// Hub v8 adapter: Lane parameters, Live's Scale and Voice announcements in -> engine -> player tables and status out.
// No timing happens here: the native player plays two banks per Lane from its table, and the engine's scheduler
// decides what goes in them (see createScheduler). This script passes it the player's reports and carries out its
// commands on its table and pending outlets.
autowatch = 1;
inlets = 1;

const {
  createEngine,
  createScheduler,
  controlName,
  STRAIGHT_RATES,
  FEELS,
  RHYTHM_PRESETS,
  GROUP_MODES,
  CHORD_SHAPES,
  HUB_OUTLETS: OUT,
  LANE_DEFAULTS,
  LANES,
  PLAYER,
  VOICES,
  FREEZE_OFF,
  FREEZE_BASE,
  PITCH_STEPS,
  RANDOM_GROUPS,
  randomSettings,
} = require("pf4-engine.js");

outlets = Object.keys(OUT).length; // what each carries: HUB_OUTLETS in the engine

const engine = createEngine();
engine.configure({ lanes: LANE_DEFAULTS });
const player = new Dict(PLAYER.dict); // "lane<n>": the bank the player is playing, written as it adopts
const scheduler = createScheduler({
  engine,
  lanes: LANES,
  gridTicks: PLAYER.gridTicks,
  bankSize: PLAYER.bankSize,
  playingBank: (n) => player.get(`lane${n}`),
  send(command) {
    if (command.type === "write") outlet(OUT.table, [command.key].concat(...command.notes));
    else if (command.type === "remove") outlet(OUT.table, "remove", command.key);
    else {
      const { lane, bank, cycleTicks, now, release } = command;
      outlet(OUT.pending, lane, bank, cycleTicks, now ? 1 : 0, release ? 1 : 0); // while stopped the player adopts at once
    }
  },
});

// Hits, Length, Rotate, Rate (a straight value) and Feel (menu indices for the last two): from the next Cycle
function lane(n, hits, length, rotate, rateIndex, feelIndex) {
  engine.setLane(n, { hits, length, rotate, rate: STRAIGHT_RATES[rateIndex], feel: FEELS[feelIndex] });
  const preset = RHYTHM_PRESETS[chosenPreset[n] - 1];
  if (preset && !loadingPreset && (preset.hits !== hits || preset.length !== length || preset.rotate !== rotate)) {
    chosenPreset[n] = 0;
    outlet(OUT.presetMenus, n, "set", 0);
  }
  refresh(n);
}

// Rhythm Preset menu (0 = none): set the Lane's Hits, Length and Rotate dials to the preset. Changing Hits, Length
// or Rotate hands the Lane back from any Captured Base, so the preset becomes the Base.
const chosenPreset = Array.from({ length: LANES }, () => 0);
let loadingPreset = false;
function rhythm(n, index) {
  chosenPreset[n] = index;
  const preset = RHYTHM_PRESETS[index - 1];
  if (!preset) return;
  loadingPreset = true; // the dials report back straight away, one at a time
  outlet(OUT.presetDials, n, preset.hits, preset.rotate, preset.length);
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
  storeFrozen(); // a frozen Lane now holds the new Base
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
  outlet(OUT.bases, data);
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
  const before = Array.from({ length: LANES }, (_, m) => engine.laneVoices(m).slice());
  if (!engine.setVoice(Number(n), Number(v), Boolean(Number(state)), scheduler.changePosition())) return;
  for (let m = 0; m < LANES; m++)
    for (let w = 1; w <= VOICES; w++) {
      const on = engine.laneVoices(m).includes(w);
      if (m !== Number(n) && on !== before[m].includes(w)) outlet(OUT.script, "script", "send", controlName("voiceButton", m + 1, w), on ? 1 : 0);
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

    const gmName = controlName("groupMode", n + 1);
    const chordName = controlName("chordShape", n + 1);
    // Rhythm view: grey out (active 0) if the Lane has no Voices, but keep it clickable (no ignoreclick)
    const rhythm = ["hits", "length", "rotate", "rate", "feel", "rhythm"].map((kind) => controlName(kind, n + 1));

    // Send active state to object inlet (visual dimming)
    outlet(OUT.script, "script", "send", gmName, "active", gmActive);
    outlet(OUT.script, "script", "send", chordName, "active", chordActive);

    // Send ignoreclick attribute to box (strictly disables mouse clicks)
    outlet(OUT.script, "script", "sendbox", gmName, "ignoreclick", gmActive ? 0 : 1);
    outlet(OUT.script, "script", "sendbox", chordName, "ignoreclick", chordActive ? 0 : 1);

    for (const name of rhythm) outlet(OUT.script, "script", "send", name, "active", gmActive);

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
      for (const name of rhythm) {
        const obj = this.patcher.getnamed(name);
        if (obj && obj.message) obj.message("active", gmActive);
      }
    }
  }
}

// Freeze toggle: hold the Cycle sounding now (heard from the next Cycle), leaving Mutation as it is; off: evolve again
// from the song position. Which Cycle each Lane holds is saved with the set (stored-only pattr), so a set reopened
// while frozen holds the same one. Live restores the toggle and the pattr in either order: a stored value not yet
// taken up waits for the toggle.
const freezeOn = Array.from({ length: LANES }, () => false);
const restoredFreeze = Array.from({ length: LANES }, () => FREEZE_OFF);
let storedFrozen = "";
const fromStored = (value) => (value === FREEZE_BASE ? "base" : value >= 0 ? value : undefined);
function freeze(n, on) {
  freezeOn[n] = Boolean(Number(on));
  const restored = restoredFreeze[n];
  restoredFreeze[n] = FREEZE_OFF;
  const held = !freezeOn[n] ? undefined : restored !== FREEZE_OFF ? fromStored(restored) : scheduler.captureCycle(n);
  engine.setLane(n, { freeze: held });
  storeFrozen();
  refresh(n);
}

function storeFrozen() {
  const data = Array.from({ length: LANES }, (_, n) => {
    const held = engine.laneSettings(n).freeze;
    return held === undefined ? FREEZE_OFF : held === "base" ? FREEZE_BASE : held;
  });
  storedFrozen = data.join(" ");
  outlet(OUT.frozen, data);
}

// the pattr's saved value, when the set (or a preset) loads — and its echo of what we just stored
function frozen(...data) {
  if (data.join(" ") === storedFrozen) return;
  storedFrozen = data.join(" ");
  data.slice(0, LANES).forEach((value, n) => {
    if (!freezeOn[n]) return void (restoredFreeze[n] = value);
    engine.setLane(n, { freeze: fromStored(value) ?? scheduler.captureCycle(n) });
    refresh(n);
  });
}

// Randomise: new values for one of a Lane's groups ("rhythm", "pitch" or "evolution"), or all three ("lane"); Lane -1
// = every Lane. The values are set on the controls themselves, so they're saved with the set, show in automation and
// reach the engine as a turn of the knobs would. Undo puts back the controls from before the Lane's last roll.
const beforeRoll = Array.from({ length: LANES }, () => null);
function randomise(n, group) {
  if (n < 0) {
    for (let m = 0; m < LANES; m++) randomise(m, "lane");
    return;
  }
  const current = engine.laneSettings(n);
  const next = randomSettings(current, group === "lane" ? RANDOM_GROUPS : [group], Math.random);
  beforeRoll[n] = Object.fromEntries(Object.keys(next).map((key) => [key, current[key]]));
  setControls(n, next);
}

function undo(n) {
  const back = beforeRoll[n];
  beforeRoll[n] = null;
  if (back) setControls(n, back);
}

function setControls(n, settings) {
  const send = (control, ...values) => outlet(OUT.controls, n, control, ...values);
  const { length, hits, rotate, rate, feel, pitchCycle, probability, mutation, seed } = settings;
  if (length !== undefined) send("length", length); // before Hits, whose range follows Length
  if (hits !== undefined) send("hits", hits);
  if (rotate !== undefined) send("rotate", rotate);
  if (STRAIGHT_RATES.includes(rate)) send("rate", STRAIGHT_RATES.indexOf(rate));
  if (FEELS.includes(feel)) send("feel", FEELS.indexOf(feel));
  if (pitchCycle) {
    pitchCycle.slice(0, PITCH_STEPS).forEach((degree, i) => send("degree", i, degree));
    send("pitchLength", Math.min(pitchCycle.length, PITCH_STEPS));
  }
  if (probability !== undefined) send("probability", probability);
  if (mutation !== undefined) send("mutation", mutation);
  if (seed !== undefined) send("seed", seed);
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
    outlet(OUT.releaseVoices, n, ...engine.releaseVoices(n));
    const voices = engine.laneVoices(n);
    const mode = voices.length > 1 ? ` ${engine.laneSettings(n).groupMode || "poly"}` : "";
    const text = !voices.length ? "off" : voices.length === 1 ? `V${voices[0]}` : `V${voices.join("+")}${mode}`;
    outlet(OUT.laneVoices, n, "set", text);
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
  outlet(OUT.scale, "set", `Scale: ${NOTE_NAMES[scale.root]} ${scale.name}`);
  for (let n = 0; n < LANES; n++) refresh(n);
}

function transportRunning(isPlaying) {
  outlet(OUT.transport, isPlaying ? 1 : 0);
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
  outlet(OUT.resetPeriod, engine.resetTicks() || PLAYER.noReset);
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
    outlet(OUT.readouts, n, "set", `Cycle ${cycleIndex + 1} · step ${step + 1}/${length}${mutated ? " · mutated" : ""}`);
    outlet(OUT.readouts, LANES + n, "set", captureDepth ? `captured${captureDepth > 1 ? ` ×${captureDepth}` : ""}` : "Euclidean");
    // pattern view: ● hit, · rest; the playhead step (◉ hit, ○ rest) goes on an overlay in its own colour, and the
    // pattern leaves a gap under it. No-break spaces pad both, so Max keeps leading blanks and the columns line up
    const gap = "\u00a0";
    const draw = (glyph) =>
      rows.map((row, r) => row.map((hit, i) => glyph(hit, r * rows[0].length + i === step)).join(gap)).join("\n");
    outlet(OUT.patterns, n, "set", draw((hit, playhead) => (playhead ? gap : hit ? "●" : "·")));
    outlet(OUT.patterns, LANES + n, "set", draw((hit, playhead) => (playhead ? (hit ? "◉" : "○") : gap)));
  }
}

function showVoices() {
  const { connected, duplicates } = engine.voiceStatus();
  const missing = Array.from({ length: VOICES }, (_, v) => v + 1).filter((voice) => !connected.includes(voice));
  let text = "";
  if (!connected.length) {
    text = "Waiting for Voices";
  } else if (missing.length || duplicates.length) {
    text = missing.length ? `Missing Voice ${missing.join(" ")}` : "";
    if (duplicates.length) text += `${text ? " · " : ""}Duplicate Voice ${duplicates.join(" ")}`;
  }
  outlet(OUT.voiceStatus, "set", text);
}
