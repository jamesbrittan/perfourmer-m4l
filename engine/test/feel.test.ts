import { describe, expect, it } from "vitest";
import { createEngine, FEELS, STRAIGHT_RATES, type LaneParams } from "../src/index";

const cycle = (lane: Partial<LaneParams>) => {
  const engine = createEngine();
  engine.configure({ lanes: [{ hits: 1, length: 1, rotate: 0, ...lane }] });
  return engine.cycleTicks(0);
};

describe("Rate and Feel", () => {
  it("offer the straight values on the Rate control, and five Feels", () => {
    expect(STRAIGHT_RATES).toEqual(["1/1", "1/2", "1/4", "1/8", "1/16", "1/32"]);
    expect(FEELS).toEqual(["straight", "dotted", "triplet", "quintuplet", "septuplet"]);
  });

  it("make the step the straight value times the Feel", () => {
    expect(cycle({ rate: "1/8" })).toBe(240);
    expect(cycle({ rate: "1/8", feel: "dotted" })).toBe(360);
    expect(cycle({ rate: "1/2", feel: "triplet" })).toBe(640);
    expect(cycle({ rate: "1/32", feel: "triplet" })).toBe(40);
  });

  it("cover every rate the single Rate menu had", () => {
    const same: [LaneParams["rate"], LaneParams["rate"], LaneParams["feel"]][] = [
      ["1/4T", "1/4", "triplet"],
      ["1/8T", "1/8", "triplet"],
      ["1/16T", "1/16", "triplet"],
      ["1/16Q", "1/16", "quintuplet"],
      ["1/16S", "1/16", "septuplet"],
      ["1/32Q", "1/32", "quintuplet"],
    ];
    for (const [old, rate, feel] of same) expect(cycle({ rate, feel })).toBe(cycle({ rate: old }));
  });
});
