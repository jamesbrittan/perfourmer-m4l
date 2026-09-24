// Hub v8 adapter: Lane parameters in -> engine -> player slot table out. No timing happens here (ADR 0003).
// Each render goes into the bank the player is NOT playing, then is offered as "pending";
// the native player adopts it at the next Cycle boundary and tells us with "adopt <bank>".
autowatch = 1;
inlets = 1;
outlets = 2; // 0: coll edits for the player's table, 1: "pending <bank> <cycleTicks>" (bank -1 = nothing pending)

const { createEngine } = require("pf4-engine.js");

const GRID_TICKS = 2; // must match the player's metro
const BANK_SIZE = 10000; // table key = bank * BANK_SIZE + slot

const engine = createEngine();
const params = { hits: 5, length: 8, rotate: 0 };
const writtenKeys = [[], []];
let adoptedBank = 1; // so the first render lands in bank 0

function lane(hits, length, rotate) {
  params.hits = hits;
  params.length = length;
  params.rotate = rotate;
  render();
}

function adopt(bank) {
  adoptedBank = bank;
}

function bang() {
  render();
}

function render() {
  const bank = 1 - adoptedBank;
  engine.configure({ lanes: [params] });
  outlet(1, -1, 0); // withdraw any pending bank while we rewrite it
  for (const key of writtenKeys[bank]) outlet(0, "remove", key);
  writtenKeys[bank] = engine.slotTable(0, GRID_TICKS).map(({ slot, notes }) => {
    const key = bank * BANK_SIZE + slot;
    outlet(0, [key].concat(...notes));
    return key;
  });
  outlet(1, bank, engine.cycleTicks(0));
}
