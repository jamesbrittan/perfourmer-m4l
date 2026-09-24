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
 * degrees and octave octaves. */
export type LaneParams = {
  hits: number;
  length: number;
  rotate: number;
  rate?: Rate;
  pitchCycle?: number[];
  transpose?: number;
  octave?: number;
};
/** Live's global scale: root 0–11 (C = 0) and the semitone intervals of its notes. */
export type Scale = { root: number; intervals: number[] };
/** resetBars 0 = never; ticksPerBar follows Live's time signature (4/4 = 1920). */
export type EngineConfig = { lanes: LaneParams[]; scale?: Scale; resetBars?: number; ticksPerBar?: number };
/** One player grid slot: the [voice, pitch, velocity] messages due there (velocity 0 = note-off). */
export type Slot = { slot: number; notes: [number, number, number][] };

const MIDDLE_C = 60;
const C_MAJOR: Scale = { root: 0, intervals: [0, 2, 4, 5, 7, 9, 11] };
const GATE = 0.5; // fraction of a step, until articulation arrives
const VELOCITY = 100;

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

type Note = Omit<Event, "voice">;

const clampToMidi = (note: number) => Math.max(0, Math.min(127, note));

/** A scale degree as a MIDI note: degrees past the Scale's last note carry on into the next octave. */
function degreeToNote(degree: number, { root, intervals }: Scale): number {
  const octave = Math.floor(degree / intervals.length);
  const index = degree - octave * intervals.length;
  return MIDDLE_C + root + intervals[index] + 12 * octave;
}

/** Voice Layout: which Voice plays each of a Lane's notes. The MVP layout is 4×mono (Lane n → Voice n). */
function allocate(lane: number, notes: Note[]): Event[] {
  return notes.map((note) => ({ ...note, voice: lane + 1 }));
}

export function createEngine() {
  let lanes: LaneParams[] = [];
  let scale = C_MAJOR;
  let resetTicks = 0; // 0 = Lanes never realign
  const voiceDevices = new Map<number, number>(); // Voice device id -> Voice number

  function renderCycle(lane: number, cycleIndex: number): Event[] {
    const { hits, length, rotate, pitchCycle = [0], transpose = 0, octave = 0 } = lanes[lane];
    const pattern = bjorklund(hits, length);
    const shift = rotate % length;
    const rotated = pattern.map((_, step) => pattern[(step - shift + length) % length]);
    const step = stepTicks(lane);
    const onsets = rotated.flatMap((hit, i) => (hit ? [i * step] : []));
    const hitsBefore = cyclesSinceReset(lane, cycleIndex) * onsets.length; // the Pitch Cycle realigns at each Reset
    const notes = onsets.map((onset, hit) => ({
      onset,
      duration: step * GATE,
      pitch: clampToMidi(degreeToNote(pitchCycle[(hitsBefore + hit) % pitchCycle.length] + transpose, scale) + 12 * octave),
      velocity: VELOCITY,
    }));
    return allocate(lane, notes);
  }

  function stepTicks(lane: number): number {
    return RATE_TICKS[lanes[lane].rate ?? "1/16"];
  }

  function cycleTicks(lane: number): number {
    return lanes[lane].length * stepTicks(lane);
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

  /** A Cycle as the fine-grid player reads it: messages grouped by grid slot, in slot order. */
  function slotTable(lane: number, gridTicks: number, cycleIndex = 0): Slot[] {
    const slots = new Map<number, Slot["notes"]>();
    const at = (tick: number, note: [number, number, number]) => {
      const slot = Math.round(tick / gridTicks);
      slots.set(slot, [...(slots.get(slot) ?? []), note]);
    };
    for (const e of renderCycle(lane, cycleIndex)) {
      at(e.onset, [e.voice, e.pitch, e.velocity]);
      at(e.onset + e.duration, [e.voice, e.pitch, 0]);
    }
    return [...slots].sort(([a], [b]) => a - b).map(([slot, notes]) => ({ slot, notes }));
  }

  return {
    configure(config: EngineConfig) {
      lanes = config.lanes;
      scale = config.scale ?? C_MAJOR;
      resetTicks = (config.resetBars ?? 0) * (config.ticksPerBar ?? 1920);
    },
    cycleTicks,
    locate,
    renderCycle,
    slotTable,
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
