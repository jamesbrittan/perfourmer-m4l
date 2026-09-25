import { describe, expect, it } from "vitest";
import { createEngine, RHYTHM_PRESETS } from "../src/index";
import { asPattern } from "./helpers";

// Toussaint, "The Euclidean Algorithm Generates Traditional Musical Rhythms" (2005)
const PUBLISHED: Record<string, string> = {
  "Khafif-e-ramal 2/5": "x.x..",
  "Cumbia 3/4": "x.xx",
  "Romanian folk 3/5": "x.x.x",
  "Ruchenitza 3/7": "x.x.x..",
  "Tresillo 3/8": "x..x..x.",
  "Ruchenitza 4/7": "x.x.x.x",
  "Aksak 4/9": "x.x.x.x..",
  "Outside Now 4/11": "x..x..x..x.",
  "York-Samai 5/6": "x.xxxx",
  "Nawakhat 5/7": "x.xx.xx",
  "Cinquillo 5/8": "x.xx.xx.",
  "Agsag-Samai 5/9": "x.x.x.x.x",
  "Moussorgsky 5/11": "x.x.x.x.x..",
  "Venda 5/12": "x..x.x..x.x.",
  "Bossa nova 5/16": "x..x..x..x..x...",
  "Tuareg 7/8": "x.xxxxxx",
  "West African bell 7/12": "x.xx.x.xx.x.",
  "Samba 7/16": "x..x.x.x..x.x.x.",
  "Central African 9/16": "x.xx.x.x.xx.x.x.",
  "Aka 11/24": "x..x.x.x.x.x..x.x.x.x.x.",
  "Aka upper sangha 13/24": "x.xx.x.x.x.x.xx.x.x.x.x.",
};

describe("Rhythm Presets", () => {
  it("are the published Euclidean rhythms, each rendering its published pattern at Rotate 0", () => {
    expect(RHYTHM_PRESETS.map((p) => p.name)).toEqual(Object.keys(PUBLISHED));
    for (const { name, hits, length } of RHYTHM_PRESETS) {
      const engine = createEngine();
      engine.configure({ lanes: [{ hits, length, rotate: 0 }] });
      expect([name, asPattern(engine.renderCycle(0, 0), length)]).toEqual([name, PUBLISHED[name]]);
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
    expect(engine.isMutated(0, 5)).toBe(true);
    engine.revert(0);
    engine.configure({ lanes: [{ ...tresillo, mutation: 0, seed: 1 }] });
    expect(asPattern(engine.renderCycle(0, 5), 8)).toBe("x..x..x.");
  });
});
