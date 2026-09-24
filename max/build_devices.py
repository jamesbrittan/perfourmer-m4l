"""Builds the Max for Live devices ("PF4 Hub.amxd", "PF4 Voice.amxd") next to this file.

Run: python3 max/build_devices.py   (after `npm run build` in engine/, which writes pf4-engine.js here)
The devices are generated, not hand-patched: edit this file and rebuild. Scripts (pf4-hub.js with the engine
inlined, pf4-voice.js) are embedded in v8.codebox objects, so the .amxd files need nothing beside them.
"""
import json, os, struct

HERE = os.path.dirname(os.path.abspath(__file__))
GRID_TICKS = 2  # player resolution; must match GRID_TICKS in pf4-hub.js
BANK_SIZE = 10000  # must match BANK_SIZE in pf4-hub.js
VOICE_BUS = "pf4.voice"


def embedded(script, inline_engine=False):
    """Source of a device script; the engine bundle is inlined in place of require("pf4-engine.js")."""
    with open(os.path.join(HERE, script)) as f:
        code = f.read()
    if inline_engine:
        with open(os.path.join(HERE, "pf4-engine.js")) as f:
            bundle = f.read()
        module = ("(function () {\n  const module = { exports: {} };\n  const exports = module.exports;\n"
                  + bundle + "\n  return module.exports;\n})()")
        assert 'require("pf4-engine.js")' in code
        code = code.replace('require("pf4-engine.js")', module)
    return code


class Patch:
    def __init__(self):
        self.boxes, self.lines, self.n = [], [], 0

    def add(self, maxclass, x, y, w=None, h=22, text=None, ins=1, outs=1, **extra):
        self.n += 1
        oid = f"obj-{self.n}"
        box = {"id": oid, "maxclass": maxclass, "numinlets": ins, "numoutlets": outs,
               "patching_rect": [x, y, w or max(40, 7 * len(text or "") + 16), h]}
        if text is not None:
            box["text"] = text
        if outs:
            box["outlettype"] = [""] * outs
        box.update(extra)
        self.boxes.append({"box": box})
        return oid

    def obj(self, text, x, y, ins=1, outs=1, **kw):
        return self.add("newobj", x, y, text=text, ins=ins, outs=outs, **kw)

    def msg(self, text, x, y):
        return self.add("message", x, y, text=text, ins=2, outs=1)

    def codebox(self, code, x, y, ins=1, outs=1):
        """A v8 object whose JavaScript is stored inside the device, so copies and presets stay self-contained."""
        return self.add("v8.codebox", x, y, w=200, h=60, ins=ins, outs=outs, code=code, filename="none",
                        saved_object_attributes={"parameter_enable": 0})

    def comment(self, text, x, y, w=None):
        return self.add("comment", x, y, w=w, text=text, ins=1, outs=0)

    def param(self, maxclass, name, x, y, lo, hi, initial, w=44, h=48, short=None, enum=None):
        valueof = {"parameter_longname": name, "parameter_shortname": short or name,
                   "parameter_type": 1, "parameter_mmin": lo, "parameter_mmax": hi,
                   "parameter_initial": [initial], "parameter_initial_enable": 1}
        if enum:  # named choices, e.g. rates; the object outputs the choice's index
            valueof.update(parameter_type=2, parameter_enum=enum, parameter_mmax=len(enum) - 1)
        return self.add(maxclass, x, y, w=w, h=h, ins=1, outs=2, parameter_enable=1,
                        saved_attribute_attributes={"valueof": valueof})

    def c(self, a, b, outlet=0, inlet=0):
        self.lines.append({"patchline": {"source": [a, outlet], "destination": [b, inlet]}})

    def save_amxd(self, name, width):
        doc = {"patcher": {
            "fileversion": 1,
            "appversion": {"major": 9, "minor": 1, "revision": 5, "architecture": "x64", "modernui": 1},
            "classnamespace": "box", "rect": [100, 100, 1100, 800],
            "openrect": [0.0, 0.0, float(width), 169.0], "openrectmode": 0,
            "default_fontsize": 10.0, "default_fontname": "Arial Bold", "gridsize": [8.0, 8.0],
            "latency": 0, "is_mpe": 0,
            "project": {"version": 1, "contents": {"patchers": {}}, "layout": {}, "searchpath": {},
                        "amxdtype": 1835887981,  # 'mmmm' = MIDI effect
                        "readonly": 0, "devpathtype": 0, "devpath": ".", "sortmode": 0,
                        "viewmode": 0, "includepackages": 0},
            "boxes": self.boxes, "lines": self.lines}}
        body = json.dumps(doc, indent=1).encode() + b"\0"
        header = (b"ampf" + struct.pack("<I", 4) + b"mmmm" +
                  b"meta" + struct.pack("<I", 4) + struct.pack("<I", 1) +
                  b"ptch" + struct.pack("<I", len(body)))
        with open(os.path.join(HERE, name), "wb") as f:
            f.write(header + body)


LANES = 4
LANE_DEFAULTS = [(5, 8, 0), (3, 8, 0), (2, 5, 0), (7, 12, 0)]  # must match params in pf4-hub.js
RATES = ["1/1", "1/2", "1/4", "1/4T", "1/8", "1/8T", "1/16", "1/16Q", "1/16T", "1/16S", "1/32", "1/32Q"]  # = engine RATES
DEFAULT_RATE = RATES.index("1/16")
NEVER = 1e12  # "no Reset" period, as in pf4-hub.js
HUB_BUS = "pf4.hub"


def build_hub():
    P = Patch()
    Y = 220  # logic lives below the visible 169px device area

    # --- adapter + shared player table
    adapter = P.codebox(embedded("pf4-hub.js", inline_engine=True), 4, Y + 900, ins=1, outs=4)
    table = P.obj("coll", 4, Y + 40, ins=1, outs=4)
    shared_notes = P.obj("zl iter 3", 4, Y + 80, ins=2, outs=2)
    pending = P.obj("route 0 1 2 3", 200, Y + 40, ins=2, outs=5)
    bus = P.obj(f"send {VOICE_BUS}", 4, Y + 700)
    hub_in = P.obj(f"receive {HUB_BUS}", 200, Y - 30, ins=0)
    P.c(adapter, table, 0, 0); P.c(adapter, pending, 1); P.c(hub_in, adapter)
    P.c(table, shared_notes); P.c(shared_notes, bus)

    # --- visible: one 2×2 block per Lane, then status/setup
    P.comment("PF4 Hub", 4, 0, 60)
    status = P.msg("Waiting for Voices", 380, 20)
    P.c(adapter, status, 2)
    P.comment("Reset every", 380, 48, 64)
    reset = P.param("live.numbox", "Reset Bars", 446, 48, 0, 64, 0, w=40, h=18, short="Reset")
    P.comment("bars (0 = off)", 488, 48, 80)
    reset_msg = P.obj("prepend reset", 700, Y - 30)
    P.c(reset, reset_msg); P.c(reset_msg, adapter)
    P.comment("Perfourmer setup: Play Mode M1 · synth ch 1–4 on MIDI ch 1–4 · "
              "Edit 3 (aftertouch → cutoff) on", 380, 76, 190)

    # --- Live's time signature -> adapter (bar length for Reset)
    here = P.obj("live.thisdevice", 1000, Y, ins=1, outs=3)
    live_set = P.msg("path live_set", 1000, Y + 30)
    path = P.obj("live.path", 1000, Y + 60, ins=1, outs=3)
    num = P.obj("live.observer @property signature_numerator", 1150, Y + 90, ins=2, outs=2)
    den = P.obj("live.observer @property signature_denominator", 1150, Y + 120, ins=2, outs=2)
    sig = P.obj("pak 4 4", 1150, Y + 150, ins=2)
    sig_msg = P.obj("prepend timesig", 1150, Y + 180)
    P.c(here, live_set); P.c(live_set, path)
    P.c(path, num, 0, 1); P.c(path, den, 0, 1)
    P.c(num, sig, 0, 0); P.c(den, sig, 0, 1); P.c(sig, sig_msg); P.c(sig_msg, adapter)

    # --- transport observer: release everything on stop, adopt pending banks on start
    playing = P.obj("live.observer @property is_playing", 1000, Y + 90, ins=2, outs=2)
    started = P.obj("sel 0 1", 1000, Y + 120, ins=3, outs=3)
    release_all = P.msg("releaseall", 1000, Y + 150)
    rollcall = P.msg("rollcall", 1100, Y + 30)
    load = P.obj("loadbang", 1200, Y)
    P.c(path, playing, 0, 1); P.c(playing, started)
    P.c(started, release_all, 0); P.c(release_all, bus)
    P.c(here, rollcall); P.c(rollcall, bus)          # ask Voices that loaded before us to announce
    P.c(load, adapter)                               # render every Lane once

    # --- clock: fine tick grid (ticket 01 verdict), fanned out to every Lane
    clock = P.obj(f"metro {GRID_TICKS} ticks @quantize {GRID_TICKS} ticks @active 1", 600, Y, ins=2)
    pos = P.obj("transport", 600, Y + 30, ins=2, outs=9)
    tick = P.obj("expr int($f1+0.5)", 600, Y + 60)
    fan = P.obj("t " + " ".join(["i"] * LANES), 600, Y + 90, ins=1, outs=LANES)
    P.c(clock, pos); P.c(pos, tick, 7); P.c(tick, fan)

    for n in range(LANES):
        hits_d, len_d, rot_d = LANE_DEFAULTS[n]
        x = 4 + 94 * n
        P.comment(f"Lane {n + 1}", x, 14, 60)
        hits = P.param("live.dial", f"L{n + 1} Hits", x, 30, 0, len_d, hits_d, short="Hits")
        length = P.param("live.dial", f"L{n + 1} Length", x + 46, 30, 1, 64, len_d, short="Length")
        rotate = P.param("live.dial", f"L{n + 1} Rotate", x, 80, 0, 63, rot_d, short="Rotate")
        rate = P.param("live.dial", f"L{n + 1} Rate", x + 46, 80, 0, 0, DEFAULT_RATE, short="Rate", enum=RATES)

        lx = 200 + 300 * n  # this Lane's logic column
        ly = Y + 100
        # Hits range follows Length, so a full encoder sweep is always valid
        len_t = P.obj("t i i", lx, ly, ins=1, outs=2)
        rng = P.obj("prepend _parameter_range 0", lx + 60, ly + 30)
        P.c(length, len_t); P.c(len_t, rng, 1); P.c(rng, hits)

        lane = P.obj(f"pak {hits_d} {len_d} {rot_d} {DEFAULT_RATE}", lx, ly + 60, ins=4)
        prep = P.obj(f"prepend lane {n}", lx, ly + 90)
        P.c(hits, lane, 0, 0); P.c(len_t, lane, 0, 1); P.c(rotate, lane, 0, 2); P.c(rate, lane, 0, 3)
        P.c(lane, prep); P.c(prep, adapter)

        # pending bank + Cycle length (fractional for odd rates), held until adopted
        unpack = P.obj("unpack 0 0.", lx, ly + 130, ins=1, outs=2)
        pend_bank = P.obj("i -1", lx, ly + 160, ins=2)
        pend_ticks = P.obj(f"f {len_d * 120}", lx + 60, ly + 160, ins=2)
        P.c(pending, unpack, n); P.c(unpack, pend_bank, 0, 1); P.c(unpack, pend_ticks, 1, 1)

        # player: position = (song mod Reset period) mod Cycle length, exactly as the engine's locate()
        where = "fmod(fmod($f1,$f3),$f2)"
        tick_t = P.obj("t i i", lx, ly + 200, ins=1, outs=2)
        pos_now = P.obj(f"expr {where}", lx + 60, ly + 230, ins=3)
        pos_t = P.obj("t f f", lx + 60, ly + 260, ins=1, outs=2)
        wrapped = P.obj("expr $f1 < $f2", lx + 60, ly + 290, ins=2)   # position went backwards = new Cycle
        is_new = P.obj("sel 1", lx + 60, ly + 320, ins=2, outs=2)
        key = P.obj(f"expr $i4*{BANK_SIZE} + int({where}/{GRID_TICKS}. + 0.5)", lx, ly + 460, ins=4)
        P.c(fan, tick_t, LANES - 1 - n)
        P.c(tick_t, pos_now, 1, 0)                       # first: adopt a pending bank if a Cycle began
        P.c(pos_now, pos_t); P.c(pos_t, wrapped, 1, 0); P.c(pos_t, wrapped, 0, 1)
        P.c(wrapped, is_new)
        P.c(tick_t, key, 0, 0)                           # then: look up this slot in the playing bank
        P.c(key, table)
        init_c = P.msg(str(len_d * 120), lx + 150, ly + 200)
        init_r = P.msg(str(NEVER), lx + 200, ly + 200)
        init_key = P.msg(str(-BANK_SIZE), lx + 260, ly + 200)
        P.c(load, init_c); P.c(init_c, pos_now, 0, 1); P.c(init_c, key, 0, 1)
        P.c(load, init_r); P.c(init_r, pos_now, 0, 2); P.c(init_r, key, 0, 2)
        P.c(adapter, pos_now, 3, 2); P.c(adapter, key, 3, 2)   # Reset period from the adapter
        P.c(load, init_key); P.c(init_key, key, 0, 3)

        adopt_now = P.obj("t b", lx + 60, ly + 350)
        has_pending = P.obj("sel -1", lx + 60, ly + 380, ins=2, outs=2)
        adopt_t = P.obj("t b i i b", lx + 60, ly + 410, ins=1, outs=4)
        bank_key = P.obj(f"+ {n * 2}", lx + 110, ly + 440, ins=2)
        to_adapter = P.obj(f"prepend adopt {n}", lx + 160, ly + 440)
        release = P.msg(f"release {n + 1}", lx + 60, ly + 470)  # 4×mono: Lane n+1 plays Voice n+1
        clear_pending = P.msg("-1", lx + 140, ly + 470)
        P.c(is_new, adopt_now); P.c(adopt_now, pend_bank); P.c(pend_bank, has_pending)
        P.c(has_pending, adopt_t, 1)
        P.c(adopt_t, pend_ticks, 3); P.c(pend_ticks, pos_now, 0, 1); P.c(pend_ticks, key, 0, 1)
        P.c(adopt_t, bank_key, 2); P.c(bank_key, key, 0, 3)
        P.c(adopt_t, to_adapter, 1); P.c(to_adapter, adapter)
        P.c(adopt_t, release, 0); P.c(release, bus)
        P.c(adopt_t, clear_pending, 0); P.c(clear_pending, pend_bank, 0, 1)
        P.c(started, adopt_now, 1)  # transport start adopts whatever is pending

    P.save_amxd("PF4 Hub.amxd", 580)


def build_voice():
    V = Patch()
    V.comment("PF4 Voice", 4, 2, 120)
    voice = V.param("live.numbox", "Voice", 4, 24, 1, 8, 1, w=44, h=18)
    V.comment("= chain number; set this chain's External Instrument to the same MIDI channel", 4, 48, 170)

    rcv = V.obj(f"receive {VOICE_BUS}", 4, 200, ins=0)
    route = V.obj("route release releaseall rollcall", 4, 230, ins=2, outs=4)
    held = V.obj("flush", 4, 440, ins=2, outs=2)  # remembers sounding notes; bang releases them
    # "release <voice>": only when it's addressed to us
    rel_mine = V.obj("expr $i1 == $i2", 250, 260, ins=2)
    rel_sel = V.obj("sel 1", 250, 290, ins=2, outs=2)
    V.c(rcv, route); V.c(route, rel_mine, 0); V.c(rel_mine, rel_sel); V.c(rel_sel, held)
    V.c(route, held, 1)
    brain = V.codebox(embedded("pf4-voice.js"), 400, 600)
    rc = V.msg("rollcall", 400, 260)
    V.c(route, rc, 2); V.c(rc, brain)
    # notes: [voice pitch velocity] -> pass [pitch velocity] if the voice is ours
    split = V.obj("t l l", 4, 260, ins=1, outs=2)
    who = V.obj("zl nth 1", 120, 290, ins=2, outs=2)
    mine = V.obj("== 1", 120, 320, ins=2)
    body = V.obj("zl slice 1", 4, 350, ins=2, outs=2)
    gate = V.obj("gate 1", 4, 380, ins=2)
    pk = V.obj("pack 0 0", 4, 470, ins=2)
    fmt = V.obj("midiformat 1", 4, 500, ins=7, outs=2)
    out = V.obj("midiout", 4, 530, ins=1, outs=0)
    V.c(route, split, 3)
    V.c(split, who, 1); V.c(who, mine); V.c(mine, gate, 0, 0)   # right first: is it for this Voice?
    V.c(split, body, 0); V.c(body, gate, 1, 1)                  # then pass [pitch velocity]
    V.c(gate, held); V.c(held, pk, 0, 0); V.c(held, pk, 1, 1); V.c(pk, fmt); V.c(fmt, out)
    # Voice number drives filtering, MIDI channel, release addressing and the Hub announcement
    V.c(voice, mine, 0, 1); V.c(voice, fmt, 0, 6); V.c(voice, rel_mine, 0, 1); V.c(voice, brain)
    here = V.obj("live.thisdevice", 400, 200, ins=1, outs=3)
    V.c(here, brain); V.c(brain, voice)
    V.save_amxd("PF4 Voice.amxd", 180)


if __name__ == "__main__":
    build_hub()
    build_voice()
    print("built PF4 Hub.amxd, PF4 Voice.amxd")
