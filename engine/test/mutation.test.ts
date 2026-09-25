import { describe, expect, it } from "vitest";
import { createEngine, type LaneParams } from "../src/index";

const BASE = { hits: 5, length: 8, rotate: 0, pitchCycle: [0, 2, 4] };

function cycles(lane: Partial<LaneParams>, count = 24) {
  const engine = createEngine();
  engine.configure({ lanes: [{ ...BASE, ...lane }] });
  return Array.from({ length: count }, (_, c) => engine.renderCycle(0, c).map((e) => [e.onset, e.pitch]));
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

describe("Mutation", () => {
  it("at 0 renders the Base for every Cycle", () => {
    expect(cycles({ mutation: 0, seed: 7 })).toEqual(cycles({}));
  });

  it("at 127 renders a different pattern on consecutive Cycles", () => {
    const run = cycles({ mutation: 127, seed: 7, pitchCycle: [0] }); // the Base alone never changes
    run.slice(1).forEach((cycle, i) => expect(same(cycle, run[i])).toBe(false));
  });

  it("in between, changes some Cycles but not all of each", () => {
    const base = cycles({});
    const run = cycles({ mutation: 32, seed: 7 }, 100);
    const changed = run.filter((cycle, c) => !same(cycle, base[c % base.length])).length;
    expect(changed).toBeGreaterThan(20);
    expect(changed).toBeLessThan(100);
  });

  it("gives identical Events for the same seed and Cycle, and a different path for a different seed", () => {
    expect(cycles({ mutation: 90, seed: 3 })).toEqual(cycles({ mutation: 90, seed: 3 }));
    expect(same(cycles({ mutation: 90, seed: 3 }), cycles({ mutation: 90, seed: 4 }))).toBe(false);
  });

  it("keeps mutated pitches in the Scale and near the Lane's register", () => {
    // C major; the Pitch Cycle spans degrees 0–4, so mutated degrees stay within −3…7 (G3 to C5)
    const pitches = cycles({ mutation: 127, seed: 11 }, 200).flat().map(([, pitch]) => pitch);
    const cMajor = new Set([0, 2, 4, 5, 7, 9, 11]);
    expect(pitches.every((p) => cMajor.has(p % 12))).toBe(true);
    expect(Math.min(...pitches)).toBeGreaterThanOrEqual(55);
    expect(Math.max(...pitches)).toBeLessThanOrEqual(72);
    expect(new Set(pitches).size).toBeGreaterThan(5); // it really does wander
  });
});

describe("Hit probability", () => {
  it("at 100% drops nothing and at 0% sounds nothing", () => {
    expect(cycles({ probability: 100, seed: 5 })).toEqual(cycles({}));
    expect(cycles({ probability: 0, seed: 5 }).flat()).toEqual([]);
  });

  it("thins the pattern out reproducibly", () => {
    const thinned = cycles({ probability: 50, seed: 5 }, 100);
    const notes = thinned.flat().length;
    expect(notes).toBeGreaterThan(150); // of 500 hits
    expect(notes).toBeLessThan(350);
    expect(cycles({ probability: 50, seed: 5 }, 100)).toEqual(thinned);
  });
});
