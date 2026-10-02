"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  CHORD_SHAPES: () => CHORD_SHAPES,
  CONTROL_NAMES: () => CONTROL_NAMES,
  E16_CHANNEL: () => E16_CHANNEL,
  ENCODER_CC_BASE: () => ENCODER_CC_BASE,
  FREEZE_BASE: () => FREEZE_BASE,
  FREEZE_OFF: () => FREEZE_OFF,
  GROUP_MODES: () => GROUP_MODES,
  HUB_OUTLETS: () => HUB_OUTLETS,
  LANES: () => LANES,
  LANE_COLOURS: () => LANE_COLOURS,
  LANE_DEFAULTS: () => LANE_DEFAULTS,
  PAGE_CC: () => PAGE_CC,
  PITCH_PRESETS: () => PITCH_PRESETS,
  PITCH_STEPS: () => PITCH_STEPS,
  PLAYER: () => PLAYER,
  PLAYER_POSITION: () => PLAYER_POSITION,
  PUSH_CC_BASE: () => PUSH_CC_BASE,
  RANDOM_GROUPS: () => RANDOM_GROUPS,
  RANGES: () => RANGES,
  RATES: () => RATES,
  REL_DECREMENT: () => REL_DECREMENT,
  REL_INCREMENT: () => REL_INCREMENT,
  RHYTHM_PRESETS: () => RHYTHM_PRESETS,
  SPLITS: () => SPLITS,
  VOICES: () => VOICES,
  controlName: () => controlName,
  createE16Display: () => createE16Display,
  createEngine: () => createEngine,
  createScheduler: () => createScheduler,
  decodeDelta: () => decodeDelta,
  encoderCC: () => encoderCC,
  encoderSysEx: () => encoderSysEx,
  hitsControl: () => hitsControl,
  inRange: () => inRange,
  lengthControl: () => lengthControl,
  pageRefresh: () => pageRefresh,
  pageTitleSysEx: () => pageTitleSysEx,
  pushCC: () => pushCC,
  randomSettings: () => randomSettings,
  rateControl: () => rateControl,
  rhythmPage: () => rhythmPage,
  rotateControl: () => rotateControl,
  stepEncoder: () => stepEncoder,
  testPage: () => testPage
});
module.exports = __toCommonJS(index_exports);

// node_modules/pure-rand/lib/esm/distribution/uniformInt.js
function uniformIntInternal(rng, rangeSize) {
  const MaxAllowed = rangeSize > 2 ? ~~(4294967296 / rangeSize) * rangeSize : 4294967296;
  let deltaV = rng.next() + 2147483648;
  while (deltaV >= MaxAllowed) deltaV = rng.next() + 2147483648;
  return deltaV % rangeSize;
}
function fromNumberToArrayInt64(out, n) {
  if (n < 0) {
    const posN = -n;
    out.sign = -1;
    out.data[0] = ~~(posN / 4294967296);
    out.data[1] = posN >>> 0;
  } else {
    out.sign = 1;
    out.data[0] = ~~(n / 4294967296);
    out.data[1] = n >>> 0;
  }
  return out;
}
function substractArrayInt64(out, arrayIntA, arrayIntB) {
  const lowA = arrayIntA.data[1];
  const highA = arrayIntA.data[0];
  const signA = arrayIntA.sign;
  const lowB = arrayIntB.data[1];
  const highB = arrayIntB.data[0];
  const signB = arrayIntB.sign;
  out.sign = 1;
  if (signA === 1 && signB === -1) {
    const low2 = lowA + lowB;
    const high = highA + highB + (low2 > 4294967295 ? 1 : 0);
    out.data[0] = high >>> 0;
    out.data[1] = low2 >>> 0;
    return out;
  }
  let lowFirst = lowA;
  let highFirst = highA;
  let lowSecond = lowB;
  let highSecond = highB;
  if (signA === -1) {
    lowFirst = lowB;
    highFirst = highB;
    lowSecond = lowA;
    highSecond = highA;
  }
  let reminderLow = 0;
  let low = lowFirst - lowSecond;
  if (low < 0) {
    reminderLow = 1;
    low = low >>> 0;
  }
  out.data[0] = highFirst - highSecond - reminderLow;
  out.data[1] = low;
  return out;
}
function uniformArrayIntInternal(rng, out, rangeSize) {
  const maxIndex0 = rangeSize[0] + 1;
  out[0] = uniformIntInternal(rng, maxIndex0);
  out[1] = uniformIntInternal(rng, 4294967296);
  while (out[0] >= rangeSize[0] && (out[0] !== rangeSize[0] || out[1] >= rangeSize[1])) {
    out[0] = uniformIntInternal(rng, maxIndex0);
    out[1] = uniformIntInternal(rng, 4294967296);
  }
  return out;
}
var safeNumberMaxSafeInteger = Number.MAX_SAFE_INTEGER;
var sharedA = {
  sign: 1,
  data: [0, 0]
};
var sharedB = {
  sign: 1,
  data: [0, 0]
};
var sharedC = {
  sign: 1,
  data: [0, 0]
};
var sharedData = [0, 0];
function uniformLargeIntInternal(rng, from, to, rangeSize) {
  const rangeSizeArrayIntValue = rangeSize <= safeNumberMaxSafeInteger ? fromNumberToArrayInt64(sharedC, rangeSize) : substractArrayInt64(sharedC, fromNumberToArrayInt64(sharedA, to), fromNumberToArrayInt64(sharedB, from));
  if (rangeSizeArrayIntValue.data[1] === 4294967295) {
    rangeSizeArrayIntValue.data[0] += 1;
    rangeSizeArrayIntValue.data[1] = 0;
  } else rangeSizeArrayIntValue.data[1] += 1;
  uniformArrayIntInternal(rng, sharedData, rangeSizeArrayIntValue.data);
  return sharedData[0] * 4294967296 + sharedData[1] + from;
}
function uniformInt(rng, from, to) {
  const rangeSize = to - from;
  if (rangeSize <= 4294967295) return uniformIntInternal(rng, rangeSize + 1) + from;
  return uniformLargeIntInternal(rng, from, to, rangeSize);
}

// node_modules/pure-rand/lib/esm/generator/xoroshiro128plus.js
var jumps = [
  3639956645,
  3750757012,
  1261568508,
  386426335
];
var XoroShiro128Plus = class XoroShiro128Plus2 {
  constructor(s01, s00, s11, s10) {
    this.s01 = s01;
    this.s00 = s00;
    this.s11 = s11;
    this.s10 = s10;
  }
  clone() {
    return new XoroShiro128Plus2(this.s01, this.s00, this.s11, this.s10);
  }
  next() {
    const out = this.s00 + this.s10 | 0;
    const a0 = this.s10 ^ this.s00;
    const a1 = this.s11 ^ this.s01;
    const s00 = this.s00;
    const s01 = this.s01;
    this.s00 = s00 << 24 ^ s01 >>> 8 ^ a0 ^ a0 << 16;
    this.s01 = s01 << 24 ^ s00 >>> 8 ^ a1 ^ (a1 << 16 | a0 >>> 16);
    this.s10 = a1 << 5 ^ a0 >>> 27;
    this.s11 = a0 << 5 ^ a1 >>> 27;
    return out;
  }
  jump() {
    let ns01 = 0;
    let ns00 = 0;
    let ns11 = 0;
    let ns10 = 0;
    let s01 = this.s01;
    let s00 = this.s00;
    let s11 = this.s11;
    let s10 = this.s10;
    for (let i = 0; i !== 4; ++i) {
      const ji = jumps[i];
      for (let mask = 1; mask; mask <<= 1) {
        if (ji & mask) {
          ns01 ^= s01;
          ns00 ^= s00;
          ns11 ^= s11;
          ns10 ^= s10;
        }
        const a0 = s10 ^ s00;
        const a1 = s11 ^ s01;
        const s00_ = s00;
        const s01_ = s01;
        s00 = s00_ << 24 ^ s01_ >>> 8 ^ a0 ^ a0 << 16;
        s01 = s01_ << 24 ^ s00_ >>> 8 ^ a1 ^ (a1 << 16 | a0 >>> 16);
        s10 = a1 << 5 ^ a0 >>> 27;
        s11 = a0 << 5 ^ a1 >>> 27;
      }
    }
    this.s01 = ns01;
    this.s00 = ns00;
    this.s11 = ns11;
    this.s10 = ns10;
  }
  getState() {
    return [
      this.s01,
      this.s00,
      this.s11,
      this.s10
    ];
  }
};
function xoroshiro128plus(seed) {
  return new XoroShiro128Plus(-1, ~seed, seed | 0, 0);
}

// src/device.ts
var LANES = 4;
var VOICES = 4;
var PITCH_STEPS = 8;
var PLAYER = { gridTicks: 2, bankSize: 1e4, noReset: 1e12, dict: "pf4.player" };
var PLAYER_POSITION = "fmod(fmod($f1,$f3),$f2)";
var RANGES = {
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
  seed: [0, 999]
};
var LANE_DEFAULTS = [
  { hits: 16, length: 16, accent: 15 },
  { hits: 4, length: 16, rotate: 2, gate: 30 },
  { hits: 2, length: 7, rate: "1/4", gate: 100, velocity: 90 },
  { hits: 5, length: 13, velocity: 85, mutation: 20 }
].map((lane, n) => ({
  rotate: 0,
  rate: "1/16",
  pitchCycle: [0],
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
  ...lane
}));
var HUB_OUTLETS = {
  table: 0,
  // player table edits
  pending: 1,
  // "<lane> <bank> <cycleTicks> <now>" offers
  voiceStatus: 2,
  resetPeriod: 3,
  // in ticks, PLAYER.noReset when off
  readouts: 4,
  // "<lane> set <text>": 0–3 positions, 4–7 Bases
  transport: 5,
  // 1 running, 0 stopped
  scale: 6,
  bases: 7,
  // Captured Bases, to the stored-only pattr
  patterns: 8,
  // "<lane> set <text>" pattern view
  presetDials: 9,
  // "<lane> <hits> <rotate> <length>" from a Rhythm Preset
  presetMenus: 10,
  // "<lane> set 0": the Rhythm Preset menu back to "—"
  laneVoices: 11,
  // "<lane> set <text>"
  script: 12,
  // scripting messages to thispatcher
  frozen: 13,
  // each Lane's held Cycle (FREEZE_OFF, FREEZE_BASE or the Cycle), to the stored-only pattr
  controls: 14,
  // "<lane> <control> <value>" to move a Lane's controls (Randomise and its Undo)
  pitchPresetBoxes: 15,
  // "<lane> <length> <deg0> ... <deg7>" from a Pitch Preset
  pitchPresetMenus: 16,
  // "<lane> set 0": the Pitch Preset menu back to "—"
  e16: 17
  // SysEx bytes to the E16 via send_midi
};
var FREEZE_OFF = -1;
var FREEZE_BASE = -2;
var CONTROL_NAMES = {
  voiceButton: "btn_L{lane}_V{voice}",
  groupMode: "menu_L{lane}_gm",
  chordShape: "menu_L{lane}_chord",
  hits: "dial_L{lane}_hits",
  length: "dial_L{lane}_len",
  rotate: "dial_L{lane}_rot",
  rate: "dial_L{lane}_rate",
  rhythm: "menu_L{lane}_rhythm",
  pitchPreset: "menu_L{lane}_pitch_preset"
};
var controlName = (kind, lane, voice = 0) => CONTROL_NAMES[kind].replace("{lane}", String(lane)).replace("{voice}", String(voice));
var clamp = (value, [lo, hi]) => Math.max(lo, Math.min(hi, value));
function inRange(lane) {
  const out = { ...lane };
  for (const key of ["hits", "length", "rotate", "transpose", "octave", "gate", "velocity", "accent", "probability", "mutation", "seed"])
    if (typeof out[key] === "number") out[key] = clamp(out[key], RANGES[key]);
  if (out.pitchCycle) {
    const degrees = out.pitchCycle.slice(0, PITCH_STEPS).map((d) => clamp(d, RANGES.degree));
    out.pitchCycle = degrees.length ? degrees : [0];
  }
  return out;
}
var RANDOM_GROUPS = ["rhythm", "pitch", "evolution"];
function randomSettings(current, groups, random) {
  const int = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
  const pick = (choices) => choices[Math.floor(random() * choices.length)];
  const out = {};
  if (groups.includes("rhythm")) {
    const length = int(3, 16);
    out.length = length;
    out.hits = int(1, length);
    out.rotate = int(0, length - 1);
    out.rate = pick(["1/8", "1/16"]);
  }
  if (groups.includes("pitch")) {
    const degrees = current.pitchCycle ?? [0];
    const centre = Math.round(degrees.reduce((a, b) => a + b, 0) / degrees.length);
    const [lo, hi] = RANGES.degree;
    const around = [Math.max(lo, centre - 5), Math.min(hi, centre + 5)];
    out.pitchCycle = Array.from({ length: int(2, 6) }, () => int(...around));
  }
  if (groups.includes("evolution")) {
    out.probability = int(70, 100);
    out.mutation = int(0, 60);
    out.seed = int(0, RANGES.seed[1]);
  }
  return out;
}

// src/scheduler.ts
function createScheduler({ engine, lanes, gridTicks, bankSize, playingBank: reported, send }) {
  const each = (make) => Array.from({ length: lanes }, make);
  const emptyBank = () => ({ cycle: 0, keys: [] });
  const banks = each(() => [emptyBank(), emptyBank()]);
  const offered = each(() => -1);
  const adoptedAt = each(() => null);
  let polledAt = 0;
  let playing = false;
  function playingBank(n) {
    const bank = reported(n);
    return bank === 0 || bank === 1 ? bank : 1;
  }
  const playingCycle = (n) => banks[n][playingBank(n)].cycle;
  const pendingCycle = (n) => offered[n] !== -1 && offered[n] !== playingBank(n) ? banks[n][offered[n]].cycle : null;
  function withdraw(n) {
    send({ type: "offer", lane: n, bank: -1, cycleTicks: 0, now: false });
    offered[n] = -1;
  }
  function soundingCycle(n) {
    const at = adoptedAt[n];
    return at === null ? playingCycle(n) : engine.locate(n, at).cycleIndex;
  }
  function prepareNext(n, current, force = false) {
    if (force || pendingCycle(n) !== current + 1) render(n, current + 1);
  }
  function render(n, cycleIndex, now = false) {
    withdraw(n);
    const playingNow = playingBank(n);
    if (cycleIndex === null) cycleIndex = banks[n][playingNow].cycle;
    const bank = 1 - playingNow;
    const target = banks[n][bank];
    for (const key of target.keys) send({ type: "remove", key });
    target.keys = engine.slotTable(n, gridTicks, cycleIndex).map(({ slot, notes }) => {
      const key = (n * 2 + bank) * bankSize + slot;
      send({ type: "write", key, notes });
      return key;
    });
    target.cycle = cycleIndex;
    offered[n] = bank;
    send({ type: "offer", lane: n, bank, cycleTicks: engine.cycleTicks(n), now: now && playing });
  }
  function follow(n, cycleIndex) {
    if (!playing) {
      if (playingCycle(n) !== cycleIndex) render(n, cycleIndex);
      return;
    }
    const held = soundingCycle(n);
    prepareNext(n, Math.abs(cycleIndex - held) <= 1 ? Math.max(cycleIndex, held) : cycleIndex);
  }
  function changed(n) {
    if (playing) prepareNext(n, soundingCycle(n), true);
    else render(n, engine.locate(n, polledAt).cycleIndex);
  }
  return {
    /** A fresh player (not playing any bank yet): every Lane from its first Cycle. */
    start() {
      for (let n = 0; n < lanes; n++) render(n, 0);
    },
    get playing() {
      return playing;
    },
    transport(isPlaying) {
      playing = isPlaying;
      if (!playing) {
        for (let n = 0; n < lanes; n++) withdraw(n);
        return;
      }
      for (let n = 0; n < lanes; n++) {
        adoptedAt[n] = null;
        prepareNext(n, playingCycle(n));
      }
    },
    /** The song position, polled a few times a second. */
    poll(songTicks) {
      polledAt = songTicks;
      for (let n = 0; n < lanes; n++) follow(n, engine.locate(n, songTicks).cycleIndex);
    },
    /** The player took up a pending bank at a Cycle boundary: line up the Cycle after it. */
    adopted(n, songTicks) {
      if (!playing) return;
      adoptedAt[n] = songTicks;
      const sounding = engine.locate(n, songTicks).cycleIndex;
      if (playingCycle(n) !== sounding) return render(n, sounding, true);
      prepareNext(n, sounding);
    },
    /** The Lane's settings changed: heard from its next Cycle (at once while stopped). */
    changed,
    /** The Lane's settings changed and can't wait for the next Cycle: heard from the next note. */
    changedNow(n) {
      if (playing) render(n, null, true);
      else changed(n);
    },
    /** The Cycle a Capture takes: the one sounding, or the one at the song position while stopped. */
    captureCycle(n) {
      return playing ? soundingCycle(n) : engine.locate(n, polledAt).cycleIndex;
    },
    /** The song position a change timed to the bar counts from: undefined while stopped (the change is immediate).
     * The latest position known, from the last poll or the last Cycle boundary a Lane reported, whichever is later:
     * judged from a stale one, a change made just after an earlier one landed would take it as still to come. */
    changePosition() {
      return playing ? Math.max(polledAt, ...adoptedAt.map((at) => at ?? -Infinity)) : void 0;
    }
  };
}

// src/e16.ts
var E16_CHANNEL = 15;
var ENCODER_CC_BASE = 20;
var encoderCC = (encoder) => ENCODER_CC_BASE + encoder;
var PUSH_CC_BASE = 40;
var pushCC = (encoder) => PUSH_CC_BASE + encoder;
var PAGE_CC = 119;
var REL_INCREMENT = 65;
var REL_DECREMENT = 63;
function decodeDelta(value) {
  if (value === REL_INCREMENT) return 1;
  if (value === REL_DECREMENT) return -1;
  if (value > 64) return value - 64;
  if (value < 64) return value - 64;
  return 0;
}
var SYSEX_HEADER = [240, 0, 127, 127, 1];
var SYSEX_END = 247;
function encoderSysEx(encoder, ring, label, colour = { r: 0, g: 127, b: 40 }) {
  const chars = label.padEnd(4, " ").slice(0, 4);
  return [
    ...SYSEX_HEADER,
    encoder & 127,
    ring & 127,
    colour.r & 127,
    colour.g & 127,
    colour.b & 127,
    chars.charCodeAt(0) & 127,
    chars.charCodeAt(1) & 127,
    chars.charCodeAt(2) & 127,
    chars.charCodeAt(3) & 127,
    SYSEX_END
  ];
}
function pageTitleSysEx(title) {
  const chars = title.padEnd(4, " ").slice(0, 4);
  return [
    ...SYSEX_HEADER,
    127,
    // page title, not an encoder
    0,
    0,
    0,
    0,
    // ring/colour unused
    chars.charCodeAt(0) & 127,
    chars.charCodeAt(1) & 127,
    chars.charCodeAt(2) & 127,
    chars.charCodeAt(3) & 127,
    SYSEX_END
  ];
}
var RATE_LABELS = {
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
  "1/32Q": "32Q "
};
var clamp2 = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
var LANE_COLOURS = [
  { r: 7, g: 127, b: 127 },
  // Lane 1: Cyan (index 7)
  { r: 2, g: 60, b: 0 },
  // Lane 2: Orange (index 2)
  { r: 5, g: 127, b: 0 },
  // Lane 3: Green (index 5)
  { r: 12, g: 127, b: 0 }
  // Lane 4: Magenta (index 12)
];
var ringScale = (value, lo, hi) => hi === lo ? 64 : Math.round((value - lo) / (hi - lo) * 127);
function numericControl(kind, lane, param, labelFn, colour) {
  const [lo, hi] = RANGES[param];
  return {
    kind,
    lane,
    value: (s) => s[param] ?? lo,
    step(s, delta) {
      const current = s[param] ?? lo;
      const next = clamp2(current + delta, lo, hi);
      if (next === current) return null;
      return { [param]: next };
    },
    label: labelFn ? (s) => labelFn(s[param] ?? lo, s) : (s) => String(s[param] ?? lo).padStart(4, " "),
    ring: (s) => ringScale(s[param] ?? lo, lo, hi),
    colour
  };
}
function rateControl(lane, colour) {
  return {
    kind: "rate",
    lane,
    value: (s) => RATES.indexOf(s.rate ?? "1/16"),
    step(s, delta) {
      const idx = RATES.indexOf(s.rate ?? "1/16");
      const next = clamp2(idx + delta, 0, RATES.length - 1);
      if (next === idx) return null;
      return { rate: RATES[next] };
    },
    label: (s) => RATE_LABELS[s.rate ?? "1/16"],
    ring: (s) => ringScale(RATES.indexOf(s.rate ?? "1/16"), 0, RATES.length - 1),
    colour
  };
}
function lengthControl(lane, colour) {
  const [lo, hi] = RANGES.length;
  return {
    kind: "length",
    lane,
    value: (s) => s.length,
    step(s, delta) {
      const next = clamp2(s.length + delta, lo, hi);
      if (next === s.length) return null;
      const out = { length: next };
      if (s.hits > next) out.hits = next;
      if (s.rotate >= next) out.rotate = next - 1;
      return out;
    },
    label: (s) => String(s.length).padStart(4, " "),
    ring: (s) => ringScale(s.length, lo, hi),
    colour
  };
}
function hitsControl(lane, colour) {
  const lo = RANGES.hits[0];
  return {
    kind: "hits",
    lane,
    value: (s) => s.hits,
    step(s, delta) {
      const hi = s.length;
      const next = clamp2(s.hits + delta, lo, hi);
      if (next === s.hits) return null;
      return { hits: next };
    },
    label: (s) => String(s.hits).padStart(4, " "),
    ring: (s) => ringScale(s.hits, lo, s.length),
    colour
  };
}
function rotateControl(lane, colour) {
  return {
    kind: "rotate",
    lane,
    value: (s) => s.rotate,
    step(s, delta) {
      const hi = Math.max(0, s.length - 1);
      const next = clamp2(s.rotate + delta, 0, hi);
      if (next === s.rotate) return null;
      return { rotate: next };
    },
    label: (s) => String(s.rotate).padStart(4, " "),
    ring: (s) => ringScale(s.rotate, 0, Math.max(0, s.length - 1)),
    colour
  };
}
function groupModeControl(lane) {
  const labels = { poly: "poly", "round-robin": "r-rb", unison: "unis" };
  return {
    kind: "groupMode",
    lane,
    value: (s) => GROUP_MODES.indexOf(s.groupMode ?? "poly"),
    step(s, delta) {
      const idx = GROUP_MODES.indexOf(s.groupMode ?? "poly");
      const next = clamp2(idx + delta, 0, GROUP_MODES.length - 1);
      if (next === idx) return null;
      return { groupMode: GROUP_MODES[next] };
    },
    label: (s) => labels[s.groupMode ?? "poly"] ?? "poly",
    ring: (s) => ringScale(GROUP_MODES.indexOf(s.groupMode ?? "poly"), 0, GROUP_MODES.length - 1)
  };
}
function chordShapeControl(lane) {
  const names = Object.keys(CHORD_SHAPES);
  const labels = {
    unison: "unis",
    "5th": " 5th",
    triad: "trID",
    "7th": " 7th",
    sus2: "sus2",
    sus4: "sus4",
    "6th": " 6th",
    add9: "add9",
    quartal: "qrtl",
    "open triad": "opTR",
    octaves: "oct "
  };
  return {
    kind: "chordShape",
    lane,
    value: (s) => names.indexOf(s.chordShape ?? "triad"),
    step(s, delta) {
      const idx = names.indexOf(s.chordShape ?? "triad");
      const next = clamp2(idx + delta, 0, names.length - 1);
      if (next === idx) return null;
      return { chordShape: names[next] };
    },
    label: (s) => labels[s.chordShape ?? "triad"] ?? "    ",
    ring: (s) => ringScale(names.indexOf(s.chordShape ?? "triad"), 0, names.length - 1)
  };
}
function testPage() {
  return {
    title: "TST ",
    encoders: [
      rateControl(0),
      lengthControl(0),
      hitsControl(0),
      rotateControl(0),
      numericControl("gate", 0, "gate", (v) => v === 100 ? "tied" : `${v}%`.padStart(4, " ")),
      numericControl("velocity", 0, "velocity"),
      numericControl("accent", 0, "accent"),
      numericControl("probability", 0, "probability", (v) => `${v}%`.padStart(4, " ")),
      numericControl("mutation", 0, "mutation"),
      groupModeControl(0),
      chordShapeControl(0),
      null,
      null,
      null,
      null,
      null
    ]
  };
}
function rhythmPage() {
  return {
    title: "RHY ",
    encoders: [
      // Row 0
      hitsControl(0, LANE_COLOURS[0]),
      lengthControl(0, LANE_COLOURS[0]),
      hitsControl(1, LANE_COLOURS[1]),
      lengthControl(1, LANE_COLOURS[1]),
      // Row 1
      rotateControl(0, LANE_COLOURS[0]),
      rateControl(0, LANE_COLOURS[0]),
      rotateControl(1, LANE_COLOURS[1]),
      rateControl(1, LANE_COLOURS[1]),
      // Row 2
      hitsControl(2, LANE_COLOURS[2]),
      lengthControl(2, LANE_COLOURS[2]),
      hitsControl(3, LANE_COLOURS[3]),
      lengthControl(3, LANE_COLOURS[3]),
      // Row 3
      rotateControl(2, LANE_COLOURS[2]),
      rateControl(2, LANE_COLOURS[2]),
      rotateControl(3, LANE_COLOURS[3]),
      rateControl(3, LANE_COLOURS[3])
    ]
  };
}
function stepEncoder(page, encoder, delta, settings) {
  const control = page.encoders[encoder];
  if (!control) return null;
  const changes = control.step(settings, delta);
  if (!changes) return null;
  const after = { ...settings, ...changes };
  const sysex = encoderSysEx(encoder, control.ring(after), control.label(after), control.colour);
  return { changes, sysex, lane: control.lane };
}
function pageRefresh(page, laneSettings) {
  const messages = [pageTitleSysEx(page.title)];
  for (let i = 0; i < page.encoders.length; i++) {
    const control = page.encoders[i];
    if (!control) {
      messages.push(encoderSysEx(i, 0, "    ", { r: 20, g: 20, b: 20 }));
      continue;
    }
    const s = laneSettings(control.lane);
    messages.push(encoderSysEx(i, control.ring(s), control.label(s), control.colour));
  }
  return messages;
}
function createE16Display(page) {
  const showing = /* @__PURE__ */ new Map();
  const keep = (message) => {
    const key = message.join(" ");
    if (showing.get(message[5]) === key) return false;
    showing.set(message[5], key);
    return true;
  };
  return {
    update: (laneSettings) => pageRefresh(page, laneSettings).filter(keep),
    sent(message) {
      keep(message);
    },
    forget() {
      showing.clear();
    }
  };
}

// src/index.ts
var RHYTHM_PRESETS = [
  // Grid and metric anchors
  ["Four-on-floor", 4, 16, 0],
  ["Offbeat", 4, 16, 2],
  ["Ostinato", 16, 16, 0],
  // 16-step syncopations and club grooves
  ["Dotted 8th", 5, 16, 0],
  ["3-against-4", 3, 16, 0],
  ["Samba", 7, 16, 0],
  ["Central African", 9, 16, 0],
  // 8-step claves and timelines
  ["Tresillo", 3, 8, 0],
  ["Cinquillo", 5, 8, 0],
  ["Tuareg", 7, 8, 0],
  // Minimalist and polymetric phasing
  ["Detroit", 2, 5, 0],
  ["Ostinato", 3, 5, 0],
  ["Phasing", 3, 7, 0],
  ["Outside Now", 4, 11, 0],
  ["Bell", 7, 12, 0],
  ["Phase Pair", 8, 13, 0]
].map(([name, hits, length, rotate]) => ({ name: `${name} ${hits}/${length}`, hits, length, rotate }));
var RATE_TICKS = {
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
  "1/32Q": 48
};
var RATES = Object.keys(RATE_TICKS);
var SPLITS = {
  "1+1+1+1": [[1], [2], [3], [4]],
  "4": [[1, 2, 3, 4]],
  "1+3": [[1], [2, 3, 4]],
  "2+2": [[1, 2], [3, 4]],
  "1+1+2": [[1], [2], [3, 4]]
};
var GROUP_MODES = ["poly", "round-robin", "unison"];
var CHORD_SHAPES = {
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
  octaves: [0, 7, 14, 21]
};
var LOWEST_BASS = 24;
var VIEW_ROW = 16;
var MIDDLE_C = 60;
var CHANGE_LEAD = 240;
var RETRIGGER_TICKS = 6;
var LEGATO_TICKS = 6;
var C_MAJOR = { root: 0, intervals: [0, 2, 4, 5, 7, 9, 11] };
function bjorklund(hits, length) {
  hits = Math.max(0, Math.min(hits, length));
  if (hits === 0 || hits === length) return Array.from({ length }, () => hits > 0);
  let groups = Array.from({ length: hits }, () => [true]);
  let remainder = Array.from({ length: length - hits }, () => [false]);
  do {
    const pairs = Math.min(groups.length, remainder.length);
    const leftover = groups.length > pairs ? groups.slice(pairs) : remainder.slice(pairs);
    groups = groups.slice(0, pairs).map((g, i) => g.concat(remainder[i]));
    remainder = leftover;
  } while (remainder.length > 1);
  return groups.concat(remainder).flat();
}
var mix = (seed, cycleIndex) => Math.imul(seed + 1, 2654435761) ^ Math.imul(cycleIndex + 1, 2246822507) | 0;
var clampToMidi = (note) => Math.max(0, Math.min(127, note));
function degreeToNote(degree, { root, intervals }) {
  const octave = Math.floor(degree / intervals.length);
  const index = degree - octave * intervals.length;
  return MIDDLE_C + root + intervals[index] + 12 * octave;
}
var signature = ({ hits, length, rotate, pitchCycle = [0] }) => [hits, length, rotate, pitchCycle.length, ...pitchCycle];
function createEngine() {
  let lanes = [];
  const captures = /* @__PURE__ */ new Map();
  const active = (lane) => {
    const entry = captures.get(lane);
    return entry && !entry.waiting ? entry : void 0;
  };
  let scale = C_MAJOR;
  let voiceLayout = SPLITS["1+1+1+1"];
  let layoutChange = { from: voiceLayout, at: 0 };
  let ticksPerBar = 1920;
  let resetBars = 0;
  let resetTicks = 0;
  let basesChanged = 0;
  const views = /* @__PURE__ */ new Map();
  const voiceDevices = /* @__PURE__ */ new Map();
  function cycleHits(lane, cycleIndex, evolve = true) {
    const { hits, length, rotate, pitchCycle = [0], seed = 0, freeze } = lanes[lane];
    if (freeze === "base") evolve = false;
    const end = playedTicks(lane, cycleIndex);
    if (typeof freeze === "number") cycleIndex = freeze;
    const { mutation, probability } = evolve ? { mutation: 0, probability: 100, ...lanes[lane] } : { mutation: 0, probability: 100 };
    const stack = active(lane)?.stack;
    const captured = stack?.[stack.length - 1];
    const pattern = bjorklund(hits, length);
    const shift = rotate % length;
    const base = captured?.steps ?? pattern.map((_, step2) => pattern[(step2 - shift + length) % length]);
    const rng = xoroshiro128plus(mix(seed, cycleIndex));
    const chance = () => uniformInt(rng, 0, 99999) / 1e5;
    const register = captured?.degrees ?? pitchCycle;
    const [lo, hi] = [Math.min(...register) - 3, Math.max(...register) + 3];
    const baseHits = base.filter(Boolean).length;
    const density = captured ? baseHits / length : hits / length;
    let hitIndex = cyclesSinceReset(lane, cycleIndex) * baseHits;
    let count = cyclesSinceReset(lane, cycleIndex) * baseHits;
    const step = stepTicks(lane);
    const sounding = [];
    base.forEach((isHit, i) => {
      const [stepDraw, hitDraw, pitchDraw, degreeDraw, soundDraw] = [chance(), chance(), chance(), chance(), chance()];
      const hit = stepDraw < mutation / 127 ? hitDraw < density : isHit;
      if (!hit) return;
      const hitCount = count++;
      const baseDegree = captured ? captured.degrees[i] : pitchCycle[hitIndex++ % pitchCycle.length];
      const degree = pitchDraw < mutation / 127 ? lo + Math.floor(degreeDraw * (hi - lo + 1)) : baseDegree;
      const onset = i * step;
      if (soundDraw * 100 < probability && onset < end - 1e-6) sounding.push({ onset, degree, count: hitCount });
    });
    return sounding;
  }
  function renderCycle(lane, cycleIndex) {
    const { transpose = 0, octave = 0, gate = 50, velocity = 100, accent = 0 } = lanes[lane];
    const step = stepTicks(lane);
    const end = playedTicks(lane, cycleIndex);
    const sounding = cycleHits(lane, cycleIndex);
    const next = cycleHits(lane, cycleIndex + 1)[0]?.onset ?? playedTicks(lane, cycleIndex + 1);
    const gaps = sounding.map(({ onset }, i) => (i + 1 < sounding.length ? sounding[i + 1].onset : end + next) - onset);
    const noteLength = (gap) => gate <= 50 ? step * gate / 100 : step / 2 + (gap - step / 2) * (gate - 50) / 50;
    const toPitch = (degree) => clampToMidi(degreeToNote(degree + transpose, scale) + 12 * octave);
    const start = cycleStart(lane, cycleIndex);
    return sounding.flatMap(({ onset, degree, count }, hit) => {
      const before = start + onset < layoutChange.at;
      let duration = noteLength(gaps[hit]);
      const cut = before && start + onset + duration > layoutChange.at;
      if (cut) duration = layoutChange.at - start - onset;
      const note = {
        onset,
        duration,
        velocity: Math.max(1, Math.min(127, velocity + (hit === 0 ? accent : 0)))
      };
      return allocate(lane, degree, count, toPitch, before ? layoutChange.from : voiceLayout).map(({ voice, pitch }) => ({
        ...note,
        pitch,
        voice
      }));
    });
  }
  function cycleStart(lane, cycleIndex) {
    if (!resetTicks) return cycleIndex * cycleTicks(lane);
    const perPeriod = cyclesPerPeriod(lane);
    return Math.floor(cycleIndex / perPeriod) * resetTicks + cycleIndex % perPeriod * cycleTicks(lane);
  }
  function allocate(lane, degree, count, toPitch, layout) {
    const group = layout[lane] ?? [];
    const { groupMode = "poly", chordShape = "triad" } = lanes[lane];
    if (group.length === 1 || group.length && groupMode !== "poly") {
      if (groupMode === "unison") return group.map((voice) => ({ voice, pitch: toPitch(degree) }));
      return [{ voice: group[count % group.length], pitch: toPitch(degree) }];
    }
    const chord = [...new Set(CHORD_SHAPES[chordShape].map((d) => toPitch(degree + d)))].sort((a, b) => a - b);
    const root = toPitch(degree);
    for (let up = 12; chord.length < group.length; up += 12) {
      const below = chord[0] - 12;
      const fill = below >= LOWEST_BASS && !chord.includes(below) ? below : root + up;
      if (fill <= 127 && !chord.includes(fill)) chord.push(fill);
      else if (fill > 127) break;
      chord.sort((a, b) => a - b);
    }
    const highestFirst = [...group].reverse();
    return chord.slice(0, group.length).map((pitch, i) => ({ voice: highestFirst[i], pitch }));
  }
  function laneVoices(lane) {
    return voiceLayout[lane] ?? [];
  }
  function changeLayout(next, songTicks) {
    if (songTicks === void 0) layoutChange = { from: next, at: 0 };
    else {
      let at = (Math.floor(songTicks / ticksPerBar) + 1) * ticksPerBar;
      if (at - songTicks < CHANGE_LEAD) at += ticksPerBar;
      layoutChange = { from: songTicks < layoutChange.at ? layoutChange.from : voiceLayout, at };
    }
    voiceLayout = next;
  }
  function stepTicks(lane) {
    return RATE_TICKS[lanes[lane].rate ?? "1/16"];
  }
  function cycleTicks(lane) {
    return lanes[lane].length * stepTicks(lane);
  }
  function playedTicks(lane, cycleIndex) {
    const cycle = cycleTicks(lane);
    return resetTicks ? Math.min(cycle, resetTicks - cyclesSinceReset(lane, cycleIndex) * cycle) : cycle;
  }
  function cyclesPerPeriod(lane) {
    return resetTicks ? Math.ceil(resetTicks / cycleTicks(lane)) : Infinity;
  }
  function cyclesSinceReset(lane, cycleIndex) {
    return cycleIndex % cyclesPerPeriod(lane);
  }
  function locate(lane, songTicks) {
    const cycle = cycleTicks(lane);
    const period = resetTicks ? Math.floor(songTicks / resetTicks) : 0;
    const sinceReset = resetTicks ? songTicks % resetTicks : songTicks;
    return {
      cycleIndex: (period ? period * cyclesPerPeriod(lane) : 0) + Math.floor(sinceReset / cycle),
      offsetTicks: sinceReset % cycle
    };
  }
  function slotTable(lane, gridTicks, cycleIndex = 0) {
    const slotOf = (tick) => Math.floor(tick / gridTicks + 1e-9);
    const end = playedTicks(lane, cycleIndex);
    const aligned = Number.isInteger(cycleTicks(lane) / gridTicks) && Number.isInteger(end / gridTicks);
    const lastSlot = aligned ? end / gridTicks - 1 : Math.ceil(end / gridTicks) - 2;
    const at = (e, offset = 0) => (Math.min(slotOf(e.onset), lastSlot) + offset) * gridTicks;
    const events = renderCycle(lane, cycleIndex);
    const following = [
      ...events.map((e) => ({ ...e, start: at(e) })),
      ...renderCycle(lane, cycleIndex + 1).map((e) => ({ ...e, start: slotOf(e.onset) * gridTicks + end }))
    ];
    const slots = /* @__PURE__ */ new Map();
    for (const e of events) {
      const start = at(e);
      let length = e.onset + e.duration - start;
      const next = following.find((n) => n.voice === e.voice && n.start > start);
      if (next && next.pitch === e.pitch) length = Math.min(length, next.start - start - RETRIGGER_TICKS);
      else if (next && start + length >= next.start) length = next.start - start + LEGATO_TICKS;
      const slot = start / gridTicks;
      slots.set(slot, [...slots.get(slot) ?? [], [e.voice, e.pitch, e.velocity, Math.max(gridTicks, length)]]);
    }
    return [...slots].sort(([a], [b]) => a - b).map(([slot, notes]) => ({ slot, notes }));
  }
  function settingsChanged() {
    for (const [lane, entry] of captures) {
      const matches = !!lanes[lane] && signature(lanes[lane]).join() === entry.signature.join();
      if (matches && entry.waiting) entry.waiting = false;
      else if (!matches && !entry.waiting) captures.delete(lane);
      else continue;
      basesChanged++;
    }
  }
  return {
    /** Replace every setting: the Lanes, and the song settings (anything left out takes its default). Lane
     * settings are brought inside the control ranges (RANGES), here and in setLane. */
    configure(config) {
      lanes = config.lanes.map((lane) => inRange(lane));
      scale = config.scale ?? C_MAJOR;
      ticksPerBar = config.ticksPerBar ?? 1920;
      resetTicks = (config.resetBars ?? 0) * ticksPerBar;
      resetBars = config.resetBars ?? 0;
      settingsChanged();
    },
    /** Change some of a Lane's settings, keeping the rest. */
    setLane(lane, change) {
      lanes[lane] = { ...lanes[lane], ...inRange(change) };
      settingsChanged();
    },
    /** Change some of the song settings, keeping the rest. */
    setSong(change) {
      if (change.scale) scale = change.scale;
      if (change.ticksPerBar !== void 0) ticksPerBar = change.ticksPerBar;
      if (change.resetBars !== void 0) resetBars = change.resetBars;
      resetTicks = resetBars * ticksPerBar;
    },
    /** The song settings as they stand. */
    songSettings() {
      return { scale, resetBars, ticksPerBar };
    },
    /** A Lane's settings as they stand (a copy). */
    laneSettings(lane) {
      return { ...lanes[lane] };
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
    setVoice(lane, voice, on, songTicks) {
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
    setVoiceLayout(layout, songTicks) {
      changeLayout(layout.map((voices) => [...voices]), songTicks);
    },
    /** Forget the Voice Layout a change replaced once the bar it landed on has played (a jump back in the song
     * then hears the new layout). Returns whether it did. */
    retireVoiceLayout(songTicks) {
      if (layoutChange.from === voiceLayout || songTicks < layoutChange.at + ticksPerBar) return false;
      layoutChange = { from: voiceLayout, at: 0 };
      return true;
    },
    slotTable,
    /** What the Lane shows at a song position (the pattern view and readouts). The Cycle is worked out once and
     * kept until it or the Lane's settings change, so polling is cheap. */
    laneView(lane, songTicks) {
      const { cycleIndex, offsetTicks } = locate(lane, songTicks);
      const step = Math.floor(offsetTicks / stepTicks(lane));
      const key = `${cycleIndex}|${resetTicks}|${basesChanged}|${JSON.stringify(lanes[lane])}`;
      const cached = views.get(lane);
      if (cached?.key === key) return { ...cached.view, step };
      const heard = cycleHits(lane, cycleIndex);
      const onsets = new Set(heard.map((h) => Math.round(h.onset / stepTicks(lane))));
      const steps = Array.from({ length: lanes[lane].length }, (_, i) => onsets.has(i));
      const rows = [];
      for (let i = 0; i < steps.length; i += VIEW_ROW) rows.push(steps.slice(i, i + VIEW_ROW));
      const view = {
        cycleIndex,
        rows,
        mutated: JSON.stringify(heard) !== JSON.stringify(cycleHits(lane, cycleIndex, false)),
        captureDepth: active(lane)?.stack.length ?? 0
      };
      views.set(lane, { key, view });
      return { ...view, step };
    },
    /** Make the Cycle's sounding pattern the Lane's new Base (the previous one is kept for Revert). */
    capture(lane, cycleIndex) {
      const { length } = lanes[lane];
      const heard = cycleHits(lane, cycleIndex);
      const step = stepTicks(lane);
      const steps = Array.from({ length }, (_, i) => heard.some((h) => Math.round(h.onset / step) === i));
      const degreeAt = new Map(heard.map((h) => [Math.round(h.onset / step), h.degree]));
      const last = heard[heard.length - 1]?.degree ?? (lanes[lane].pitchCycle ?? [0])[0];
      let held = last;
      const degrees = steps.map((_, i) => held = degreeAt.get(i) ?? held);
      const entry = active(lane) ?? { signature: signature(lanes[lane]), stack: [] };
      entry.stack.push({ steps, degrees });
      captures.set(lane, entry);
      if (lanes[lane].freeze !== void 0) lanes[lane] = { ...lanes[lane], freeze: "base" };
      basesChanged++;
    },
    /** Go back to the Base from before the last Capture. */
    revert(lane) {
      const entry = active(lane);
      entry?.stack.pop();
      if (entry && !entry.stack.length) captures.delete(lane);
      basesChanged++;
    },
    /** How many Captured Bases the Lane has (Revert steps back through them); 0 = its Euclidean pattern. */
    captureDepth(lane) {
      return active(lane)?.stack.length ?? 0;
    },
    /** Every Lane's Captured Bases as plain numbers, for storing with the set. */
    saveBases() {
      const out = [1, captures.size];
      for (const [lane, { signature: taken, stack }] of captures) {
        out.push(lane, taken.length, ...taken, stack.length);
        for (const { steps, degrees } of stack) out.push(steps.length, ...steps.map(Number), ...degrees);
      }
      return out;
    },
    loadBases(data) {
      captures.clear();
      basesChanged++;
      if (data[0] !== 1) return;
      let i = 2;
      for (let n = 0; n < data[1]; n++) {
        const lane = data[i++];
        const taken = data.slice(i + 1, i + 1 + data[i]);
        i += 1 + taken.length;
        const stack = [];
        for (let depth = data[i++]; depth > 0; depth--) {
          const length = data[i++];
          stack.push({ steps: data.slice(i, i + length).map(Boolean), degrees: data.slice(i + length, i + 2 * length) });
          i += 2 * length;
        }
        captures.set(lane, { signature: taken, stack, waiting: true });
      }
      settingsChanged();
    },
    voiceJoined(deviceId, voice) {
      voiceDevices.set(deviceId, voice);
    },
    voiceLeft(deviceId) {
      voiceDevices.delete(deviceId);
    },
    voiceStatus() {
      const claims = /* @__PURE__ */ new Map();
      for (const voice of voiceDevices.values()) claims.set(voice, (claims.get(voice) ?? 0) + 1);
      const connected = [...claims.keys()].sort((a, b) => a - b);
      return { connected, duplicates: connected.filter((voice) => claims.get(voice) > 1) };
    }
  };
}
var PITCH_PRESETS = [
  // Anchors & Pedals
  { name: "Root Drone", degrees: [0] },
  { name: "Octave Bounce", degrees: [0, 7] },
  { name: "Root & 5th", degrees: [0, 4] },
  // Diatonic Arpeggios
  { name: "Triad Up", degrees: [0, 2, 4] },
  { name: "Triad Arch", degrees: [0, 2, 4, 2] },
  { name: "Seventh Arp", degrees: [0, 2, 4, 6] },
  { name: "Alberti Bass", degrees: [0, 4, 2, 4] },
  // Acid Techno & 303 Lines
  { name: "Acid Octaves", degrees: [0, 7, 0, 7, 0, 2, 7, 0] },
  { name: "Acid Bounce", degrees: [0, 0, 7, 0, 6, 0, 4, 7] },
  { name: "Acid Slide", degrees: [0, 2, 3, 7, 6, 4, 2, 0] },
  { name: "Acid Roll", degrees: [0, 0, 2, 0] },
  // Sequencer Figures & Ostinatos
  { name: "Berlin Ostinato", degrees: [0, 0, 7, 0, 5] },
  { name: "Sub Drop", degrees: [0, 0, -1, 0] },
  { name: "Passacaglia", degrees: [0, -1, -2, -3] },
  // Minimalist & Contour Figures
  { name: "Reich Cell", degrees: [0, 1, 4, 5, 6] },
  { name: "Pendulum 3", degrees: [0, 2, 0] },
  { name: "Zigzag 5", degrees: [0, 3, 1, 4, 2] }
];
