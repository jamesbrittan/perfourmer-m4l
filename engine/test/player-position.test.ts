import { describe, expect, it } from "vitest";
import { createEngine, FEELS, PLAYER, PLAYER_POSITION, RANGES, STRAIGHT_RATES, type Rate } from "../src/index";

/** Evaluates the player's Max expr the way Max does ($fN = the Nth inlet as a float, fmod as in C). */
const player = (songTicks: number, cycleTicks: number, resetTicks: number) =>
  new Function("f1", "f2", "f3", "fmod", `return ${PLAYER_POSITION.replace(/\$f(\d)/g, "f$1")};`)(
    songTicks,
    cycleTicks,
    resetTicks,
    (a: number, b: number) => a % b,
  ) as number;

describe("The player's position formula", () => {
  it("puts it at the same point in the Cycle as the engine's locate()", () => {
    for (const [rate, length, resetBars] of [["1/16", 8, 0], ["1/8T", 7, 2], ["1/16S", 5, 1], ["1/4", 3, 3]] as [Rate, number, number][]) {
      const engine = createEngine();
      engine.configure({ lanes: [{ hits: 1, length, rotate: 0, rate }], resetBars });
      const reset = resetBars ? resetBars * 1920 : 1e12;
      for (let tick = 0; tick < 1920 * 13; tick += 38)
        expect(player(tick, engine.cycleTicks(0), reset)).toBeCloseTo(engine.locate(0, tick).offsetTicks, 6);
    }
  });
});

describe("The player's table", () => {
  it("has room in each bank for the longest Cycle: every step at the slowest Rate and Feel", () => {
    const engine = createEngine();
    const cycles = STRAIGHT_RATES.flatMap((rate) =>
      FEELS.map((feel) => {
        engine.configure({ lanes: [{ hits: 1, length: RANGES.length[1], rotate: 0, rate, feel }] });
        return engine.cycleTicks(0);
      }),
    );
    expect(Math.ceil(Math.max(...cycles) / PLAYER.gridTicks)).toBeLessThan(PLAYER.bankSize);
  });
});
