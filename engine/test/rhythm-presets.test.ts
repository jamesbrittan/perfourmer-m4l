import { describe, expect, it } from "vitest";
import { createEngine, RHYTHM_PRESETS } from "../src/index";
import { asPattern } from "./helpers";

// The curated library (issue #35): short names, each with its hits/length, all Euclidean
const EXPECTED_PATTERNS: Record<string, string> = {
  // Grid and metric anchors
  "Four-on-floor 4/16": "x...x...x...x...",
  "Offbeat 4/16": "..x...x...x...x.",
  "Ostinato 16/16": "xxxxxxxxxxxxxxxx",
  // 16-step syncopations and club grooves
  "Dotted 8th 5/16": "x..x..x..x..x...",
  "3-against-4 3/16": "x....x....x.....",
  "Samba 7/16": "x..x.x.x..x.x.x.",
  "Central African 9/16": "x.xx.x.x.xx.x.x.",
  // 8-step claves and timelines
  "Tresillo 3/8": "x..x..x.",
  "Cinquillo 5/8": "x.xx.xx.",
  "Tuareg 7/8": "x.xxxxxx",
  // Minimalist and polymetric phasing
  "Detroit 2/5": "x.x..",
  "Ostinato 3/5": "x.x.x",
  "Phasing 3/7": "x.x.x..",
  "Outside Now 4/11": "x..x..x..x.",
  "Bell 7/12": "x.xx.x.xx.x.",
  "Phase Pair 8/13": "x.xx.x.xx.x.x",
};

describe("Rhythm Presets", () => {
  it("are the curated library of 16 Euclidean rhythms, each rendering its expected pattern", () => {
    expect(RHYTHM_PRESETS.map((p) => p.name)).toEqual(Object.keys(EXPECTED_PATTERNS));
    for (const { name, hits, length, rotate } of RHYTHM_PRESETS) {
      const engine = createEngine();
      engine.configure({ lanes: [{ hits, length, rotate }] });
      expect([name, asPattern(engine.renderCycle(0, 0), length)]).toEqual([name, EXPECTED_PATTERNS[name]]);
    }
  });
});

describe("Loading a Rhythm Preset", () => {
  it("makes it the Lane's Base: Mutation departs from it and Revert comes back to it", () => {
    const tresillo = RHYTHM_PRESETS.find((p) => p.name.startsWith("Tresillo"))!;
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 5, length: 8, rotate: 2, mutation: 127, seed: 1 }] });
    engine.capture(0, 3); // an earlier happy accident
    engine.configure({ lanes: [{ ...tresillo, mutation: 127, seed: 1 }] });
    expect(engine.laneView(0, 5 * 960).mutated).toBe(true);
    engine.revert(0);
    engine.configure({ lanes: [{ ...tresillo, mutation: 0, seed: 1 }] });
    expect(asPattern(engine.renderCycle(0, 5), 8)).toBe("x..x..x.");
  });
});
