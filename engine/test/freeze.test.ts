import { describe, expect, it } from "vitest";
import { createEngine, SPLITS, type LaneParams } from "../src/index";

const LANE: LaneParams = { hits: 5, length: 8, rotate: 0, pitchCycle: [0, 2, 4], mutation: 127, probability: 70, seed: 9 };
const heard = (engine: ReturnType<typeof createEngine>, cycleIndex: number) =>
  engine.renderCycle(0, cycleIndex).map(({ onset, pitch, velocity, voice }) => [onset, pitch, velocity, voice]);
const setup = (lane: Partial<LaneParams> = {}) => {
  const engine = createEngine();
  engine.configure({ lanes: [{ ...LANE, ...lane }] });
  return engine;
};

describe("Freeze", () => {
  it("repeats the frozen Cycle exactly, mutated steps, degrees, dropped hits and all, leaving Mutation alone", () => {
    const engine = setup();
    const held = heard(engine, 6);
    engine.setLane(0, { freeze: 6 });
    for (const c of [6, 7, 8, 30]) expect(heard(engine, c)).toEqual(held);
    expect(engine.laneSettings(0).mutation).toBe(127);
    expect(engine.laneView(0, 20 * 960).rows).toEqual(setup().laneView(0, 6 * 960).rows);
  });

  it("holds the Voices of a round-robin Lane too", () => {
    const engine = setup({ groupMode: "round-robin", mutation: 0, probability: 100 });
    engine.setVoiceLayout(SPLITS["4"]);
    const held = heard(engine, 3);
    engine.setLane(0, { freeze: 3 });
    expect(heard(engine, 4)).toEqual(held);
  });

  it("when released, plays what the Lane would have played at that song position", () => {
    const engine = setup();
    engine.setLane(0, { freeze: 6 });
    engine.setLane(0, { freeze: undefined });
    for (const c of [7, 12]) expect(heard(engine, c)).toEqual(heard(setup(), c));
  });

  it("with Capture: the frozen Cycle becomes the Base, the Lane holds it, and evolves from it once released", () => {
    const engine = setup();
    const held = heard(engine, 6);
    engine.setLane(0, { freeze: 6 });
    engine.capture(0, 9);
    expect(engine.laneSettings(0).freeze).toBe("base");
    expect(engine.captureDepth(0)).toBe(1);
    for (const c of [9, 10, 25]) expect(heard(engine, c)).toEqual(held);
    engine.setLane(0, { freeze: undefined });
    expect(heard(engine, 10)).not.toEqual(held); // Mutation 127 departs from the new Base
    engine.setLane(0, { mutation: 0, probability: 100 });
    const onsets = (c: number) => heard(engine, c).map(([onset, pitch]) => [onset, pitch]);
    expect(onsets(10)).toEqual(held.map(([onset, pitch]) => [onset, pitch]));
  });

  it("is ended by a Reset like any Cycle", () => {
    const engine = setup({ length: 12, mutation: 0, probability: 100 });
    engine.configure({ lanes: [{ ...LANE, length: 12, mutation: 0, probability: 100 }], resetBars: 1 });
    engine.setLane(0, { freeze: 0 });
    // Cycles of 1440 ticks: the second is cut short by the Reset at 1920
    expect(engine.renderCycle(0, 1).every((e) => e.onset < 480)).toBe(true);
  });
});
