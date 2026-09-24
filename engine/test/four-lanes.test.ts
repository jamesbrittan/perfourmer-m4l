import { describe, expect, it } from "vitest";
import { createEngine } from "../src/index";
import { asPattern } from "./helpers";

describe("Four Lanes in the 4×mono Voice Layout", () => {
  const lanes = [
    { hits: 3, length: 8, rotate: 0 },
    { hits: 5, length: 8, rotate: 1 },
    { hits: 2, length: 5, rotate: 0 },
    { hits: 7, length: 12, rotate: 0 },
  ];

  it("renders each Lane's own pattern", () => {
    const engine = createEngine();
    engine.configure({ lanes });
    expect(asPattern(engine.renderCycle(0, 0), 8)).toBe("x..x..x.");
    expect(asPattern(engine.renderCycle(1, 0), 8)).toBe(".x.xx.xx");
    expect(asPattern(engine.renderCycle(2, 0), 5)).toBe("x.x..");
    expect(asPattern(engine.renderCycle(3, 0), 12)).toBe("x.xx.x.xx.x.");
  });

  it("sends Lane n to Voice n", () => {
    const engine = createEngine();
    engine.configure({ lanes });
    const voices = lanes.map((_, lane) => new Set(engine.renderCycle(lane, 0).map((e) => e.voice)));
    expect(voices).toEqual([new Set([1]), new Set([2]), new Set([3]), new Set([4])]);
  });

  it("gives each Lane its own Cycle length", () => {
    const engine = createEngine();
    engine.configure({ lanes });
    expect(lanes.map((_, lane) => engine.cycleTicks(lane))).toEqual([960, 960, 600, 1440]);
  });
});
