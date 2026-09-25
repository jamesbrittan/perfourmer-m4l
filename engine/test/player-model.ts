import { createEngine, createScheduler, SPLITS, type LaneParams, type Scale, type Split } from "../src/index";

/**
 * A model of the Hub's native player, driven by the scheduler as the Hub drives it: it plays the two banks per Lane
 * from its table, adopts pending banks at Cycle boundaries (or at the next tick for a "now" offer), and releases a
 * Lane's Voices when told to or when it misses a boundary. Its reports, song position polls and control edits reach
 * the scheduler `latency` ticks late, as they do from Max's low-priority script thread. It plays adversarially: it takes up a pending offer the moment the scheduler starts
 * writing to its table, as if its Cycle boundary came part-way through the render.
 */

const GRID = 2;
const BANK = 10000;
const LANES = 4;
const TICKS_PER_BAR = 1920;

export const DEFAULT_LANES: LaneParams[] = [
  { hits: 5, length: 8, rotate: 0, pitchCycle: [0, 4, 2, 5], octave: 0 },
  { hits: 3, length: 8, rotate: 0, pitchCycle: [0, 2, 4], octave: -1 },
  { hits: 2, length: 5, rotate: 0, pitchCycle: [0, -3], octave: -2 },
  { hits: 7, length: 12, rotate: 0, pitchCycle: [4, 6, 7, 9, 11], octave: 0 },
].map((lane, n) => ({ rate: "1/16", transpose: 0, gate: 50, velocity: 100, accent: 0, probability: 100, mutation: 0, ...lane, seed: n + 1 }));

/** What the Hub's controls do, as the Hub passes them on. */
export type Controls = ReturnType<typeof hub>;

function hub(engine: ReturnType<typeof createEngine>, scheduler: ReturnType<typeof createScheduler>, state: HubState) {
  const configure = () => engine.configure({ lanes: state.params, scale: state.scale, resetBars: state.resetBars });
  const controls = {
    /** Hits, Length, Rotate, Rate, the Pitch Cycle, Mutation …: from the Lane's next Cycle. */
    lane(n: number, change: Partial<LaneParams>) {
      Object.assign(state.params[n], change);
      configure();
      scheduler.changed(n);
    },
    /** Gate, Velocity, Accent: from the next note. */
    articulate(n: number, change: Pick<LaneParams, "gate" | "velocity" | "accent">) {
      Object.assign(state.params[n], change);
      configure();
      scheduler.changedNow(n);
    },
    voice(n: number, voice: number, on: boolean) {
      if (!engine.setVoice(n, voice, on, scheduler.changePosition())) return;
      configure();
      for (let m = 0; m < LANES; m++) scheduler.changedNow(m);
    },
    /** A Split as Voicing Matrix clicks: the wanted Voices on first (taking them off other Lanes), then the rest off. */
    split(name: Split) {
      const layout: readonly (readonly number[])[] = SPLITS[name];
      for (let n = 0; n < LANES; n++) for (const v of layout[n] ?? []) controls.voice(n, v, true);
      for (let n = 0; n < LANES; n++)
        for (let v = 1; v <= 4; v++) if (!(layout[n] ?? []).includes(v)) controls.voice(n, v, false);
    },
    scale(scale: Scale) {
      state.scale = scale;
      configure();
      for (let n = 0; n < LANES; n++) scheduler.changed(n);
    },
    capture(n: number) {
      configure();
      engine.capture(n, scheduler.captureCycle(n));
      scheduler.changed(n);
    },
    revert(n: number) {
      engine.revert(n);
      scheduler.changed(n);
    },
  };
  return controls;
}

type HubState = { params: LaneParams[]; scale: Scale; resetBars: number };
type Note = [tick: number, id: number, velocity: number]; // id = voice * 1000 + pitch

/** A stretch of playback from `start`. The transport stops between stretches (`stopped` runs while it is stopped,
 * after the Hub has polled the new position), unless `jump`: then the song position jumps while playing. */
export type Segment = { start: number; ticks: number; jump?: boolean; stopped?: (controls: Controls) => void };
export type SimOptions = {
  /** Stretches of playback; the transport stops between them (a jump if the next starts elsewhere). */
  play: Segment[];
  resetBars?: number;
  latency?: number;
  pollEvery?: number;
  setup?: (controls: Controls) => void;
  edits?: { at: number; fn: (controls: Controls) => void }[];
};

export function simulate({ play, resetBars = 0, latency = 10, pollEvery = 100, setup, edits = [] }: SimOptions) {
  const state: HubState = {
    params: DEFAULT_LANES.map((lane) => ({ ...lane, pitchCycle: [...(lane.pitchCycle ?? [0])] })),
    scale: { root: 0, intervals: [0, 2, 4, 5, 7, 9, 11] },
    resetBars,
  };
  const engine = createEngine();
  const resetTicks = resetBars ? resetBars * TICKS_PER_BAR : 1e12;
  const table = new Map<number, number[]>();
  const noted: (number | undefined)[] = []; // the bank each Lane's player notes it's playing
  type Pending = { bank: number; ticks: number; now: boolean; release: boolean };
  const none: Pending = { bank: -1, ticks: 0, now: false, release: false };
  const pending: Pending[] = Array.from({ length: LANES }, () => none);
  const player = Array.from({ length: LANES }, () => ({ bank: -1, cycleTicks: 1, last: Infinity }));
  const stream: Note[][] = Array.from({ length: LANES }, () => []);
  const held = Array.from({ length: LANES }, () => new Set<number>());
  let running = false;
  let curTick = 0;
  let clock = 0;
  let clobbers = 0;
  const queue: [number, () => void][] = [];
  const later = (fn: () => void, delay = latency) => queue.push([clock + delay, fn]);
  const drain = () => {
    queue.sort((a, b) => a[0] - b[0]);
    while (queue.length && queue[0][0] <= clock) queue.shift()![1]();
  };

  const scheduler = createScheduler({
    engine,
    lanes: LANES,
    gridTicks: GRID,
    bankSize: BANK,
    playingBank: (n) => noted[n],
    send(command) {
      if (command.type === "offer") {
        const { lane, bank, cycleTicks, now, release } = command;
        pending[lane] = { bank, ticks: cycleTicks, now, release };
        if (bank >= 0 && !running) adopt(lane, true);
        return;
      }
      const lane = Math.floor(command.key / (2 * BANK));
      if (running && pending[lane].bank >= 0 && !pending[lane].now) adopt(lane); // the boundary came mid-render
      if (running && player[lane].bank === Math.floor(command.key / BANK) % 2) clobbers++;
      if (command.type === "remove") table.delete(command.key);
      else table.set(command.key, command.notes.flat());
    },
  });
  const controls = hub(engine, scheduler, state);

  const release = (n: number, voices: readonly number[]) => {
    for (const id of [...held[n]])
      if (voices.includes(Math.floor(id / 1000))) {
        stream[n].push([curTick, id, 0]);
        held[n].delete(id);
      }
  };
  function adopt(n: number, sync = false) {
    const p = pending[n];
    if (p.bank < 0) return;
    if (p.release) release(n, engine.releaseVoices(n));
    Object.assign(player[n], { bank: p.bank, cycleTicks: p.ticks });
    noted[n] = p.bank;
    pending[n] = none;
    const at = curTick;
    if (sync) scheduler.adopted(n, at);
    else later(() => scheduler.adopted(n, at));
  }
  const poll = (at: number) => {
    engine.retireVoiceLayout(at);
    scheduler.poll(at);
  };

  engine.configure({ lanes: state.params, scale: state.scale, resetBars });
  scheduler.start();
  setup?.(controls);
  let previous = -Infinity;
  play.forEach(({ start, ticks, jump, stopped }, i) => {
    if (!jump) {
      // stopped at the start position: the Hub keeps polling it
      curTick = start;
      for (let k = 0; k < 500; k++) {
        clock++;
        drain();
        if (k % pollEvery === 0) poll(start);
      }
      clock += latency + 1;
      drain();
      stopped?.(controls);
      running = true;
      scheduler.transport(true);
    }
    for (let tick = start; tick < start + ticks; tick += GRID) {
      clock += GRID;
      curTick = tick;
      drain();
      for (const edit of edits) if (edit.at === tick) later(() => edit.fn(controls));
      if ((tick - start) % pollEvery === 0) later(() => poll(tick));
      const contiguous = tick - previous > 0 && tick - previous <= 16;
      previous = tick;
      if (!contiguous) for (let n = 0; n < LANES; n++) release(n, [1, 2, 3, 4, 5, 6, 7, 8]); // the player jumped
      for (let n = 0; n < LANES; n++) {
        const pl = player[n];
        if (pending[n].now) adopt(n);
        const pos = (tick % resetTicks) % pl.cycleTicks;
        if (pos < pl.last && contiguous) {
          if (pending[n].bank < 0) release(n, engine.releaseVoices(n)); // missed a boundary
          adopt(n);
        }
        const at = (tick % resetTicks) % player[n].cycleTicks;
        pl.last = at;
        const m = table.get((n * 2 + pl.bank) * BANK + Math.floor(at / GRID)) ?? [];
        for (let k = 0; k < m.length; k += 3) {
          const id = m[k] * 1000 + m[k + 1];
          stream[n].push([tick, id, m[k + 2]]);
          if (m[k + 2] > 0) held[n].add(id);
          else held[n].delete(id);
        }
      }
    }
    if (play[i + 1]?.jump) return;
    // transport stop: the player releases everything it holds
    curTick = start + ticks;
    for (let n = 0; n < LANES; n++) release(n, [1, 2, 3, 4, 5, 6, 7, 8]);
    running = false;
    scheduler.transport(false);
    for (const p of player) p.last = Infinity;
    previous = -Infinity;
  });
  clock += latency + 1;
  drain();

  const heldAt = (n: number, tick: number) => {
    const on = new Map<number, number>();
    for (const [t, id, v] of stream[n]) {
      if (t >= tick) break;
      if (v > 0) on.set(id, t);
      else on.delete(id);
    }
    return on;
  };
  return { stream, clobbers, state, engine, heldAt };
}

/** What the engine says each Voice should receive between two song ticks, chaining carried note-offs from Cycle
 * to Cycle, for the settings a simulation ended with. */
export function expected(sim: ReturnType<typeof simulate>, from: number, to: number): Note[][] {
  const { params, scale, resetBars } = sim.state;
  const e = createEngine();
  e.configure({ lanes: params, scale, resetBars });
  e.setVoiceLayout(params.map((_, n) => sim.engine.laneVoices(n)));
  const resetTicks = resetBars * TICKS_PER_BAR;
  return params.map((_, n) => {
    const out: Note[] = [];
    let c = Math.max(0, e.locate(n, from).cycleIndex - 2);
    let carry: ReturnType<typeof e.cycleTable>["carry"] = [];
    for (;;) {
      const { slots, carry: next } = e.cycleTable(n, GRID, c, carry);
      const perPeriod = resetBars ? Math.ceil(resetTicks / e.cycleTicks(n)) : Infinity;
      const start = resetBars
        ? Math.floor(c / perPeriod) * resetTicks + (c % perPeriod) * e.cycleTicks(n)
        : c * e.cycleTicks(n);
      if (start >= to) break;
      for (const { slot, notes } of slots) {
        // the player samples even ticks and reads slot floor(position / 2): slot s is read on the first tick at or after it
        const tick = GRID * Math.ceil((start + slot * GRID) / GRID - 1e-9);
        if (tick >= from && tick < to) for (const [voice, p, v] of notes) out.push([tick, voice * 1000 + p, v]);
      }
      carry = next;
      c++;
    }
    return out.sort((a, b) => a[0] - b[0]);
  });
}

export const between = (sim: ReturnType<typeof simulate>, from: number, to: number) =>
  sim.stream.map((notes) => notes.filter(([t]) => t >= from && t < to));
