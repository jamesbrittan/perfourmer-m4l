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
  createEngine: () => createEngine
});
module.exports = __toCommonJS(index_exports);
var STEP_TICKS = 120;
var PITCH = 60;
var GATE_TICKS = STEP_TICKS / 2;
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
  const voiceDevices = /* @__PURE__ */ new Map();
  function renderCycle(lane, _cycleIndex) {
    const { hits, length, rotate } = lanes[lane];
    const pattern = bjorklund(hits, length);
    const shift = rotate % length;
    const rotated = pattern.map((_, step) => pattern[(step - shift + length) % length]);
    const notes = rotated.flatMap(
      (hit, step) => hit ? [{ onset: step * STEP_TICKS, duration: GATE_TICKS, pitch: PITCH, velocity: VELOCITY }] : []
    );
    return allocate(lane, notes);
  }
  function cycleTicks(lane) {
    return lanes[lane].length * STEP_TICKS;
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
    },
    cycleTicks,
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
