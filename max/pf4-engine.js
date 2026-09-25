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
  GROUP_MODES: () => GROUP_MODES,
  RATES: () => RATES,
  RHYTHM_PRESETS: () => RHYTHM_PRESETS,
  SPLITS: () => SPLITS,
  createEngine: () => createEngine
});
module.exports = __toCommonJS(index_exports);

// ../../perfourmer/engine/node_modules/pure-rand/lib/esm/distribution/uniformInt.js
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

// ../../perfourmer/engine/node_modules/pure-rand/lib/esm/generator/xoroshiro128plus.js
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

// src/index.ts
var RHYTHM_PRESETS = [
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
  ["Aka upper sangha", 13, 24]
].map(([name, hits, length]) => ({ name: `${name} ${hits}/${length}`, hits, length, rotate: 0 }));
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
  let resetTicks = 0;
  let basesChanged = 0;
  const views = /* @__PURE__ */ new Map();
  const voiceDevices = /* @__PURE__ */ new Map();
  function cycleHits(lane, cycleIndex, evolve = true) {
    const { hits, length, rotate, pitchCycle = [0], seed = 0 } = lanes[lane];
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
    const end = playedTicks(lane, cycleIndex);
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
    const tie = gate >= 100;
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
        velocity: Math.max(1, Math.min(127, velocity + (hit === 0 ? accent : 0))),
        ...tie && !cut && { tie }
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
  function cycleTable(lane, gridTicks, cycleIndex = 0, carried = [], replacing = { slots: [], carry: [] }) {
    const slotOf = (tick) => Math.floor(tick / gridTicks + 1e-9);
    const end = playedTicks(lane, cycleIndex);
    const aligned = Number.isInteger(cycleTicks(lane) / gridTicks) && Number.isInteger(end / gridTicks);
    const lastSlot = aligned ? end / gridTicks - 1 : Math.ceil(end / gridTicks) - 2;
    const nextCycleSlot = (tick) => Math.max(0, slotOf(tick - end));
    const ons = renderCycle(lane, cycleIndex);
    const carry = [];
    const offs = carried.filter((off) => off.slot <= lastSlot);
    for (const off of carried) if (off.slot > lastSlot) carry.push({ ...off, slot: nextCycleSlot(off.slot * gridTicks) });
    for (const e of ons) {
      const off = { voice: e.voice, pitch: e.pitch, tie: Boolean(e.tie) };
      const tick = e.onset + e.duration;
      const slot = Math.max(slotOf(tick), slotOf(e.onset) + 1);
      if (slot > lastSlot) carry.push({ ...off, slot: nextCycleSlot(tick) });
      else offs.push({ ...off, slot });
    }
    const held = (off) => (e) => off.tie && slotOf(e.onset) === off.slot && e.voice === off.voice && e.pitch === off.pitch;
    const skippedOns = /* @__PURE__ */ new Set();
    const sentOffs = offs.filter((off) => {
      const continued = ons.find(held(off));
      if (continued) skippedOns.add(continued);
      return !continued;
    });
    const sent = new Set(sentOffs);
    const oldOns = replacing.slots.flatMap(
      ({ slot, notes }) => notes.filter(([, , velocity]) => velocity > 0).map(([voice, pitch]) => ({ slot, voice, pitch }))
    );
    const newEnd = (on) => {
      const e = ons.find((x) => slotOf(x.onset) === on.slot && x.voice === on.voice && x.pitch === on.pitch);
      if (!e || skippedOns.has(e)) return -Infinity;
      const off = offs.find((o) => o.voice === e.voice && o.pitch === e.pitch && o.slot > on.slot);
      if (off) return sent.has(off) ? off.slot : Infinity;
      return carry.some((c) => c.voice === e.voice && c.pitch === e.pitch) ? Infinity : -Infinity;
    };
    for (const { slot, notes } of replacing.slots)
      for (const [voice, pitch, velocity] of notes) {
        if (velocity !== 0) continue;
        const started = oldOns.filter((o) => o.voice === voice && o.pitch === pitch && o.slot < slot).pop();
        const duplicate = sentOffs.some((o) => o.slot === slot && o.voice === voice && o.pitch === pitch);
        if (!duplicate && !(started && newEnd(started) >= slot)) sentOffs.push({ slot, voice, pitch, tie: false });
      }
    const slots = /* @__PURE__ */ new Map();
    const add = (slot, note) => slots.set(slot, [...slots.get(slot) ?? [], note]);
    const onsAt = (slot) => ons.filter((e) => !skippedOns.has(e) && slotOf(e.onset) === slot);
    const retriggers = (off) => onsAt(off.slot).some((e) => e.voice === off.voice && e.pitch === off.pitch);
    for (const off of sentOffs.filter(retriggers)) add(off.slot, [off.voice, off.pitch, 0]);
    for (const e of ons) if (!skippedOns.has(e)) add(slotOf(e.onset), [e.voice, e.pitch, e.velocity]);
    for (const off of sentOffs.filter((off2) => !retriggers(off2))) add(off.slot, [off.voice, off.pitch, 0]);
    const same = (a) => (b) => a.voice === b.voice && a.pitch === b.pitch;
    const identical = (a) => (b) => same(a)(b) && a.slot === b.slot && a.tie === b.tie;
    for (const old of replacing.carry) if (!carry.some(identical(old))) carry.push({ ...old, tie: false });
    return { slots: [...slots].sort(([a], [b]) => a - b).map(([slot, notes]) => ({ slot, notes })), carry };
  }
  function slotTable(lane, gridTicks, cycleIndex = 0) {
    return cycleTable(lane, gridTicks, cycleIndex).slots;
  }
  return {
    configure(config) {
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
    /** The Voices a Lane's player must release: its own, plus those it gave up in a change that hasn't landed. */
    releaseVoices(lane) {
      return [.../* @__PURE__ */ new Set([...layoutChange.from[lane] ?? [], ...laneVoices(lane)])].sort((a, b) => a - b);
    },
    /** Forget the Voice Layout a change replaced once the bar it landed on has played (a jump back in the song
     * then hears the new layout). Returns whether it did, i.e. whether releaseVoices may have changed. */
    retireVoiceLayout(songTicks) {
      if (layoutChange.from === voiceLayout || songTicks < layoutChange.at + ticksPerBar) return false;
      layoutChange = { from: voiceLayout, at: 0 };
      return true;
    },
    cycleTable,
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
      for (const [lane, entry] of captures)
        if (lanes[lane] && signature(lanes[lane]).join() === entry.signature.join()) entry.waiting = false;
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
