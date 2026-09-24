import type { Event } from "../src/index";

export const SIXTEENTH = 120; // ticks at 480 PPQ

/** Reads a rendered Cycle back as a step pattern, e.g. "x.xx.xx." */
export function asPattern(events: Event[], length: number): string {
  const steps = Array.from({ length }, () => ".");
  for (const e of events) steps[e.onset / SIXTEENTH] = "x";
  return steps.join("");
}
