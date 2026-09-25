import { uniformInt } from "pure-rand/distribution/uniformInt";
import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus";

/** tie: the note lasts right up to the next one (gap gate at 100%), so the two join legato. */
export type Event = { onset: number; duration: number; pitch: number; velocity: number; voice: number; tie?: boolean };
/** Step length in ticks at 480 PPQ, slowest first. Q = quintuplet, T = triplet, S = septuplet. */
const RATE_TICKS = {
  "1/1": 1920,
  "1/2": 960,
  "1/4": 480,
  "1/4T": 320,
  "1/8": 240,
  "1/8T": 160,
  "1/16": 120,
  "1/16Q": 96,
  "1/16T": 80,
  "1/16S": 480 / 7,
  "1/32": 60,
  "1/32Q": 48,
} as const;
export type Rate = keyof typeof RATE_TICKS;
/** Rate names in menu order (slowest first); the Hub's Rate control indexes into this. */
export const RATES = Object.keys(RATE_TICKS) as Rate[];
/** pitchCycle: scale degrees, one per hit (0 = the Scale's root nearest middle C), shifted by transpose
 * degrees and octave octaves. gate runs from short to tied: up to 50% it is that percentage of one step; from 50%
 * to 100% the note stretches from half a step to the whole gap to the next hit, and at 100% it ties into the next.
 * accent: velocity added to the first hit of each Cycle (0 = none).
 * probability: % chance each hit sounds; mutation: 0 (the Base every Cycle) to 127 (a new pattern every Cycle);
 * seed: picks the path Mutation and probability take. */
export type LaneParams = {
  hits: number;
  length: number;
  rotate: number;
  rate?: Rate;
  pitchCycle?: number[];
  transpose?: number;
  octave?: number;
  probability?: number;
  mutation?: number;
  seed?: number;
  gate?: number;
  velocity?: number;
  accent?: number;
};
/** Live's global scale: root 0–11 (C = 0) and the semitone intervals of its notes. */
export type Scale = { root: number; intervals: number[] };
/** resetBars 0 = never; ticksPerBar follows Live's time signature (4/4 = 1920). */
export type EngineConfig = { lanes: LaneParams[]; scale?: Scale; resetBars?: number; ticksPerBar?: number };
/** One player grid slot: the [voice, pitch, velocity] messages due there (velocity 0 = note-off). */
export type Slot = { slot: number; notes: [number, number, number][] };
/** A note-off that falls past the end of a Cycle, due at `slot` of the next one. */
export type Carry = { slot: number; voice: number; pitch: number; tie: boolean };
export type CycleTable = { slots: Slot[]; carry: Carry[] };

const MIDDLE_C = 60;
const C_MAJOR: Scale = { root: 0, intervals: [0, 2, 4, 5, 7, 9, 11] };

/** Bjorklund's algorithm: the Euclidean rhythms as tabulated by Toussaint (first hit on step 0). */
function bjorklund(hits: number, length: number): boolean[] {
  hits = Math.max(0, Math.min(hits, length));
  if (hits === 0 || hits === length) return Array.from({ length }, () => hits > 0);
  let groups: boolean[][] = Array.from({ length: hits }, () => [true]);
  let remainder: boolean[][] = Array.from({ length: length - hits }, () => [false]);
  do {
    const pairs = Math.min(groups.length, remainder.length);
    const leftover = groups.length > pairs ? groups.slice(pairs) : remainder.slice(pairs);
    groups = groups.slice(0, pairs).map((g, i) => g.concat(remainder[i]));
    remainder = leftover;
  } while (remainder.length > 1);
  return groups.concat(remainder).flat();
}

type Note = Omit<Event, "voice">;

/** One RNG seed per (Lane seed, Cycle). */
const mix = (seed: number, cycleIndex: number) => (Math.imul(seed + 1, 0x9e3779b1) ^ Math.imul(cycleIndex + 1, 0x85ebca6b)) | 0;

const clampToMidi = (note: number) => Math.max(0, Math.min(127, note));

/** A scale degree as a MIDI note: degrees past the Scale's last note carry on into the next octave. */
function degreeToNote(degree: number, { root, intervals }: Scale): number {
  const octave = Math.floor(degree / intervals.length);
  const index = degree - octave * intervals.length;
  return MIDDLE_C + root + intervals[index] + 12 * octave;
}

/** Voice Layout: which Voice plays each of a Lane's notes. The MVP layout is 4×mono (Lane n → Voice n). */
function allocate(lane: number, notes: Note[]): Event[] {
  return notes.map((note) => ({ ...note, voice: lane + 1 }));
}

/** A Captured Base: which steps hit, and a scale degree for every step (a rest step keeps the previous hit's). */
type Captured = { steps: boolean[]; degrees: number[] };
/** The controls a Captured Base was taken under; changing any of them hands the Lane back to its controls. */
const signature = ({ hits, length, rotate, pitchCycle = [0] }: LaneParams) => [hits, length, rotate, pitchCycle.length, ...pitchCycle];

export function createEngine() {
  let lanes: LaneParams[] = [];
  const captures = new Map<number, { signature: number[]; stack: Captured[] }>(); // Lane -> Bases, newest last
  let scale = C_MAJOR;
  let resetTicks = 0; // 0 = Lanes never realign
  const voiceDevices = new Map<number, number>(); // Voice device id -> Voice number

  /**
   * The hits that sound in a Cycle, as onsets and scale degrees (before transpose). Each Cycle starts again from
   * the Base (Euclidean pattern + Pitch Cycle): with probability mutation/127, each step is re-decided (a hit with
   * the Base's density, hits/length) and each hit's degree is redrawn within the Pitch Cycle's range ±3 degrees;
   * then each hit sounds with the Lane's probability. The draws come from an RNG seeded by (seed, cycleIndex), a
   * fixed number per step, so a Cycle is reproducible from song position whatever the other settings.
   */
  function cycleHits(lane: number, cycleIndex: number, evolve = true): { onset: number; degree: number }[] {
    const { hits, length, rotate, pitchCycle = [0], seed = 0 } = lanes[lane];
    const { mutation, probability } = evolve ? { mutation: 0, probability: 100, ...lanes[lane] } : { mutation: 0, probability: 100 };
    const stack = captures.get(lane)?.stack;
    const captured = stack?.[stack.length - 1];
    const pattern = bjorklund(hits, length);
    const shift = rotate % length;
    const base = captured?.steps ?? pattern.map((_, step) => pattern[(step - shift + length) % length]);
    const rng = xoroshiro128plus(mix(seed, cycleIndex));
    const chance = () => uniformInt(rng, 0, 99999) / 100000;
    const register = captured?.degrees ?? pitchCycle;
    const [lo, hi] = [Math.min(...register) - 3, Math.max(...register) + 3];
    const baseHits = base.filter(Boolean).length;
    const density = captured ? baseHits / length : hits / length;
    let hitIndex = cyclesSinceReset(lane, cycleIndex) * baseHits; // the Pitch Cycle realigns at each Reset
    const step = stepTicks(lane);
    const end = playedTicks(lane, cycleIndex);
    const sounding: { onset: number; degree: number }[] = [];
    base.forEach((isHit, i) => {
      const [stepDraw, hitDraw, pitchDraw, degreeDraw, soundDraw] = [chance(), chance(), chance(), chance(), chance()];
      const hit = stepDraw < mutation / 127 ? hitDraw < density : isHit;
      if (!hit) return;
      const baseDegree = captured ? captured.degrees[i] : pitchCycle[hitIndex++ % pitchCycle.length];
      const degree = pitchDraw < mutation / 127 ? lo + Math.floor(degreeDraw * (hi - lo + 1)) : baseDegree;
      const onset = i * step;
      // a dropped hit still uses up its Pitch Cycle step; hits from a Reset cut on are never reached
      if (soundDraw * 100 < probability && onset < end - 1e-6) sounding.push({ onset, degree });
    });
    return sounding;
  }

  function renderCycle(lane: number, cycleIndex: number): Event[] {
    const { transpose = 0, octave = 0, gate = 50, velocity = 100, accent = 0 } = lanes[lane];
    const step = stepTicks(lane);
    const end = playedTicks(lane, cycleIndex);
    const sounding = cycleHits(lane, cycleIndex);
    // the gap after the last hit runs to the next Cycle's first hit
    const next = cycleHits(lane, cycleIndex + 1)[0]?.onset ?? playedTicks(lane, cycleIndex + 1);
    const gaps = sounding.map(({ onset }, i) => (i + 1 < sounding.length ? sounding[i + 1].onset : end + next) - onset);
    const tie = gate >= 100;
    const noteLength = (gap: number) =>
      gate <= 50 ? (step * gate) / 100 : step / 2 + ((gap - step / 2) * (gate - 50)) / 50; // short … half a step … tied
    const notes = sounding.map(({ onset, degree }, hit) => ({
      onset,
      duration: noteLength(gaps[hit]),
      pitch: clampToMidi(degreeToNote(degree + transpose, scale) + 12 * octave),
      velocity: Math.max(1, Math.min(127, velocity + (hit === 0 ? accent : 0))),
      ...(tie && { tie }),
    }));
    return allocate(lane, notes);
  }

  function stepTicks(lane: number): number {
    return RATE_TICKS[lanes[lane].rate ?? "1/16"];
  }

  function cycleTicks(lane: number): number {
    return lanes[lane].length * stepTicks(lane);
  }

  /** How much of a Cycle is played: all of it, unless a Reset cuts it short. */
  function playedTicks(lane: number, cycleIndex: number): number {
    const cycle = cycleTicks(lane);
    return resetTicks ? Math.min(cycle, resetTicks - cyclesSinceReset(lane, cycleIndex) * cycle) : cycle;
  }

  /** Cycles per Reset period (the last one may be cut short); Cycle numbers keep rising across Resets. */
  function cyclesPerPeriod(lane: number): number {
    return resetTicks ? Math.ceil(resetTicks / cycleTicks(lane)) : Infinity;
  }

  function cyclesSinceReset(lane: number, cycleIndex: number): number {
    return cycleIndex % cyclesPerPeriod(lane);
  }

  /** Where a Lane is at a song position: which Cycle, and how far into it. */
  function locate(lane: number, songTicks: number) {
    const cycle = cycleTicks(lane);
    const period = resetTicks ? Math.floor(songTicks / resetTicks) : 0;
    const sinceReset = resetTicks ? songTicks % resetTicks : songTicks;
    return {
      cycleIndex: (period ? period * cyclesPerPeriod(lane) : 0) + Math.floor(sinceReset / cycle),
      offsetTicks: sinceReset % cycle,
    };
  }

  /**
   * A Cycle as the fine-grid player reads it: messages grouped by grid slot, in slot order, plus the note-offs
   * that fall past its end (`carry`, to hand to the next Cycle's table as `carried`).
   * Within a slot, a note-off for a pitch that starts again there comes first (a clean retrigger); other note-offs
   * come after the note-ons, so consecutive notes join legato. A tied note running into the same pitch is simply
   * held: neither its note-off nor the next note-on is sent.
   * `replacing` is the table this one takes over from part-way through the Cycle (after a Gate change): its
   * note-offs that come later than the new ones are kept (including those it carried into the next Cycle), so a
   * note already sounding is still ended.
   */
  function cycleTable(
    lane: number,
    gridTicks: number,
    cycleIndex = 0,
    carried: Carry[] = [],
    replacing: CycleTable = { slots: [], carry: [] },
  ): CycleTable {
    // The player reads slot floor(position / grid) on ticks one grid step apart, so from each Cycle's start it
    // reaches slots 0, 1, 2, … in turn. When Cycles aren't a whole number of slots (septuplets), a Cycle can start
    // up to a slot's width before its first tick, so its last slot isn't always reached: anything due there goes
    // into the next Cycle.
    const slotOf = (tick: number) => Math.floor(tick / gridTicks + 1e-9);
    const end = playedTicks(lane, cycleIndex);
    const aligned = Number.isInteger(cycleTicks(lane) / gridTicks) && Number.isInteger(end / gridTicks);
    const lastSlot = aligned ? end / gridTicks - 1 : Math.ceil(end / gridTicks) - 2;
    const nextCycleSlot = (tick: number) => Math.max(0, slotOf(tick - end));
    type Off = { slot: number; voice: number; pitch: number; tie: boolean };
    const ons: Event[] = renderCycle(lane, cycleIndex);
    const carry: Carry[] = [];
    // a carried note-off due after this Cycle's end (a Reset cut it short) is carried on again
    const offs: Off[] = carried.filter((off) => off.slot <= lastSlot);
    for (const off of carried) if (off.slot > lastSlot) carry.push({ ...off, slot: nextCycleSlot(off.slot * gridTicks) });
    for (const e of ons) {
      const off = { voice: e.voice, pitch: e.pitch, tie: Boolean(e.tie) };
      const tick = e.onset + e.duration;
      // an off at (or within half a slot of) the Cycle's end belongs to the next Cycle, after its first note-on
      const slot = Math.max(slotOf(tick), slotOf(e.onset) + 1); // never in its own note-on's slot
      if (slot > lastSlot) carry.push({ ...off, slot: nextCycleSlot(tick) });
      else offs.push({ ...off, slot });
    }
    const held = (off: Off) => (e: Event) =>
      off.tie && slotOf(e.onset) === off.slot && e.voice === off.voice && e.pitch === off.pitch;
    const skippedOns = new Set<Event>();
    const sentOffs = offs.filter((off) => {
      const continued = ons.find(held(off));
      if (continued) skippedOns.add(continued);
      return !continued;
    });
    const sent = new Set(sentOffs);
    // A note the replaced table started ends at its old note-off unless the new table has the very same note
    // (same start slot, Voice and pitch) and ends it later. Erring this way can end a note early during edits,
    // never leave one hanging.
    const oldOns = replacing.slots.flatMap(({ slot, notes }) =>
      notes.filter(([, , velocity]) => velocity > 0).map(([voice, pitch]) => ({ slot, voice, pitch })),
    );
    const newEnd = (on: { slot: number; voice: number; pitch: number }) => {
      const e = ons.find((x) => slotOf(x.onset) === on.slot && x.voice === on.voice && x.pitch === on.pitch);
      if (!e || skippedOns.has(e)) return -Infinity;
      const off = offs.find((o) => o.voice === e.voice && o.pitch === e.pitch && o.slot > on.slot);
      if (off) return sent.has(off) ? off.slot : Infinity;
      return carry.some((c) => c.voice === e.voice && c.pitch === e.pitch) ? Infinity : -Infinity;
    };
    for (const { slot, notes } of replacing.slots)
      for (const [voice, pitch, velocity] of notes) {
        if (velocity !== 0) continue;
        const started = oldOns.filter((o) => o.voice === voice && o.pitch === pitch && o.slot < slot).pop();
        const duplicate = sentOffs.some((o) => o.slot === slot && o.voice === voice && o.pitch === pitch);
        if (!duplicate && !(started && newEnd(started) >= slot)) sentOffs.push({ slot, voice, pitch, tie: false });
      }
    const slots = new Map<number, Slot["notes"]>();
    const add = (slot: number, note: [number, number, number]) => slots.set(slot, [...(slots.get(slot) ?? []), note]);
    const onsAt = (slot: number) => ons.filter((e) => !skippedOns.has(e) && slotOf(e.onset) === slot);
    const retriggers = (off: Off) => onsAt(off.slot).some((e) => e.voice === off.voice && e.pitch === off.pitch);
    for (const off of sentOffs.filter(retriggers)) add(off.slot, [off.voice, off.pitch, 0]);
    for (const e of ons) if (!skippedOns.has(e)) add(slotOf(e.onset), [e.voice, e.pitch, e.velocity]);
    for (const off of sentOffs.filter((off) => !retriggers(off))) add(off.slot, [off.voice, off.pitch, 0]);
    const same = (a: Carry) => (b: Carry) => a.voice === b.voice && a.pitch === b.pitch;
    const identical = (a: Carry) => (b: Carry) => same(a)(b) && a.slot === b.slot && a.tie === b.tie;
    for (const old of replacing.carry) if (!carry.some(identical(old))) carry.push({ ...old, tie: false });
    return { slots: [...slots].sort(([a], [b]) => a - b).map(([slot, notes]) => ({ slot, notes })), carry };
  }

  function slotTable(lane: number, gridTicks: number, cycleIndex = 0): Slot[] {
    return cycleTable(lane, gridTicks, cycleIndex).slots;
  }

  return {
    configure(config: EngineConfig) {
      lanes = config.lanes;
      for (const [lane, { signature: taken }] of captures)
        if (!lanes[lane] || signature(lanes[lane]).join() !== taken.join()) captures.delete(lane);
      scale = config.scale ?? C_MAJOR;
      resetTicks = (config.resetBars ?? 0) * (config.ticksPerBar ?? 1920);
    },
    cycleTicks,
    locate,
    renderCycle,
    cycleTable,
    slotTable,
    /** Make the Cycle's sounding pattern the Lane's new Base (the previous one is kept for Revert). */
    capture(lane: number, cycleIndex: number) {
      const { length } = lanes[lane];
      const heard = cycleHits(lane, cycleIndex);
      const step = stepTicks(lane);
      const steps = Array.from({ length }, (_, i) => heard.some((h) => Math.round(h.onset / step) === i));
      const degreeAt = new Map(heard.map((h) => [Math.round(h.onset / step), h.degree]));
      const last = heard[heard.length - 1]?.degree ?? (lanes[lane].pitchCycle ?? [0])[0];
      let held = last; // rests before the first hit carry the last hit's degree round
      const degrees = steps.map((_, i) => (held = degreeAt.get(i) ?? held));
      const entry = captures.get(lane) ?? { signature: signature(lanes[lane]), stack: [] };
      entry.stack.push({ steps, degrees });
      captures.set(lane, entry);
    },
    /** Go back to the Base from before the last Capture. */
    revert(lane: number) {
      const entry = captures.get(lane);
      entry?.stack.pop();
      if (entry && !entry.stack.length) captures.delete(lane);
    },
    /** Whether Mutation or probability make the Cycle depart from the Base. */
    isMutated(lane: number, cycleIndex: number) {
      return JSON.stringify(cycleHits(lane, cycleIndex)) !== JSON.stringify(cycleHits(lane, cycleIndex, false));
    },
    /** Every Lane's Captured Bases as plain numbers, for storing with the set. */
    saveBases(): number[] {
      const out = [1, captures.size];
      for (const [lane, { signature: taken, stack }] of captures) {
        out.push(lane, taken.length, ...taken, stack.length);
        for (const { steps, degrees } of stack) out.push(steps.length, ...steps.map(Number), ...degrees);
      }
      return out;
    },
    loadBases(data: number[]) {
      captures.clear();
      if (data[0] !== 1) return;
      let i = 2;
      for (let n = 0; n < data[1]; n++) {
        const lane = data[i++];
        const taken = data.slice(i + 1, i + 1 + data[i]);
        i += 1 + taken.length;
        const stack: Captured[] = [];
        for (let depth = data[i++]; depth > 0; depth--) {
          const length = data[i++];
          stack.push({ steps: data.slice(i, i + length).map(Boolean), degrees: data.slice(i + length, i + 2 * length) });
          i += 2 * length;
        }
        captures.set(lane, { signature: taken, stack });
      }
    },
    voiceJoined(deviceId: number, voice: number) {
      voiceDevices.set(deviceId, voice);
    },
    voiceLeft(deviceId: number) {
      voiceDevices.delete(deviceId);
    },
    voiceStatus() {
      const claims = new Map<number, number>();
      for (const voice of voiceDevices.values()) claims.set(voice, (claims.get(voice) ?? 0) + 1);
      const connected = [...claims.keys()].sort((a, b) => a - b);
      return { connected, duplicates: connected.filter((voice) => claims.get(voice)! > 1) };
    },
  };
}
