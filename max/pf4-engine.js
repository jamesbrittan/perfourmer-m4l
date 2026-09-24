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
var PITCH = 60;
var GATE = 0.5;
var VELOCITY = 100;
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
function allocate(lane, notes) {
  return notes.map((note) => ({ ...note, voice: lane + 1 }));
}
function createEngine() {
  let lanes = [];
  let resetTicks = 0;
  const voiceDevices = /* @__PURE__ */ new Map();
  function renderCycle(lane, _cycleIndex) {
    const { hits, length, rotate } = lanes[lane];
    const pattern = bjorklund(hits, length);
    const shift = rotate % length;
    const rotated = pattern.map((_, step2) => pattern[(step2 - shift + length) % length]);
    const step = stepTicks(lane);
    const notes = rotated.flatMap(
      (hit, i) => hit ? [{ onset: i * step, duration: step * GATE, pitch: PITCH, velocity: VELOCITY }] : []
    );
    return allocate(lane, notes);
  }
  function stepTicks(lane) {
    return RATE_TICKS[lanes[lane].rate ?? "1/16"];
  }
  function cycleTicks(lane) {
    return lanes[lane].length * stepTicks(lane);
  }
  function locate(lane, songTicks) {
    const cycle = cycleTicks(lane);
    const period = resetTicks ? Math.floor(songTicks / resetTicks) : 0;
    const sinceReset = resetTicks ? songTicks % resetTicks : songTicks;
    const cyclesPerPeriod = resetTicks ? Math.ceil(resetTicks / cycle) : 0;
    return {
      cycleIndex: period * cyclesPerPeriod + Math.floor(sinceReset / cycle),
      offsetTicks: sinceReset % cycle
    };
  }
  function slotTable(lane, gridTicks) {
    const slots = /* @__PURE__ */ new Map();
    const at = (tick, note) => {
      const slot = Math.round(tick / gridTicks);
      slots.set(slot, [...slots.get(slot) ?? [], note]);
    };
    for (const e of renderCycle(lane, 0)) {
      at(e.onset, [e.voice, e.pitch, e.velocity]);
      at(e.onset + e.duration, [e.voice, e.pitch, 0]);
    }
    return [...slots].sort(([a], [b]) => a - b).map(([slot, notes]) => ({ slot, notes }));
  }
  return {
    configure(config) {
      lanes = config.lanes;
      resetTicks = (config.resetBars ?? 0) * (config.ticksPerBar ?? 1920);
    },
    cycleTicks,
    locate,
    renderCycle,
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
