import { describe, expect, it } from "vitest";
import { createEngine, type LaneParams, type Scale } from "../src/index";

const MAJOR = [0, 2, 4, 5, 7, 9, 11];

/** The pitches of one Cycle of a Lane that hits on every step. */
function pitches(lane: Partial<LaneParams>, scale?: Scale, cycleIndex = 0, length = 8) {
  const engine = createEngine();
  engine.configure({ lanes: [{ hits: length, length, rotate: 0, ...lane }], scale });
  return engine.renderCycle(0, cycleIndex).map((e) => e.pitch);
}

describe("Scale degrees", () => {
  it("turn into notes from Live's root and scale intervals, degree 0 being the root nearest middle C", () => {
    const cMajor = { root: 0, intervals: MAJOR };
    expect(pitches({ pitchCycle: [0, 1, 2, 3, 4, 5, 6, 7] }, cMajor)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    const dMajor = { root: 2, intervals: MAJOR };
    expect(pitches({ pitchCycle: [0, 2, 4, 7] }, dMajor, 0, 4)).toEqual([62, 66, 69, 74]);
  });

  it("follow scales that don't have 7 notes", () => {
    const aMinorPentatonic = { root: 9, intervals: [0, 3, 5, 7, 10] };
    expect(pitches({ pitchCycle: [0, 1, 2, 3, 4, 5, -1] }, aMinorPentatonic, 0, 7)).toEqual([
      69, 72, 74, 76, 79, 81, 67,
    ]);
    const wholeTone = { root: 0, intervals: [0, 2, 4, 6, 8, 10] };
    expect(pitches({ pitchCycle: [0, 6, -6] }, wholeTone, 0, 3)).toEqual([60, 72, 48]);
  });
});

describe("Pitch Cycle", () => {
  it("advances one degree per hit, not per step", () => {
    // x..x..x. with degrees 0 1 2: each hit takes the next degree; rests don't use one up
    expect(pitches({ hits: 3, length: 8, pitchCycle: [0, 1, 2] })).toEqual([60, 62, 64]);
  });

  it("wraps at its own length, drifting against the rhythm from one Cycle to the next", () => {
    const lane = { hits: 3, length: 8, pitchCycle: [0, 1, 2, 3] };
    const cycle = (index: number) => pitches(lane, undefined, index);
    expect(cycle(0)).toEqual([60, 62, 64]);
    expect(cycle(1)).toEqual([65, 60, 62]);
    expect(cycle(2)).toEqual([64, 65, 60]);
    expect(cycle(3)).toEqual([62, 64, 65]);
    expect(cycle(4)).toEqual(cycle(0)); // 3 hits against 4 degrees line up again after 4 Cycles
  });

  it("starts again from its first degree at each Reset", () => {
    const engine = createEngine();
    // 3 hits in 8 sixteenths; Reset every bar of 4/4 = 2 Cycles
    engine.configure({ lanes: [{ hits: 3, length: 8, rotate: 0, pitchCycle: [0, 1, 2, 3] }], resetBars: 1 });
    const cycleAt = (songTicks: number) => engine.renderCycle(0, engine.locate(0, songTicks).cycleIndex);
    expect(cycleAt(960).map((e) => e.pitch)).toEqual([65, 60, 62]); // 2nd Cycle of the bar
    expect(cycleAt(1920).map((e) => e.pitch)).toEqual([60, 62, 64]); // next bar: realigned
    expect(cycleAt(1920 * 5 + 960).map((e) => e.pitch)).toEqual([65, 60, 62]);
  });
});

describe("Lane transpose", () => {
  it("moves the Pitch Cycle along the Scale by degrees", () => {
    expect(pitches({ pitchCycle: [0, 1, 2], transpose: 2 }, undefined, 0, 3)).toEqual([64, 65, 67]);
    expect(pitches({ pitchCycle: [0, 1, 2], transpose: -1 }, undefined, 0, 3)).toEqual([59, 60, 62]);
  });

  it("moves it by octaves", () => {
    expect(pitches({ pitchCycle: [0, 4], octave: -2 }, undefined, 0, 2)).toEqual([36, 43]);
    expect(pitches({ pitchCycle: [0, 4], transpose: 1, octave: 1 }, undefined, 0, 2)).toEqual([74, 81]);
  });

  it("keeps notes inside the MIDI range", () => {
    expect(pitches({ pitchCycle: [0, 7, 14], transpose: 7, octave: 3 }, undefined, 0, 3)).toEqual([108, 120, 127]);
    expect(pitches({ pitchCycle: [0, -14], transpose: -7, octave: -3 }, undefined, 0, 2)).toEqual([12, 0]);
  });
});

describe("Player table", () => {
  it("holds the pitches of the Cycle it was rendered for", () => {
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 3, length: 8, rotate: 0, pitchCycle: [0, 1, 2, 3] }] });
    const noteOns = (cycleIndex: number) =>
      engine.slotTable(0, 2, cycleIndex).flatMap((s) => s.notes.filter(([, , velocity]) => velocity > 0));
    expect(noteOns(1).map(([, pitch]) => pitch)).toEqual([65, 60, 62]);
  });
});
