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
  RATES,
  RHYTHM_PRESETS,
  PITCH_PRESETS,
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
  // E16 controller
  rhythmPage,
  stepEncoder,
  createE16Display,
  decodeDelta,
  E16_CHANNEL,
  ENCODER_CC_BASE,
  PUSH_CC_BASE,
  PAGE_CC,
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
      const { lane, bank, cycleTicks, now } = command;
      outlet(OUT.pending, lane, bank, cycleTicks, now ? 1 : 0); // while stopped the player adopts at once
    }
  },
});

function lane(n, hits, length, rotate, rateIndex) {
  engine.setLane(n, { hits, length, rotate, rate: RATES[rateIndex] });
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

// Pitch Preset menu (0 = none): set the Lane's Pitch Length and degrees to the preset. Changing length
// or any degree from the preset drops back to "—".
const chosenPitchPreset = [0, 0, 0, 0];
let loadingPitchPreset = false;

function pitchPreset(n, index) {
  chosenPitchPreset[n] = index;
  const preset = PITCH_PRESETS[index - 1];
  if (!preset) return;
  loadingPitchPreset = true;
  const degs = Array.from({ length: 8 }, (_, i) => (i < preset.degrees.length ? preset.degrees[i] : 0));
  outlet(OUT.pitchPresetBoxes, n, preset.degrees.length, ...degs);
  loadingPitchPreset = false;
}

// Pitch Cycle editor: its length, then all 8 degree boxes (only the first <length> are used)
function pitch(n, length, ...degrees) {
  const chosen = PITCH_PRESETS[chosenPitchPreset[n] - 1];
  if (chosen && !loadingPitchPreset) {
    const matches = chosen.degrees.length === length && chosen.degrees.every((d, i) => d === degrees[i]);
    if (!matches) {
      chosenPitchPreset[n] = 0;
      outlet(OUT.pitchPresetMenus, n, "set", 0);
    }
  }
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
  engine.setLane(n, { probability, mutation, seed: seed !== undefined ? Math.round(seed) : undefined });
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
    const hasVoices = count > 0 ? 1 : 0;
    const gmActive = count >= 2 ? 1 : 0;
    const chordActive = (count >= 2 && mode === "poly") ? 1 : 0;

    const gmName = controlName("groupMode", n + 1);
    const chordName = controlName("chordShape", n + 1);
    // Rhythm view: grey out (active 0) if the Lane has no Voices, but keep it clickable (no ignoreclick)
    const rhythm = ["hits", "length", "rotate", "rate", "rhythm"].map((kind) => controlName(kind, n + 1));

    // Send active state to object inlet (visual dimming)
    outlet(OUT.script, "script", "send", gmName, "active", gmActive);
    outlet(OUT.script, "script", "send", chordName, "active", chordActive);

    // Send ignoreclick attribute to box (strictly disables mouse clicks)
    outlet(OUT.script, "script", "sendbox", gmName, "ignoreclick", gmActive ? 0 : 1);
    outlet(OUT.script, "script", "sendbox", chordName, "ignoreclick", chordActive ? 0 : 1);

    for (const name of rhythm) outlet(OUT.script, "script", "send", name, "active", hasVoices);

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
        if (obj && obj.message) obj.message("active", hasVoices);
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
// Undo also puts back a Lane from before a paste or swap, Captured Bases included.
const beforeRoll = Array.from({ length: LANES }, () => null); // { settings, bases? } (bases: only after a paste)
function randomise(n, group) {
  if (n < 0) {
    for (let m = 0; m < LANES; m++) randomise(m, "lane");
    return;
  }
  const current = engine.laneSettings(n);
  const next = randomSettings(current, group === "lane" ? RANDOM_GROUPS : [group], Math.random);
  beforeRoll[n] = { settings: Object.fromEntries(Object.keys(next).map((key) => [key, current[key]])) };
  setControls(n, next);
}

function undo(n) {
  const back = beforeRoll[n];
  beforeRoll[n] = null;
  if (back && back.bases !== undefined) return paste(n, back);
  if (back) setControls(n, back.settings);
}

// Lane menu: Copy a Lane, Paste the copy into a Lane, or Swap two Lanes. A paste sets the Lane's controls (as
// Randomise does) and brings the copy's Captured Bases; the Lane keeps its Voices, Group Mode and Chord Shape.
let copied = null;
function copyLane(n) {
  copied = engine.copyLane(n);
}

function pasteLane(n) {
  if (!copied) return;
  beforeRoll[n] = engine.copyLane(n);
  paste(n, copied);
}

function swapLanes(a, b) {
  const [first, second] = [engine.copyLane(a), engine.copyLane(b)];
  beforeRoll[a] = first;
  beforeRoll[b] = second;
  paste(a, second);
  paste(b, first);
}

function paste(n, copy) {
  engine.pasteBases(n, copy);
  storeBases();
  refresh(n); // the Lane's Base may have changed even if no control does
  setControls(n, copy.settings);
}

function setControls(n, settings) {
  const send = (control, ...values) => outlet(OUT.controls, n, control, ...values);
  const { length, hits, rotate, rate, pitchCycle, transpose, octave, gate, velocity, accent, probability, mutation, seed } =
    settings;
  if (length !== undefined) send("length", length); // before Hits, whose range follows Length
  if (hits !== undefined) send("hits", hits);
  if (rotate !== undefined) send("rotate", rotate);
  if (RATES.includes(rate)) send("rate", RATES.indexOf(rate));
  if (pitchCycle) {
    pitchCycle.slice(0, PITCH_STEPS).forEach((degree, i) => send("degree", i, degree));
    send("pitchLength", Math.min(pitchCycle.length, PITCH_STEPS));
  }
  if (transpose !== undefined) send("transpose", transpose);
  if (octave !== undefined) send("octave", octave);
  if (gate !== undefined) send("gate", gate);
  if (velocity !== undefined) send("velocity", velocity);
  if (accent !== undefined) send("accent", accent);
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
  updateMatrixActiveStates();
  e16setup();
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
  e16Update(); // keep the E16's display in sync with every source of change
}

function hello(deviceId, voice) {
  engine.voiceJoined(deviceId, voice);
  showVoices();
}

function bye(deviceId) {
  engine.voiceLeft(deviceId);
  showVoices();
}

// ── E16 controller ────────────────────────────────────────────────────────────
// The E16 sends relative CCs on channel 1 (manual encoders). The Hub steps
// the value, sets the live.* control via setControls, and sends SysEx back
// to update the encoder's display. Every value change from any source
// (mouse, automation, preset, Randomise) updates the display; only messages
// that change what the E16 shows are sent.

const e16Page = rhythmPage();
const e16Display = createE16Display(e16Page);
let e16Connected = false;
let e16cs = null;
// The CCs can reach the Hub by more than one route (the E16's port and the track's input), often both at once. Only
// one route is listened to, so each click counts once; another route takes over once the one listened to has been
// quiet for a while (copies of one click arrive within a few ms of each other).
const E16_ROUTE_QUIET_MS = 150;
let e16Route = null;
let e16RouteHeard = 0;
const e16RoutesSeen = new Set();

/** Send one SysEx message to the E16 through the MaxForLive control surface. */
function sendE16Sysex(sysex) {
  try {
    if (e16cs) return e16cs.call("send_midi", ...sysex);
  } catch (err) {
    post("PF4 Hub: E16 send_midi error: " + err + "\n");
  }
  outlet(OUT.e16, "call", "send_midi", ...sysex); // through the patcher's live.object
}

/** Find the MaxForLive control surface in Live's slots (0..5), to send the E16 SysEx through. */
function e16setup() {
  e16cs = null;
  let targetIndex = -1;

  const seen = [];
  for (let i = 0; i < 6; i++) {
    try {
      const api = new LiveAPI("control_surfaces " + i);
      if (!api || !api.id || Number(api.id) === 0) continue;
      // only the MaxForLive surface, never another controller
      const typeName = [].concat(api.get("type_name")).join(" ");
      seen.push(i + ": " + typeName);
      if (typeName.toLowerCase().indexOf("maxforlive") !== -1) {
        targetIndex = i;
        break;
      }
    } catch {
      // try the next slot
    }
  }

  if (targetIndex === -1) {
    post("PF4 Hub: E16 needs the MaxForLive control surface in Live's Link/Tempo/MIDI preferences. ");
    post("Control surfaces found: " + (seen.join(", ") || "none") + "\n");
    return;
  }

  try {
    // The surface is only used to send SysEx. Its MIDI isn't grabbed: once grabbed, the E16's CCs stop reaching the
    // tracks and the surface gives a device no way to read them. The CCs come in through the Hub track's MIDI input.
    e16cs = new LiveAPI("control_surfaces " + targetIndex);
    try {
      e16cs.call("release_midi"); // undo a grab by an earlier version of the Hub
    } catch {
      // nothing was grabbed
    }
    e16Connected = true;
    post("PF4 Hub: E16 on control surface " + targetIndex + "\n");

    // Point the patcher's live.path at the same surface
    outlet(OUT.script, "script", "send", "e16_path", "path", "live_set", "control_surfaces", targetIndex);

    e16Display.forget();
    e16Update();
  } catch (err) {
    post("PF4 Hub: Error attaching to control surface " + targetIndex + ": " + err + "\n");
  }
}

/** A channel-16 CC from midiin: `route` is "port" or "track". */
function e16in(route, cc, value) {
  e16from(String(route), Number(cc), Number(value));
}

function e16from(route, cc, value) {
  const now = Date.now();
  if (!e16RoutesSeen.has(route)) {
    e16RoutesSeen.add(route);
    post("PF4 Hub: E16 CC " + cc + " " + value + " arrived by " + route + "\n");
  }
  if (route !== e16Route) {
    if (e16Route !== null && now - e16RouteHeard < E16_ROUTE_QUIET_MS) return; // a copy of a click already counted
    e16Route = route;
    post("PF4 Hub: listening to E16 CCs from " + route + "\n");
  }
  e16RouteHeard = now;
  e16cc(cc, value);
}

/** Handle a CC from the E16. */
function e16cc(cc, value) {
  e16Connected = true;

  // Encoder turn
  if (cc >= ENCODER_CC_BASE && cc < ENCODER_CC_BASE + 16) {
    const encoder = cc - ENCODER_CC_BASE;
    const control = e16Page.encoders[encoder];
    const delta = decodeDelta(value);
    if (!control || delta === 0) return;
    const result = stepEncoder(e16Page, encoder, delta, engine.laneSettings(control.lane));
    if (!result) return;
    // the engine first, so the next click steps from the new value
    engine.setLane(result.lane, result.changes);
    scheduler.changed(result.lane);
    sendE16Sysex(result.sysex);
    e16Display.sent(result.sysex);
    setControls(result.lane, result.changes); // the Live controls follow (undo, automation recording)
    e16Update(); // a shorter Length may have clamped Hits or Rotate
    return;
  }
  // Encoder push: push on Rotate resets rotation to 0
  if (cc >= PUSH_CC_BASE && cc < PUSH_CC_BASE + 16) {
    const control = e16Page.encoders[cc - PUSH_CC_BASE];
    if (control && control.kind === "rotate") {
      engine.setLane(control.lane, { rotate: 0 });
      scheduler.changed(control.lane);
      setControls(control.lane, { rotate: 0 });
      e16Update();
    }
    return;
  }
  // Page change: the E16 has cleared its display
  if (cc === PAGE_CC) {
    e16Display.forget();
    e16Update();
  }
}

/** Send the E16 whatever on its page has changed since it was last sent. */
function e16Update() {
  if (!e16Connected) return;
  for (const message of e16Display.update((lane) => engine.laneSettings(lane))) sendE16Sysex(message);
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
  if (scheduler.playing) engine.retireVoiceLayout(songTicks);
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
