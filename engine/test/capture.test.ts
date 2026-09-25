import { describe, expect, it } from "vitest";
import { createEngine, type LaneParams } from "../src/index";

const LANE: LaneParams = { hits: 5, length: 8, rotate: 0, pitchCycle: [0, 2, 4], mutation: 127, seed: 9 };
const notes = (engine: ReturnType<typeof createEngine>, cycleIndex: number) =>
  engine.renderCycle(0, cycleIndex).map((e) => [e.onset, e.pitch]);

function setup(lane: Partial<LaneParams> = {}) {
  const engine = createEngine();
  engine.configure({ lanes: [{ ...LANE, ...lane }] });
  return engine;
}

describe("Capture", () => {
  it("makes the sounding Cycle the Lane's Base, so at mutation 0 it repeats exactly", () => {
    const engine = setup();
    const heard = notes(engine, 6);
    engine.capture(0, 6);
    engine.configure({ lanes: [{ ...LANE, mutation: 0 }] });
    for (const c of [0, 1, 7, 40]) expect(notes(engine, c)).toEqual(heard);
  });

  it("gives Mutation the Captured pattern to depart from", () => {
    const engine = setup();
    engine.capture(0, 6);
    const evolving = [8, 9, 10].map((c) => notes(engine, c));
    expect(evolving.every((cycle) => JSON.stringify(cycle) !== JSON.stringify(notes(engine, 6)))).toBe(true);
  });
});

describe("Revert", () => {
  it("restores the Base from before the last Capture, one Capture at a time", () => {
    const engine = setup({ mutation: 0 });
    const original = notes(engine, 0);
    engine.configure({ lanes: [LANE] });
    const first = notes(engine, 3);
    engine.capture(0, 3);
    const second = notes(engine, 4);
    engine.capture(0, 4);
    engine.configure({ lanes: [{ ...LANE, mutation: 0 }] });
    expect(notes(engine, 0)).toEqual(second);
    engine.revert(0);
    expect(notes(engine, 0)).toEqual(first);
    engine.revert(0);
    expect(notes(engine, 0)).toEqual(original);
    engine.revert(0); // nothing left to revert
    expect(notes(engine, 0)).toEqual(original);
  });
});

describe("The Captured Base", () => {
  it("survives saving and loading", () => {
    const engine = setup();
    engine.capture(0, 2);
    engine.capture(0, 5);
    const saved = engine.saveBases();
    expect(saved.every((x) => typeof x === "number" && Number.isFinite(x))).toBe(true);
    const reloaded = createEngine();
    reloaded.loadBases(saved);
    reloaded.configure({ lanes: [{ ...LANE, mutation: 0 }] });
    engine.configure({ lanes: [{ ...LANE, mutation: 0 }] });
    expect(notes(reloaded, 0)).toEqual(notes(engine, 0));
    engine.revert(0);
    reloaded.revert(0);
    expect(notes(reloaded, 0)).toEqual(notes(engine, 0));
  });

  it("waits for its controls when a set loads, whatever order they arrive in", () => {
    const engine = setup();
    engine.capture(0, 5);
    engine.configure({ lanes: [{ ...LANE, mutation: 0 }] });
    const reloaded = createEngine();
    reloaded.configure({ lanes: [{ hits: 3, length: 8, rotate: 0 }] }); // the device's defaults
    reloaded.loadBases(engine.saveBases());
    reloaded.configure({ lanes: [{ hits: 3, length: 8, rotate: 0 }] });
    reloaded.configure({ lanes: [{ ...LANE, mutation: 0, length: 16 }] }); // controls restored one at a time
    reloaded.configure({ lanes: [{ ...LANE, mutation: 0 }] });
    expect(notes(reloaded, 0)).toEqual(notes(engine, 0));
  });

  it("gives way when Hits, Length, Rotate or the Pitch Cycle change, but not for other settings", () => {
    const engine = setup();
    const heard = notes(engine, 6);
    engine.capture(0, 6);
    engine.configure({ lanes: [{ ...LANE, mutation: 0, velocity: 80, rate: "1/16", transpose: 0 }] });
    expect(notes(engine, 0)).toEqual(heard);
    engine.configure({ lanes: [{ ...LANE, mutation: 0, hits: 3 }] });
    expect(notes(engine, 0)).toEqual(setup({ mutation: 0, hits: 3 }).renderCycle(0, 0).map((e) => [e.onset, e.pitch]));
  });
});

describe("Capture depth", () => {
  it("counts the Captured Bases Revert can step back through", () => {
    const engine = setup();
    expect(engine.captureDepth(0)).toBe(0);
    engine.capture(0, 2);
    engine.capture(0, 5);
    expect(engine.captureDepth(0)).toBe(2);
    engine.revert(0);
    expect(engine.captureDepth(0)).toBe(1);
    const reloaded = createEngine();
    reloaded.loadBases(engine.saveBases());
    expect(reloaded.captureDepth(0)).toBe(0); // waiting for its controls
    reloaded.configure({ lanes: [LANE] });
    expect(reloaded.captureDepth(0)).toBe(1);
    engine.configure({ lanes: [{ ...LANE, hits: 3 }] });
    expect(engine.captureDepth(0)).toBe(0);
  });
});

describe("Mutated from Base", () => {
  it("tells whether a Cycle departs from the Base", () => {
    expect(setup({ mutation: 0 }).isMutated(0, 5)).toBe(false);
    expect(setup({ mutation: 127 }).isMutated(0, 5)).toBe(true);
  });
});
