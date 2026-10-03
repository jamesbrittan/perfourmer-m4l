import { describe, expect, it } from "vitest";
import { e16Pages, LANE_COLOURS, pageRefresh, pushEncoder, stepEncoder, type E16Settings } from "../src/e16";
import { LANE_DEFAULTS, PITCH_PRESETS } from "../src/index";

const lane = (n: number, change: Partial<E16Settings> = {}): E16Settings => ({ ...LANE_DEFAULTS[n], ...change });
const label = (sysex: number[]) => String.fromCharCode(...sysex.slice(10, 14));
// slots in each Lane's quadrant: top-left, top-right, bottom-left, bottom-right
const QUADRANTS = [[0, 1, 4, 5], [2, 3, 6, 7], [8, 9, 12, 13], [10, 11, 14, 15]];

describe("E16 pages", () => {
  it("follow the Hub's tabs: page 1 Rhythm, page 2 Pitch; pages the Hub doesn't use are blank", () => {
    const pages = e16Pages();
    expect(pages.page(0).title).toBe("RHY ");
    expect(pages.page(1).title).toBe("PIT ");
    expect(pages.page(5).encoders.every((e) => e === null)).toBe(true);
  });

  it("keep their state: the same Pitch page each time it's shown", () => {
    const pages = e16Pages();
    expect(pages.page(1)).toBe(pages.page(1));
  });
});

describe("E16 Pitch page", () => {
  const page = () => e16Pages().page(1);

  it("puts Transpose, Octave, Pitch Length and Pitch Preset in each Lane's quadrant, in the Lane's colour", () => {
    const encoders = page().encoders;
    QUADRANTS.forEach((slots, n) => {
      expect(slots.map((s) => encoders[s]?.kind)).toEqual(["transpose", "octave", "pitchLength", "pitchPreset"]);
      expect(slots.every((s) => encoders[s]?.lane === n && encoders[s]?.colour === LANE_COLOURS[n])).toBe(true);
    });
  });

  it("steps Transpose and Octave within their ranges, labelled with a sign", () => {
    const up = stepEncoder(page(), 0, 1, lane(0, { transpose: 6 }))!;
    expect(up.changes).toEqual({ transpose: 7 });
    expect(label(up.sysex)).toBe("  +7");
    expect(stepEncoder(page(), 0, 1, lane(0, { transpose: 7 }))).toBeNull();
    const down = stepEncoder(page(), 1, -1, lane(0, { octave: 0 }))!;
    expect(down.changes).toEqual({ octave: -1 });
    expect(label(down.sysex)).toBe("  -1");
  });

  it("resets Transpose and Octave to 0 on a push", () => {
    expect(pushEncoder(page(), 2, lane(1, { transpose: 3 }))).toEqual({ lane: 1, changes: { transpose: 0 } });
    expect(pushEncoder(page(), 3, lane(1, { octave: -2 }))).toEqual({ lane: 1, changes: { octave: 0 } });
    expect(pushEncoder(page(), 2, lane(1, { transpose: 0 }))).toBeNull();
  });

  it("lengthens the Pitch Cycle with the degrees the editor holds beyond it, and shortens it", () => {
    const held = lane(0, { pitchCycle: [0, 2], pitchSteps: [0, 2, 4, 6, 0, 0, 0, 0] });
    expect(stepEncoder(page(), 4, 1, held)!.changes).toEqual({ pitchCycle: [0, 2, 4] });
    expect(stepEncoder(page(), 4, -1, held)!.changes).toEqual({ pitchCycle: [0] });
    expect(stepEncoder(page(), 4, -1, lane(0, { pitchCycle: [3] }))).toBeNull();
    expect(stepEncoder(page(), 4, 1, lane(0, { pitchCycle: [3] }))!.changes).toEqual({ pitchCycle: [3, 0] }); // no editor values known
  });

  it("browses Pitch Presets by turning, without changing the Lane, and loads the one shown on a push", () => {
    const p = page();
    const start = lane(0, { pitchCycle: [0, 2, 4] }); // Triad Up
    const triadUp = PITCH_PRESETS.findIndex((preset) => preset.name === "Triad Up");
    const turned = stepEncoder(p, 5, 1, start)!;
    expect(turned.changes).toEqual({});
    expect(label(turned.sysex)).toBe("TrAr"); // the next preset after the one the Lane plays
    expect(pushEncoder(p, 5, start)).toEqual({ lane: 0, changes: {}, pitchPreset: triadUp + 2 }); // menu item, from 1
  });

  it("shows the preset the Lane plays until it's browsed, or dashes if it plays none", () => {
    const shown = (settings: E16Settings) => label(pageRefresh(page(), () => settings)[1 + 5]);
    expect(shown(lane(0, { pitchCycle: [0, 4] }))).toBe("R+5 ");
    expect(shown(lane(0, { pitchCycle: [1, 1, 1] }))).toBe("----");
  });

  it("gives every Pitch Preset its own short label", () => {
    const p = page();
    const labels = PITCH_PRESETS.map((preset) => label(pageRefresh(p, () => lane(0, { pitchCycle: [...preset.degrees] }))[1 + 5]));
    expect(new Set(labels).size).toBe(PITCH_PRESETS.length);
    expect(labels.every((l) => l.length === 4)).toBe(true);
  });
});

describe("E16 pushes on the Rhythm page", () => {
  it("reset Rotate to 0, and do nothing on the other encoders", () => {
    const page = e16Pages().page(0);
    expect(pushEncoder(page, 4, lane(0, { rotate: 3 }))).toEqual({ lane: 0, changes: { rotate: 0 } });
    expect(pushEncoder(page, 0, lane(0))).toBeNull();
  });
});
