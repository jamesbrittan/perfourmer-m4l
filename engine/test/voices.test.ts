import { describe, expect, it } from "vitest";
import { createEngine } from "../src/index";

describe("Connected Voices", () => {
  it("lists the Voices whose devices have announced themselves, in order", () => {
    const engine = createEngine();
    engine.voiceJoined(501, 3);
    engine.voiceJoined(502, 1);
    expect(engine.voiceStatus()).toEqual({ connected: [1, 3], duplicates: [] });
  });

  it("flags a Voice number claimed by more than one device", () => {
    const engine = createEngine();
    engine.voiceJoined(501, 2);
    engine.voiceJoined(502, 2);
    engine.voiceJoined(503, 4);
    expect(engine.voiceStatus()).toEqual({ connected: [2, 4], duplicates: [2] });
  });

  it("forgets a Voice device that has been removed", () => {
    const engine = createEngine();
    engine.voiceJoined(501, 1);
    engine.voiceJoined(502, 2);
    engine.voiceLeft(501);
    expect(engine.voiceStatus()).toEqual({ connected: [2], duplicates: [] });
  });

  it("moves a device that re-announces itself under a new Voice number", () => {
    const engine = createEngine();
    engine.voiceJoined(501, 1);
    engine.voiceJoined(502, 2);
    engine.voiceJoined(501, 2);
    engine.voiceJoined(501, 3);
    expect(engine.voiceStatus()).toEqual({ connected: [2, 3], duplicates: [] });
  });
});
