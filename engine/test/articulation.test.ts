import { describe, expect, it } from "vitest";
import { createEngine, type CycleTable, type LaneParams } from "../src/index";

function cycle(lane: Partial<LaneParams>, cycleIndex = 0, resetBars = 0) {
  const engine = createEngine();
  engine.configure({ lanes: [{ hits: 3, length: 8, rotate: 0, ...lane }], resetBars });
  return engine.renderCycle(0, cycleIndex);
}

describe("Step gate", () => {
  it("lasts a percentage of one step, whatever the gap to the next hit", () => {
    expect(cycle({ gateMode: "step", gate: 25 }).map((e) => e.duration)).toEqual([30, 30, 30]);
    expect(cycle({ gateMode: "step", gate: 100, rate: "1/8" }).map((e) => e.duration)).toEqual([240, 240, 240]);
  });
});

describe("Velocity and accent", () => {
  it("plays every hit at the Lane's velocity", () => {
    expect(cycle({ velocity: 90 }).map((e) => e.velocity)).toEqual([90, 90, 90]);
  });

  it("adds the accent to the first hit of each Cycle only, up to 127", () => {
    expect(cycle({ velocity: 90, accent: 20 }).map((e) => e.velocity)).toEqual([110, 90, 90]);
    expect(cycle({ velocity: 90, accent: 20, rotate: 1 }).map((e) => e.velocity)).toEqual([110, 90, 90]);
    expect(cycle({ velocity: 120, accent: 20 }, 3).map((e) => e.velocity)).toEqual([127, 120, 120]);
  });
});

describe("Gap gate", () => {
  it("lasts a percentage of the gap to the next hit, so a sparse pattern gets mixed note lengths", () => {
    // x..x..x. : gaps of 3, 3 and 2 steps (the last one wraps round to the next Cycle's first hit)
    expect(cycle({ gateMode: "gap", gate: 50 }).map((e) => e.duration)).toEqual([180, 180, 120]);
    // .x..x..x : the last gap runs to step 1 of the next Cycle
    expect(cycle({ gateMode: "gap", gate: 50, rotate: 1 }).map((e) => e.duration)).toEqual([180, 180, 120]);
  });

  it("at 100% ends each note exactly where the next begins, and marks it as tied", () => {
    const events = cycle({ gateMode: "gap", gate: 100 });
    expect(events.map((e) => e.onset + e.duration)).toEqual([360, 720, 960]);
    expect(events.every((e) => e.tie)).toBe(true);
    expect(cycle({ gateMode: "gap", gate: 99 }).some((e) => e.tie)).toBe(false);
  });

  it("measures the last gap to where a Reset cuts the Cycle short, and drops hits the Reset cuts off", () => {
    // x...x...x... is 1440 ticks; a Reset every bar (1920) cuts every second Cycle to 480 ticks
    const cut = cycle({ hits: 3, length: 12, gateMode: "gap", gate: 100 }, 1, 1);
    expect(cut.map((e) => [e.onset, e.duration])).toEqual([[0, 480]]);
  });
});

describe("Player table with ties", () => {
  const table = (lane: Partial<LaneParams>, cycleIndex = 0, carried: Parameters<ReturnType<typeof createEngine>["cycleTable"]>[3] = []) => {
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 3, length: 8, rotate: 0, gateMode: "gap", gate: 100, ...lane }] });
    return engine.cycleTable(0, 2, cycleIndex, carried);
  };
  const at = (slots: { slot: number; notes: number[][] }[], slot: number) => slots.find((s) => s.slot === slot)?.notes;

  it("starts the next note before ending the last one, so different pitches join legato", () => {
    const { slots } = table({ pitchCycle: [0, 2, 4] });
    expect(at(slots, 180)).toEqual([[1, 64, 100], [1, 60, 0]]);
  });

  it("holds a note straight through when it ties into the same pitch", () => {
    const { slots } = table({ pitchCycle: [0] });
    expect(slots).toEqual([{ slot: 0, notes: [[1, 60, 100]] }]);
  });

  it("carries a note-off past the Cycle's end into the next Cycle, after that Cycle's first note starts", () => {
    const lane = { pitchCycle: [0, 2, 4, 5] };
    const first = table(lane, 0);
    expect(first.carry).toEqual([{ slot: 0, voice: 1, pitch: 67, tie: true }]);
    const next = table(lane, 1, first.carry);
    expect(at(next.slots, 0)).toEqual([[1, 69, 100], [1, 67, 0]]);
  });

  it("keeps a tie going across the Cycle boundary", () => {
    const first = table({ pitchCycle: [0] }, 0);
    expect(table({ pitchCycle: [0] }, 1, first.carry).slots).toEqual([]);
  });

  it("ends a carried note that isn't tied before restarting the same pitch", () => {
    const next = table({ pitchCycle: [0], gate: 50 }, 1, [{ slot: 0, voice: 1, pitch: 60, tie: false }]);
    expect(at(next.slots, 0)).toEqual([[1, 60, 0], [1, 60, 100]]);
  });
});

describe("Replacing the playing Cycle mid-way (a Gate change)", () => {
  const table = (gate: number, replacing?: CycleTable) => {
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 3, length: 8, rotate: 0, gateMode: "gap", gate, pitchCycle: [0, 2, 4] }] });
    return engine.cycleTable(0, 2, 0, [], replacing);
  };
  const build = (gate: number, replacing?: number) =>
    table(gate, replacing === undefined ? undefined : table(replacing)).slots;
  const offs = (slots: { slot: number; notes: number[][] }[]) =>
    slots.flatMap((s) => s.notes.filter(([, , v]) => v === 0).map(([, pitch]) => [s.slot, pitch]));

  it("keeps the old note-offs of a shortened gate, so a note already sounding still ends", () => {
    const shorter = build(50, 100);
    expect(offs(shorter)).toEqual([[90, 60], [180, 60], [270, 64], [360, 64], [420, 67]]);
  });

  it("keeps old note-offs when a legato gate is shortened", () => {
    const shorter = build(80, 100);
    expect(offs(shorter)).toEqual([[144, 60], [180, 60], [324, 64], [360, 64], [456, 67]]);
  });

  it("doesn't cut a lengthened note at its old, earlier end", () => {
    expect(build(100, 50)).toEqual(build(100));
  });

  it("still ends a note whose old note-off was carried into the next Cycle", () => {
    expect(table(50, table(100)).carry).toEqual([{ slot: 0, voice: 1, pitch: 67, tie: false }]);
    expect(table(100, table(50)).carry).toEqual([{ slot: 0, voice: 1, pitch: 67, tie: true }]);
  });
});

describe("Very short gates", () => {
  it("still end each note at least one grid slot after it starts", () => {
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 1, length: 1, rotate: 0, rate: "1/32Q", gate: 1 }] });
    expect(engine.cycleTable(0, 2, 0).slots).toEqual([
      { slot: 0, notes: [[1, 60, 100]] },
      { slot: 1, notes: [[1, 60, 0]] },
    ]);
  });
});

describe("Carried note-offs and Resets", () => {
  it("carries a note-off on again when a Reset cuts the Cycle short before it's due", () => {
    const engine = createEngine();
    // x...x...x... is 1440 ticks; a Reset every bar cuts every second Cycle to 480 ticks (240 slots)
    engine.configure({ lanes: [{ hits: 3, length: 12, rotate: 0 }], resetBars: 1 });
    const { carry } = engine.cycleTable(0, 2, 1, [{ slot: 300, voice: 1, pitch: 50, tie: false }]);
    expect(carry).toContainEqual({ slot: 60, voice: 1, pitch: 50, tie: false });
  });
});

describe("A hit exactly where a Reset falls", () => {
  it("belongs to the new Reset period, not the Cycle the Reset cuts short", () => {
    const engine = createEngine();
    // 5 septuplet steps = 342.86 ticks; a Reset every bar leaves the 6th Cycle 3 steps (205.71 ticks) long,
    // so the hit on step 3 of that Cycle would land exactly on the Reset
    engine.configure({ lanes: [{ hits: 2, length: 5, rotate: 3, rate: "1/16S" }], resetBars: 1 });
    expect(engine.renderCycle(0, 5).map((e) => Math.round(e.onset))).toEqual([0]);
  });
});
