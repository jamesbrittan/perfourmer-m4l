"""PROTOTYPE — throwaway. Generates the timing-prototype Max abstractions.

Run: python3 gen.py   (writes "PF4 Proto Hub.amxd", "PF4 Proto Voice.amxd" and pf4.proto.voiceindex.js next to this file)

Question: can a native, transport-synced Max player emit pre-rendered events tightly enough?
Mechanism A = fine tick grid (metro every 8 ticks polls a slot table).
Mechanism B = scheduled delays (at each bar start, every event is queued in a pipe).
"""
import json, os, struct

BAR = 1920  # ticks per 4/4 bar at 480 PPQ
GRID = 8    # mechanism A grid, ticks; every onset/offset below is a multiple of 8

# ---- hard-coded Events: (onset, duration, pitch, velocity, voice) --------------------------
def euclid(hits, steps):
    return [i for i in range(steps) if (i * hits) % steps < hits]  # evenly spread hits

events = []
def lane(voice, step_ticks, steps, hit_steps, dur, pitches):
    for n, s in enumerate(hit_steps):
        onset = s * step_ticks
        vel = 120 if onset == 0 else 100
        events.append((onset, dur, pitches[n % len(pitches)], vel, voice))

# V1: 1/16, Euclid 5/8 twice
lane(1, 120, 16, euclid(5, 8) + [s + 8 for s in euclid(5, 8)], 64, [48, 51, 55, 58])
# V2: 1/16 triplets, Euclid 7/12 twice
lane(2, 80, 24, euclid(7, 12) + [s + 12 for s in euclid(7, 12)], 40, [60, 63, 67])
# V3: 1/5 beat (quintuplets), every step
lane(3, 96, 20, list(range(20)), 48, [72, 74, 75, 79, 82])
# V4: gap-gate ties — each note lasts until 8 ticks past the next onset (overlap => legato/glide)
v4_onsets, v4_pitches = [0, 480, 720, 840, 960, 1440], [36, 43, 39, 41, 43, 46]
for i, on in enumerate(v4_onsets):
    nxt = v4_onsets[i + 1] if i + 1 < len(v4_onsets) else BAR
    events.append((on, nxt - on + GRID, v4_pitches[i], 120 if on == 0 else 100, 4))
# Tick 0 of every bar hits all four voices at once => chord-skew test.

# Flatten to on/off messages: (tick, voice, pitch, vel); offs sort before ons at the same tick
msgs = []
for on, dur, p, v, voice in events:
    msgs.append((on, voice, p, v))
    msgs.append((on + dur, voice, p, 0))
msgs.sort(key=lambda m: (m[0], m[3] > 0))

# Mechanism A table: slot -> flat [voice pitch vel ...]
slots = {}
for t, voice, p, v in msgs:
    slots.setdefault((t % BAR) // GRID, []).extend([voice, p, v])
coll_a = "clear, " + ", ".join(f"{k} {' '.join(map(str, v))}" for k, v in sorted(slots.items()))
# Mechanism B table: index -> onset voice pitch vel (onset may exceed BAR for tied note-offs)
coll_b = "clear, " + ", ".join(f"{i} {t} {voice} {p} {v}" for i, (t, voice, p, v) in enumerate(msgs))

# ---- tiny patcher builder -----------------------------------------------------------------
class Patch:
    def __init__(self):
        self.boxes, self.lines, self.n = [], [], 0
    def add(self, maxclass, x, y, w=None, text=None, ins=1, outs=1, **extra):
        self.n += 1
        oid = f"obj-{self.n}"
        box = {"id": oid, "maxclass": maxclass, "numinlets": ins, "numoutlets": outs,
               "patching_rect": [x, y, w or max(40, 7 * len(text or "") + 16), 22]}
        if text is not None:
            box["text"] = text
        if outs:
            box["outlettype"] = [""] * outs
        box.update(extra)
        self.boxes.append({"box": box})
        return oid
    def obj(self, text, x, y, ins=1, outs=1, **kw):
        return self.add("newobj", x, y, text=text, ins=ins, outs=outs, **kw)
    def msg(self, text, x, y, w=None):
        return self.add("message", x, y, w=w, text=text, ins=2, outs=1)
    def comment(self, text, x, y, w=None):
        return self.add("comment", x, y, w=w, text=text, ins=1, outs=0)
    def num(self, x, y, f=False):
        return self.add("flonum" if f else "number", x, y, w=60, ins=1, outs=2)
    def toggle(self, x, y):
        return self.add("toggle", x, y, w=22, ins=1, outs=1)
    def c(self, a, b, outlet=0, inlet=0):
        self.lines.append({"patchline": {"source": [a, outlet], "destination": [b, inlet]}})
    def save_amxd(self, path, width):
        """Write a finished Max MIDI Effect device (layout copied from a device saved by Max 9.1)."""
        doc = {"patcher": {"fileversion": 1,
                           "appversion": {"major": 9, "minor": 1, "revision": 5,
                                          "architecture": "x64", "modernui": 1},
                           "classnamespace": "box", "rect": [100, 100, 1100, 800],
                           "openrect": [0.0, 0.0, float(width), 169.0], "openrectmode": 0,
                           "default_fontsize": 10.0, "default_fontname": "Arial Bold",
                           "gridsize": [8.0, 8.0], "latency": 0, "is_mpe": 0,
                           "project": {"version": 1, "contents": {"patchers": {}}, "layout": {},
                                       "searchpath": {}, "amxdtype": 1835887981,  # 'mmmm' = MIDI effect
                                       "readonly": 0, "devpathtype": 0, "devpath": ".",
                                       "sortmode": 0, "viewmode": 0, "includepackages": 0},
                           "boxes": self.boxes, "lines": self.lines}}
        body = json.dumps(doc, indent=1).encode() + b"\0"
        header = (b"ampf" + struct.pack("<I", 4) + b"mmmm" +
                  b"meta" + struct.pack("<I", 4) + struct.pack("<I", 1) +
                  b"ptch" + struct.pack("<I", len(body)))
        with open(path, "wb") as f:
            f.write(header + body)

here = os.path.dirname(os.path.abspath(__file__))

# ---- player ---------------------------------------------------------------------------------
P = Patch()
# visible UI (top-left: shown inside the device via bpatcher)
P.comment("PF4 timing prototype   mode: off = A grid · on = B scheduled", 4, 2, 400)
mode = P.toggle(4, 26); P.comment("mode", 30, 26)
P.comment("late ms (last)", 90, 26); last_ms = P.num(180, 26, f=True)
P.comment("max |late| ms", 250, 26); max_ms = P.num(340, 26, f=True)
P.comment("slot errors (A)", 90, 52); slot_err = P.num(180, 52)
P.comment("events sent", 250, 52); sent = P.num(340, 52)
P.comment("tempo", 90, 78); tempo_n = P.num(180, 78, f=True)
P.comment("PPQ", 250, 78); res_n = P.num(340, 78)
reset = P.msg("reset stats", 4, 104, 80)
P.comment("Max window prints nothing; watch these numbers.", 90, 104, 320)

Y = 200
lb = P.obj("loadbang", 4, Y)
lb_t = P.obj("t b b b", 4, Y + 30, ins=1, outs=3)
fill_a = P.msg(coll_a, 4, Y + 60, 200)
fill_b = P.msg(coll_b, 220, Y + 60, 200)
zero = P.msg("0", 440, Y + 60)
coll_a_o = P.obj("coll", 4, Y + 90, ins=1, outs=4)
coll_b_o = P.obj("coll", 220, Y + 90, ins=1, outs=4)
P.c(lb, lb_t); P.c(lb_t, fill_a, 2); P.c(lb_t, fill_b, 1); P.c(lb_t, zero, 0)
P.c(fill_a, coll_a_o); P.c(fill_b, coll_b_o); P.c(zero, mode)

# mode switch -> metro activity
mode_t = P.obj("t i i", 4, Y + 130, ins=1, outs=2)
not_mode = P.obj("== 0", 4, Y + 160, ins=2)
act_a = P.obj("prepend active", 4, Y + 190)
act_b = P.obj("prepend active", 160, Y + 190)
P.c(mode, mode_t); P.c(mode_t, not_mode, 0); P.c(not_mode, act_a); P.c(mode_t, act_b, 1)

# shared output + stats
out_send = P.obj("send pf4proto.voice", 600, Y + 560)
sent_count = P.obj("counter", 800, Y + 560, ins=5, outs=4)
P.c(sent_count, sent)
to_ms = P.obj("expr $f1*60000./($f2*480.)", 600, Y + 440, ins=2)
abs_o = P.obj("abs", 600, Y + 470)
maxo = P.obj("maximum 0.", 600, Y + 500, ins=2)
max_t = P.obj("t f f", 600, Y + 530, ins=1, outs=2)
P.c(to_ms, last_ms); P.c(to_ms, abs_o); P.c(abs_o, maxo); P.c(maxo, max_t)
P.c(max_t, maxo, 1, 1); P.c(max_t, max_ms, 0)
reset_t = P.obj("t b b b", 800, Y + 440, ins=1, outs=3)
P.c(reset, reset_t)
reset_zero = P.msg("0.", 800, Y + 470)
P.c(reset_t, reset_zero, 0); P.c(reset_zero, maxo, 0, 1); P.c(reset_zero, max_ms)
rz_int = P.msg("0", 860, Y + 470); P.c(reset_t, rz_int, 1); P.c(rz_int, slot_err); P.c(rz_int, sent)
rz_cnt = P.msg("set 0", 900, Y + 470); P.c(reset_t, rz_cnt, 2); P.c(rz_cnt, sent_count, 0)
sent_bang = P.obj("t b", 800, Y + 530)  # counters want bangs, not lists
P.c(sent_bang, sent_count)
tempo_init = P.msg("120.", 500, Y + 60)  # avoid divide-by-zero before the first tempo arrives
P.c(lb_t, tempo_init, 0); P.c(tempo_init, to_ms, 0, 1)

# --- Mechanism A: fine grid
metro_a = P.obj(f"metro {GRID} ticks @quantize {GRID} ticks @active 1", 4, Y + 240, ins=2)
tr_a = P.obj("transport", 4, Y + 270, ins=2, outs=9)
P.c(act_a, metro_a); P.c(metro_a, tr_a)
P.c(tr_a, tempo_n, 4); P.c(tr_a, res_n, 3); P.c(tr_a, to_ms, 4, 1)
raw_a = P.obj("t f f", 4, Y + 300, ins=1, outs=2)
P.c(tr_a, raw_a, 7)
late_a = P.obj(f"expr fmod($f1+{GRID // 2}.,{GRID}.)-{GRID // 2}.", 200, Y + 330)
P.c(raw_a, late_a, 1); P.c(late_a, to_ms)
slot = P.obj(f"expr int(($f1+{GRID // 2}.)/{GRID}.)%{BAR // GRID}", 4, Y + 330)
P.c(raw_a, slot, 0)
slot_t = P.obj("t i i i", 4, Y + 360, ins=1, outs=3)
diff = P.obj(f"expr ($i1-$i2+{BAR // GRID})%{BAR // GRID}", 200, Y + 390, ins=2)
P.c(slot, slot_t); P.c(slot_t, diff, 2, 0); P.c(slot_t, diff, 1, 1); P.c(slot_t, coll_a_o, 0)
neq = P.obj("!= 1", 200, Y + 420, ins=2); sel = P.obj("sel 1", 200, Y + 450, ins=2, outs=2)
err_count = P.obj("counter", 200, Y + 480, ins=5, outs=4)
P.c(diff, neq); P.c(neq, sel); P.c(sel, err_count); P.c(err_count, slot_err)
P.c(rz_cnt, err_count, 0)
iter_a = P.obj("zl iter 3", 4, Y + 420, ins=2, outs=2)
P.c(coll_a_o, iter_a); P.c(iter_a, out_send); P.c(iter_a, sent_bang)

# --- Mechanism B: schedule each bar's events into a pipe
metro_b = P.obj("metro 1n @quantize 1n @active 0", 400, Y + 240, ins=2)
tr_b = P.obj("transport", 400, Y + 270, ins=2, outs=9)
P.c(act_b, metro_b); P.c(metro_b, tr_b)
P.c(tr_b, tempo_n, 4); P.c(tr_b, to_ms, 4, 1)
bar_off = P.obj(f"expr floor($f1/{BAR}.+0.5)*{BAR}.-$f1", 400, Y + 300)
delay_ms = P.obj("expr ($f1+$f2)*60000./($f3*$f4)", 400, Y + 390, ins=4)
P.c(tr_b, bar_off, 7); P.c(bar_off, delay_ms, 0, 1)
P.c(tr_b, delay_ms, 4, 2); P.c(tr_b, delay_ms, 3, 3)
dump = P.msg("dump", 560, Y + 300)
P.c(tr_b, dump, 0); P.c(dump, coll_b_o)
ev_t = P.obj("t l l", 400, Y + 330, ins=1, outs=2)
P.c(coll_b_o, ev_t)
onset = P.obj("zl nth 1", 400, Y + 360, ins=2, outs=2)
P.c(ev_t, onset, 1); P.c(onset, delay_ms)
pipe = P.obj("pipe 0 0 0 0 0", 560, Y + 420, ins=5, outs=4)
P.c(delay_ms, pipe, 0, 4); P.c(ev_t, pipe, 0, 0)
pk = P.obj("pack 0 0 0 0", 560, Y + 450, ins=4, outs=1)
for i in range(4):
    P.c(pipe, pk, i, i)
due_t = P.obj("t l b l", 560, Y + 480, ins=1, outs=3)
P.c(pk, due_t)
due_onset = P.obj("zl nth 1", 760, Y + 510, ins=2, outs=2)
tr_m = P.obj("transport", 700, Y + 380, ins=2, outs=9)
late_b = P.obj(f"expr fmod($f1-$f2+{BAR * 1000 + BAR // 2}.,{BAR}.)-{BAR // 2}.", 700, Y + 410, ins=2)
P.c(due_t, due_onset, 2); P.c(due_onset, late_b, 0, 1)
P.c(due_t, tr_m, 1); P.c(tr_m, late_b, 7); P.c(late_b, to_ms)
body = P.obj("zl slice 1", 560, Y + 530, ins=2, outs=2)
P.c(due_t, body, 0); P.c(body, out_send, 1); P.c(body, sent_bang, 1)

# --- panic on transport stop (also cancels B's pending events)
poll = P.obj("metro 50 @active 1", 900, Y + 240, ins=2)
tr_s = P.obj("transport", 900, Y + 270, ins=2, outs=9)
chg = P.obj("change", 900, Y + 300, ins=1, outs=3)
stopped = P.obj("sel 0", 900, Y + 330, ins=2, outs=2)
panic = P.msg("panic", 900, Y + 360); clear = P.msg("clear", 980, Y + 360)
P.c(poll, tr_s); P.c(tr_s, chg, 6); P.c(chg, stopped); P.c(stopped, panic); P.c(stopped, clear)
P.c(panic, out_send); P.c(clear, pipe)
# switching mode abandons the other mechanism's pending note-offs -> release everything on every switch
switch_b = P.obj("t b", 1000, Y + 330)
P.c(mode_t, switch_b, 1); P.c(switch_b, panic); P.c(switch_b, clear)
P.save_amxd(os.path.join(here, "PF4 Proto Hub.amxd"), 420)

# ---- voice ----------------------------------------------------------------------------------
V = Patch()
V.comment("PF4 proto voice", 4, 2, 160)
V.comment("voice", 4, 26)
voice_n = V.add("live.numbox", 44, 26, w=44, ins=1, outs=2, parameter_enable=1,
                saved_attribute_attributes={"valueof": {
                    "parameter_longname": "Voice", "parameter_shortname": "Voice",
                    "parameter_type": 1, "parameter_mmin": 1, "parameter_mmax": 8,
                    "parameter_initial": [1], "parameter_initial_enable": 1}})
V.comment("AT LFO", 100, 26); at_on = V.toggle(150, 26)
V.comment("notes in", 180, 26); notes_in = V.num(240, 26)
rcv = V.obj("receive pf4proto.voice", 4, 200, ins=0)
rp = V.obj("route panic", 4, 230, ins=2, outs=2)
split = V.obj("t l l", 4, 260, ins=1, outs=2)
who = V.obj("zl nth 1", 160, 290, ins=2, outs=2)
mine = V.obj("== 1", 160, 320, ins=2)
body = V.obj("zl slice 1", 4, 320, ins=2, outs=2)
gate = V.obj("gate 1", 4, 350, ins=2)
cnt_bang = V.obj("t l b", 4, 380, ins=1, outs=2)
cnt = V.obj("counter", 160, 410, ins=5, outs=4)
fl = V.obj("flush", 4, 410, ins=2, outs=2)
pk2 = V.obj("pack 0 0", 4, 440, ins=2)
mf = V.obj("midiformat 1", 4, 500, ins=7, outs=2)
mo = V.obj("midiout", 4, 530, ins=1, outs=0)
V.c(rcv, rp); V.c(rp, fl, 0); V.c(rp, split, 1)
V.c(split, who, 1); V.c(who, mine); V.c(mine, gate, 0, 0)      # right first: open/close gate
V.c(split, body, 0); V.c(body, gate, 1, 1)                      # then pass [pitch vel]
V.c(gate, cnt_bang); V.c(cnt_bang, cnt, 1); V.c(cnt_bang, fl, 0); V.c(cnt, notes_in)
V.c(fl, pk2, 0, 0); V.c(fl, pk2, 1, 1); V.c(pk2, mf); V.c(mf, mo)
# voice number drives: which messages we accept, MIDI channel, LFO period
V.c(voice_n, mine, 0, 1); V.c(voice_n, mf, 0, 6)
lfo = V.obj("metro 20", 300, 200, ins=2)
lc = V.obj("counter", 300, 230, ins=5, outs=4)
sine = V.obj("expr int(63.5+63.5*sin($i1*0.0628318/$i2))", 300, 260, ins=2)
V.c(voice_n, sine, 0, 1)
V.c(at_on, lfo); V.c(lfo, lc); V.c(lc, sine); V.c(sine, mf, 0, 4)
# voice number = position of this device's rack chain (chain 1 -> voice 1), found via the Live API once loaded
V.comment("auto: chain N = voice N. Set this chain's External Instrument to Ch N.", 4, 52, 290)
thisdev = V.obj("live.thisdevice", 450, 200, ins=1, outs=3)
chain_js = V.obj("js pf4.proto.voiceindex.js", 450, 230)
V.c(thisdev, chain_js); V.c(chain_js, voice_n)
V.save_amxd(os.path.join(here, "PF4 Proto Voice.amxd"), 300)

with open(os.path.join(here, "pf4.proto.voiceindex.js"), "w") as f:
    f.write('''// PROTOTYPE — outputs this device's rack chain number (1-based); 1 if not inside a rack.
autowatch = 1;
outlets = 1;
function bang() {
    var path = new LiveAPI("this_device").unquotedpath; // e.g. live_set tracks 0 devices 1 chains 2 devices 0
    var m = path.match(/chains (\\d+) devices \\d+$/);
    outlet(0, m ? parseInt(m[1], 10) + 1 : 1);
}
''')

print(f"{len(events)} events, {len(msgs)} on/off messages, {len(slots)} grid slots")
