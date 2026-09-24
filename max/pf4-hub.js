// Hub v8 adapter: Lane parameters and Voice announcements in -> engine -> player tables and status out.
// No timing happens here (ADR 0003). Each Lane has two banks in the player's table: a render goes into the
// bank that Lane is NOT playing and is offered as "pending"; the player adopts it at that Lane's next Cycle
// boundary and replies "adopt <lane> <bank>".
autowatch = 1;
inlets = 1;
outlets = 4; // 0: table edits, 1: "<lane> <bank> <cycleTicks>" pending (bank -1 = withdrawn), 2: Voice status text,
// 3: Reset period in ticks for the player (NEVER when off)

const { createEngine, RATES } = require("pf4-engine.js");

const GRID_TICKS = 2; // must match the player's metro
const BANK_SIZE = 10000; // table key = (lane * 2 + bank) * BANK_SIZE + slot
const LANES = 4;
const NEVER = 1e12; // "no Reset" as a period the player's modulo can use

const engine = createEngine();
const params = [
  { hits: 5, length: 8, rotate: 0, rate: "1/16" },
  { hits: 3, length: 8, rotate: 0, rate: "1/16" },
  { hits: 2, length: 5, rotate: 0, rate: "1/16" },
  { hits: 7, length: 12, rotate: 0, rate: "1/16" },
];
const song = { resetBars: 0, ticksPerBar: 1920 };
const writtenKeys = params.map(() => [[], []]);
const adoptedBank = params.map(() => 1); // so each Lane's first render lands in bank 0

function lane(n, hits, length, rotate, rateIndex) {
  params[n] = { hits, length, rotate, rate: RATES[rateIndex] };
  render(n);
}

function reset(bars) {
  song.resetBars = bars;
  sendReset();
}

// Live's time signature, e.g. 7 8
function timesig(numerator, denominator) {
  song.ticksPerBar = (numerator * 1920) / denominator;
  sendReset();
}

function sendReset() {
  engine.configure({ lanes: params, ...song });
  outlet(3, song.resetBars ? song.resetBars * song.ticksPerBar : NEVER);
}

function adopt(n, bank) {
  adoptedBank[n] = bank;
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
  for (let n = 0; n < LANES; n++) render(n);
  sendReset();
  showVoices();
}

function render(n) {
  const bank = 1 - adoptedBank[n];
  engine.configure({ lanes: params, ...song });
  outlet(1, n, -1, 0); // withdraw any pending bank while we rewrite it
  for (const key of writtenKeys[n][bank]) outlet(0, "remove", key);
  writtenKeys[n][bank] = engine.slotTable(n, GRID_TICKS).map(({ slot, notes }) => {
    const key = (n * 2 + bank) * BANK_SIZE + slot;
    outlet(0, [key].concat(...notes));
    return key;
  });
  outlet(1, n, bank, engine.cycleTicks(n));
}

function showVoices() {
  const { connected, duplicates } = engine.voiceStatus();
  const missing = [1, 2, 3, 4].filter((voice) => !connected.includes(voice));
  let text = connected.length ? `Voices ${connected.join(" ")}` : "No Voices connected";
  if (missing.length) text += ` · missing ${missing.join(" ")}`;
  if (duplicates.length) text += ` · DUPLICATE ${duplicates.join(" ")}`;
  outlet(2, "set", text);
}
