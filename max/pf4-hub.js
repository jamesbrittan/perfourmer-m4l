// Hub v8 adapter: Lane parameters, Live's Scale and Voice announcements in -> engine -> player tables and status out.
// No timing happens here: the native player plays two banks per Lane from its table, and the engine's scheduler
// decides what goes in them (see createScheduler). This script passes it the player's reports and carries out its
// commands on outlets 0 and 1.
autowatch = 1;
inlets = 1;
outlets = 14; // 0: table edits, 1: "<lane> <bank> <cycleTicks> <now> <release>" pending (bank -1 = withdrawn; now 1 =
// switch at the next tick rather than the next Cycle boundary; release 1 = release the Lane's Voice on switching),
// 2: Voice status text,
// 3: Reset period in ticks for the player (NEVER when off), 4: "<lane> set <text>" position readouts (lanes 4–7: Base readouts),
// 5: transport running (1) / stopped (0), 6: "set <text>" Scale readout, 7: Captured Bases as numbers (to the
// stored-only pattr that saves them with the set), 8: "<lane> set <text>" pattern view,
// 9: "<lane> <hits> <rotate> <length>" to set a Lane's dials from a Rhythm Preset, 10: "<lane> set 0" to show the
// Rhythm Preset menu as "—" once the dials no longer match the preset, 11: "<lane> set <text>" the Lane's Voices,
// 12: "<lane> <voice> …" the Voices the player releases for that Lane (current and, during a Voice Layout change,
// previous), 13: scripting messages to thispatcher (Voicing Matrix buttons, enabling the Lane's controls)

const { createEngine, createScheduler, RATES, RHYTHM_PRESETS, GROUP_MODES, CHORD_SHAPES } = require("pf4-engine.js");

const GRID_TICKS = 2; // must match the player's metro
const BANK_SIZE = 10000; // table key = (lane * 2 + bank) * BANK_SIZE + slot
const LANES = 4;
const NEVER = 1e12; // "no Reset" as a period the player's modulo can use

const engine = createEngine();
// defaults must match LANE_DEFAULTS, PITCH_DEFAULTS, ARTICULATION_DEFAULTS and EVOLUTION_DEFAULTS in build_devices.py
engine.configure({ lanes: [
  { hits: 16, length: 16, rotate: 0, rate: "1/16", pitchCycle: [0], transpose: 0, octave: 0, gate: 50, velocity: 100, accent: 15, probability: 100, mutation: 0 },
  { hits: 4, length: 16, rotate: 2, rate: "1/16", pitchCycle: [0], transpose: 0, octave: 0, gate: 30, velocity: 100, accent: 0, probability: 100, mutation: 0 },
  { hits: 2, length: 7, rotate: 0, rate: "1/4", pitchCycle: [0], transpose: 0, octave: 0, gate: 100, velocity: 90, accent: 0, probability: 100, mutation: 0 },
  { hits: 5, length: 13, rotate: 0, rate: "1/16", pitchCycle: [0], transpose: 0, octave: 0, gate: 50, velocity: 85, accent: 0, probability: 100, mutation: 20 },
].map((lane, n) => ({ ...lane, seed: n + 1 })) });
const player = new Dict("pf4.player"); // "lane<n>": the bank the player is playing, written as it adopts
const scheduler = createScheduler({
  engine,
  lanes: LANES,
  gridTicks: GRID_TICKS,
  bankSize: BANK_SIZE,
  playingBank: (n) => player.get(`lane${n}`),
  send(command) {
    if (command.type === "write") outlet(0, [command.key].concat(...command.notes));
    else if (command.type === "remove") outlet(0, "remove", command.key);
    else {
      const { lane, bank, cycleTicks, now, release } = command;
      outlet(1, lane, bank, cycleTicks, now ? 1 : 0, release ? 1 : 0); // while stopped the player adopts at once
    }
  },
});

function lane(n, hits, length, rotate, rateIndex) {
  engine.setLane(n, { hits, length, rotate, rate: RATES[rateIndex] });
  const preset = RHYTHM_PRESETS[chosenPreset[n] - 1];
  if (preset && !loadingPreset && (preset.hits !== hits || preset.length !== length || preset.rotate !== rotate)) {
    chosenPreset[n] = 0;
    outlet(10, n, "set", 0);
  }
  refresh(n);
}

// Rhythm Preset menu (0 = none): set the Lane's Hits, Length and Rotate dials to the preset. Changing Hits, Length
// or Rotate hands the Lane back from any Captured Base, so the preset becomes the Base.
const chosenPreset = [0, 0, 0, 0];
let loadingPreset = false;
function rhythm(n, index) {
  chosenPreset[n] = index;
  const preset = RHYTHM_PRESETS[index - 1];
  if (!preset) return;
  loadingPreset = true; // the dials report back straight away, one at a time
  outlet(9, n, preset.hits, preset.rotate, preset.length);
  loadingPreset = false;
}

// Pitch Cycle editor: its length, then all 8 degree boxes (only the first <length> are used)
function pitch(n, length, ...degrees) {
  engine.setLane(n, { pitchCycle: degrees.slice(0, length) });
  refresh(n);
}

// Gate % (short … tied), Velocity, Accent: heard from the next note, not the next Cycle
function articulate(n, gate, velocity, accent) {
  engine.setLane(n, { gate, velocity, accent });
  scheduler.changedNow(n);
}

// Probability %, Mutation 0–127, Seed: from the next Cycle
function evolve(n, probability, mutation, seed) {
  engine.setLane(n, { probability, mutation, seed });
  refresh(n);
}

// Capture: the Cycle sounding now becomes the Lane's Base (heard from the next Cycle)
function capture(n) {
  engine.capture(n, scheduler.captureCycle(n));
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

// Voicing Matrix button (lane 0..3, voice 1..4, state 0/1): lands on the next bar while playing, at once while
// stopped. A Voice belongs to one Lane at most, so switching it on may switch another Lane's button off.
function voice(n, v, state) {
  const before = [0, 1, 2, 3].map((m) => engine.laneVoices(m).slice());
  if (!engine.setVoice(Number(n), Number(v), Boolean(Number(state)), scheduler.changePosition())) return;
  for (let m = 0; m < LANES; m++)
    for (let w = 1; w <= 4; w++) {
      const on = engine.laneVoices(m).includes(w);
      if (m !== Number(n) && on !== before[m].includes(w)) outlet(13, "script", "send", `btn_L${m + 1}_V${w}`, on ? 1 : 0);
    }
  for (let m = 0; m < LANES; m++) scheduler.changedNow(m);
  showLaneVoices();
  updateMatrixActiveStates();
}

function updateMatrixActiveStates() {
  for (let n = 0; n < LANES; n++) {
    const count = engine.laneVoices(n).length;
    const mode = engine.laneSettings(n).groupMode || "poly";
    const gmActive = count > 0 ? 1 : 0;
    const chordActive = (count > 0 && mode === "poly") ? 1 : 0;

    const gmName = `menu_L${n + 1}_gm`;
    const chordName = `menu_L${n + 1}_chord`;

    // Send active state to object inlet (visual dimming)
    outlet(13, "script", "send", gmName, "active", gmActive);
    outlet(13, "script", "send", chordName, "active", chordActive);

    // Send ignoreclick attribute to box (strictly disables mouse clicks)
    outlet(13, "script", "sendbox", gmName, "ignoreclick", gmActive ? 0 : 1);
    outlet(13, "script", "sendbox", chordName, "ignoreclick", chordActive ? 0 : 1);

    // Rhythm view: grey out (active 0) if count === 0, but keep clickable (no ignoreclick)
    outlet(13, "script", "send", `dial_L${n + 1}_hits`, "active", gmActive);
    outlet(13, "script", "send", `dial_L${n + 1}_len`, "active", gmActive);
    outlet(13, "script", "send", `dial_L${n + 1}_rot`, "active", gmActive);
    outlet(13, "script", "send", `dial_L${n + 1}_rate`, "active", gmActive);
    outlet(13, "script", "send", `menu_L${n + 1}_rhythm`, "active", gmActive);

    // Direct JS patcher access if available
    if (typeof this !== "undefined" && this.patcher && this.patcher.getnamed) {
      const gmObj = this.patcher.getnamed(gmName);
      if (gmObj) {
        gmObj.ignoreclick = gmActive ? 0 : 1;
        if (gmObj.message) gmObj.message("active", gmActive);
      }
      const chordObj = this.patcher.getnamed(chordName);
      if (chordObj) {
        chordObj.ignoreclick = chordActive ? 0 : 1;
        if (chordObj.message) chordObj.message("active", chordActive);
      }
      for (const name of [`dial_L${n + 1}_hits`, `dial_L${n + 1}_len`, `dial_L${n + 1}_rot`, `dial_L${n + 1}_rate`, `menu_L${n + 1}_rhythm`]) {
        const obj = this.patcher.getnamed(name);
        if (obj && obj.message) obj.message("active", gmActive);
      }
    }
  }
}

// Group Mode and Chord Shape (menu indices): from the Lane's next Cycle
function group(n, modeIndex, shapeIndex) {
  engine.setLane(n, { groupMode: GROUP_MODES[modeIndex], chordShape: Object.keys(CHORD_SHAPES)[shapeIndex] });
  refresh(n);
  showLaneVoices();
  updateMatrixActiveStates();
}

function showLaneVoices() {
  for (let n = 0; n < LANES; n++) {
    outlet(12, n, ...engine.releaseVoices(n));
    const voices = engine.laneVoices(n);
    const mode = voices.length > 1 ? ` ${engine.laneSettings(n).groupMode || "poly"}` : "";
    const text = !voices.length ? "off" : voices.length === 1 ? `V${voices[0]}` : `V${voices.join("+")}${mode}`;
    outlet(11, n, "set", text);
  }
}

function transpose(n, degrees, octaves) {
  engine.setLane(n, { transpose: degrees, octave: octaves });
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
  engine.setSong({ scale: { root: scale.root, intervals: scale.intervals } });
  outlet(6, "set", `Scale: ${NOTE_NAMES[scale.root]} ${scale.name}`);
  for (let n = 0; n < LANES; n++) refresh(n);
}

function transportRunning(isPlaying) {
  outlet(5, isPlaying ? 1 : 0);
  scheduler.transport(Boolean(isPlaying));
}

function reset(bars) {
  engine.setSong({ resetBars: bars });
  sendReset();
  for (let n = 0; n < LANES; n++) refresh(n); // the Pitch Cycle realigns at each Reset
}

// Live's time signature, e.g. 7 8
function timesig(numerator, denominator) {
  engine.setSong({ ticksPerBar: (numerator * 1920) / denominator });
  sendReset();
  for (let n = 0; n < LANES; n++) refresh(n);
}

function sendReset() {
  outlet(3, engine.resetTicks() || NEVER);
}

// the player took up a pending bank (already noted in the dict) at a Cycle boundary
function adopt(n, bank, songTicks) {
  scheduler.adopted(n, songTicks);
}

// a change reaches the Lane from its next Cycle (or at once while stopped)
function refresh(n) {
  scheduler.changed(n);
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
  scheduler.start();
  sendReset();
  showVoices();
  showLaneVoices();
  updateMatrixActiveStates();
}

// song position (polled a few times a second): show where each Lane is, from the engine's own locate()
function where(songTicks) {
  if (scheduler.playing && engine.retireVoiceLayout(songTicks)) showLaneVoices();
  scheduler.poll(songTicks);
  for (let n = 0; n < LANES; n++) {
    const { cycleIndex, step, rows, mutated, captureDepth } = engine.laneView(n, songTicks);
    const { length } = engine.laneSettings(n);
    outlet(4, n, "set", `Cycle ${cycleIndex + 1} · step ${step + 1}/${length}${mutated ? " · mutated" : ""}`);
    outlet(4, LANES + n, "set", captureDepth ? `captured${captureDepth > 1 ? ` ×${captureDepth}` : ""}` : "Euclidean");
    // pattern view: ● hit, · rest; the playhead step (◉ hit, ○ rest) goes on an overlay in its own colour, and the
    // pattern leaves a gap under it. No-break spaces pad both, so Max keeps leading blanks and the columns line up
    const gap = "\u00a0";
    const draw = (glyph) =>
      rows.map((row, r) => row.map((hit, i) => glyph(hit, r * rows[0].length + i === step)).join(gap)).join("\n");
    outlet(8, n, "set", draw((hit, playhead) => (playhead ? gap : hit ? "●" : "·")));
    outlet(8, LANES + n, "set", draw((hit, playhead) => (playhead ? (hit ? "◉" : "○") : gap)));
  }
}

function showVoices() {
  const { connected, duplicates } = engine.voiceStatus();
  const missing = [1, 2, 3, 4].filter((voice) => !connected.includes(voice));
  let text = "";
  if (!connected.length) {
    text = "Waiting for Voices";
  } else if (missing.length || duplicates.length) {
    text = missing.length ? `Missing Voice ${missing.join(" ")}` : "";
    if (duplicates.length) text += `${text ? " · " : ""}Duplicate Voice ${duplicates.join(" ")}`;
  }
  outlet(2, "set", text);
}
