import { describe, expect, it } from "vitest";
import { createEngine } from "../src/index";
import { asPattern } from "./helpers";

function render(hits: number, length: number, rotate = 0) {
  const engine = createEngine();
  engine.configure({ lanes: [{ hits, length, rotate }] });
  return asPattern(engine.renderCycle(0, 0), length);
}

describe("Euclidean Lane", () => {
  it("spreads 5 hits over 8 steps as the cinquillo", () => {
    expect(render(5, 8)).toBe("x.xx.xx.");
  });

  // Toussaint, "The Euclidean Algorithm Generates Traditional Musical Rhythms" (2005)
  it.each([
    [2, 5, "x.x.."], [3, 4, "x.xx"], [3, 7, "x.x.x.."], [3, 8, "x..x..x."],
    [4, 9, "x.x.x.x.."], [4, 11, "x..x..x..x."], [5, 6, "x.xxxx"], [5, 11, "x.x.x.x.x.."],
    [5, 12, "x..x.x..x.x."], [5, 16, "x..x..x..x..x..."], [7, 12, "x.xx.x.xx.x."],
    [7, 16, "x..x.x.x..x.x.x."], [9, 16, "x.xx.x.x.xx.x.x."],
  ])("spreads %i hits over %i steps as %s", (hits, length, pattern) => {
    expect(render(hits, length)).toBe(pattern);
  });

  it("rotates hits later in time, wrapping round the Lane", () => {
    expect(render(5, 8, 1)).toBe(".x.xx.xx");
    expect(render(5, 8, 3)).toBe("xx.x.xx.");
    expect(render(5, 8, 9)).toBe(".x.xx.xx");
  });

  it("renders a rotated Cycle's Events in time order", () => {
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 5, length: 8, rotate: 3 }] });
    const onsets = engine.renderCycle(0, 0).map((e) => e.onset);
    expect(onsets).toEqual([0, 120, 360, 600, 720]);
  });

  it("plays every step when hits fill the Lane, and clamps extra hits to its length", () => {
    expect(render(8, 8)).toBe("xxxxxxxx");
    expect(render(12, 8)).toBe("xxxxxxxx");
  });

  it("is silent with no hits", () => {
    expect(render(0, 8)).toBe("........");
  });

  it("handles every Lane length from 1 to 32 with any number of hits", () => {
    for (let length = 1; length <= 32; length++) {
      for (let hits = 0; hits <= length + 1; hits++) {
        const pattern = render(hits, length);
        expect(pattern).toHaveLength(length);
        expect(pattern.split("x").length - 1).toBe(Math.min(hits, length));
        if (hits > 0) expect(pattern[0]).toBe("x");
      }
    }
  });

  it("plays each hit as middle C with a half-step gate on the Lane's own Voice", () => {
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 1, length: 4, rotate: 0 }, { hits: 3, length: 8, rotate: 0 }] });
    expect(engine.renderCycle(0, 0)).toEqual([{ onset: 0, duration: 60, pitch: 60, velocity: 100, voice: 1 }]);
    expect(engine.renderCycle(1, 0)[1]).toEqual({ onset: 360, duration: 60, pitch: 60, velocity: 100, voice: 2 });
  });

  it("reports how long a Cycle lasts, one 1/16 step per step of the Lane", () => {
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 3, length: 8, rotate: 0 }, { hits: 5, length: 13, rotate: 2 }] });
    expect(engine.cycleTicks(0)).toBe(960);
    expect(engine.cycleTicks(1)).toBe(1560);
  });

  it("lays out a Cycle as note-ons and note-offs in the player's grid slots", () => {
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 2, length: 4, rotate: 0 }] });
    expect(engine.slotTable(0, 2)).toEqual([
      { slot: 0, notes: [[1, 60, 100]] },
      { slot: 30, notes: [[1, 60, 0]] },
      { slot: 120, notes: [[1, 60, 100]] },
      { slot: 150, notes: [[1, 60, 0]] },
    ]);
  });
});
