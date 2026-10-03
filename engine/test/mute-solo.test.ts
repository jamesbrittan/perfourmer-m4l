import { describe, expect, it } from "vitest";
import { createEngine, type LaneParams } from "../src/index";

const LANE: LaneParams = { hits: 5, length: 8, rotate: 0, pitchCycle: [0, 2, 4], mutation: 60, seed: 3 };
const setup = (...lanes: Partial<LaneParams>[]) => {
  const engine = createEngine();
  engine.configure({ lanes: lanes.map((lane) => ({ ...LANE, ...lane })) });
  return engine;
};
const sounds = (engine: ReturnType<typeof createEngine>, lane: number, cycleIndex = 2) =>
  engine.renderCycle(lane, cycleIndex).length > 0 && engine.slotTable(lane, 2, cycleIndex).length > 0;

describe("Mute and Solo", () => {
  it("a muted Lane plays nothing but keeps running: its pattern view and position carry on", () => {
    const engine = setup({});
    const view = engine.laneView(0, 2 * 960 + 360);
    engine.setLane(0, { mute: true });
    expect(sounds(engine, 0)).toBe(false);
    expect(engine.silent(0)).toBe(true);
    expect(engine.laneView(0, 2 * 960 + 360)).toEqual({ ...view, silent: true });
  });

  it("unmuted, a Lane plays what it would have played had it never been muted", () => {
    const engine = setup({});
    engine.setLane(0, { mute: true });
    engine.setLane(0, { mute: false });
    for (const c of [0, 5, 11]) expect(engine.renderCycle(0, c)).toEqual(setup({}).renderCycle(0, c));
  });

  it("soloing Lanes silences the others; more than one Lane can be soloed", () => {
    const engine = setup({}, {}, {});
    engine.setLane(1, { solo: true });
    expect([0, 1, 2].map((n) => sounds(engine, n))).toEqual([false, true, false]);
    engine.setLane(2, { solo: true });
    expect([0, 1, 2].map((n) => sounds(engine, n))).toEqual([false, true, true]);
    expect([0, 1, 2].map((n) => engine.laneView(n, 0).silent)).toEqual([true, false, false]);
    engine.setLane(1, { solo: false });
    engine.setLane(2, { solo: false });
    expect([0, 1, 2].map((n) => sounds(engine, n))).toEqual([true, true, true]);
  });

  it("Mute wins over Solo", () => {
    const engine = setup({ solo: true, mute: true }, {});
    expect([0, 1].map((n) => sounds(engine, n))).toEqual([false, false]);
  });
});
