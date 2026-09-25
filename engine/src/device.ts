import type { LaneParams } from "./index";

/** Facts the engine, the Hub script (pf4-hub.js, through require) and the device generator (build_devices.py,
 * through from_engine) must agree on. Each is defined here once. */

export const LANES = 4;
/** Voices in the Voicing Matrix (one per Perfourmer synth channel). */
export const VOICES = 4;
/** Boxes in each Lane's Pitch Cycle editor. */
export const PITCH_STEPS = 8;

/** The native player: its table resolution in ticks (it reads slot floor(position / gridTicks)), the table key
 * layout ((lane * 2 + bank) * bankSize + slot), the Reset period meaning "never" (usable in its modulo), and the
 * dict it notes each Lane's playing bank in. */
export const PLAYER = { gridTicks: 2, bankSize: 10000, noReset: 1e12, dict: "pf4.player" } as const;

/** The player's position in a Cycle as a Max expr ($f1 song ticks, $f2 Cycle length, $f3 Reset period): the same
 * as the engine's locate(). */
export const PLAYER_POSITION = "fmod(fmod($f1,$f3),$f2)";

/** Each control's range (inclusive). Hits also never exceeds the Lane's Length. */
export const RANGES = {
  hits: [0, 32],
  length: [1, 32],
  rotate: [0, 31],
  degree: [-14, 14],
  transpose: [-7, 7],
  octave: [-3, 3],
  gate: [1, 100],
  velocity: [1, 127],
  accent: [0, 127],
  probability: [0, 100],
  mutation: [0, 127],
  seed: [0, 999],
} as const;

/** Each Lane's settings in a new Hub. */
export const LANE_DEFAULTS: LaneParams[] = [
  { hits: 16, length: 16, pitchCycle: [0, 0, 7, 0, 5], octave: -2, accent: 15 },
  { hits: 4, length: 16, rotate: 2, pitchCycle: [0, 3], octave: -1, gate: 30 },
  { hits: 2, length: 7, rate: "1/4", pitchCycle: [0, 2, 4], gate: 100, velocity: 90 },
  { hits: 5, length: 13, pitchCycle: [7, 9, 11, 12, 14], octave: 1, velocity: 85, mutation: 20 },
].map((lane, n) => ({
  rotate: 0,
  rate: "1/16",
  feel: "straight",
  transpose: 0,
  octave: 0,
  gate: 50,
  velocity: 100,
  accent: 0,
  probability: 100,
  mutation: 0,
  seed: n + 1,
  groupMode: "poly",
  chordShape: "triad",
  ...lane,
})) as LaneParams[];

/** The Hub script's outlets, by what they carry. */
export const HUB_OUTLETS = {
  table: 0, // player table edits
  pending: 1, // "<lane> <bank> <cycleTicks> <now> <release>" offers
  voiceStatus: 2,
  resetPeriod: 3, // in ticks, PLAYER.noReset when off
  readouts: 4, // "<lane> set <text>": 0–3 positions, 4–7 Bases
  transport: 5, // 1 running, 0 stopped
  scale: 6,
  bases: 7, // Captured Bases, to the stored-only pattr
  patterns: 8, // "<lane> set <text>" pattern view
  presetDials: 9, // "<lane> <hits> <rotate> <length>" from a Rhythm Preset
  presetMenus: 10, // "<lane> set 0": the Rhythm Preset menu back to "—"
  laneVoices: 11, // "<lane> set <text>"
  releaseVoices: 12, // "<lane> <voice> …" the Voices the player releases for that Lane
  script: 13, // scripting messages to thispatcher
  frozen: 14, // each Lane's held Cycle (FREEZE_OFF, FREEZE_BASE or the Cycle), to the stored-only pattr
} as const;

/** How a Lane's Freeze is stored with the set: off, holding its Base (after a Capture while frozen), or the Cycle. */
export const FREEZE_OFF = -1;
export const FREEZE_BASE = -2;

/** Scripting names of the controls the Hub script addresses ({lane} and {voice} count from 1). */
export const CONTROL_NAMES = {
  voiceButton: "btn_L{lane}_V{voice}",
  groupMode: "menu_L{lane}_gm",
  chordShape: "menu_L{lane}_chord",
  hits: "dial_L{lane}_hits",
  length: "dial_L{lane}_len",
  rotate: "dial_L{lane}_rot",
  rate: "dial_L{lane}_rate",
  feel: "menu_L{lane}_feel",
  rhythm: "menu_L{lane}_rhythm",
} as const;

export const controlName = (kind: keyof typeof CONTROL_NAMES, lane: number, voice = 0) =>
  CONTROL_NAMES[kind].replace("{lane}", String(lane)).replace("{voice}", String(voice));

const clamp = (value: number, [lo, hi]: readonly [number, number]) => Math.max(lo, Math.min(hi, value));

/** A Lane's settings brought inside the control ranges (only the settings given). */
export function inRange(lane: Partial<LaneParams>): Partial<LaneParams> {
  const out: Partial<LaneParams> = { ...lane };
  for (const key of ["hits", "length", "rotate", "transpose", "octave", "gate", "velocity", "accent", "probability", "mutation", "seed"] as const)
    if (typeof out[key] === "number") out[key] = clamp(out[key], RANGES[key]);
  if (out.pitchCycle) {
    const degrees = out.pitchCycle.slice(0, PITCH_STEPS).map((d) => clamp(d, RANGES.degree));
    out.pitchCycle = degrees.length ? degrees : [0];
  }
  return out;
}
