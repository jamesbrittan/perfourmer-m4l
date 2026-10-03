import { describe, expect, it } from "vitest";
import { createEngine, type LaneParams } from "../src/index";

// x..x..x. at 1/16: hits on steps 0, 3 and 6 (120 ticks a step), pitches C E G
const BASE: LaneParams = { hits: 3, length: 8, rotate: 0, pitchCycle: [0, 2, 4], gate: 50 };

function engineFor(lane: Partial<LaneParams>) {
  const engine = createEngine();
  engine.configure({ lanes: [{ ...BASE, ...lane }] });
  return engine;
}
const notes = (lane: Partial<LaneParams>, cycleIndex = 0) =>
  engineFor(lane).renderCycle(0, cycleIndex).map(({ onset, duration, pitch, velocity }) => ({ onset, duration, pitch, velocity }));
const onsets = (lane: Partial<LaneParams>, cycleIndex = 0) => notes(lane, cycleIndex).map((n) => n.onset);

describe("Ratchets", () => {
  it("at 0% leave the Lane as it was", () => {
    for (let c = 0; c < 8; c++) expect(notes({ ratchet: 4, ratchetProbability: 0, mutation: 60, seed: 2 }, c)).toEqual(notes({ mutation: 60, seed: 2 }, c));
  });

  it("at 100% play each hit as a burst of evenly spaced pulses across its step, at its pitch", () => {
    expect(notes({ ratchet: 3, ratchetProbability: 100 }).map((n) => [n.onset, n.pitch])).toEqual([
      [0, 60], [40, 60], [80, 60],
      [360, 64], [400, 64], [440, 64],
      [720, 67], [760, 67], [800, 67],
    ]);
  });

  it("give each pulse the Gate's share of its own length, and the last pulse the Gate's share of the rest of the gap", () => {
    // Gate 50% of a 60-tick pulse = 30; at Gate 100 the last pulse runs to the next hit, 300 ticks on
    expect(notes({ ratchet: 2, ratchetProbability: 100 }).slice(0, 2).map((n) => n.duration)).toEqual([30, 30]);
    expect(notes({ ratchet: 2, ratchetProbability: 100, gate: 100 }).slice(0, 2).map((n) => n.duration)).toEqual([60, 300]);
  });

  it("retrigger every pulse, even at Gate 100", () => {
    const engine = engineFor({ ratchet: 4, ratchetProbability: 100, gate: 100, rate: "1/32Q" });
    const starts = engine.slotTable(0, 2, 0).flatMap(({ slot, notes }) => notes.map(([, pitch, , length]) => ({ start: slot * 2, pitch, length })));
    starts.slice(1).forEach(({ start, pitch }, i) => {
      if (pitch === starts[i].pitch) expect(starts[i].start + starts[i].length).toBeLessThanOrEqual(start - 6);
    });
  });

  it("in between, burst some hits and not others, the same way for the same seed and Cycle", () => {
    const run = (seed: number) => Array.from({ length: 30 }, (_, c) => onsets({ ratchet: 2, ratchetProbability: 50, seed }, c));
    const bursts = run(4).flat().length - 30 * 3;
    expect(bursts).toBeGreaterThan(20); // of 90 hits
    expect(bursts).toBeLessThan(70);
    expect(run(4)).toEqual(run(4));
    expect(run(5)).not.toEqual(run(4));
  });

  it("don't change which hits sound, or their pitches, under Mutation and probability", () => {
    const lane = { mutation: 90, probability: 60, seed: 3 };
    for (let c = 0; c < 20; c++) {
      const plain = notes(lane, c);
      const burst = notes({ ...lane, ratchet: 2, ratchetProbability: 100 }, c);
      expect(burst.filter((_, i) => i % 2 === 0).map((n) => [n.onset, n.pitch])).toEqual(plain.map((n) => [n.onset, n.pitch]));
    }
  });

  it("accent only the first pulse of the Cycle", () => {
    expect(notes({ ratchet: 2, ratchetProbability: 100, velocity: 100, accent: 20 }).map((n) => n.velocity)).toEqual([120, 100, 100, 100, 100, 100]);
  });

  it("repeat exactly while the Lane is frozen", () => {
    const frozen = { ratchet: 3, ratchetProbability: 50, seed: 9, freeze: 4 };
    expect(onsets(frozen, 11)).toEqual(onsets(frozen, 4));
    expect(onsets(frozen, 12)).toEqual(onsets(frozen, 4));
  });
});
