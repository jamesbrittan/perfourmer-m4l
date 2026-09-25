import { describe, expect, it } from "vitest";
import { createEngine, createScheduler } from "../src/index";
import { between, expected, simulate, type Controls, type SimOptions } from "./player-model";

const BAR = 1920;
const gap = (gate: number) => (c: Controls) => [0, 1, 2, 3].forEach((n) => c.articulate(n, { gate, velocity: 90, accent: 20 }));

/** Notes a Lane still holds at `tick` that began long enough ago to be hanging (tied notes may rightly last). */
function hanging(sim: ReturnType<typeof simulate>, tick: number) {
  return sim.lanes().flatMap((p, n) =>
    (p.gate ?? 50) >= 100
      ? []
      : [...sim.heldAt(n, tick)].filter(([, since]) => tick - since > 2 * sim.engine.cycleTicks(n) + 2 * BAR),
  );
}

describe("The player, fed by the scheduler", () => {
  const scenarios: [string, Partial<SimOptions> & { start?: number }][] = [
    ["from the song start", {}],
    ["from mid-song, with a Reset every 3 bars", { start: BAR * 37 + 480, resetBars: 3 }],
    ["with tied notes", { setup: gap(100) }],
    ["with gap gates and a Reset every bar", { setup: gap(60), resetBars: 1, start: BAR * 3 }],
    ["with tied notes and a slow script thread", { setup: gap(100), latency: 40 }],
    ["with 7th chords over four Voices", { setup: (c) => (gap(100)(c), c.lane(0, { chordShape: "7th" }), c.split("4")) }],
    ["round-robin over four Voices", { resetBars: 1, start: BAR * 9, setup: (c) => (c.lane(0, { groupMode: "round-robin" }), c.split("4")) }],
    ["with a unison pair", { setup: (c) => (gap(60)(c), c.lane(2, { groupMode: "unison" }), c.split("1+1+2")) }],
    ["with Mutation and probability", { setup: (c) => (gap(80)(c), [0, 1, 2, 3].forEach((n) => c.lane(n, { probability: 60, mutation: 127, seed: n }))) }],
  ];
  for (const [label, { start = 0, ...options }] of scenarios)
    it(`plays exactly the engine's notes ${label}`, () => {
      const ticks = BAR * 12;
      const sim = simulate({ play: [{ start, ticks }], ...options });
      expect(between(sim, start + BAR, start + ticks - 480)).toEqual(expected(sim, start + BAR, start + ticks - 480));
      expect(sim.clobbers).toBe(0);
    });

  it("hears a Gate change from the next note, and ends the notes already sounding", () => {
    const edits = [{ at: BAR * 4 + 300, fn: gap(100) }, { at: BAR * 6 + 1000, fn: gap(20) }];
    const sim = simulate({ play: [{ start: 0, ticks: BAR * 10 }], edits });
    expect(between(sim, BAR * 8, BAR * 10 - 480)).toEqual(expected(sim, BAR * 8, BAR * 10 - 480));
    expect(sim.clobbers).toBe(0);
    expect(hanging(sim, BAR * 10)).toEqual([]);
  });

  it("releases a Lane whose Cycle length or Reset changes, and settles on the new Cycles", () => {
    const edits = [
      { at: BAR * 3 + 700, fn: (c: Controls) => c.lane(0, { length: 7, rate: "1/8T" }) },
      { at: BAR * 3 + 900, fn: (c: Controls) => c.articulate(0, { gate: 100 }) },
      { at: BAR * 5 + 100, fn: (c: Controls) => c.lane(3, { length: 5, rate: "1/16S" }) },
    ];
    const sim = simulate({ play: [{ start: 0, ticks: BAR * 12 }], resetBars: 2, edits });
    expect(between(sim, BAR * 8, BAR * 12 - 480)).toEqual(expected(sim, BAR * 8, BAR * 12 - 480));
    expect(sim.clobbers).toBe(0);
    expect(hanging(sim, BAR * 12)).toEqual([]);
  });

  it("starts again where the transport stopped", () => {
    const sim = simulate({ play: [{ start: 0, ticks: BAR * 3 + 500 }, { start: BAR * 3 + 500, ticks: BAR * 6 }], setup: gap(80) });
    const [from, to] = [BAR * 3 + 502, BAR * 9 + 20]; // from just after the stop's own note-offs
    expect(between(sim, from, to)).toEqual(expected(sim, from, to));
  });

  it("follows a jump in song position", () => {
    const sim = simulate({ play: [{ start: BAR * 2, ticks: BAR * 4 }, { start: BAR * 41 + 360, ticks: BAR * 6 }], resetBars: 4 });
    const [from, to] = [BAR * 41 + 360, BAR * 47];
    expect(between(sim, from, to)).toEqual(expected(sim, from, to));
    expect(sim.clobbers).toBe(0);
  });

  it("follows a jump while playing, without leaving notes hanging", () => {
    const sim = simulate({ play: [{ start: 0, ticks: BAR * 3 + 700 }, { start: BAR * 20, ticks: BAR * 6, jump: true }], setup: gap(90) });
    const [from, to] = [BAR * 22, BAR * 26 - 480];
    expect(between(sim, from, to)).toEqual(expected(sim, from, to));
    expect(sim.clobbers).toBe(0);
    expect(hanging(sim, BAR * 26)).toEqual([]);
  });

  describe("Capture", () => {
    const CYCLE = 960; // Lane 1: 8 × 1/16
    const heard = (sim: ReturnType<typeof simulate>, c: number) =>
      sim.stream[0].filter(([t, , v]) => v > 0 && t >= CYCLE * c && t < CYCLE * (c + 1)).map(([t, id]) => [t % CYCLE, id]);

    it("while playing takes the Cycle sounding, which then repeats at Mutation 0", () => {
      const sim = simulate({
        play: [{ start: 0, ticks: CYCLE * 20 }],
        setup: (c) => c.lane(0, { mutation: 127 }),
        edits: [
          { at: CYCLE * 10 + 400, fn: (c) => c.capture(0) },
          { at: CYCLE * 11 + 400, fn: (c) => c.lane(0, { mutation: 0 }) },
        ],
      });
      const captured = heard(sim, 10);
      expect(captured.length).toBeGreaterThan(0);
      for (const c of [14, 17, 19]) expect(heard(sim, c)).toEqual(captured);
    });

    it("while stopped takes the Cycle at the song position", () => {
      const sim = simulate({
        play: [
          { start: CYCLE * 6, ticks: CYCLE },
          { start: CYCLE * 6 + 300, ticks: 2, stopped: (c) => (c.capture(0), c.lane(0, { mutation: 0 })) },
          { start: CYCLE * 12, ticks: CYCLE * 4 },
        ],
        setup: (c) => c.lane(0, { mutation: 127 }),
      });
      const captured = heard(sim, 6);
      expect(captured.length).toBeGreaterThan(0);
      for (const c of [12, 13, 15]) expect(heard(sim, c)).toEqual(captured);
    });
  });
});

describe("Timing a change to the bar", () => {
  it("counts from the latest song position known: the last poll or the last Cycle boundary a Lane reported", () => {
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 1, length: 4, rotate: 0 }] }); // 480-tick Cycles
    const scheduler = createScheduler({ engine, lanes: 1, gridTicks: 2, bankSize: 10000, playingBank: () => 0, send() {} });
    expect(scheduler.changePosition()).toBeUndefined(); // stopped: at once
    scheduler.transport(true);
    scheduler.poll(1000);
    expect(scheduler.changePosition()).toBe(1000);
    scheduler.adopted(0, 1440);
    expect(scheduler.changePosition()).toBe(1440);
    scheduler.poll(1500);
    expect(scheduler.changePosition()).toBe(1500);
  });
});

describe("Random edits while playing", () => {
  it("never write into a playing bank, never leave a note hanging, and settle on exactly the engine's notes", () => {
    let seed = 5;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const scales = [[0, 2, 4, 5, 7, 9, 11], [0, 3, 5, 7, 10], [0, 2, 3, 5, 7, 8, 10]];
    const splits = ["1+1+1+1", "4", "1+3", "2+2", "1+1+2"] as const;
    const rates = ["1/1", "1/2", "1/4", "1/4T", "1/8", "1/8T", "1/16", "1/16Q", "1/16T", "1/16S", "1/32", "1/32Q"] as const;
    const problems: string[] = [];
    for (let trial = 0; trial < 60; trial++) {
      const start = 2 * Math.floor(rand() * 50000);
      const resetBars = Math.floor(rand() * 3);
      const edits: SimOptions["edits"] = [];
      for (let i = 0; i < 150; i++) {
        const at = start + 2 * Math.floor(rand() * 960 * 8);
        const n = Math.floor(rand() * 4);
        const kind = Math.floor(rand() * 8);
        const v = Array.from({ length: 9 }, () => rand());
        const fn = (c: Controls) => {
          if (kind === 0) c.lane(n, { pitchCycle: v.slice(1, 2 + Math.floor(v[0] * 8)).map((x) => Math.floor(x * 15) - 7) });
          else if (kind === 1) c.lane(n, { hits: 1 + Math.floor(v[0] * 5), length: 1 + Math.floor(v[1] * 8), rotate: Math.floor(v[2] * 4), rate: rates[Math.floor(v[3] * 12)] });
          else if (kind === 2) c.lane(n, { transpose: Math.floor(v[0] * 5) - 2, octave: Math.floor(v[1] * 3) - 1 });
          else if (kind === 3) c.articulate(n, { gate: 1 + Math.floor(v[1] * 100), velocity: 1 + Math.floor(v[2] * 127), accent: Math.floor(v[3] * 40) });
          else if (kind === 4) c.scale({ root: 0, intervals: scales[Math.floor(v[0] * 3)] });
          else if (kind === 5) c.lane(n, { probability: Math.floor(v[0] * 101), mutation: Math.floor(v[1] * 128), seed: Math.floor(v[2] * 50) });
          else if (kind === 6) c.split(splits[Math.floor(v[0] * 5)]);
          else c.lane(n, { groupMode: (["poly", "round-robin", "unison"] as const)[Math.floor(v[0] * 3)], chordShape: (["unison", "5th", "triad", "7th"] as const)[Math.floor(v[1] * 4)] });
        };
        edits.push({ at, fn });
      }
      const bars = 16;
      const latency = 1 + Math.floor(rand() * 40);
      const end = start + BAR * bars;
      const sim = simulate({ play: [{ start, ticks: BAR * bars }], resetBars, latency, edits });
      if (sim.clobbers) problems.push(`trial ${trial}: ${sim.clobbers} writes into a playing bank`);
      if (hanging(sim, end).length) problems.push(`trial ${trial}: hanging notes ${JSON.stringify(hanging(sim, end))}`);
      // Judge the last bars, long after the last edit. Cycles longer than that can't be judged, nor Cycles shorter than
      // the script's round trip: a Cycle is rendered as the one before it starts, so those play a Cycle behind.
      const judged = (n: number) => sim.engine.cycleTicks(n) <= BAR * 3 && sim.engine.cycleTicks(n) > 3 * latency + 20;
      const [from, to] = [start + BAR * (bars - 4), end - 480];
      const want = expected(sim, from, to);
      const got = between(sim, from, to);
      const close = (w: number[][], g: number[][]) =>
        w.length === g.length && w.every((x, j) => Math.abs(x[0] - g[j][0]) <= 2 && x[1] === g[j][1] && x[2] === g[j][2]);
      want.forEach((w, n) => {
        if (judged(n) && !close(w, got[n])) problems.push(`trial ${trial}: lane ${n + 1} unsettled`);
      });
    }
    expect(problems).toEqual([]);
  });
});
