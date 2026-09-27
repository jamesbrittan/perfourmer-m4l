import { describe, expect, it } from "vitest";
import { DEVICE_PRESETS, createEngine, LANES, SPLITS, GROUP_MODES, CHORD_SHAPES, RATES } from "../src";

describe("DEVICE_PRESETS", () => {
  it("contains 6 curated presets with unique names and descriptions", () => {
    expect(DEVICE_PRESETS.length).toBe(6);
    const names = DEVICE_PRESETS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    for (const preset of DEVICE_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
      expect(preset.lanes.length).toBe(LANES);
      expect(SPLITS[preset.split]).toBeDefined();
    }
  });

  it("verifies all lanes in each preset have valid parameters", () => {
    for (const preset of DEVICE_PRESETS) {
      for (let n = 0; n < LANES; n++) {
        const lane = preset.lanes[n];
        expect(RATES).toContain(lane.rate);
        expect(lane.length).toBeGreaterThanOrEqual(1);
        expect(lane.length).toBeLessThanOrEqual(16);
        expect(lane.hits).toBeGreaterThanOrEqual(0);
        expect(lane.hits).toBeLessThanOrEqual(lane.length);
        expect(GROUP_MODES).toContain(lane.groupMode);
        expect(Object.keys(CHORD_SHAPES)).toContain(lane.chordShape);
        expect(lane.pitchCycle).toBeDefined();
        expect(lane.pitchCycle!.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("loads each preset into an engine without throwing", () => {
    for (const preset of DEVICE_PRESETS) {
      const engine = createEngine();
      engine.setVoiceLayout(SPLITS[preset.split]);
      for (let n = 0; n < LANES; n++) {
        engine.setLane(n, preset.lanes[n]);
        expect(engine.laneSettings(n).hits).toBe(preset.lanes[n].hits);
        expect(engine.laneSettings(n).length).toBe(preset.lanes[n].length);
      }
    }
  });
});
