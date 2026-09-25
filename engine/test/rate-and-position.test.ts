import { describe, expect, it } from "vitest";
import { createEngine, type Rate } from "../src/index";

const oneStep = (rate: Rate) => {
  const engine = createEngine();
  engine.configure({ lanes: [{ hits: 1, length: 1, rotate: 0, rate }] });
  return engine.cycleTicks(0);
};

describe("Lane rate", () => {
  it("sets how long each step lasts, at 480 ticks per beat", () => {
    expect(oneStep("1/1")).toBe(1920);
    expect(oneStep("1/2")).toBe(960);
    expect(oneStep("1/4")).toBe(480);
    expect(oneStep("1/4T")).toBe(320);
    expect(oneStep("1/8")).toBe(240);
    expect(oneStep("1/8T")).toBe(160);
    expect(oneStep("1/16")).toBe(120);
    expect(oneStep("1/16Q")).toBe(96); // quintuplets: 5 per beat
    expect(oneStep("1/16T")).toBe(80);
    expect(oneStep("1/16S")).toBeCloseTo(68.571, 3); // septuplets: 7 per beat
    expect(oneStep("1/32")).toBe(60);
    expect(oneStep("1/32Q")).toBe(48); // 10 per beat
  });

  it("places hits and gates at the Lane's rate", () => {
    const engine = createEngine();
    engine.configure({
      lanes: [
        { hits: 3, length: 8, rotate: 0, rate: "1/8T" },
        { hits: 7, length: 7, rotate: 0, rate: "1/16S" },
      ],
    });
    expect(engine.renderCycle(0, 0).map((e) => [e.onset, e.duration])).toEqual([[0, 80], [480, 80], [960, 80]]);
    const septuplets = engine.renderCycle(1, 0).map((e) => e.onset);
    expect(septuplets[1]).toBeCloseTo(68.571, 3);
    expect(septuplets[6]).toBeCloseTo(411.429, 3);
  });
});

describe("Player grid for off-grid rates", () => {
  it("puts every septuplet hit in its own 2-tick slot, at or just before its true time", () => {
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 7, length: 7, rotate: 0, rate: "1/16S" }] });
    const onsets = engine.renderCycle(0, 0).map((e) => e.onset);
    const noteOnSlots = engine.slotTable(0, 2).filter((s) => s.notes.some(([, , velocity]) => velocity > 0));
    expect(noteOnSlots).toHaveLength(7);
    noteOnSlots.forEach(({ slot }, i) => {
      expect(onsets[i] - slot * 2).toBeGreaterThanOrEqual(0);
      expect(onsets[i] - slot * 2).toBeLessThan(2);
    });
  });

  it("only uses slots the player reaches in every Cycle, even when a Cycle isn't a whole number of slots", () => {
    // one septuplet step = 68.57 ticks. The player's ticks can start a Cycle up to one slot late, so it may
    // reach no further than slot 33; a note-off due later is carried into the next Cycle instead
    const engine = createEngine();
    engine.configure({ lanes: [{ hits: 1, length: 1, rotate: 0, rate: "1/16S", gate: 100 }] });
    const { slots, carry } = engine.cycleTable(0, 2, 0);
    expect(Math.max(...slots.map((s) => s.slot))).toBeLessThanOrEqual(33);
    expect(carry).toEqual([{ slot: 0, voice: 1, pitch: 60, tie: false }]);
  });
});

describe("Lane position from song position", () => {
  it("counts Cycles from the start of the song", () => {
    const engine = createEngine();
    engine.configure({
      lanes: [
        { hits: 3, length: 7, rotate: 0, rate: "1/16" },
        { hits: 2, length: 3, rotate: 0, rate: "1/8T" },
      ],
    });
    expect(engine.locate(0, 1920)).toEqual({ cycleIndex: 2, offsetTicks: 240 });
    expect(engine.locate(1, 1000)).toEqual({ cycleIndex: 2, offsetTicks: 40 });
    expect(engine.locate(0, 0)).toEqual({ cycleIndex: 0, offsetTicks: 0 });
  });

  it("realigns every Lane to its start at each Reset, while Cycle numbering keeps counting", () => {
    const engine = createEngine();
    const lane = { hits: 3, length: 7, rotate: 0, rate: "1/16" as const }; // 840-tick Cycles
    engine.configure({ lanes: [lane], resetBars: 1, ticksPerBar: 1920 });
    expect(engine.locate(0, 1919)).toEqual({ cycleIndex: 2, offsetTicks: 239 });
    expect(engine.locate(0, 1920 + 100)).toEqual({ cycleIndex: 3, offsetTicks: 100 });
    expect(engine.locate(0, 3 * 1920)).toEqual({ cycleIndex: 9, offsetTicks: 0 });
  });

  it("measures Reset bars in the song's time signature", () => {
    const engine = createEngine();
    const lane = { hits: 2, length: 5, rotate: 0, rate: "1/8" as const }; // 1200-tick Cycles
    engine.configure({ lanes: [lane], resetBars: 2, ticksPerBar: 7 * 240 }); // 7/8
    expect(engine.locate(0, 2 * 1680 + 50)).toEqual({ cycleIndex: 3, offsetTicks: 50 });
  });
});
