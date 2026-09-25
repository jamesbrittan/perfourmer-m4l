import { describe, expect, it } from "vitest";
import { createEngine } from "../src/index";

const show = (steps: boolean[]) => steps.map((hit) => (hit ? "x" : ".")).join("");

describe("A Lane's pattern for display", () => {
  it("shows the hits over the Lane's length, rotated", () => {
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 5, length: 8, rotate: 1 }] });
    expect(show(engine.hitSteps(0, 0))).toBe(".x.xx.xx");
  });

  it("shows what the Cycle actually plays once Mutation and probability have had their say", () => {
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 5, length: 8, rotate: 0, mutation: 127, seed: 3 }] });
    const onsetSteps = engine.renderCycle(0, 4).map((e) => e.onset / 120);
    expect(show(engine.hitSteps(0, 4))).toBe(show(Array.from({ length: 8 }, (_, i) => onsetSteps.includes(i))));
  });
});
