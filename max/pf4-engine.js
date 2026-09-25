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
  RATES: () => RATES,
  createEngine: () => createEngine
});
module.exports = __toCommonJS(index_exports);
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
var MIDDLE_C = 60;
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
var clampToMidi = (note) => Math.max(0, Math.min(127, note));
function degreeToNote(degree, { root, intervals }) {
  const octave = Math.floor(degree / intervals.length);
  const index = degree - octave * intervals.length;
  return MIDDLE_C + root + intervals[index] + 12 * octave;
}
function allocate(lane, notes) {
  return notes.map((note) => ({ ...note, voice: lane + 1 }));
}
function createEngine() {
  let lanes = [];
  let scale = C_MAJOR;
  let resetTicks = 0;
  const voiceDevices = /* @__PURE__ */ new Map();
  function renderCycle(lane, cycleIndex) {
    const { hits, length, rotate, pitchCycle = [0], transpose = 0, octave = 0 } = lanes[lane];
    const { gate = 50, velocity = 100, accent = 0 } = lanes[lane];
    const pattern = bjorklund(hits, length);
    const shift = rotate % length;
    const rotated = pattern.map((_, step2) => pattern[(step2 - shift + length) % length]);
    const step = stepTicks(lane);
    const end = playedTicks(lane, cycleIndex);
    const patternOnsets = rotated.flatMap((hit, i) => hit ? [i * step] : []);
    const onsets = patternOnsets.filter((onset) => onset < end - 1e-6);
    const gaps = onsets.map((onset, i) => (i + 1 < onsets.length ? onsets[i + 1] : end + patternOnsets[0]) - onset);
    const tie = gate >= 100;
    const noteLength = (gap) => gate <= 50 ? step * gate / 100 : step / 2 + (gap - step / 2) * (gate - 50) / 50;
    const hitsBefore = cyclesSinceReset(lane, cycleIndex) * patternOnsets.length;
    const notes = onsets.map((onset, hit) => ({
      onset,
      duration: noteLength(gaps[hit]),
      pitch: clampToMidi(degreeToNote(pitchCycle[(hitsBefore + hit) % pitchCycle.length] + transpose, scale) + 12 * octave),
      velocity: Math.max(1, Math.min(127, velocity + (hit === 0 ? accent : 0))),
      ...tie && { tie }
    }));
    return allocate(lane, notes);
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
      scale = config.scale ?? C_MAJOR;
      resetTicks = (config.resetBars ?? 0) * (config.ticksPerBar ?? 1920);
    },
    cycleTicks,
    locate,
    renderCycle,
    cycleTable,
    slotTable,
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
