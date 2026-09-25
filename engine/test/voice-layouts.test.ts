import { describe, expect, it } from "vitest";
import { createEngine, type EngineConfig, type LaneParams } from "../src/index";

const lane = (extra: Partial<LaneParams> = {}): LaneParams => ({ hits: 2, length: 4, rotate: 0, ...extra });
function render(config: Partial<EngineConfig>, laneIndex: number, cycleIndex = 0) {
  const engine = createEngine();
  engine.configure({ lanes: [lane(), lane(), lane(), lane()], ...config });
  return engine.renderCycle(laneIndex, cycleIndex);
}
const voices = (events: { voice: number }[]) => [...new Set(events.map((e) => e.voice))].sort();

describe("Split", () => {
  it("1+1+1+1 gives each Lane its own Voice", () => {
    expect([0, 1, 2, 3].map((n) => voices(render({ split: "1+1+1+1" }, n)))).toEqual([[1], [2], [3], [4]]);
  });

  it("hands the groups to the Lanes in order and silences Lanes left without one", () => {
    expect([0, 1, 2, 3].map((n) => voices(render({ split: "1+3" }, n)))).toEqual([[1], [2, 3, 4], [], []]);
    expect([0, 1, 2, 3].map((n) => voices(render({ split: "2+2" }, n)))).toEqual([[1, 2], [3, 4], [], []]);
    expect([0, 1, 2, 3].map((n) => voices(render({ split: "1+1+2" }, n)))).toEqual([[1], [2], [3, 4], []]);
    expect([0, 1, 2, 3].map((n) => voices(render({ split: "4" }, n)))).toEqual([[1, 2, 3, 4], [], [], []]);
  });

  it("says which Voices each Lane drives", () => {
    const engine = createEngine();
    engine.configure({ lanes: [lane(), lane(), lane(), lane()], split: "1+3" });
    expect([0, 1, 2, 3].map((n) => engine.laneVoices(n))).toEqual([[1], [2, 3, 4], [], []]);
  });
});

const byVoice = (events: { voice: number; pitch: number; onset: number }[], onset = 0) =>
  Object.fromEntries(events.filter((e) => e.onset === onset).map((e) => [e.voice, e.pitch]));

describe("Poly groups", () => {
  it("stack the Chord Shape in scale degrees, lowest note on the highest-numbered Voice", () => {
    const seventh = render({ split: "4", lanes: [lane({ chordShape: "7th" })] }, 0);
    expect(byVoice(seventh)).toEqual({ 4: 60, 3: 64, 2: 67, 1: 71 });
  });

  it("double the bass an octave down when the chord is smaller than the group", () => {
    const triad = render({ split: "4", lanes: [lane({ chordShape: "triad" })] }, 0);
    expect(byVoice(triad)).toEqual({ 4: 48, 3: 60, 2: 64, 1: 67 });
  });

  it("double an octave above the root instead when an octave down would be too low", () => {
    const low = render({ split: "4", lanes: [lane({ chordShape: "triad", octave: -3 })] }, 0);
    expect(byVoice(low)).toEqual({ 4: 24, 3: 28, 2: 31, 1: 36 });
  });

  it("drop the top notes of a chord bigger than the group", () => {
    const quartal = render({ split: "1+3", lanes: [lane(), lane({ chordShape: "quartal" })] }, 1);
    expect(byVoice(quartal)).toEqual({ 4: 60, 3: 65, 2: 71 });
  });

  it("follow the Scale and the Pitch Cycle", () => {
    const dMinor = { root: 2, intervals: [0, 2, 3, 5, 7, 8, 10] };
    const chords = render({ split: "4", scale: dMinor, lanes: [lane({ chordShape: "7th", pitchCycle: [0, 3] })] }, 0);
    expect(byVoice(chords, 0)).toEqual({ 4: 62, 3: 65, 2: 69, 1: 72 }); // Dm7
    expect(byVoice(chords, 240)).toEqual({ 4: 67, 3: 70, 2: 74, 1: 77 }); // Gm7
  });
});

describe("Round-robin", () => {
  it("plays successive hits on successive Voices, carrying on across Cycles", () => {
    const engine = createEngine();
    engine.configure({ lanes: [lane({ hits: 5, length: 8, groupMode: "round-robin" })], split: "4" });
    expect(engine.renderCycle(0, 0).map((e) => e.voice)).toEqual([1, 2, 3, 4, 1]);
    expect(engine.renderCycle(0, 1).map((e) => e.voice)).toEqual([2, 3, 4, 1, 2]);
  });

  it("starts again from the first Voice at each Reset", () => {
    const engine = createEngine();
    engine.configure({ lanes: [lane({ hits: 5, length: 8, groupMode: "round-robin" })], split: "4", resetBars: 1 });
    expect(engine.renderCycle(0, 2).map((e) => e.voice)).toEqual([1, 2, 3, 4, 1]);
  });
});

describe("Unison", () => {
  it("plays each hit on every Voice of the group", () => {
    const events = render({ split: "2+2", lanes: [lane({ groupMode: "unison", chordShape: "7th" })] }, 0);
    expect(byVoice(events)).toEqual({ 1: 60, 2: 60 });
  });
});

describe("A single-Voice group", () => {
  it("plays single notes whatever the Group Mode and Chord Shape", () => {
    expect(byVoice(render({ split: "1+3", lanes: [lane({ chordShape: "7th" })] }, 0))).toEqual({ 1: 60 });
  });
});

describe("Changing the Split", () => {
  it("takes effect at the given bar for every Lane, mid-Cycle if need be", () => {
    const engine = createEngine();
    // Lane 1: x...x... at 1/8 = 1920 ticks, so the change at tick 960 falls mid-Cycle
    engine.configure({
      lanes: [lane({ hits: 2, length: 8, rate: "1/8", groupMode: "unison" })],
      previousSplit: "1+1+1+1",
      split: "4",
      splitAt: 960,
    });
    const events = engine.renderCycle(0, 0);
    expect(events.filter((e) => e.onset === 0).map((e) => e.voice)).toEqual([1]);
    expect(events.filter((e) => e.onset === 960).map((e) => e.voice)).toEqual([1, 2, 3, 4]);
    expect(engine.renderCycle(0, 1).map((e) => e.voice)).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
  });

  it("ends notes still sounding at the change", () => {
    const engine = createEngine();
    // one note lasting the whole 1/1 step (1920 ticks); the change comes at tick 960
    engine.configure({
      lanes: [lane({ hits: 1, length: 1, rate: "1/1", gate: 100 })],
      previousSplit: "1+1+1+1",
      split: "4",
      splitAt: 960,
    });
    expect(engine.renderCycle(0, 0).map((e) => [e.onset, e.duration])).toEqual([[0, 960]]);
  });
});
