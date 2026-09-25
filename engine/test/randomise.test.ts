import { describe, expect, it } from "vitest";
import { LANE_DEFAULTS, RANGES, randomSettings, STRAIGHT_RATES, type LaneParams } from "../src/index";

/** A repeatable stand-in for Math.random. */
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const rolls = (groups: Parameters<typeof randomSettings>[1], current: LaneParams = LANE_DEFAULTS[1], count = 300) => {
  const random = seeded(7);
  return Array.from({ length: count }, () => randomSettings(current, groups, random));
};

describe("Randomising a Lane", () => {
  it("changes only the groups asked for", () => {
    for (const r of rolls(["rhythm"])) expect(Object.keys(r).sort()).toEqual(["feel", "hits", "length", "rate", "rotate"]);
    for (const r of rolls(["pitch"])) expect(Object.keys(r)).toEqual(["pitchCycle"]);
    for (const r of rolls(["evolution"])) expect(Object.keys(r).sort()).toEqual(["mutation", "probability", "seed"]);
    for (const r of rolls(["rhythm", "pitch", "evolution"])) expect(Object.keys(r)).toHaveLength(9);
  });

  it("keeps the rhythm usable: Length 3–16, Hits 1 to Length, Rotate inside the Length, common Rates", () => {
    for (const { hits = 0, length = 0, rotate = 0, rate } of rolls(["rhythm"])) {
      expect(length).toBeGreaterThanOrEqual(3);
      expect(length).toBeLessThanOrEqual(16);
      expect(hits).toBeGreaterThanOrEqual(1);
      expect(hits).toBeLessThanOrEqual(length);
      expect(rotate).toBeLessThan(length);
      expect(["1/8", "1/16"]).toContain(rate);
      expect(STRAIGHT_RATES).toContain(rate);
    }
  });

  it("keeps the Pitch Cycle near the Lane's register and inside the editor", () => {
    const high: LaneParams = { ...LANE_DEFAULTS[3], pitchCycle: [9, 10, 11] }; // centred on 10
    for (const { pitchCycle = [] } of rolls(["pitch"], high)) {
      expect(pitchCycle.length).toBeGreaterThanOrEqual(2);
      expect(pitchCycle.length).toBeLessThanOrEqual(6);
      for (const d of pitchCycle) {
        expect(d).toBeGreaterThanOrEqual(5);
        expect(d).toBeLessThanOrEqual(RANGES.degree[1]);
      }
    }
  });

  it("keeps evolution gentle: Probability 70–100, Mutation 0–60, any Seed", () => {
    for (const { probability = 0, mutation = 0, seed = 0 } of rolls(["evolution"])) {
      expect(probability).toBeGreaterThanOrEqual(70);
      expect(probability).toBeLessThanOrEqual(100);
      expect(mutation).toBeLessThanOrEqual(60);
      expect(seed).toBeLessThanOrEqual(RANGES.seed[1]);
    }
  });

  it("varies from roll to roll", () => {
    const distinct = new Set(rolls(["rhythm", "pitch", "evolution"], undefined, 50).map((r) => JSON.stringify(r)));
    expect(distinct.size).toBe(50);
  });
});
