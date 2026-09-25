import { describe, expect, it } from "vitest";
import { createEngine, type LaneParams } from "../src/index";

const LANE: LaneParams = { hits: 5, length: 8, rotate: 0, pitchCycle: [0, 2, 4], mutation: 127, seed: 9 };
const notes = (engine: ReturnType<typeof createEngine>, cycleIndex: number) =>
  engine.renderCycle(0, cycleIndex).map((e) => [e.onset, e.pitch]);

describe("The engine's settings", () => {
  it("keep each Lane's settings: an edit changes only what it names", () => {
    const engine = createEngine();
    engine.configure({ lanes: [LANE, { hits: 3, length: 8, rotate: 0 }] });
    engine.setLane(0, { hits: 3 });
    expect(engine.laneSettings(0)).toEqual({ ...LANE, hits: 3 });
    expect(engine.laneSettings(1)).toEqual({ hits: 3, length: 8, rotate: 0 });
  });

  it("aren't changed behind the engine's back by the objects it was given", () => {
    const lane = { ...LANE };
    const engine = createEngine();
    engine.configure({ lanes: [lane] });
    lane.hits = 1;
    expect(engine.laneSettings(0).hits).toBe(5);
    (engine.laneSettings(0) as LaneParams).hits = 2;
    expect(engine.laneSettings(0).hits).toBe(5);
  });

  it("keep the song settings an edit doesn't name", () => {
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 1, length: 4, rotate: 0 }] });
    engine.setSong({ resetBars: 2 });
    engine.setSong({ scale: { root: 2, intervals: [0, 2, 3, 5, 7, 8, 10] } });
    expect(engine.resetTicks()).toBe(3840);
    engine.setSong({ ticksPerBar: 1440 });
    expect(engine.resetTicks()).toBe(2880);
    expect(engine.renderCycle(0, 0)[0].pitch).toBe(62);
    expect(engine.songSettings()).toEqual({ scale: { root: 2, intervals: [0, 2, 3, 5, 7, 8, 10] }, resetBars: 2, ticksPerBar: 1440 });
  });
});

describe("A Capture", () => {
  it("takes the settings as they are, with no call before it", () => {
    const engine = createEngine();
    engine.configure({ lanes: [LANE] });
    engine.setLane(0, { pitchCycle: [0, 4], seed: 3 });
    const heard = notes(engine, 6);
    engine.capture(0, 6);
    engine.setLane(0, { mutation: 0 });
    expect(notes(engine, 0)).toEqual(heard);
  });
});

describe("Captured Bases reopening a set", () => {
  const saved = () => {
    const engine = createEngine();
    engine.configure({ lanes: [LANE] });
    engine.capture(0, 5);
    engine.setLane(0, { mutation: 0 });
    return { data: engine.saveBases(), heard: notes(engine, 0) };
  };
  // Live restores the controls one at a time, in any order, and the stored Bases anywhere among them
  const controls: Partial<LaneParams>[] = [{ hits: 5 }, { length: 8 }, { rotate: 0 }, { pitchCycle: [0, 2, 4] }, { mutation: 0 }, { seed: 9 }];
  const orders = [[0, 1, 2, 3, 4, 5], [5, 4, 3, 2, 1, 0], [3, 0, 5, 1, 4, 2]];

  for (const order of orders)
    for (const basesAt of [0, 2, 6])
      it(`survive controls restored in the order ${order.join("")} with the Bases arriving after ${basesAt}`, () => {
        const { data, heard } = saved();
        const engine = createEngine();
        engine.configure({ lanes: [{ hits: 3, length: 16, rotate: 2, pitchCycle: [0] }] }); // the device's defaults
        order.forEach((i, k) => {
          if (k === basesAt) engine.loadBases(data);
          engine.setLane(0, controls[i]);
        });
        if (basesAt === 6) engine.loadBases(data);
        expect(notes(engine, 0)).toEqual(heard);
        expect(engine.captureDepth(0)).toBe(1);
      });
});

describe("Control ranges", () => {
  it("keep every Lane setting inside the range its control allows", () => {
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 40, length: 64, rotate: -1, transpose: 9, octave: -4, gate: 0, velocity: 200 }] });
    expect(engine.laneSettings(0)).toMatchObject({ hits: 32, length: 32, rotate: 0, transpose: 7, octave: -3, gate: 1, velocity: 127 });
    engine.setLane(0, { accent: -5, probability: 101, mutation: 128, seed: 1000, length: 0 });
    expect(engine.laneSettings(0)).toMatchObject({ accent: 0, probability: 100, mutation: 127, seed: 999, length: 1 });
  });

  it("keep the Pitch Cycle to its editor's steps and degrees", () => {
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 1, length: 4, rotate: 0, pitchCycle: [20, -20, 1, 2, 3, 4, 5, 6, 7] }] });
    expect(engine.laneSettings(0).pitchCycle).toEqual([14, -14, 1, 2, 3, 4, 5, 6]);
    engine.setLane(0, { pitchCycle: [] });
    expect(engine.laneSettings(0).pitchCycle).toEqual([0]);
  });
});
