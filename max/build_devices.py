"""Builds the Max for Live devices ("PF4 Hub.amxd", "PF4 Voice.amxd") next to this file.

Run: python3 max/build_devices.py   (after `npm run build` in engine/, which writes pf4-engine.js here)
The devices are generated, not hand-patched: edit this file and rebuild.
"""
import json, os, struct

HERE = os.path.dirname(os.path.abspath(__file__))
GRID_TICKS = 2  # player resolution; must match GRID_TICKS in pf4-hub.js
BANK_SIZE = 10000  # must match BANK_SIZE in pf4-hub.js
VOICE_BUS = "pf4.voice"


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

    def comment(self, text, x, y, w=None):
        return self.add("comment", x, y, w=w, text=text, ins=1, outs=0)

    def param(self, maxclass, name, x, y, lo, hi, initial, w=44, h=48):
        return self.add(maxclass, x, y, w=w, h=h, ins=1, outs=2, parameter_enable=1,
                        saved_attribute_attributes={"valueof": {
                            "parameter_longname": name, "parameter_shortname": name,
                            "parameter_type": 1, "parameter_mmin": lo, "parameter_mmax": hi,
                            "parameter_initial": [initial], "parameter_initial_enable": 1}})

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


def build_hub():
    P = Patch()
    # --- visible controls (device view shows the top-left 169px)
    P.comment("PF4 Hub · Lane 1", 4, 2, 160)
    hits = P.param("live.dial", "Hits", 4, 24, 0, 64, 5)
    length = P.param("live.dial", "Length", 54, 24, 1, 64, 8)
    rotate = P.param("live.dial", "Rotate", 104, 24, 0, 63, 0)

    Y = 200
    # --- adapter: dial changes -> v8 renders the next Cycle into the inactive bank
    lane = P.obj("pak 5 8 0", 4, Y, ins=3)
    prep = P.obj("prepend lane", 4, Y + 30)
    adapter = P.obj("v8 pf4-hub.js", 4, Y + 60, ins=1, outs=2)
    load = P.obj("loadbang", 200, Y)
    table = P.obj("coll", 4, Y + 100, ins=1, outs=4)
    P.c(hits, lane, 0, 0); P.c(length, lane, 0, 1); P.c(rotate, lane, 0, 2)
    P.c(lane, prep); P.c(prep, adapter); P.c(load, adapter)
    P.c(adapter, table, 0, 0)

    # pending bank + its Cycle length, held until the player adopts them
    pending = P.obj("unpack 0 0", 200, Y + 100, ins=1, outs=2)
    pend_bank = P.obj("i -1", 200, Y + 130, ins=2)
    pend_ticks = P.obj("i 1920", 300, Y + 130, ins=2)
    P.c(adapter, pending, 1); P.c(pending, pend_bank, 0, 1); P.c(pending, pend_ticks, 1, 1)

    # --- player: fine tick grid, looks events up at play time (ticket 01 verdict)
    clock = P.obj(f"metro {GRID_TICKS} ticks @quantize {GRID_TICKS} ticks @active 1", 4, Y + 200, ins=2)
    pos = P.obj("transport", 4, Y + 230, ins=2, outs=9)
    tick = P.obj("expr int($f1+0.5)", 4, Y + 260)
    tick_t = P.obj("t i i", 4, Y + 290, ins=1, outs=2)
    at_boundary = P.obj("expr ($i1 % $i2) == 0", 200, Y + 320, ins=2)
    is_boundary = P.obj("sel 1", 200, Y + 350, ins=2, outs=2)
    key = P.obj(f"expr $i3*{BANK_SIZE} + ($i1 % $i2)/{GRID_TICKS}", 4, Y + 480, ins=3)
    notes = P.obj("zl iter 3", 4, Y + 540, ins=2, outs=2)
    bus = P.obj(f"send {VOICE_BUS}", 4, Y + 570)
    P.c(clock, pos); P.c(pos, tick, 7); P.c(tick, tick_t)
    P.c(tick_t, at_boundary, 1, 0)  # first: adopt a pending bank if this tick starts a Cycle
    P.c(tick_t, key, 0, 0)          # then: look up this slot in the playing bank
    P.c(at_boundary, is_boundary); P.c(key, table); P.c(table, notes); P.c(notes, bus)
    init = P.msg("1920", 300, Y + 290); init_bank = P.msg("-1", 360, Y + 290)
    P.c(load, init); P.c(init, at_boundary, 0, 1); P.c(init, key, 0, 1)
    P.c(load, init_bank); P.c(init_bank, key, 0, 2)

    # adopt: switch bank + Cycle length, tell the adapter, release sounding notes, clear pending
    adopt_now = P.obj("t b", 200, Y + 380)
    has_pending = P.obj("sel -1", 200, Y + 410, ins=2, outs=2)
    adopt_t = P.obj("t b i i b", 200, Y + 440, ins=1, outs=4)
    to_adapter = P.obj("prepend adopt", 400, Y + 470)
    release = P.msg("release", 200, Y + 500); clear_pending = P.msg("-1", 280, Y + 500)
    P.c(is_boundary, adopt_now); P.c(adopt_now, pend_bank); P.c(pend_bank, has_pending)
    P.c(has_pending, adopt_t, 1)
    P.c(adopt_t, pend_ticks, 3)                                   # new Cycle length ->
    P.c(pend_ticks, at_boundary, 0, 1); P.c(pend_ticks, key, 0, 1)
    P.c(adopt_t, key, 2, 2)                                       # new bank -> lookups
    P.c(adopt_t, to_adapter, 1); P.c(to_adapter, adapter)         # adapter writes the other bank next
    P.c(adopt_t, release, 0); P.c(release, bus)
    P.c(adopt_t, clear_pending, 0); P.c(clear_pending, pend_bank, 0, 1)

    # transport: adopt on start, release on stop (polled; ticket 03 replaces this with an observer)
    poll = P.obj("metro 50 @active 1", 600, Y + 200, ins=2)
    state = P.obj("transport", 600, Y + 230, ins=2, outs=9)
    changed = P.obj("change", 600, Y + 260, ins=1, outs=3)
    started = P.obj("sel 0 1", 600, Y + 290, ins=3, outs=3)
    P.c(poll, state); P.c(state, changed, 6); P.c(changed, started)
    P.c(started, release, 0); P.c(started, adopt_now, 1)
    P.save_amxd("PF4 Hub.amxd", 160)


def build_voice():
    V = Patch()
    V.comment("PF4 Voice", 4, 2, 120)
    voice = V.param("live.numbox", "Voice", 4, 24, 1, 8, 1, w=44, h=18)
    V.comment("= chain number; set this chain's External Instrument to the same MIDI channel", 4, 48, 170)

    rcv = V.obj(f"receive {VOICE_BUS}", 4, 200, ins=0)
    rel = V.obj("route release", 4, 230, ins=2, outs=2)
    split = V.obj("t l l", 4, 260, ins=1, outs=2)
    who = V.obj("zl nth 1", 160, 290, ins=2, outs=2)
    mine = V.obj("== 1", 160, 320, ins=2)
    body = V.obj("zl slice 1", 4, 320, ins=2, outs=2)
    gate = V.obj("gate 1", 4, 350, ins=2)
    held = V.obj("flush", 4, 380, ins=2, outs=2)  # remembers sounding notes; bang releases them
    pk = V.obj("pack 0 0", 4, 410, ins=2)
    fmt = V.obj("midiformat 1", 4, 440, ins=7, outs=2)
    out = V.obj("midiout", 4, 470, ins=1, outs=0)
    V.c(rcv, rel); V.c(rel, held, 0); V.c(rel, split, 1)
    V.c(split, who, 1); V.c(who, mine); V.c(mine, gate, 0, 0)   # right first: is it for this Voice?
    V.c(split, body, 0); V.c(body, gate, 1, 1)                  # then pass [pitch velocity]
    V.c(gate, held); V.c(held, pk, 0, 0); V.c(held, pk, 1, 1); V.c(pk, fmt); V.c(fmt, out)
    V.c(voice, mine, 0, 1); V.c(voice, fmt, 0, 6)

    here = V.obj("live.thisdevice", 300, 200, ins=1, outs=3)
    chain = V.obj("js pf4-voiceindex.js", 300, 230)
    V.c(here, chain); V.c(chain, voice)
    V.save_amxd("PF4 Voice.amxd", 180)


if __name__ == "__main__":
    build_hub()
    build_voice()
    print("built PF4 Hub.amxd, PF4 Voice.amxd")
