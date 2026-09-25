// Hub v8 adapter: Lane parameters, Live's Scale and Voice announcements in -> engine -> player tables and status out.
// No timing happens here (ADR 0003). Each Lane has two banks in the player's table: a render goes into the
// bank that Lane is NOT playing and is offered as "pending"; the player adopts it at that Lane's next Cycle
// boundary, notes the bank it now plays in the "pf4.player" dict, and replies "adopt <lane> <bank> <songTicks>".
// Every Cycle can differ (the Pitch Cycle drifts against the hits), so while the transport runs each adoption
// triggers the render of the Cycle after it; while stopped, the playing bank is kept on the Cycle at the song
// position, so playback can start anywhere.
// A Gate or Velocity change can't wait for the boundary: the playing Cycle is re-rendered into the other bank and
// offered "now", and the player switches at its next tick. Note-offs are handed on between tables (past a Cycle's
// end, and from a replaced table), so notes still end wherever the switch lands.
// Our messages from the player arrive late (v8 is low priority), so a render never trusts them to know which bank
// is playing: it withdraws the pending offer (after which the player can't switch) and reads the dict.
autowatch = 1;
inlets = 1;
outlets = 8; // 0: table edits, 1: "<lane> <bank> <cycleTicks> <now> <release>" pending (bank -1 = withdrawn; now 1 =
// switch at the next tick rather than the next Cycle boundary; release 1 = release the Lane's Voice on switching),
// 2: Voice status text,
// 3: Reset period in ticks for the player (NEVER when off), 4: "<lane> set <text>" position readouts (lanes 4–7: Base readouts),
// 5: transport running (1) / stopped (0), 6: "set <text>" Scale readout, 7: Captured Bases as numbers (to the
// stored-only pattr that saves them with the set)

const { createEngine, RATES } = require("pf4-engine.js");

const GRID_TICKS = 2; // must match the player's metro
const BANK_SIZE = 10000; // table key = (lane * 2 + bank) * BANK_SIZE + slot
const LANES = 4;
const NEVER = 1e12; // "no Reset" as a period the player's modulo can use

const engine = createEngine();
// defaults must match LANE_DEFAULTS, PITCH_DEFAULTS, ARTICULATION_DEFAULTS and EVOLUTION_DEFAULTS in build_devices.py
const articulation = { gate: 50, velocity: 100, accent: 0, probability: 100, mutation: 0 };
const params = [
  { hits: 5, length: 8, rotate: 0, rate: "1/16", pitchCycle: [0, 4, 2, 5], transpose: 0, octave: 0, ...articulation },
  { hits: 3, length: 8, rotate: 0, rate: "1/16", pitchCycle: [0, 2, 4], transpose: 0, octave: -1, ...articulation },
  { hits: 2, length: 5, rotate: 0, rate: "1/16", pitchCycle: [0, -3], transpose: 0, octave: -2, ...articulation },
  { hits: 7, length: 12, rotate: 0, rate: "1/16", pitchCycle: [4, 6, 7, 9, 11], transpose: 0, octave: 0, ...articulation },
].map((lane, n) => ({ ...lane, seed: n + 1 }));
const song = { resetBars: 0, ticksPerBar: 1920, scale: { root: 0, intervals: [0, 2, 4, 5, 7, 9, 11] } };
const writtenKeys = params.map(() => [[], []]);
const bankCycle = params.map(() => [0, 0]); // the Cycle each bank holds
const EMPTY = { slots: [], carry: [] };
const bankTable = params.map(() => [EMPTY, EMPTY]); // what each bank holds, and the note-offs it hands on
const bankCarried = params.map(() => [[], []]); // the note-offs each bank took over from the Cycle before it
const bankFrame = params.map(() => ["", ""]); // Cycle length and Reset period each bank was rendered for
const offered = params.map(() => -1); // the bank last offered to the player as pending
const adoptedAt = params.map(() => null); // song position of each Lane's last adoption while running
let polledAt = 0; // song position at the last poll
const player = new Dict("pf4.player"); // "lane<n>": the bank the player is playing, written as it adopts
let playing = false;

/** The bank Lane n's player is on right now (bank 1 before its first adoption, so that render lands in bank 0). */
function playingBank(n) {
  const bank = player.get(`lane${n}`);
  return bank === 0 || bank === 1 ? bank : 1;
}

const playingCycle = (n) => bankCycle[n][playingBank(n)];

/** The Cycle waiting in the player's pending slot, or null. */
function pendingCycle(n) {
  return offered[n] !== -1 && offered[n] !== playingBank(n) ? bankCycle[n][offered[n]] : null;
}

function lane(n, hits, length, rotate, rateIndex) {
  Object.assign(params[n], { hits, length, rotate, rate: RATES[rateIndex] });
  refresh(n);
}

// Pitch Cycle editor: its length, then all 8 degree boxes (only the first <length> are used)
function pitch(n, length, ...degrees) {
  params[n].pitchCycle = degrees.slice(0, length);
  refresh(n);
}

// Gate % (short … tied), Velocity, Accent: heard from the next note, not the next Cycle
function articulate(n, gate, velocity, accent) {
  Object.assign(params[n], { gate, velocity, accent });
  engine.configure({ lanes: params, ...song });
  if (!playing) return refresh(n);
  render(n, null, true);
}

// Probability %, Mutation 0–127, Seed: from the next Cycle
function evolve(n, probability, mutation, seed) {
  Object.assign(params[n], { probability, mutation, seed });
  refresh(n);
}

// Capture: the Cycle sounding now becomes the Lane's Base (heard from the next Cycle)
function capture(n) {
  engine.configure({ lanes: params, ...song });
  engine.capture(n, playing ? soundingCycle(n) : engine.locate(n, polledAt).cycleIndex);
  storeBases();
  refresh(n);
}

// Revert: back to the Base from before the last Capture
function revert(n) {
  engine.revert(n);
  storeBases();
  refresh(n);
}

let storedBases = "";
function storeBases() {
  const data = engine.saveBases();
  storedBases = data.join(" ");
  outlet(7, data);
}

// the pattr's saved value, when the set (or a preset) loads — and its echo of what we just stored
function bases(...data) {
  if (data.join(" ") === storedBases) return;
  storedBases = data.join(" ");
  engine.loadBases(data);
  for (let n = 0; n < LANES; n++) refresh(n);
}

function transpose(n, degrees, octaves) {
  Object.assign(params[n], { transpose: degrees, octave: octaves });
  refresh(n);
}

// Once the Live API is ready (live.thisdevice): watch the transport and the time signature.
const observers = [];
function observe() {
  observers.length = 0;
  const watch = (property, onChange) => {
    const api = new LiveAPI((args) => {
      if (args[0] === property) onChange(...args.slice(1));
    }, "live_set");
    api.property = property;
    observers.push(api);
  };
  const signature = { numerator: 4, denominator: 4 };
  watch("is_playing", transportRunning);
  watch("signature_numerator", (n) => {
    signature.numerator = n;
    timesig(signature.numerator, signature.denominator);
  });
  watch("signature_denominator", (d) => {
    signature.denominator = d;
    timesig(signature.numerator, signature.denominator);
  });
  const scale = { root: 0, intervals: [0, 2, 4, 5, 7, 9, 11], name: "Major" };
  watch("root_note", (root) => setScale(scale, { root }));
  watch("scale_intervals", (...intervals) => setScale(scale, { intervals }));
  watch("scale_name", (name) => setScale(scale, { name }));
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Live's global Scale changed: every Lane follows from its next Cycle
function setScale(scale, change) {
  Object.assign(scale, change);
  if (!scale.intervals.length) return;
  song.scale = { root: scale.root, intervals: scale.intervals };
  outlet(6, "set", `Scale: ${NOTE_NAMES[scale.root]} ${scale.name}`);
  for (let n = 0; n < LANES; n++) refresh(n);
}

function transportRunning(isPlaying) {
  playing = Boolean(isPlaying);
  outlet(5, playing ? 1 : 0);
  if (!playing) {
    // withdraw anything offered for the next Cycle: stopped, the playing bank is kept on the song position instead
    for (let n = 0; n < LANES; n++) {
      outlet(1, n, -1, 0, 0, 0);
      offered[n] = -1;
    }
    return;
  }
  for (let n = 0; n < LANES; n++) {
    adoptedAt[n] = null;
    prepareNext(n, playingCycle(n));
  }
}

function reset(bars) {
  song.resetBars = bars;
  sendReset();
  for (let n = 0; n < LANES; n++) refresh(n); // the Pitch Cycle realigns at each Reset
}

// Live's time signature, e.g. 7 8
function timesig(numerator, denominator) {
  song.ticksPerBar = (numerator * 1920) / denominator;
  sendReset();
  for (let n = 0; n < LANES; n++) refresh(n);
}

function sendReset() {
  engine.configure({ lanes: params, ...song });
  outlet(3, song.resetBars ? song.resetBars * song.ticksPerBar : NEVER);
}

// the player took up a pending bank (already noted in the dict) at a Cycle boundary: line up the Cycle after it
function adopt(n, bank, songTicks) {
  if (!playing) return;
  adoptedAt[n] = songTicks;
  const sounding = engine.locate(n, songTicks).cycleIndex;
  // wrong Cycle (e.g. Length/Rate changed the numbering, or a "now" offer landed on a boundary): replace it at once
  if (bankCycle[n][playingBank(n)] !== sounding) return render(n, sounding, true);
  prepareNext(n, sounding);
}

// a change reaches the Lane from its next Cycle (or at once while stopped)
function refresh(n) {
  engine.configure({ lanes: params, ...song });
  if (playing) prepareNext(n, soundingCycle(n), true);
  else render(n, engine.locate(n, polledAt).cycleIndex);
}

/** The Cycle a running Lane is in, by the song position of its last Cycle boundary (numbered for the current
 * settings, which may have changed since). */
function soundingCycle(n) {
  return adoptedAt[n] === null ? playingCycle(n) : engine.locate(n, adoptedAt[n]).cycleIndex;
}

function prepareNext(n, current, force = false) {
  if (force || pendingCycle(n) !== current + 1) render(n, current + 1);
}

function hello(deviceId, voice) {
  engine.voiceJoined(deviceId, voice);
  showVoices();
}

function bye(deviceId) {
  engine.voiceLeft(deviceId);
  showVoices();
}

function bang() {
  player.clear(); // a fresh player isn't playing any bank yet
  for (let n = 0; n < LANES; n++) render(n, 0);
  sendReset();
  showVoices();
}

// now: replace the playing Cycle from the player's next tick, instead of waiting for its next Cycle boundary
// (cycleIndex null = the Cycle the playing bank holds, as read once the player can no longer switch)
function render(n, cycleIndex, now = false) {
  outlet(1, n, -1, 0, 0, 0); // withdraw the pending offer: from here on the player stays on its bank
  offered[n] = -1;
  const playingNow = playingBank(n);
  if (cycleIndex === null) cycleIndex = bankCycle[n][playingNow];
  const bank = 1 - playingNow;
  engine.configure({ lanes: params, ...song });
  // note-offs handed on. Running, whatever is offered follows the playing Cycle in time (even when a Length or Rate
  // change has renumbered the Cycles), so it takes that Cycle's carried note-offs; a "now" replacement takes over
  // the ones the playing Cycle took over, plus everything it would have sent. Stopped, nothing is sounding.
  // If the Cycle length or Reset period changed, the old note-off positions mean nothing in the new table: the
  // player releases the Voice as it switches instead.
  const frame = `${engine.cycleTicks(n)}/${song.resetBars * song.ticksPerBar}`;
  const release = playing && frame !== bankFrame[n][playingNow];
  const handOn = playing && !release;
  const carried = !handOn ? [] : now ? bankCarried[n][playingNow] : bankTable[n][playingNow].carry;
  const table = engine.cycleTable(n, GRID_TICKS, cycleIndex, carried, handOn && now ? bankTable[n][playingNow] : EMPTY);
  for (const key of writtenKeys[n][bank]) outlet(0, "remove", key);
  writtenKeys[n][bank] = table.slots.map(({ slot, notes }) => {
    const key = (n * 2 + bank) * BANK_SIZE + slot;
    outlet(0, [key].concat(...notes));
    return key;
  });
  bankCycle[n][bank] = cycleIndex;
  bankTable[n][bank] = table;
  bankCarried[n][bank] = carried;
  bankFrame[n][bank] = frame;
  offered[n] = bank;
  // while stopped the player adopts this at once (re-entering adopt)
  outlet(1, n, bank, engine.cycleTicks(n), now && playing ? 1 : 0, release ? 1 : 0);
}

// Keep a Lane's banks on the polled song position (cycleIndex = the Cycle there). Stopped, the player should hold
// the Cycle playback would start in; running, the Cycle after the current one should be pending.
function follow(n, cycleIndex) {
  if (!playing) {
    if (playingCycle(n) !== cycleIndex) render(n, cycleIndex);
    return;
  }
  // Within one Cycle of each other, the later one is right: a poll taken just before a boundary lags the player,
  // and a player that missed a boundary (nothing pending in time) hasn't reported the one it's in.
  // A bigger gap means the song position jumped.
  const held = soundingCycle(n);
  prepareNext(n, Math.abs(cycleIndex - held) <= 1 ? Math.max(cycleIndex, held) : cycleIndex);
}

// song position (polled a few times a second): show where each Lane is, from the engine's own locate()
function where(songTicks) {
  polledAt = songTicks;
  for (let n = 0; n < LANES; n++) {
    const { cycleIndex, offsetTicks } = engine.locate(n, songTicks);
    follow(n, cycleIndex);
    const step = Math.floor(offsetTicks / (engine.cycleTicks(n) / params[n].length)) + 1;
    const mutated = engine.isMutated(n, cycleIndex) ? " · mutated" : "";
    outlet(4, n, "set", `Cycle ${cycleIndex + 1} · step ${step}/${params[n].length}${mutated}`);
    const depth = engine.captureDepth(n);
    outlet(4, LANES + n, "set", depth ? `Base: captured${depth > 1 ? ` ×${depth}` : ""}` : "Base: Euclidean");
  }
}

function showVoices() {
  const { connected, duplicates } = engine.voiceStatus();
  const missing = [1, 2, 3, 4].filter((voice) => !connected.includes(voice));
  let text = connected.length ? `Voices ${connected.join(" ")}` : "No Voices connected";
  if (missing.length) text += ` · missing ${missing.join(" ")}`;
  if (duplicates.length) text += ` · DUPLICATE ${duplicates.join(" ")}`;
  outlet(2, "set", text);
}
