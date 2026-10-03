import { describe, expect, it } from "vitest";
import { createEngine, LANE_DEFAULTS, type LaneParams } from "../src/index";

const SOURCE: LaneParams = {
  ...LANE_DEFAULTS[0],
  hits: 5,
  length: 13,
  rotate: 2,
  rate: "1/8",
  pitchCycle: [0, 4, 2],
  transpose: 1,
  octave: -1,
  gate: 70,
  velocity: 90,
  accent: 20,
  probability: 80,
  mutation: 30,
  seed: 7,
};

function engineWith(source: LaneParams) {
  const engine = createEngine();
  engine.configure({ lanes: [source, { ...LANE_DEFAULTS[1], groupMode: "unison", chordShape: "7th" }] });
  return engine;
}
const cycles = (engine: ReturnType<typeof createEngine>, lane: number) =>
  Array.from({ length: 8 }, (_, c) => engine.renderCycle(lane, c).map(({ onset, pitch, duration, velocity }) => [onset, pitch, duration, velocity]));

describe("Copying a Lane", () => {
  it("takes its rhythm, pitch, feel and evolution settings, but not its voicing or Freeze", () => {
    const engine = engineWith({ ...SOURCE, groupMode: "round-robin", chordShape: "sus4", freeze: 3 });
    const { settings } = engine.copyLane(0);
    const { groupMode, chordShape, ...musical } = SOURCE; // eslint-disable-line @typescript-eslint/no-unused-vars
    expect(settings).toEqual(musical);
  });

  it("pasted, sounds the same on the other Lane once its controls take the settings", () => {
    const engine = engineWith(SOURCE);
    const copy = engine.copyLane(0);
    engine.pasteBases(1, copy);
    engine.setLane(1, copy.settings);
    expect(cycles(engine, 1).map((c) => c.map(([onset, pitch]) => [onset, pitch]))).toEqual(
      cycles(engine, 0).map((c) => c.map(([onset, pitch]) => [onset, pitch])),
    );
  });

  it("carries a Captured Base, which takes over once the controls match", () => {
    const engine = engineWith(SOURCE);
    engine.capture(0, 1); // a mutated Cycle becomes Lane 1's Base
    engine.setLane(0, { mutation: 0 });
    const copy = engine.copyLane(0);
    engine.pasteBases(1, copy);
    expect(engine.captureDepth(1)).toBe(0); // waiting for the controls
    engine.setLane(1, { hits: copy.settings.hits, length: copy.settings.length });
    engine.setLane(1, copy.settings);
    expect(engine.captureDepth(1)).toBe(1);
    expect(cycles(engine, 1)).toEqual(cycles(engine, 0));
  });

  it("without a Base, clears the other Lane's Base, even when its controls already match", () => {
    const engine = engineWith(SOURCE);
    engine.setLane(1, engine.copyLane(0).settings);
    engine.capture(1, 2);
    expect(engine.captureDepth(1)).toBe(1);
    engine.pasteBases(1, engine.copyLane(0));
    expect(engine.captureDepth(1)).toBe(0);
  });

  it("with a Base, takes over at once when the other Lane's controls already match", () => {
    const engine = engineWith(SOURCE);
    engine.setLane(1, engine.copyLane(0).settings);
    engine.capture(0, 1);
    engine.pasteBases(1, engine.copyLane(0));
    expect(engine.captureDepth(1)).toBe(1);
  });

  it("is a snapshot: later changes to the source don't reach it", () => {
    const engine = engineWith(SOURCE);
    engine.capture(0, 1);
    const copy = engine.copyLane(0);
    engine.capture(0, 2);
    engine.setLane(0, { pitchCycle: [9] });
    expect(copy.settings.pitchCycle).toEqual([0, 4, 2]);
    engine.setLane(1, copy.settings);
    engine.pasteBases(1, copy);
    expect(engine.captureDepth(1)).toBe(1);
  });
});
