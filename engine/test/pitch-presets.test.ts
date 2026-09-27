import { describe, expect, it } from "vitest";
import { PITCH_PRESETS, createEngine, PITCH_STEPS, RANGES } from "../src";

describe("PITCH_PRESETS", () => {
  it("contains 17 presets with distinct names", () => {
    expect(PITCH_PRESETS.length).toBe(17);
    const names = PITCH_PRESETS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("ensures every preset has valid length and degrees within range", () => {
    const [minDeg, maxDeg] = RANGES.degree;
    for (const preset of PITCH_PRESETS) {
      expect(preset.degrees.length).toBeGreaterThanOrEqual(1);
      expect(preset.degrees.length).toBeLessThanOrEqual(PITCH_STEPS);
      for (const deg of preset.degrees) {
        expect(deg).toBeGreaterThanOrEqual(minDeg);
        expect(deg).toBeLessThanOrEqual(maxDeg);
        expect(Number.isInteger(deg)).toBe(true);
      }
    }
  });

  it("applies cleanly to an engine lane's pitchCycle", () => {
    const engine = createEngine();
    for (const preset of PITCH_PRESETS) {
      engine.setLane(0, { pitchCycle: [...preset.degrees] });
      expect(engine.laneSettings(0).pitchCycle).toEqual(preset.degrees);
    }
  });
});
