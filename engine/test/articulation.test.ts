import { describe, expect, it } from "vitest";
import { createEngine, type LaneParams } from "../src/index";

function cycle(lane: Partial<LaneParams>, cycleIndex = 0, resetBars = 0) {
  const engine = createEngine();
  engine.configure({ lanes: [{ hits: 3, length: 8, rotate: 0, ...lane }], resetBars });
  return engine.renderCycle(0, cycleIndex);
}

describe("Gate, up to 50%", () => {
  it("lasts that percentage of one step, whatever the gap to the next hit", () => {
    expect(cycle({ gate: 25 }).map((e) => e.duration)).toEqual([30, 30, 30]);
    expect(cycle({ gate: 50, rate: "1/8" }).map((e) => e.duration)).toEqual([120, 120, 120]);
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

describe("Gate, from 50% to 100%", () => {
  it("stretches from half a step towards the whole gap to the next hit, so a sparse pattern gets mixed lengths", () => {
    // x..x..x. : gaps of 3, 3 and 2 steps (the last one wraps round to the next Cycle's first hit)
    expect(cycle({ gate: 75 }).map((e) => e.duration)).toEqual([210, 210, 150]);
    // .x..x..x : the last gap runs to step 1 of the next Cycle
    expect(cycle({ gate: 75, rotate: 1 }).map((e) => e.duration)).toEqual([210, 210, 150]);
  });

  it("at 100% ends each note exactly where the next begins", () => {
    expect(cycle({ gate: 100 }).map((e) => e.onset + e.duration)).toEqual([360, 720, 960]);
  });

  it("measures the last gap to where a Reset cuts the Cycle short, and drops hits the Reset cuts off", () => {
    // x...x...x... is 1440 ticks; a Reset every bar (1920) cuts every second Cycle to 480 ticks
    const cut = cycle({ hits: 3, length: 12, gate: 100 }, 1, 1);
    expect(cut.map((e) => [e.onset, e.duration])).toEqual([[0, 480]]);
  });
});

describe("Player table", () => {
  const table = (lane: Partial<LaneParams>, cycleIndex = 0) => {
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 3, length: 8, rotate: 0, gate: 100, ...lane }] });
    return engine.slotTable(0, 2, cycleIndex);
  };

  it("gives each note its length, so the Voice device can end it", () => {
    expect(table({ gate: 50 })).toEqual([
      { slot: 0, notes: [[1, 60, 100, 60]] },
      { slot: 180, notes: [[1, 60, 100, 60]] },
      { slot: 360, notes: [[1, 60, 100, 60]] },
    ]);
  });

  it("runs a note just past the start of a different pitch, so the two join legato", () => {
    // x..x..x. : 360-tick gaps, then 240 to the next Cycle's first hit
    const lengths = table({ pitchCycle: [0, 2, 4] }).map((s) => s.notes[0][3]);
    expect(lengths).toEqual([366, 366, 246]);
  });

  it("ends a note just before the same pitch starts again, so the synth retriggers", () => {
    expect(table({ pitchCycle: [0] }).map((s) => s.notes[0][3])).toEqual([354, 354, 234]);
  });

  it("looks into the next Cycle for the note after a Cycle's last one", () => {
    // pitches 60 64 67 | 69 …: the last note runs into a different pitch, legato
    expect(table({ pitchCycle: [0, 2, 4, 5] }).map((s) => s.notes[0][3])).toEqual([366, 366, 246]);
    // x.x. with pitches 60 64 | 64 …: the last note is followed by the same pitch, so it retriggers
    expect(table({ pitchCycle: [0, 2, 2], hits: 2, length: 4 }).map((s) => s.notes[0][3])).toEqual([246, 234]);
  });

  it("leaves a note that ends well before the next one as the gate makes it", () => {
    // 80%: half a step (60) plus 60% of the rest of the gap
    expect(table({ gate: 80, pitchCycle: [0, 2, 4] }).map((s) => s.notes[0][3])).toEqual([240, 240, 168]);
  });
});

describe("Very short gates", () => {
  it("still last at least one grid slot", () => {
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 1, length: 1, rotate: 0, rate: "1/32Q", gate: 1 }] });
    expect(engine.slotTable(0, 2, 0)).toEqual([{ slot: 0, notes: [[1, 60, 100, 2]] }]);
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
