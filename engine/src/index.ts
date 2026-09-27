import { uniformInt } from "pure-rand/distribution/uniformInt";
import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus";

export { createScheduler, type PlayerCommand } from "./scheduler";

/** Named, known-good Euclidean rhythms a Lane can load as its Base. */
export const RHYTHM_PRESETS: readonly {
  readonly name: string;
  readonly hits: number;
  readonly length: number;
  readonly rotate: number;
}[] = [
  // Electronic / Genre rhythms
  { name: "Four-on-the-floor 4/16", hits: 4, length: 16, rotate: 0 },
  { name: "Offbeat 4/16", hits: 4, length: 16, rotate: 2 },
  { name: "Straight 16ths 16/16", hits: 16, length: 16, rotate: 0 },
  { name: "Syncopated 5/16", hits: 5, length: 16, rotate: 0 },
  { name: "3-against-4 3/16", hits: 3, length: 16, rotate: 0 },
  { name: "Phase 12 8/12", hits: 8, length: 12, rotate: 0 },
  { name: "Phase 13 8/13", hits: 8, length: 13, rotate: 0 },
  // Traditional Euclidean rhythms (Toussaint 2005)
  ...([
    ["Khafif-e-ramal", 2, 5],
    ["Cumbia", 3, 4],
    ["Romanian folk", 3, 5],
    ["Ruchenitza", 3, 7],
    ["Tresillo", 3, 8],
    ["Ruchenitza", 4, 7],
    ["Aksak", 4, 9],
    ["Outside Now", 4, 11],
    ["York-Samai", 5, 6],
    ["Nawakhat", 5, 7],
    ["Cinquillo", 5, 8],
    ["Agsag-Samai", 5, 9],
    ["Moussorgsky", 5, 11],
    ["Venda", 5, 12],
    ["Bossa nova", 5, 16],
    ["Tuareg", 7, 8],
    ["West African bell", 7, 12],
    ["Samba", 7, 16],
    ["Central African", 9, 16],
    ["Aka", 11, 24],
    ["Aka upper sangha", 13, 24],
  ] as const).map(([name, hits, length]) => ({
    name: `${name} ${hits}/${length}`,
    hits,
    length,
    rotate: 0,
  })),
];

export type Event = { onset: number; duration: number; pitch: number; velocity: number; voice: number };
/** Step length in ticks at 480 PPQ, slowest first. Q = quintuplet, T = triplet, S = septuplet. */
const RATE_TICKS = {
  "1/1": 1920,
  "1/2": 960,
  "1/4": 480,
  "1/4T": 320,
  "1/8": 240,
  "1/8T": 160,
  "1/16": 120,
  "1/16Q": 96,
  "1/16T": 80,
  "1/16S": 480 / 7,
  "1/32": 60,
  "1/32Q": 48,
} as const;
export type Rate = keyof typeof RATE_TICKS;
/** Rate names in menu order (slowest first); the Hub's Rate control indexes into this. */
export const RATES = Object.keys(RATE_TICKS) as Rate[];
/** pitchCycle: scale degrees, one per hit (0 = the Scale's root nearest middle C), shifted by transpose
 * degrees and octave octaves. gate runs from short to tied: up to 50% it is that percentage of one step; from 50%
 * to 100% the note stretches from half a step to the whole gap to the next hit, and at 100% it ties into the next.
 * accent: velocity added to the first hit of each Cycle (0 = none).
 * probability: % chance each hit sounds; mutation: 0 (the Base every Cycle) to 127 (a new pattern every Cycle);
 * seed: picks the path Mutation and probability take. */
export type LaneParams = {
  hits: number;
  length: number;
  rotate: number;
  rate?: Rate;
  pitchCycle?: number[];
  transpose?: number;
  octave?: number;
  probability?: number;
  mutation?: number;
  seed?: number;
  groupMode?: GroupMode;
  chordShape?: ChordShape;
  gate?: number;
  velocity?: number;
  accent?: number;
};
/** Live's global scale: root 0–11 (C = 0) and the semitone intervals of its notes. */
export type Scale = { root: number; intervals: number[] };
/** Standard groupings of the four Voices, as Voicing Matrix presets: Lanes take the groups in order. */
export const SPLITS = {
  "1+1+1+1": [[1], [2], [3], [4]],
  "4": [[1, 2, 3, 4]],
  "1+3": [[1], [2, 3, 4]],
  "2+2": [[1, 2], [3, 4]],
  "1+1+2": [[1], [2], [3, 4]],
} as const;
export type Split = keyof typeof SPLITS;
/** How a Lane uses a group of more than one Voice. */
export const GROUP_MODES = ["poly", "round-robin", "unison"] as const;
export type GroupMode = (typeof GROUP_MODES)[number];
/** Scale-degree intervals stacked on each hit of a poly Lane. */
export const CHORD_SHAPES = {
  unison: [0],
  "5th": [0, 4],
  triad: [0, 2, 4],
  "7th": [0, 2, 4, 6],
  sus2: [0, 1, 4],
  sus4: [0, 3, 4],
  "6th": [0, 2, 4, 5],
  add9: [0, 2, 4, 8],
  quartal: [0, 3, 6, 9],
  "open triad": [0, 4, 9],
  octaves: [0, 7, 14, 21],
} as const;
export type ChordShape = keyof typeof CHORD_SHAPES;
/** Below this, a doubled bass note would be too low to hear: the chord is filled upwards instead. */
const LOWEST_BASS = 24;

/** resetBars 0 = never; ticksPerBar follows Live's time signature (4/4 = 1920). */
export type EngineConfig = {
  lanes: LaneParams[];
  scale?: Scale;
  resetBars?: number;
  ticksPerBar?: number;
};
/** The Voicing Matrix as each Lane's Voices (1–4), Lane by Lane. */
export type VoiceLayout = readonly (readonly number[])[];
/** One player grid slot: the notes that start there, as [voice, pitch, velocity, length in ticks]. Each Voice
 * device plays them with makenote, so every note ends by itself. */
export type Slot = { slot: number; notes: [number, number, number, number][] };
/** What a Lane shows at a song position: its Cycle, the playhead step (from 0), the Cycle's steps in rows of 16
 * (true = a hit sounds), whether Mutation or probability changed it from the Base, and the Capture depth. */
export type LaneView = { cycleIndex: number; step: number; rows: boolean[][]; mutated: boolean; captureDepth: number };

const VIEW_ROW = 16;

const MIDDLE_C = 60;
/** A Voice Layout change made while playing waits for a bar at least this far ahead (an eighth note), so the
 * Cycles rendered for it reach the player in time. */
const CHANGE_LEAD = 240;
/** A note followed by the same pitch on its Voice ends at least this many ticks before it (so the synth sees the
 * gate close and retriggers); one running into a different pitch lasts this much longer (so the two join legato). */
const RETRIGGER_TICKS = 6;
const LEGATO_TICKS = 6;
const C_MAJOR: Scale = { root: 0, intervals: [0, 2, 4, 5, 7, 9, 11] };

/** Bjorklund's algorithm: the Euclidean rhythms as tabulated by Toussaint (first hit on step 0). */
function bjorklund(hits: number, length: number): boolean[] {
  hits = Math.max(0, Math.min(hits, length));
  if (hits === 0 || hits === length) return Array.from({ length }, () => hits > 0);
  let groups: boolean[][] = Array.from({ length: hits }, () => [true]);
  let remainder: boolean[][] = Array.from({ length: length - hits }, () => [false]);
  do {
    const pairs = Math.min(groups.length, remainder.length);
    const leftover = groups.length > pairs ? groups.slice(pairs) : remainder.slice(pairs);
    groups = groups.slice(0, pairs).map((g, i) => g.concat(remainder[i]));
    remainder = leftover;
  } while (remainder.length > 1);
  return groups.concat(remainder).flat();
}

/** One RNG seed per (Lane seed, Cycle). */
const mix = (seed: number, cycleIndex: number) => (Math.imul(seed + 1, 0x9e3779b1) ^ Math.imul(cycleIndex + 1, 0x85ebca6b)) | 0;

const clampToMidi = (note: number) => Math.max(0, Math.min(127, note));

/** A scale degree as a MIDI note: degrees past the Scale's last note carry on into the next octave. */
function degreeToNote(degree: number, { root, intervals }: Scale): number {
  const octave = Math.floor(degree / intervals.length);
  const index = degree - octave * intervals.length;
  return MIDDLE_C + root + intervals[index] + 12 * octave;
}

/** A Captured Base: which steps hit, and a scale degree for every step (a rest step keeps the previous hit's). */
type Captured = { steps: boolean[]; degrees: number[] };
/** The controls a Captured Base was taken under; changing any of them hands the Lane back to its controls. */
const signature = ({ hits, length, rotate, pitchCycle = [0] }: LaneParams) => [hits, length, rotate, pitchCycle.length, ...pitchCycle];

export function createEngine() {
  let lanes: LaneParams[] = [];
  // Lane -> Bases, newest last. Bases loaded with a set wait (inactive) until the Lane's controls match the ones
  // they were captured with, since a set's controls are restored one by one and in no particular order.
  const captures = new Map<number, { signature: number[]; stack: Captured[]; waiting?: boolean }>();
  const active = (lane: number) => {
    const entry = captures.get(lane);
    return entry && !entry.waiting ? entry : undefined;
  };
  let scale = C_MAJOR;
  let voiceLayout: VoiceLayout = SPLITS["1+1+1+1"];
  // The Voice Layout a change replaced, and the song tick the change lands on: notes starting earlier use `from`,
  // and any still sounding there end there. `from` is the current layout once the change is retired.
  let layoutChange: { from: VoiceLayout; at: number } = { from: voiceLayout, at: 0 };
  let ticksPerBar = 1920;
  let resetTicks = 0; // 0 = Lanes never realign
  let basesChanged = 0; // counts changes to the Captured Bases, so a cached Lane view knows it's out of date
  const views = new Map<number, { key: string; view: Omit<LaneView, "step"> }>();
  const voiceDevices = new Map<number, number>(); // Voice device id -> Voice number

  /**
   * The hits that sound in a Cycle, as onsets and scale degrees (before transpose). Each Cycle starts again from
   * the Base (Euclidean pattern + Pitch Cycle): with probability mutation/127, each step is re-decided (a hit with
   * the Base's density, hits/length) and each hit's degree is redrawn within the Pitch Cycle's range ±3 degrees;
   * then each hit sounds with the Lane's probability. The draws come from an RNG seeded by (seed, cycleIndex), a
   * fixed number per step, so a Cycle is reproducible from song position whatever the other settings.
   */
  function cycleHits(lane: number, cycleIndex: number, evolve = true): { onset: number; degree: number; count: number }[] {
    const { hits, length, rotate, pitchCycle = [0], seed = 0 } = lanes[lane];
    const { mutation, probability } = evolve ? { mutation: 0, probability: 100, ...lanes[lane] } : { mutation: 0, probability: 100 };
    const stack = active(lane)?.stack;
    const captured = stack?.[stack.length - 1];
    const pattern = bjorklund(hits, length);
    const shift = rotate % length;
    const base = captured?.steps ?? pattern.map((_, step) => pattern[(step - shift + length) % length]);
    const rng = xoroshiro128plus(mix(seed, cycleIndex));
    const chance = () => uniformInt(rng, 0, 99999) / 100000;
    const register = captured?.degrees ?? pitchCycle;
    const [lo, hi] = [Math.min(...register) - 3, Math.max(...register) + 3];
    const baseHits = base.filter(Boolean).length;
    const density = captured ? baseHits / length : hits / length;
    let hitIndex = cyclesSinceReset(lane, cycleIndex) * baseHits; // the Pitch Cycle realigns at each Reset
    let count = cyclesSinceReset(lane, cycleIndex) * baseHits; // hits since the Reset, for round-robin
    const step = stepTicks(lane);
    const end = playedTicks(lane, cycleIndex);
    const sounding: { onset: number; degree: number; count: number }[] = [];
    base.forEach((isHit, i) => {
      const [stepDraw, hitDraw, pitchDraw, degreeDraw, soundDraw] = [chance(), chance(), chance(), chance(), chance()];
      const hit = stepDraw < mutation / 127 ? hitDraw < density : isHit;
      if (!hit) return;
      const hitCount = count++;
      const baseDegree = captured ? captured.degrees[i] : pitchCycle[hitIndex++ % pitchCycle.length];
      const degree = pitchDraw < mutation / 127 ? lo + Math.floor(degreeDraw * (hi - lo + 1)) : baseDegree;
      const onset = i * step;
      // a dropped hit still uses up its Pitch Cycle step; hits from a Reset cut on are never reached
      if (soundDraw * 100 < probability && onset < end - 1e-6) sounding.push({ onset, degree, count: hitCount });
    });
    return sounding;
  }

  function renderCycle(lane: number, cycleIndex: number): Event[] {
    const { transpose = 0, octave = 0, gate = 50, velocity = 100, accent = 0 } = lanes[lane];
    const step = stepTicks(lane);
    const end = playedTicks(lane, cycleIndex);
    const sounding = cycleHits(lane, cycleIndex);
    // the gap after the last hit runs to the next Cycle's first hit
    const next = cycleHits(lane, cycleIndex + 1)[0]?.onset ?? playedTicks(lane, cycleIndex + 1);
    const gaps = sounding.map(({ onset }, i) => (i + 1 < sounding.length ? sounding[i + 1].onset : end + next) - onset);
    const noteLength = (gap: number) =>
      gate <= 50 ? (step * gate) / 100 : step / 2 + ((gap - step / 2) * (gate - 50)) / 50; // short … half a step … tied
    const toPitch = (degree: number) => clampToMidi(degreeToNote(degree + transpose, scale) + 12 * octave);
    const start = cycleStart(lane, cycleIndex);
    return sounding.flatMap(({ onset, degree, count }, hit) => {
      const before = start + onset < layoutChange.at; // started under the previous Voice Layout
      let duration = noteLength(gaps[hit]);
      const cut = before && start + onset + duration > layoutChange.at; // still sounding when the layout changes
      if (cut) duration = layoutChange.at - start - onset;
      const note = {
        onset,
        duration,
        velocity: Math.max(1, Math.min(127, velocity + (hit === 0 ? accent : 0))),
      };
      return allocate(lane, degree, count, toPitch, before ? layoutChange.from : voiceLayout).map(({ voice, pitch }) => ({
        ...note,
        pitch,
        voice,
      }));
    });
  }

  /** The song tick a Cycle starts at (the inverse of locate). */
  function cycleStart(lane: number, cycleIndex: number): number {
    if (!resetTicks) return cycleIndex * cycleTicks(lane);
    const perPeriod = cyclesPerPeriod(lane);
    return Math.floor(cycleIndex / perPeriod) * resetTicks + (cycleIndex % perPeriod) * cycleTicks(lane);
  }

  /**
   * Voice Layout: which Voices play a hit, and at which pitches. A single Voice plays the hit; a poly group plays
   * the Chord Shape, lowest note on the highest-numbered Voice (the bottom of the Perfourmer's panel), doubling
   * the bass when the chord is smaller than the group; round-robin takes the group's Voices in turn, counting
   * hits since the last Reset; unison plays the hit on every Voice.
   */
  function allocate(
    lane: number,
    degree: number,
    count: number,
    toPitch: (degree: number) => number,
    layout: VoiceLayout,
  ) {
    const group: readonly number[] = layout[lane] ?? [];
    const { groupMode = "poly", chordShape = "triad" } = lanes[lane];
    if (group.length === 1 || (group.length && groupMode !== "poly")) {
      if (groupMode === "unison") return group.map((voice) => ({ voice, pitch: toPitch(degree) }));
      return [{ voice: group[count % group.length], pitch: toPitch(degree) }];
    }
    const chord = [...new Set(CHORD_SHAPES[chordShape].map((d) => toPitch(degree + d)))].sort((a, b) => a - b);
    const root = toPitch(degree);
    for (let up = 12; chord.length < group.length; up += 12) {
      const below = chord[0] - 12;
      const fill = below >= LOWEST_BASS && !chord.includes(below) ? below : root + up; // an octave down, else up
      if (fill <= 127 && !chord.includes(fill)) chord.push(fill);
      else if (fill > 127) break;
      chord.sort((a, b) => a - b);
    }
    const highestFirst = [...group].reverse();
    return chord.slice(0, group.length).map((pitch, i) => ({ voice: highestFirst[i], pitch }));
  }

  function laneVoices(lane: number): readonly number[] {
    return voiceLayout[lane] ?? [];
  }

  /** Change the Voice Layout: at once while stopped (songTicks undefined), else on the next bar far enough ahead.
   * A change on top of one that hasn't landed yet replaces it, from the layout still sounding. */
  function changeLayout(next: VoiceLayout, songTicks?: number) {
    if (songTicks === undefined) layoutChange = { from: next, at: 0 };
    else {
      let at = (Math.floor(songTicks / ticksPerBar) + 1) * ticksPerBar;
      if (at - songTicks < CHANGE_LEAD) at += ticksPerBar;
      layoutChange = { from: songTicks < layoutChange.at ? layoutChange.from : voiceLayout, at };
    }
    voiceLayout = next;
  }

  function stepTicks(lane: number): number {
    return RATE_TICKS[lanes[lane].rate ?? "1/16"];
  }

  function cycleTicks(lane: number): number {
    return lanes[lane].length * stepTicks(lane);
  }

  /** How much of a Cycle is played: all of it, unless a Reset cuts it short. */
  function playedTicks(lane: number, cycleIndex: number): number {
    const cycle = cycleTicks(lane);
    return resetTicks ? Math.min(cycle, resetTicks - cyclesSinceReset(lane, cycleIndex) * cycle) : cycle;
  }

  /** Cycles per Reset period (the last one may be cut short); Cycle numbers keep rising across Resets. */
  function cyclesPerPeriod(lane: number): number {
    return resetTicks ? Math.ceil(resetTicks / cycleTicks(lane)) : Infinity;
  }

  function cyclesSinceReset(lane: number, cycleIndex: number): number {
    return cycleIndex % cyclesPerPeriod(lane);
  }

  /** Where a Lane is at a song position: which Cycle, and how far into it. */
  function locate(lane: number, songTicks: number) {
    const cycle = cycleTicks(lane);
    const period = resetTicks ? Math.floor(songTicks / resetTicks) : 0;
    const sinceReset = resetTicks ? songTicks % resetTicks : songTicks;
    return {
      cycleIndex: (period ? period * cyclesPerPeriod(lane) : 0) + Math.floor(sinceReset / cycle),
      offsetTicks: sinceReset % cycle,
    };
  }

  /**
   * A Cycle as the fine-grid player reads it: the notes starting in each grid slot, in slot order, each with the
   * length it should last from that slot. The player reads slot floor(position / grid) on ticks one grid step
   * apart, so a note sounds up to a slot early; lengths are measured from there. A note followed by the same pitch
   * on its Voice (in this Cycle or the next) ends RETRIGGER_TICKS before it; one that reaches a different pitch
   * lasts LEGATO_TICKS past its start. No note is shorter than a slot.
   */
  function slotTable(lane: number, gridTicks: number, cycleIndex = 0): Slot[] {
    const slotOf = (tick: number) => Math.floor(tick / gridTicks + 1e-9);
    const end = playedTicks(lane, cycleIndex);
    // When Cycles aren't a whole number of slots (septuplets), a Cycle can start up to a slot's width before its
    // first tick, so its last slot isn't always reached: a note due there starts a slot earlier.
    const aligned = Number.isInteger(cycleTicks(lane) / gridTicks) && Number.isInteger(end / gridTicks);
    const lastSlot = aligned ? end / gridTicks - 1 : Math.ceil(end / gridTicks) - 2;
    const at = (e: Event, offset = 0) => (Math.min(slotOf(e.onset), lastSlot) + offset) * gridTicks;
    const events = renderCycle(lane, cycleIndex);
    const following = [
      ...events.map((e) => ({ ...e, start: at(e) })),
      ...renderCycle(lane, cycleIndex + 1).map((e) => ({ ...e, start: slotOf(e.onset) * gridTicks + end })),
    ];
    const slots = new Map<number, Slot["notes"]>();
    for (const e of events) {
      const start = at(e);
      let length = e.onset + e.duration - start;
      const next = following.find((n) => n.voice === e.voice && n.start > start);
      if (next && next.pitch === e.pitch) length = Math.min(length, next.start - start - RETRIGGER_TICKS);
      else if (next && start + length >= next.start) length = next.start - start + LEGATO_TICKS;
      const slot = start / gridTicks;
      slots.set(slot, [...(slots.get(slot) ?? []), [e.voice, e.pitch, e.velocity, Math.max(gridTicks, length)]]);
    }
    return [...slots].sort(([a], [b]) => a - b).map(([slot, notes]) => ({ slot, notes }));
  }

  return {
    configure(config: EngineConfig) {
      lanes = config.lanes;
      for (const [lane, entry] of captures) {
        const matches = !!lanes[lane] && signature(lanes[lane]).join() === entry.signature.join();
        if (matches && entry.waiting) entry.waiting = false;
        else if (!matches && !entry.waiting) captures.delete(lane);
        else continue;
        basesChanged++;
      }
      scale = config.scale ?? C_MAJOR;
      ticksPerBar = config.ticksPerBar ?? 1920;
      resetTicks = (config.resetBars ?? 0) * ticksPerBar;
    },
    cycleTicks,
    /** The Reset period in ticks (0 = no Reset). */
    resetTicks: () => resetTicks,
    locate,
    renderCycle,
    /** The Voices a Lane drives (after any pending Voice Layout change). */
    laneVoices,
    /** Voicing Matrix click: put a Voice on a Lane, taking it off any other Lane, or take it off. songTicks: the
     * song position while playing (the change lands on a bar), undefined while stopped (at once). Returns whether
     * anything changed. */
    setVoice(lane: number, voice: number, on: boolean, songTicks?: number): boolean {
      if (laneVoices(lane).includes(voice) === on) return false;
      const lanesCount = Math.max(voiceLayout.length, lane + 1);
      const next = Array.from({ length: lanesCount }, (_, n) => {
        const others = laneVoices(n).filter((v) => v !== voice);
        return n === lane && on ? [...others, voice].sort((a, b) => a - b) : others;
      });
      changeLayout(next, songTicks);
      return true;
    },
    /** Set the whole Voicing Matrix, e.g. to a Split; songTicks as for setVoice. */
    setVoiceLayout(layout: VoiceLayout, songTicks?: number) {
      changeLayout(layout.map((voices) => [...voices]), songTicks);
    },
    /** Forget the Voice Layout a change replaced once the bar it landed on has played (a jump back in the song
     * then hears the new layout). Returns whether it did. */
    retireVoiceLayout(songTicks: number): boolean {
      if (layoutChange.from === voiceLayout || songTicks < layoutChange.at + ticksPerBar) return false;
      layoutChange = { from: voiceLayout, at: 0 };
      return true;
    },
    slotTable,
    /** What the Lane shows at a song position (the pattern view and readouts). The Cycle is worked out once and
     * kept until it or the Lane's settings change, so polling is cheap. */
    laneView(lane: number, songTicks: number): LaneView {
      const { cycleIndex, offsetTicks } = locate(lane, songTicks);
      const step = Math.floor(offsetTicks / stepTicks(lane));
      const key = `${cycleIndex}|${resetTicks}|${basesChanged}|${JSON.stringify(lanes[lane])}`;
      const cached = views.get(lane);
      if (cached?.key === key) return { ...cached.view, step };
      const heard = cycleHits(lane, cycleIndex);
      const onsets = new Set(heard.map((h) => Math.round(h.onset / stepTicks(lane))));
      const steps = Array.from({ length: lanes[lane].length }, (_, i) => onsets.has(i));
      const rows: boolean[][] = [];
      for (let i = 0; i < steps.length; i += VIEW_ROW) rows.push(steps.slice(i, i + VIEW_ROW));
      const view = {
        cycleIndex,
        rows,
        mutated: JSON.stringify(heard) !== JSON.stringify(cycleHits(lane, cycleIndex, false)),
        captureDepth: active(lane)?.stack.length ?? 0,
      };
      views.set(lane, { key, view });
      return { ...view, step };
    },
    /** Make the Cycle's sounding pattern the Lane's new Base (the previous one is kept for Revert). */
    capture(lane: number, cycleIndex: number) {
      const { length } = lanes[lane];
      const heard = cycleHits(lane, cycleIndex);
      const step = stepTicks(lane);
      const steps = Array.from({ length }, (_, i) => heard.some((h) => Math.round(h.onset / step) === i));
      const degreeAt = new Map(heard.map((h) => [Math.round(h.onset / step), h.degree]));
      const last = heard[heard.length - 1]?.degree ?? (lanes[lane].pitchCycle ?? [0])[0];
      let held = last; // rests before the first hit carry the last hit's degree round
      const degrees = steps.map((_, i) => (held = degreeAt.get(i) ?? held));
      const entry = active(lane) ?? { signature: signature(lanes[lane]), stack: [] };
      entry.stack.push({ steps, degrees });
      captures.set(lane, entry);
      basesChanged++;
    },
    /** Go back to the Base from before the last Capture. */
    revert(lane: number) {
      const entry = active(lane);
      entry?.stack.pop();
      if (entry && !entry.stack.length) captures.delete(lane);
      basesChanged++;
    },
    /** How many Captured Bases the Lane has (Revert steps back through them); 0 = its Euclidean pattern. */
    captureDepth(lane: number) {
      return active(lane)?.stack.length ?? 0;
    },
    /** Every Lane's Captured Bases as plain numbers, for storing with the set. */
    saveBases(): number[] {
      const out = [1, captures.size];
      for (const [lane, { signature: taken, stack }] of captures) {
        out.push(lane, taken.length, ...taken, stack.length);
        for (const { steps, degrees } of stack) out.push(steps.length, ...steps.map(Number), ...degrees);
      }
      return out;
    },
    loadBases(data: number[]) {
      captures.clear();
      basesChanged++;
      if (data[0] !== 1) return;
      let i = 2;
      for (let n = 0; n < data[1]; n++) {
        const lane = data[i++];
        const taken = data.slice(i + 1, i + 1 + data[i]);
        i += 1 + taken.length;
        const stack: Captured[] = [];
        for (let depth = data[i++]; depth > 0; depth--) {
          const length = data[i++];
          stack.push({ steps: data.slice(i, i + length).map(Boolean), degrees: data.slice(i + length, i + 2 * length) });
          i += 2 * length;
        }
        captures.set(lane, { signature: taken, stack, waiting: true });
      }
      for (const [lane, entry] of captures)
        if (lanes[lane] && signature(lanes[lane]).join() === entry.signature.join()) entry.waiting = false;
    },
    voiceJoined(deviceId: number, voice: number) {
      voiceDevices.set(deviceId, voice);
    },
    voiceLeft(deviceId: number) {
      voiceDevices.delete(deviceId);
    },
    voiceStatus() {
      const claims = new Map<number, number>();
      for (const voice of voiceDevices.values()) claims.set(voice, (claims.get(voice) ?? 0) + 1);
      const connected = [...claims.keys()].sort((a, b) => a - b);
      return { connected, duplicates: connected.filter((voice) => claims.get(voice)! > 1) };
    },
  };
}
