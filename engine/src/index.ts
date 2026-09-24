export type Event = { onset: number; duration: number; pitch: number; velocity: number; voice: number };
export type LaneParams = { hits: number; length: number; rotate: number };
export type EngineConfig = { lanes: LaneParams[] };
/** One player grid slot: the [voice, pitch, velocity] messages due there (velocity 0 = note-off). */
export type Slot = { slot: number; notes: [number, number, number][] };

const STEP_TICKS = 120; // fixed 1/16 at 480 PPQ until Lane rates arrive
const PITCH = 60; // fixed middle C until Pitch Cycles arrive
const GATE_TICKS = STEP_TICKS / 2;
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

export function createEngine() {
  let lanes: LaneParams[] = [];

  function renderCycle(lane: number, _cycleIndex: number): Event[] {
    const { hits, length, rotate } = lanes[lane];
    const pattern = bjorklund(hits, length);
    const shift = rotate % length;
    const rotated = pattern.map((_, step) => pattern[(step - shift + length) % length]);
    return rotated.flatMap((hit, step) =>
      hit ? [{ onset: step * STEP_TICKS, duration: GATE_TICKS, pitch: PITCH, velocity: VELOCITY, voice: lane + 1 }] : [],
    );
  }

  function cycleTicks(lane: number): number {
    return lanes[lane].length * STEP_TICKS;
  }

  /** The Cycle as the fine-grid player reads it: messages grouped by grid slot, in slot order. */
  function slotTable(lane: number, gridTicks: number): Slot[] {
    const slots = new Map<number, Slot["notes"]>();
    const at = (tick: number, note: [number, number, number]) => {
      const slot = Math.round(tick / gridTicks);
      slots.set(slot, [...(slots.get(slot) ?? []), note]);
    };
    for (const e of renderCycle(lane, 0)) {
      at(e.onset, [e.voice, e.pitch, e.velocity]);
      at(e.onset + e.duration, [e.voice, e.pitch, 0]);
    }
    return [...slots].sort(([a], [b]) => a - b).map(([slot, notes]) => ({ slot, notes }));
  }

  return {
    configure(config: EngineConfig) {
      lanes = config.lanes;
    },
    cycleTicks,
    renderCycle,
    slotTable,
  };
}
