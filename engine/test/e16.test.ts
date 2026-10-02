import { describe, expect, it } from "vitest";
import {
  decodeDelta,
  encoderSysEx,
  pageTitleSysEx,
  stepEncoder,
  pageRefresh,
  createE16Display,
  testPage,
  rhythmPage,
  LANE_COLOURS,
  E16_CHANNEL,
  ENCODER_CC_BASE,
  REL_INCREMENT,
  REL_DECREMENT,
} from "../src/e16";
import { RATES, type LaneParams, LANE_DEFAULTS } from "../src/index";

const defaults: Readonly<LaneParams> = { ...LANE_DEFAULTS[0] };

describe("CC protocol", () => {
  it("uses channel 1 (0-indexed 0)", () => {
    expect(E16_CHANNEL).toBe(0);
  });

  it("gives each of the 16 encoders a unique CC", () => {
    const ccs = Array.from({ length: 16 }, (_, i) => ENCODER_CC_BASE + i);
    expect(new Set(ccs).size).toBe(16);
    expect(ccs.every((cc) => cc >= 0 && cc <= 127)).toBe(true);
  });

  it("decodes relative encoder values: 65 = +1, 63 = −1", () => {
    expect(decodeDelta(REL_INCREMENT)).toBe(1);
    expect(decodeDelta(REL_DECREMENT)).toBe(-1);
    expect(decodeDelta(64)).toBe(0);
  });

  it("decodes fast turns (values further from 64)", () => {
    expect(decodeDelta(67)).toBe(3);
    expect(decodeDelta(61)).toBe(-3);
  });
});

describe("SysEx protocol", () => {
  it("builds a well-formed encoder update message", () => {
    const msg = encoderSysEx(0, 64, "1/16", { r: 0, g: 127, b: 40 });
    expect(msg[0]).toBe(0xf0); // SysEx start
    expect(msg[msg.length - 1]).toBe(0xf7); // SysEx end
    expect(msg[5]).toBe(0); // encoder 0
    expect(msg[6]).toBe(64); // ring position
    // All data bytes are 7-bit (< 128)
    expect(msg.slice(1, -1).every((b) => b < 128)).toBe(true);
  });

  it("encodes the 4-char label as ASCII", () => {
    const msg = encoderSysEx(3, 100, "1/4T");
    // chars at bytes 10–13
    expect(String.fromCharCode(msg[10], msg[11], msg[12], msg[13])).toBe("1/4T");
  });

  it("pads short labels with spaces", () => {
    const msg = encoderSysEx(0, 0, "hi");
    expect(String.fromCharCode(msg[10], msg[11], msg[12], msg[13])).toBe("hi  ");
  });

  it("truncates long labels to 4 chars", () => {
    const msg = encoderSysEx(0, 0, "hello world");
    expect(String.fromCharCode(msg[10], msg[11], msg[12], msg[13])).toBe("hell");
  });

  it("builds a page title message with encoder byte 0x7F", () => {
    const msg = pageTitleSysEx("TST ");
    expect(msg[5]).toBe(0x7f);
    expect(String.fromCharCode(msg[10], msg[11], msg[12], msg[13])).toBe("TST ");
  });
});

describe("Stepping Rate (enumerated control)", () => {
  const page = testPage();

  it("steps Rate up by one: 1/16 → 1/16Q", () => {
    const s = { ...defaults, rate: "1/16" as const };
    const result = stepEncoder(page, 0, 1, s);
    expect(result).not.toBeNull();
    expect(result!.changes.rate).toBe("1/16Q");
  });

  it("steps Rate down by one: 1/16 → 1/8T", () => {
    const s = { ...defaults, rate: "1/16" as const };
    const result = stepEncoder(page, 0, -1, s);
    expect(result).not.toBeNull();
    expect(result!.changes.rate).toBe("1/8T");
  });

  it("doesn't step past the last Rate (1/32Q)", () => {
    const s = { ...defaults, rate: "1/32Q" as const };
    expect(stepEncoder(page, 0, 1, s)).toBeNull();
  });

  it("doesn't step before the first Rate (1/1)", () => {
    const s = { ...defaults, rate: "1/1" as const };
    expect(stepEncoder(page, 0, -1, s)).toBeNull();
  });

  it("returns a 4-char label for each Rate", () => {
    const rate = page.encoders[0]!;
    for (const r of RATES) {
      const label = rate.label({ ...defaults, rate: r });
      expect(label.length).toBe(4);
    }
  });

  it('labels 1/16 as "1/16"', () => {
    const rate = page.encoders[0]!;
    expect(rate.label({ ...defaults, rate: "1/16" })).toBe("1/16");
  });
});

describe("Stepping Length (with Hits clamping)", () => {
  const page = testPage();

  it("steps Length down by one", () => {
    const s = { ...defaults, length: 16, hits: 8, rotate: 0 };
    const result = stepEncoder(page, 1, -1, s);
    expect(result).not.toBeNull();
    expect(result!.changes.length).toBe(15);
    expect(result!.changes.hits).toBeUndefined(); // Hits 8 fits within 15
  });

  it("clamps Hits when Length drops below it", () => {
    const s = { ...defaults, length: 8, hits: 8, rotate: 0 };
    const result = stepEncoder(page, 1, -1, s);
    expect(result).not.toBeNull();
    expect(result!.changes.length).toBe(7);
    expect(result!.changes.hits).toBe(7); // clamped
  });

  it("clamps Rotate when Length drops to Rotate's value", () => {
    const s = { ...defaults, length: 5, hits: 3, rotate: 4 };
    const result = stepEncoder(page, 1, -1, s);
    expect(result).not.toBeNull();
    expect(result!.changes.length).toBe(4);
    expect(result!.changes.rotate).toBe(3); // clamped to length - 1
  });

  it("doesn't go below Length 1", () => {
    const s = { ...defaults, length: 1, hits: 1, rotate: 0 };
    expect(stepEncoder(page, 1, -1, s)).toBeNull();
  });

  it("doesn't go above Length 32", () => {
    const s = { ...defaults, length: 32, hits: 8, rotate: 0 };
    expect(stepEncoder(page, 1, 1, s)).toBeNull();
  });
});

describe("Stepping Hits (clamped to Length)", () => {
  const page = testPage();

  it("steps Hits up within Length", () => {
    const s = { ...defaults, length: 8, hits: 5 };
    const result = stepEncoder(page, 2, 1, s);
    expect(result!.changes.hits).toBe(6);
  });

  it("doesn't let Hits exceed Length", () => {
    const s = { ...defaults, length: 8, hits: 8 };
    expect(stepEncoder(page, 2, 1, s)).toBeNull();
  });

  it("steps Hits down to 0", () => {
    const s = { ...defaults, length: 8, hits: 1 };
    const result = stepEncoder(page, 2, -1, s);
    expect(result!.changes.hits).toBe(0);
  });

  it("doesn't go below Hits 0", () => {
    const s = { ...defaults, length: 8, hits: 0 };
    expect(stepEncoder(page, 2, -1, s)).toBeNull();
  });
});

describe("Stepping Rotate", () => {
  const page = testPage();

  it("steps Rotate within [0, Length - 1]", () => {
    const s = { ...defaults, length: 8, rotate: 3 };
    expect(stepEncoder(page, 3, 1, s)!.changes.rotate).toBe(4);
    expect(stepEncoder(page, 3, -1, s)!.changes.rotate).toBe(2);
  });

  it("doesn't exceed Length - 1", () => {
    const s = { ...defaults, length: 8, rotate: 7 };
    expect(stepEncoder(page, 3, 1, s)).toBeNull();
  });

  it("doesn't go below 0", () => {
    const s = { ...defaults, length: 8, rotate: 0 };
    expect(stepEncoder(page, 3, -1, s)).toBeNull();
  });
});

describe("SysEx feedback from stepping", () => {
  const page = testPage();

  it("includes valid SysEx in every step result", () => {
    const s = { ...defaults, rate: "1/8" as const };
    const result = stepEncoder(page, 0, 1, s);
    expect(result).not.toBeNull();
    const msg = result!.sysex;
    expect(msg[0]).toBe(0xf0);
    expect(msg[msg.length - 1]).toBe(0xf7);
    // The label should reflect the new value (1/8T)
    expect(String.fromCharCode(msg[10], msg[11], msg[12], msg[13])).toBe("1/8T");
  });

  it("encodes the correct encoder number in the SysEx", () => {
    const s = { ...defaults, length: 10, hits: 5 };
    const result = stepEncoder(page, 2, 1, s);
    expect(result!.sysex[5]).toBe(2); // encoder 2
  });
});

describe("Page refresh", () => {
  it("sends a page title message followed by 16 encoder messages", () => {
    const page = testPage();
    const messages = pageRefresh(page, () => defaults);
    expect(messages.length).toBe(17); // 1 title + 16 encoders
    // First message is the page title
    expect(messages[0][5]).toBe(0x7f);
    // Each encoder message has the right encoder number
    for (let i = 0; i < 16; i++) {
      expect(messages[i + 1][5]).toBe(i);
    }
  });

  it("reflects the current Lane settings in each encoder's label", () => {
    const page = testPage();
    const s = { ...defaults, rate: "1/4T" as const, length: 12, hits: 7, rotate: 3 };
    const messages = pageRefresh(page, () => s);
    // Rate encoder (0): should show "1/4T"
    const rateLabel = String.fromCharCode(messages[1][10], messages[1][11], messages[1][12], messages[1][13]);
    expect(rateLabel).toBe("1/4T");
    // Length encoder (1): should show "  12"
    const lengthLabel = String.fromCharCode(messages[2][10], messages[2][11], messages[2][12], messages[2][13]);
    expect(lengthLabel).toBe("  12");
    // Hits encoder (2): should show "   7"
    const hitsLabel = String.fromCharCode(messages[3][10], messages[3][11], messages[3][12], messages[3][13]);
    expect(hitsLabel).toBe("   7");
  });

  it("dims unused encoders", () => {
    const page = testPage();
    const messages = pageRefresh(page, () => defaults);
    // Encoder 15 is null → should have dim colour
    const msg = messages[16]; // 0-indexed: title + 15
    expect(msg[7]).toBe(20); // r
    expect(msg[8]).toBe(20); // g
    expect(msg[9]).toBe(20); // b
  });
});

describe("The step result carries the right Lane", () => {
  it("every control on the test page reports Lane 0", () => {
    const page = testPage();
    for (let i = 0; i < page.encoders.length; i++) {
      if (!page.encoders[i]) continue;
      const s = { ...defaults };
      // Try stepping and check the lane
      const result = stepEncoder(page, i, 1, s);
      // Some controls may already be at max — that's fine
      if (result) expect(result.lane).toBe(0);
    }
  });
});

describe("Rhythm page (4 quadrants)", () => {
  const page = rhythmPage();

  it("sets the page title to RHY", () => {
    expect(page.title).toBe("RHY ");
  });

  it("populates all 16 encoder slots", () => {
    expect(page.encoders.length).toBe(16);
    expect(page.encoders.every((e) => e !== null)).toBe(true);
  });

  it("maps Quadrant 1 (top-left) to Lane 0 with Lane 1 colour", () => {
    // Enc 0: Hits, Enc 1: Length, Enc 4: Rotate, Enc 5: Rate
    const q1 = [0, 1, 4, 5];
    for (const idx of q1) {
      expect(page.encoders[idx]!.lane).toBe(0);
      expect(page.encoders[idx]!.colour).toEqual(LANE_COLOURS[0]);
    }
    expect(page.encoders[0]!.kind).toBe("hits");
    expect(page.encoders[1]!.kind).toBe("length");
    expect(page.encoders[4]!.kind).toBe("rotate");
    expect(page.encoders[5]!.kind).toBe("rate");
  });

  it("maps Quadrant 2 (top-right) to Lane 1 with Lane 2 colour", () => {
    // Enc 2: Hits, Enc 3: Length, Enc 6: Rotate, Enc 7: Rate
    const q2 = [2, 3, 6, 7];
    for (const idx of q2) {
      expect(page.encoders[idx]!.lane).toBe(1);
      expect(page.encoders[idx]!.colour).toEqual(LANE_COLOURS[1]);
    }
    expect(page.encoders[2]!.kind).toBe("hits");
    expect(page.encoders[3]!.kind).toBe("length");
    expect(page.encoders[6]!.kind).toBe("rotate");
    expect(page.encoders[7]!.kind).toBe("rate");
  });

  it("maps Quadrant 3 (bottom-left) to Lane 2 with Lane 3 colour", () => {
    // Enc 8: Hits, Enc 9: Length, Enc 12: Rotate, Enc 13: Rate
    const q3 = [8, 9, 12, 13];
    for (const idx of q3) {
      expect(page.encoders[idx]!.lane).toBe(2);
      expect(page.encoders[idx]!.colour).toEqual(LANE_COLOURS[2]);
    }
    expect(page.encoders[8]!.kind).toBe("hits");
    expect(page.encoders[9]!.kind).toBe("length");
    expect(page.encoders[12]!.kind).toBe("rotate");
    expect(page.encoders[13]!.kind).toBe("rate");
  });

  it("maps Quadrant 4 (bottom-right) to Lane 3 with Lane 4 colour", () => {
    // Enc 10: Hits, Enc 11: Length, Enc 14: Rotate, Enc 15: Rate
    const q4 = [10, 11, 14, 15];
    for (const idx of q4) {
      expect(page.encoders[idx]!.lane).toBe(3);
      expect(page.encoders[idx]!.colour).toEqual(LANE_COLOURS[3]);
    }
    expect(page.encoders[10]!.kind).toBe("hits");
    expect(page.encoders[11]!.kind).toBe("length");
    expect(page.encoders[14]!.kind).toBe("rotate");
    expect(page.encoders[15]!.kind).toBe("rate");
  });

  it("generates SysEx messages with quadrant colours on page refresh", () => {
    const messages = pageRefresh(page, () => defaults);
    expect(messages.length).toBe(17);
    // each Lane's E16 colour value
    expect(messages[1][7]).toBe(0); // encoder 1, Lane 1: purple
    expect(messages[3][7]).toBe(15); // encoder 3, Lane 2: green
    expect(messages[9][7]).toBe(11); // encoder 9, Lane 3: pink
    expect(messages[11][7]).toBe(7); // encoder 11, Lane 4: yellow
  });
});


describe("E16 display: only what changed is sent", () => {
  const page = rhythmPage();
  const lanes = () => [0, 1, 2, 3].map(() => ({ ...defaults }));

  it("sends the whole page the first time", () => {
    const display = createE16Display(page);
    const settings = lanes();
    expect(display.update((n) => settings[n])).toEqual(pageRefresh(page, (n) => settings[n]));
  });

  it("sends nothing when nothing changed", () => {
    const display = createE16Display(page);
    const settings = lanes();
    display.update((n) => settings[n]);
    expect(display.update((n) => settings[n])).toEqual([]);
  });

  it("sends only the encoders whose display changed", () => {
    const display = createE16Display(page);
    const settings = lanes();
    display.update((n) => settings[n]);
    settings[1] = { ...settings[1], rotate: 3 };
    const sent = display.update((n) => settings[n]);
    expect(sent.map((m) => m[5])).toEqual([6]); // Lane 2's Rotate
  });

  it("doesn't resend what a turn already sent", () => {
    const display = createE16Display(page);
    const settings = lanes();
    display.update((n) => settings[n]);
    const turn = stepEncoder(page, 4, 1, settings[0])!;
    display.sent(turn.sysex);
    settings[0] = { ...settings[0], ...turn.changes };
    expect(display.update((n) => settings[n])).toEqual([]);
  });

  it("sends the whole page again after forget (the E16 cleared its screen)", () => {
    const display = createE16Display(page);
    const settings = lanes();
    display.update((n) => settings[n]);
    display.forget();
    expect(display.update((n) => settings[n])).toHaveLength(17);
  });
});
