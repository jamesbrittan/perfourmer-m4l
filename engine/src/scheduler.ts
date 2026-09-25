import type { Carry, CycleTable, createEngine } from "./index";

/**
 * What the native player plays next. Timing stays in the player; this only decides what goes in its table.
 *
 * Each Lane has two banks in the player's table: a render goes into the bank that Lane is NOT playing and is offered
 * as "pending"; the player adopts it at that Lane's next Cycle boundary, notes the bank it now plays (read back
 * through `playingBank`) and reports the adoption. Every Cycle can differ (the Pitch Cycle drifts against the hits),
 * so while the transport runs each adoption triggers the render of the Cycle after it; while stopped, the playing
 * bank is kept on the Cycle at the song position, so playback can start anywhere.
 * A change that can't wait for the boundary (Gate, Velocity, the Voice Layout) re-renders the playing Cycle into the
 * other bank and offers it "now": the player switches at its next tick. Note-offs are handed on between tables (past
 * a Cycle's end, and from a replaced table), so notes still end wherever the switch lands.
 * Reports from the player arrive late (the script runs at low priority), so a render never trusts them to know which
 * bank is playing: it withdraws the pending offer (after which the player can't switch) and reads `playingBank`.
 */
export type PlayerCommand =
  /** Put a slot's [voice, pitch, velocity] messages in the player's table (velocity 0 = note-off). */
  | { type: "write"; key: number; notes: [number, number, number][] }
  | { type: "remove"; key: number }
  /** Offer a bank for the Lane's next Cycle boundary (bank -1 = withdraw the offer). now: switch at the next tick
   * instead; release: release the Lane's Voices on switching (the old note-off positions mean nothing any more). */
  | { type: "offer"; lane: number; bank: number; cycleTicks: number; now: boolean; release: boolean };

export type SchedulerOptions = {
  engine: Pick<ReturnType<typeof createEngine>, "cycleTable" | "cycleTicks" | "locate" | "resetTicks">;
  lanes: number;
  /** The player's table resolution in ticks: it reads slot floor(position / gridTicks). */
  gridTicks: number;
  /** Table key = (lane * 2 + bank) * bankSize + slot. */
  bankSize: number;
  /** The bank the Lane's player is on right now (anything else = none yet), as the player itself notes it. */
  playingBank: (lane: number) => unknown;
  /** Carried out in order, at once: the player may act on an offer before the next command. */
  send: (command: PlayerCommand) => void;
};

const EMPTY: CycleTable = { slots: [], carry: [] };

export function createScheduler({ engine, lanes, gridTicks, bankSize, playingBank: reported, send }: SchedulerOptions) {
  type Bank = { cycle: number; keys: number[]; table: CycleTable; carried: Carry[]; frame: string };
  const each = <T>(make: () => T) => Array.from({ length: lanes }, make);
  const emptyBank = (): Bank => ({ cycle: 0, keys: [], table: EMPTY, carried: [], frame: "" });
  const banks = each((): [Bank, Bank] => [emptyBank(), emptyBank()]);
  const offered = each(() => -1); // the bank last offered to the player as pending
  const adoptedAt = each((): number | null => null); // song position of each Lane's last adoption while running
  let polledAt = 0;
  let playing = false;

  /** Bank 1 before the Lane's first adoption, so that render lands in bank 0. */
  function playingBank(n: number): 0 | 1 {
    const bank = reported(n);
    return bank === 0 || bank === 1 ? bank : 1;
  }
  const playingCycle = (n: number) => banks[n][playingBank(n)].cycle;
  /** The Cycle waiting in the player's pending slot, or null. */
  const pendingCycle = (n: number) =>
    offered[n] !== -1 && offered[n] !== playingBank(n) ? banks[n][offered[n]].cycle : null;

  function withdraw(n: number) {
    send({ type: "offer", lane: n, bank: -1, cycleTicks: 0, now: false, release: false });
    offered[n] = -1;
  }

  /** The Cycle a running Lane is in, by the song position of its last Cycle boundary (numbered for the current
   * settings, which may have changed since). */
  function soundingCycle(n: number) {
    const at = adoptedAt[n];
    return at === null ? playingCycle(n) : engine.locate(n, at).cycleIndex;
  }

  function prepareNext(n: number, current: number, force = false) {
    if (force || pendingCycle(n) !== current + 1) render(n, current + 1);
  }

  // now: replace the playing Cycle from the player's next tick, instead of waiting for its next Cycle boundary
  // (cycleIndex null = the Cycle the playing bank holds, as read once the player can no longer switch)
  function render(n: number, cycleIndex: number | null, now = false) {
    withdraw(n); // from here on the player stays on its bank
    const playingNow = playingBank(n);
    const current = banks[n][playingNow];
    if (cycleIndex === null) cycleIndex = current.cycle;
    const bank = (1 - playingNow) as 0 | 1;
    // Note-offs handed on. Running, whatever is offered follows the playing Cycle in time (even when a Length or Rate
    // change has renumbered the Cycles), so it takes that Cycle's carried note-offs; a "now" replacement takes over
    // the ones the playing Cycle took over, plus everything it would have sent. Stopped, nothing is sounding.
    // If the Cycle length or Reset period changed, the old note-off positions mean nothing in the new table: the
    // player releases the Voice as it switches instead.
    const frame = `${engine.cycleTicks(n)}/${engine.resetTicks()}`;
    const release = playing && frame !== current.frame;
    const handOn = playing && !release;
    const carried = !handOn ? [] : now ? current.carried : current.table.carry;
    const table = engine.cycleTable(n, gridTicks, cycleIndex, carried, handOn && now ? current.table : EMPTY);
    const target = banks[n][bank];
    for (const key of target.keys) send({ type: "remove", key });
    target.keys = table.slots.map(({ slot, notes }) => {
      const key = (n * 2 + bank) * bankSize + slot;
      send({ type: "write", key, notes });
      return key;
    });
    Object.assign(target, { cycle: cycleIndex, table, carried, frame });
    offered[n] = bank;
    // while stopped the player adopts this at once
    send({ type: "offer", lane: n, bank, cycleTicks: engine.cycleTicks(n), now: now && playing, release });
  }

  // Keep a Lane's banks on the polled song position (cycleIndex = the Cycle there). Stopped, the player should hold
  // the Cycle playback would start in; running, the Cycle after the current one should be pending.
  function follow(n: number, cycleIndex: number) {
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

  function changed(n: number) {
    if (playing) prepareNext(n, soundingCycle(n), true);
    else render(n, engine.locate(n, polledAt).cycleIndex);
  }

  return {
    /** A fresh player (not playing any bank yet): every Lane from its first Cycle. */
    start() {
      for (let n = 0; n < lanes; n++) render(n, 0);
    },
    get playing() {
      return playing;
    },
    transport(isPlaying: boolean) {
      playing = isPlaying;
      if (!playing) {
        // withdraw anything offered for the next Cycle: stopped, the playing bank is kept on the song position
        for (let n = 0; n < lanes; n++) withdraw(n);
        return;
      }
      for (let n = 0; n < lanes; n++) {
        adoptedAt[n] = null;
        prepareNext(n, playingCycle(n));
      }
    },
    /** The song position, polled a few times a second. */
    poll(songTicks: number) {
      polledAt = songTicks;
      for (let n = 0; n < lanes; n++) follow(n, engine.locate(n, songTicks).cycleIndex);
    },
    /** The player took up a pending bank at a Cycle boundary: line up the Cycle after it. */
    adopted(n: number, songTicks: number) {
      if (!playing) return;
      adoptedAt[n] = songTicks;
      const sounding = engine.locate(n, songTicks).cycleIndex;
      // wrong Cycle (e.g. Length/Rate changed the numbering, or a "now" offer landed on a boundary): replace it at once
      if (playingCycle(n) !== sounding) return render(n, sounding, true);
      prepareNext(n, sounding);
    },
    /** The Lane's settings changed: heard from its next Cycle (at once while stopped). */
    changed,
    /** The Lane's settings changed and can't wait for the next Cycle: heard from the next note. */
    changedNow(n: number) {
      if (playing) render(n, null, true);
      else changed(n);
    },
    /** The Cycle a Capture takes: the one sounding, or the one at the song position while stopped. */
    captureCycle(n: number) {
      return playing ? soundingCycle(n) : engine.locate(n, polledAt).cycleIndex;
    },
    /** The song position a change timed to the bar counts from: undefined while stopped (the change is immediate). */
    changePosition(): number | undefined {
      return playing ? polledAt : undefined;
    },
  };
}
