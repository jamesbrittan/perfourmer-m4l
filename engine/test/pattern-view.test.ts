import { describe, expect, it } from "vitest";
import { createEngine } from "../src/index";

const show = (steps: boolean[]) => steps.map((hit) => (hit ? "x" : ".")).join("");

describe("A Lane's pattern for display", () => {
  it("shows the hits over the Lane's length, rotated", () => {
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 5, length: 8, rotate: 1 }] });
    expect(engine.laneView(0, 0).rows.map(show)).toEqual([".x.xx.xx"]);
  });

  it("shows what the Cycle actually plays once Mutation and probability have had their say", () => {
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 5, length: 8, rotate: 0, mutation: 127, seed: 3 }] });
    const onsetSteps = engine.renderCycle(0, 4).map((e) => e.onset / 120);
    expect(engine.laneView(0, 4 * 960).rows.map(show)).toEqual([show(Array.from({ length: 8 }, (_, i) => onsetSteps.includes(i)))]);
  });
});

const rows = (view: { rows: boolean[][] }) => view.rows.map(show);

describe("A Lane's view at a song position", () => {
  const engine = (lane = {}) => {
    const e = createEngine();
    e.configure({ lanes: [{ hits: 5, length: 8, rotate: 0, ...lane }] });
    return e;
  };

  it("puts the playhead on the step sounding there, counting Cycles from the song start", () => {
    // 8 sixteenths = 960 ticks a Cycle
    expect(engine().laneView(0, 5 * 120 + 10)).toMatchObject({ cycleIndex: 0, step: 5 });
    expect(engine().laneView(0, 960 + 130)).toMatchObject({ cycleIndex: 1, step: 1 });
    expect(engine({ rate: "1/8" }).laneView(0, 3 * 240)).toMatchObject({ cycleIndex: 0, step: 3 });
  });

  it("follows the Reset", () => {
    const e = createEngine();
    e.configure({ lanes: [{ hits: 5, length: 12, rotate: 0 }], resetBars: 1 });
    // Cycles of 1440 ticks; the second is cut short by the Reset at 1920, where the Lane starts again
    expect(e.laneView(0, 1920 + 120)).toMatchObject({ cycleIndex: 2, step: 1 });
  });

  it("lays the steps out in rows of 16", () => {
    expect(rows(engine().laneView(0, 0))).toEqual(["x.xx.xx."]);
    expect(rows(engine({ hits: 4, length: 16 }).laneView(0, 0))).toEqual(["x...x...x...x..."]);
    expect(rows(engine({ hits: 5, length: 20 }).laneView(0, 0))).toEqual(["x...x...x...x...", "x..."]);
    expect(engine({ hits: 9, length: 32 }).laneView(0, 0).rows.map((r) => r.length)).toEqual([16, 16]);
  });

  it("says whether Mutation or probability have changed the Cycle from the Base", () => {
    expect(engine({ mutation: 0 }).laneView(0, 0).mutated).toBe(false);
    expect(engine({ mutation: 127, seed: 2 }).laneView(0, 0).mutated).toBe(true);
    expect(engine({ probability: 0 }).laneView(0, 0).mutated).toBe(true);
  });

  it("shows the Captured Base and how many Captures Revert can step back through", () => {
    const e = engine({ mutation: 127, seed: 4 });
    expect(e.laneView(0, 0).captureDepth).toBe(0);
    const heard = e.laneView(0, 3 * 960).rows;
    e.capture(0, 3);
    e.configure({ lanes: [{ hits: 5, length: 8, rotate: 0, mutation: 0, seed: 4 }] });
    expect(e.laneView(0, 0)).toMatchObject({ rows: heard, captureDepth: 1, mutated: false });
  });

  it("works each Cycle out once, not on every poll, and again after a change", () => {
    const e = engine();
    const first = e.laneView(0, 10);
    expect(e.laneView(0, 500).rows).toBe(first.rows);
    e.configure({ lanes: [{ hits: 5, length: 8, rotate: 0 }] }); // the same settings again
    expect(e.laneView(0, 900).rows).toBe(first.rows);
    e.configure({ lanes: [{ hits: 3, length: 8, rotate: 0 }] });
    expect(rows(e.laneView(0, 900))).toEqual(["x..x..x."]);
  });
});
