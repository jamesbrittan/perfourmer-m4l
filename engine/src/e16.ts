/**
 * Oxi E16 ↔ Hub controller layer.
 *
 * The E16 Lua script sends raw encoder increments as CCs; the Hub steps the
 * value, sets the live.* control, and sends SysEx back with the encoder's
 * label, ring position and colour. This module holds everything both sides
 * need to agree on, and the stepping/labelling logic the Hub calls.
 *
 * Nothing here depends on Max: it's tested in Node alongside the engine.
 */

import { RATES, GROUP_MODES, CHORD_SHAPES, type Rate, type LaneParams } from "./index";
import { RANGES } from "./device";

// ─── CC protocol (E16 → Hub) ────────────────────────────────────────────────
//
// Every encoder is "manual" in the Lua script: a turn sends one CC per click.
// Value 65 = +1 step, value 63 = −1 step (relative encoding, same convention
// as most Ableton control surfaces). Push-button presses and page changes
// also send CCs.

/** MIDI channel the E16 script sends and receives on (0-indexed). */
export const E16_CHANNEL = 15; // channel 16

/** CC numbers for the 16 encoders (one per encoder, 0-indexed within a page). */
export const ENCODER_CC_BASE = 20;
export const encoderCC = (encoder: number) => ENCODER_CC_BASE + encoder;

/** CC numbers for encoder push-buttons (same layout, offset by 16). */
export const PUSH_CC_BASE = 40;
export const pushCC = (encoder: number) => PUSH_CC_BASE + encoder;

/** CC for page changes: value = page number (0-indexed). */
export const PAGE_CC = 119;

/** Relative encoder values. */
export const REL_INCREMENT = 65;
export const REL_DECREMENT = 63;

/** Decode a relative CC value to a signed delta. */
export function decodeDelta(value: number): number {
  if (value === REL_INCREMENT) return 1;
  if (value === REL_DECREMENT) return -1;
  // Fast turns may send values further from 64
  if (value > 64) return value - 64;
  if (value < 64) return value - 64;
  return 0;
}

// ─── SysEx protocol (Hub → E16) ─────────────────────────────────────────────
//
// The Hub sends one SysEx message per encoder update. The E16 script parses it
// and sets the encoder's label, ring position and colour.
//
// Format:  F0 00 7F 7F 01 <encoder> <ring> <r> <g> <b> <c0> <c1> <c2> <c3> F7
//
// - encoder: 0–15
// - ring:    0–127 (LED ring position)
// - r, g, b: 0–127 (colour, 7-bit)
// - c0–c3:   4 ASCII characters (label), padded with spaces
//
// Manufacturer ID 00 7F 7F is "educational/development use" — fine for a
// private M4L device.

const SYSEX_HEADER = [0xf0, 0x00, 0x7f, 0x7f, 0x01];
const SYSEX_END = 0xf7;

/** Build a SysEx message to update one encoder's display. */
export function encoderSysEx(
  encoder: number,
  ring: number,
  label: string,
  colour: { r: number; g: number; b: number } = { r: 0, g: 127, b: 40 },
): number[] {
  const chars = label.padEnd(4, " ").slice(0, 4);
  return [
    ...SYSEX_HEADER,
    encoder & 0x7f,
    ring & 0x7f,
    colour.r & 0x7f,
    colour.g & 0x7f,
    colour.b & 0x7f,
    chars.charCodeAt(0) & 0x7f,
    chars.charCodeAt(1) & 0x7f,
    chars.charCodeAt(2) & 0x7f,
    chars.charCodeAt(3) & 0x7f,
    SYSEX_END,
  ];
}

/** Build a SysEx message to set a full page title (encoder byte = 0x7F). */
export function pageTitleSysEx(title: string): number[] {
  const chars = title.padEnd(4, " ").slice(0, 4);
  return [
    ...SYSEX_HEADER,
    0x7f, // page title, not an encoder
    0, 0, 0, 0, // ring/colour unused
    chars.charCodeAt(0) & 0x7f,
    chars.charCodeAt(1) & 0x7f,
    chars.charCodeAt(2) & 0x7f,
    chars.charCodeAt(3) & 0x7f,
    SYSEX_END,
  ];
}

// ─── Pages ──────────────────────────────────────────────────────────────────
//
// The test scope (Issue #12) uses a single page with Rate, Length and Hits for
// one Lane. The full layout will map the Hub's tabs to E16 pages.

/** A control the E16 can step through. */
export type E16Control = {
  /** What the control is: its name in the Hub. */
  kind: string;
  /** Which Lane it belongs to (0–3). */
  lane: number;
  /** The current value (an index for enumerated controls, a number for ranges). */
  value: (settings: Readonly<LaneParams>) => number;
  /** Step the value by delta (+1 or −1), returning the new settings to apply. Handles clamping. */
  step: (settings: Readonly<LaneParams>, delta: number) => Partial<LaneParams> | null;
  /** A 4-character label for the E16's screen. */
  label: (settings: Readonly<LaneParams>) => string;
  /** LED ring position (0–127). */
  ring: (settings: Readonly<LaneParams>) => number;
  /** LED colour. */
  colour?: { r: number; g: number; b: number };
};

// ─── Control definitions ────────────────────────────────────────────────────

/** 4-char rate labels, matching RATES order. */
const RATE_LABELS: Record<Rate, string> = {
  "1/1": "1/1 ",
  "1/2": "1/2 ",
  "1/4": "1/4 ",
  "1/4T": "1/4T",
  "1/8": "1/8 ",
  "1/8T": "1/8T",
  "1/16": "1/16",
  "1/16Q": "16Q ",
  "1/16T": "16T ",
  "1/16S": "16S ",
  "1/32": "1/32",
  "1/32Q": "32Q ",
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Scale a value from [lo, hi] to [0, 127] for the LED ring. */
const ringScale = (value: number, lo: number, hi: number) =>
  hi === lo ? 64 : Math.round(((value - lo) / (hi - lo)) * 127);

/** Create a numeric stepper control for a Lane parameter. */
function numericControl(
  kind: string,
  lane: number,
  param: keyof LaneParams & keyof typeof RANGES,
  labelFn?: (value: number, settings: Readonly<LaneParams>) => string,
): E16Control {
  const [lo, hi] = RANGES[param];
  return {
    kind,
    lane,
    value: (s) => (s[param] as number) ?? lo,
    step(s, delta) {
      const current = (s[param] as number) ?? lo;
      const next = clamp(current + delta, lo, hi);
      if (next === current) return null;
      return { [param]: next };
    },
    label: labelFn
      ? (s) => labelFn((s[param] as number) ?? lo, s)
      : (s) => String((s[param] as number) ?? lo).padStart(4, " "),
    ring: (s) => ringScale((s[param] as number) ?? lo, lo, hi),
  };
}

/** Rate: an enumerated control stepping through RATES. */
function rateControl(lane: number): E16Control {
  return {
    kind: "rate",
    lane,
    value: (s) => RATES.indexOf(s.rate ?? "1/16"),
    step(s, delta) {
      const idx = RATES.indexOf(s.rate ?? "1/16");
      const next = clamp(idx + delta, 0, RATES.length - 1);
      if (next === idx) return null;
      return { rate: RATES[next] };
    },
    label: (s) => RATE_LABELS[s.rate ?? "1/16"],
    ring: (s) => ringScale(RATES.indexOf(s.rate ?? "1/16"), 0, RATES.length - 1),
  };
}

/** Length: numeric, but stepping it may clamp Hits. */
function lengthControl(lane: number): E16Control {
  const [lo, hi] = RANGES.length;
  return {
    kind: "length",
    lane,
    value: (s) => s.length,
    step(s, delta) {
      const next = clamp(s.length + delta, lo, hi);
      if (next === s.length) return null;
      // Hits can't exceed Length; Rotate wraps too
      const out: Partial<LaneParams> = { length: next };
      if (s.hits > next) out.hits = next;
      if (s.rotate >= next) out.rotate = next - 1;
      return out;
    },
    label: (s) => String(s.length).padStart(4, " "),
    ring: (s) => ringScale(s.length, lo, hi),
  };
}

/** Hits: numeric, clamped to [0, Length]. */
function hitsControl(lane: number): E16Control {
  const lo = RANGES.hits[0];
  return {
    kind: "hits",
    lane,
    value: (s) => s.hits,
    step(s, delta) {
      const hi = s.length;
      const next = clamp(s.hits + delta, lo, hi);
      if (next === s.hits) return null;
      return { hits: next };
    },
    label: (s) => String(s.hits).padStart(4, " "),
    ring: (s) => ringScale(s.hits, lo, s.length),
  };
}

/** Rotate: numeric, clamped to [0, Length - 1]. */
function rotateControl(lane: number): E16Control {
  return {
    kind: "rotate",
    lane,
    value: (s) => s.rotate,
    step(s, delta) {
      const hi = Math.max(0, s.length - 1);
      const next = clamp(s.rotate + delta, 0, hi);
      if (next === s.rotate) return null;
      return { rotate: next };
    },
    label: (s) => String(s.rotate).padStart(4, " "),
    ring: (s) => ringScale(s.rotate, 0, Math.max(0, s.length - 1)),
  };
}

/** Group Mode: an enumerated control. */
function groupModeControl(lane: number): E16Control {
  const labels: Record<string, string> = { poly: "poly", "round-robin": "r-rb", unison: "unis" };
  return {
    kind: "groupMode",
    lane,
    value: (s) => GROUP_MODES.indexOf(s.groupMode ?? "poly"),
    step(s, delta) {
      const idx = GROUP_MODES.indexOf(s.groupMode ?? "poly");
      const next = clamp(idx + delta, 0, GROUP_MODES.length - 1);
      if (next === idx) return null;
      return { groupMode: GROUP_MODES[next] };
    },
    label: (s) => labels[s.groupMode ?? "poly"] ?? "poly",
    ring: (s) => ringScale(GROUP_MODES.indexOf(s.groupMode ?? "poly"), 0, GROUP_MODES.length - 1),
  };
}

/** Chord Shape: an enumerated control. */
function chordShapeControl(lane: number): E16Control {
  const names = Object.keys(CHORD_SHAPES);
  const labels: Record<string, string> = {
    unison: "unis", "5th": " 5th", triad: "trID", "7th": " 7th",
    sus2: "sus2", sus4: "sus4", "6th": " 6th", add9: "add9",
    quartal: "qrtl", "open triad": "opTR", octaves: "oct ",
  };
  return {
    kind: "chordShape",
    lane,
    value: (s) => names.indexOf(s.chordShape ?? "triad"),
    step(s, delta) {
      const idx = names.indexOf(s.chordShape ?? "triad");
      const next = clamp(idx + delta, 0, names.length - 1);
      if (next === idx) return null;
      return { chordShape: names[next] as keyof typeof CHORD_SHAPES };
    },
    label: (s) => labels[s.chordShape ?? "triad"] ?? "    ",
    ring: (s) => ringScale(names.indexOf(s.chordShape ?? "triad"), 0, names.length - 1),
  };
}

// ─── Page layout ────────────────────────────────────────────────────────────
//
// For the hardware test (Issue #12), one page with Rate + Length + Hits for
// Lane 0. The full layout will cover all Lanes and control groups.

export type E16Page = {
  title: string;
  /** 16 encoder slots; null = encoder is unused on this page. */
  encoders: (E16Control | null)[];
};

/** Test page: Rate, Length, Hits and Rotate for Lane 0 (first 4 encoders). */
export function testPage(): E16Page {
  return {
    title: "TST ",
    encoders: [
      rateControl(0),
      lengthControl(0),
      hitsControl(0),
      rotateControl(0),
      numericControl("gate", 0, "gate", (v) => (v === 100 ? "tied" : `${v}%`.padStart(4, " "))),
      numericControl("velocity", 0, "velocity"),
      numericControl("accent", 0, "accent"),
      numericControl("probability", 0, "probability", (v) => `${v}%`.padStart(4, " ")),
      numericControl("mutation", 0, "mutation"),
      groupModeControl(0),
      chordShapeControl(0),
      null, null, null, null, null,
    ],
  };
}

// ─── Full page layout (for after the hardware test) ─────────────────────────

/** Build the rhythm page for one Lane: Rate, Length, Hits, Rotate. */
export function rhythmPage(lane: number): E16Page {
  return {
    title: `R L${lane + 1}`,
    encoders: [
      rateControl(lane),
      lengthControl(lane),
      hitsControl(lane),
      rotateControl(lane),
      ...Array(12).fill(null),
    ],
  };
}

// ─── Stepping + feedback (called by the Hub) ────────────────────────────────

/**
 * Process an encoder turn: step the control, return the new Lane settings to
 * apply and the SysEx to send back to the E16. Returns null if the value
 * didn't change (encoder at its limit).
 */
export function stepEncoder(
  page: E16Page,
  encoder: number,
  delta: number,
  settings: Readonly<LaneParams>,
): { changes: Partial<LaneParams>; sysex: number[]; lane: number } | null {
  const control = page.encoders[encoder];
  if (!control) return null;
  const changes = control.step(settings, delta);
  if (!changes) return null;
  // Apply changes to get the post-step settings for label/ring
  const after = { ...settings, ...changes };
  const sysex = encoderSysEx(encoder, control.ring(after), control.label(after), control.colour);
  return { changes, sysex, lane: control.lane };
}

/**
 * Build the SysEx for every encoder on a page, reflecting the current state.
 * Called when a page is entered, or when a value changes from another source
 * (mouse, automation, preset, Randomise).
 */
export function pageRefresh(
  page: E16Page,
  laneSettings: (lane: number) => Readonly<LaneParams>,
): number[][] {
  const messages: number[][] = [pageTitleSysEx(page.title)];
  for (let i = 0; i < page.encoders.length; i++) {
    const control = page.encoders[i];
    if (!control) {
      // Blank unused encoders
      messages.push(encoderSysEx(i, 0, "    ", { r: 20, g: 20, b: 20 }));
      continue;
    }
    const s = laneSettings(control.lane);
    messages.push(encoderSysEx(i, control.ring(s), control.label(s), control.colour));
  }
  return messages;
}
