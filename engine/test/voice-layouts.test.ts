import { describe, expect, it } from "vitest";
import { createEngine, SPLITS, type EngineConfig, type LaneParams, type Split } from "../src/index";

const lane = (extra: Partial<LaneParams> = {}): LaneParams => ({ hits: 2, length: 4, rotate: 0, ...extra });
function render({ split, ...config }: Partial<EngineConfig> & { split?: Split }, laneIndex: number, cycleIndex = 0) {
  const engine = createEngine();
  engine.configure({ lanes: [lane(), lane(), lane(), lane()], ...config });
  if (split) engine.setVoiceLayout(SPLITS[split]);
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
    engine.configure({ lanes: [lane(), lane(), lane(), lane()] });
    engine.setVoiceLayout(SPLITS["1+3"]);
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
    engine.configure({ lanes: [lane({ hits: 5, length: 8, groupMode: "round-robin" })] });
    engine.setVoiceLayout(SPLITS["4"]);
    expect(engine.renderCycle(0, 0).map((e) => e.voice)).toEqual([1, 2, 3, 4, 1]);
    expect(engine.renderCycle(0, 1).map((e) => e.voice)).toEqual([2, 3, 4, 1, 2]);
  });

  it("starts again from the first Voice at each Reset", () => {
    const engine = createEngine();
    engine.configure({ lanes: [lane({ hits: 5, length: 8, groupMode: "round-robin" })], resetBars: 1 });
    engine.setVoiceLayout(SPLITS["4"]);
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

const layout = (engine: ReturnType<typeof createEngine>) => [0, 1, 2, 3].map((n) => engine.laneVoices(n));
const fourLanes = (extra: Partial<LaneParams> = {}) => {
  const engine = createEngine();
  engine.configure({ lanes: [0, 1, 2, 3].map(() => lane(extra)) });
  return engine;
};

describe("The Voicing Matrix", () => {
  it("starts with one Voice per Lane", () => {
    expect(layout(fourLanes())).toEqual([[1], [2], [3], [4]]);
  });

  it("gives each Voice to at most one Lane: putting it on a Lane takes it off the other", () => {
    const engine = fourLanes();
    expect(engine.setVoice(1, 1, true)).toBe(true);
    expect(layout(engine)).toEqual([[], [1, 2], [3], [4]]);
    expect(engine.setVoice(1, 3, true)).toBe(true);
    expect(layout(engine)).toEqual([[], [1, 2, 3], [], [4]]);
  });

  it("lets a Lane take any set of Voices, and says when a click changes nothing", () => {
    const engine = fourLanes();
    expect(engine.setVoice(0, 1, true)).toBe(false);
    expect(engine.setVoice(0, 4, true)).toBe(true);
    expect(engine.setVoice(0, 1, false)).toBe(true);
    expect(engine.setVoice(0, 1, false)).toBe(false);
    expect(layout(engine)).toEqual([[4], [2], [3], []]);
  });

  it("runs a Lane with no Voices silently", () => {
    const engine = fourLanes();
    engine.setVoice(0, 1, false);
    expect(engine.renderCycle(0, 0)).toEqual([]);
    expect(engine.renderCycle(1, 0).length).toBeGreaterThan(0);
  });

  it("takes a Split as a preset for the whole matrix", () => {
    const engine = fourLanes();
    engine.setVoiceLayout(SPLITS["2+2"]);
    expect(layout(engine)).toEqual([[1, 2], [3, 4], [], []]);
  });
});

describe("Changing the Voice Layout while playing", () => {
  // Lane 1: x...x... at 1/8 = 1920 ticks a Cycle, hits at 0 and 960, in unison over its Voices
  const playing = () => {
    const engine = createEngine();
    engine.configure({ lanes: [lane({ hits: 2, length: 8, rate: "1/8", groupMode: "unison" }), lane()] });
    return engine;
  };

  it("lands on the next bar", () => {
    const engine = playing();
    engine.setVoice(0, 2, true, 100); // Lane 2 gives up Voice 2 at bar 2 (tick 1920)
    expect(engine.renderCycle(0, 0).map((e) => e.voice)).toEqual([1, 1]);
    expect(engine.renderCycle(0, 1).map((e) => e.voice)).toEqual([1, 2, 1, 2]);
    expect(engine.renderCycle(1, 0).map((e) => e.voice)).toEqual([2, 2]); // Lane 2's last notes before the bar
    expect(engine.renderCycle(1, 4)).toEqual([]); // from tick 1920 Lane 2 has no Voices
  });

  it("waits a further bar when the next one is less than an eighth note away", () => {
    const engine = playing();
    engine.setVoice(0, 2, true, 1800);
    expect(engine.renderCycle(0, 1).map((e) => e.voice)).toEqual([1, 1]);
    expect(engine.renderCycle(0, 2).map((e) => e.voice)).toEqual([1, 2, 1, 2]);
  });

  it("follows Live's time signature", () => {
    const engine = playing();
    engine.configure({ lanes: [lane({ hits: 2, length: 8, rate: "1/8", groupMode: "unison" })], ticksPerBar: 1440 }); // 3/4
    engine.setVoice(0, 2, true, 100);
    expect(engine.renderCycle(0, 0).map((e) => [e.onset, e.voice])).toEqual([[0, 1], [960, 1]]);
    expect(engine.renderCycle(0, 1).map((e) => [e.onset, e.voice])).toEqual([[0, 1], [0, 2], [960, 1], [960, 2]]);
  });

  it("puts a second change on top of the first, from the layout still sounding", () => {
    const engine = playing();
    engine.setVoice(0, 2, true, 100);
    engine.setVoice(0, 3, true, 200);
    expect(engine.renderCycle(0, 0).map((e) => e.voice)).toEqual([1, 1]);
    expect(engine.renderCycle(0, 1).map((e) => e.voice)).toEqual([1, 2, 3, 1, 2, 3]);
    expect(engine.releaseVoices(1)).toEqual([2]);
  });

  it("ends notes still sounding at the change", () => {
    const engine = createEngine();
    // in 3/4 the change lands at tick 1440, part-way through a note lasting the whole 1/1 step (1920 ticks)
    engine.configure({ lanes: [lane({ hits: 1, length: 1, rate: "1/1", gate: 100 })], ticksPerBar: 1440 });
    engine.setVoice(0, 2, true, 100);
    expect(engine.renderCycle(0, 0)).toEqual([{ onset: 0, duration: 1440, pitch: 60, velocity: 100, voice: 1 }]);
  });

  it("releases the Voices a Lane gave up, as well as its new ones, until the change has landed", () => {
    const engine = playing();
    engine.setVoice(0, 2, true, 100);
    expect(engine.releaseVoices(0)).toEqual([1, 2]);
    expect(engine.releaseVoices(1)).toEqual([2]);
    expect(engine.retireVoiceLayout(1920)).toBe(false); // the bar it lands on is still playing notes from before
    expect(engine.retireVoiceLayout(3840)).toBe(true);
    expect(engine.retireVoiceLayout(3840)).toBe(false);
    expect(engine.releaseVoices(1)).toEqual([]);
    expect(engine.renderCycle(0, 0).map((e) => e.voice)).toEqual([1, 2, 1, 2]); // jumping back hears the new layout
  });
});

describe("Changing the Voice Layout while stopped", () => {
  it("takes effect at once", () => {
    const engine = fourLanes({ hits: 2, length: 8, groupMode: "unison" });
    engine.setVoice(0, 2, true);
    expect(engine.renderCycle(0, 0).map((e) => e.voice)).toEqual([1, 2, 1, 2]);
    expect(engine.renderCycle(1, 0)).toEqual([]);
    expect(engine.releaseVoices(1)).toEqual([]);
  });
});
