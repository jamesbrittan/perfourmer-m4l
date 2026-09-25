"""Builds the Max for Live devices ("PF4 Hub <n>.amxd", "PF4 Voice <n>.amxd") next to this file.

<n> is the ticket number of the branch being built (feature/08-… → 8, or PF4_TICKET=8), so Live's title bar shows
which build is loaded; other branches (main) build the plain "PF4 Hub.amxd", "PF4 Voice.amxd".

Run: python3 max/build_devices.py   (after `npm run build` in engine/, which writes pf4-engine.js here)
The devices are generated, not hand-patched: edit this file and rebuild. Scripts (pf4-hub.js with the engine
inlined, pf4-voice.js) are embedded in v8.codebox objects, so the .amxd files need nothing beside them.
"""
import glob, json, os, re, struct, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
GRID_TICKS = 2  # player resolution; must match GRID_TICKS in pf4-hub.js
BANK_SIZE = 10000  # must match BANK_SIZE in pf4-hub.js
VOICE_BUS = "pf4.voice"


def ticket():
    if os.environ.get("PF4_TICKET"):
        return int(os.environ["PF4_TICKET"])
    branch = subprocess.run(["git", "branch", "--show-current"], cwd=HERE, capture_output=True, text=True).stdout
    m = re.match(r"feature/(\d+)-", branch)
    return int(m.group(1)) if m else None


TICKET = ticket()


def device_file(name):
    """"PF4 Hub.amxd" → "PF4 Hub 8.amxd" on ticket 8's branch."""
    stem = name[:-len(".amxd")]
    return f"{stem} {TICKET}.amxd" if TICKET else name


# Live's Info View help: (title, text) per control kind. Parameters match by name without their "L<n> " Lane prefix;
# readouts match by the text they start with (see info_for). One table for every control, so later ones pick it up.
HELP = {
    "Hub Tab": ("Hub Tab", "Switches between Rhythm, Pitch, Feel, Evolve, Timbre and Voicing pages."),
    "VCF Depth": ("VCF Depth", "How far the Lane's aftertouch LFO sweeps (the Perfourmer's VCF cutoff, with "
                  "Edit 3 on). 0 = no aftertouch sent."),
    "VCF Rate": ("VCF Rate", "Length of one VCF sweep, in bars of four beats. Follows song position, "
                 "so it replays the same way."),
    "PWM Depth": ("PWM Depth", "How far the Lane's CC1 LFO sweeps (the Perfourmer's pulse width). 0 = no CC1 "
                  "sent."),
    "PWM Rate": ("PWM Rate", "Length of one PWM sweep, in bars of four beats. Follows song position."),
    "Hits": ("Hits", "How many of the Lane's steps play, spread as evenly as possible (a Euclidean rhythm). "
             "Can't exceed Length. Takes effect from the Lane's next Cycle."),
    "Length": ("Length", "How many steps the Lane's Cycle has (1–32). The rhythm repeats every Cycle. "
               "Takes effect from the next Cycle."),
    "Rotate": ("Rotate", "Shifts the hits later by this many steps. Takes effect from the next Cycle."),
    "Rate": ("Rate", "How long each step lasts: 1/1 to 1/32, with triplets (T), quintuplets (Q) and septuplets (S). "
             "Takes effect from the next Cycle."),
    "Rhythm": ("Rhythm Preset", "Loads a known Euclidean rhythm (Toussaint): sets Hits, Length and Rotate, making it "
               "the Lane's Base. Shows — again once you change those by hand."),
    "Pitch Length": ("Pitch Cycle notes", "How many of the 8 degree boxes the Pitch Cycle uses. Each hit takes the "
                     "next degree, so when this differs from Hits the melody drifts against the rhythm."),
    "Degree": ("Pitch Cycle degree", "Scale degree for this step of the Pitch Cycle: 0 = the Scale's root nearest "
               "middle C, 7 = an octave up in a 7-note scale, negative = below. Greyed out past the Pitch Cycle "
               "length."),
    "Transpose": ("Transpose", "Moves the Lane along the Scale by scale degrees. Takes effect from the next Cycle."),
    "Octave": ("Octave", "Moves the Lane up or down by octaves. Takes effect from the next Cycle."),
    "Gate": ("Gate %", "Note length, from short to tied. Up to 50%: that percentage of one step. From 50% to 100%: "
             "stretches from half a step to the whole gap to the next hit, so sparse patterns get long notes. 100%: "
             "each note ties into the next (legato; glides if the Perfourmer's Glide is up). Heard from the next note."),
    "Velocity": ("Velocity", "Velocity of every note (1–127). Heard from the next note."),
    "Accent": ("Accent", "Velocity added to the first hit of each Cycle; 0 = no accent. Heard from the next note."),
    "Probability": ("Probability", "Chance (%) that each hit sounds, decided per Cycle from the Seed, so the same bars "
                    "replay the same way. Takes effect from the next Cycle."),
    "Mutation": ("Mutation", "Chance each Cycle that each step and each pitch is redrawn from the Base: 0 = the Base "
                 "forever, 127 = a new pattern every Cycle. Seeded by song position, so a section replays the same "
                 "evolution."),
    "Seed": ("Seed", "Chooses which evolution Mutation and Probability follow. Saved with the set, not automatable."),
    "New Seed": ("New Seed", "Picks a new random Seed for this Lane: a different evolution for Mutation and "
                 "Probability, which then replays the same way. Takes effect from the next Cycle."),
    "Capture": ("Capture", "Makes the Cycle playing now the Lane's Base, so Mutation 0 repeats it and Mutation "
                "departs from it. Revert undoes it."),
    "Revert": ("Revert", "Goes back to the Base from before the last Capture."),
    "AT Depth": ("Aftertouch LFO depth", "How far the Lane's aftertouch LFO sweeps (the Perfourmer's VCF cutoff, with "
                 "Edit 3 on). 0 = no aftertouch sent."),
    "AT Rate": ("Aftertouch LFO rate", "Length of one aftertouch sweep, in bars of four beats. Follows song position, "
                "so it replays the same way."),
    "CC1 Depth": ("CC1 LFO depth", "How far the Lane's CC1 LFO sweeps (the Perfourmer's pulse width). 0 = no CC1 "
                  "sent."),
    "CC1 Rate": ("CC1 LFO rate", "Length of one CC1 sweep, in bars of four beats. Follows song position."),
    "Group Mode": ("Group Mode", "How the Lane uses a group of Voices (see Voices): poly plays chords, round-robin "
                   "moves successive hits across the Voices 1 → 4, unison plays every Voice together. Takes effect "
                   "from the next Cycle."),
    "Chord Shape": ("Chord Shape", "For poly: scale-degree intervals stacked on each hit, lowest note on the "
                    "highest-numbered Voice (the bottom of the Perfourmer's panel). Takes effect from the next Cycle."),
    "Reset Bars": ("Reset", "Realigns every Lane (rhythm and Pitch Cycle) to its start every N bars of Live's time "
                   "signature. 0 = never. Cycles keep counting across Resets, so Mutation keeps evolving."),
    "Voicing Matrix": ("Voicing Matrix", "Which Voices the Lane plays. Each Voice belongs to one Lane at most: "
                       "switching it on here takes it off any other Lane. A Lane with no Voices runs silently. While "
                       "playing, a change lands on the next bar."),
    "Voice": ("Voice", "This chain's Voice number (1–8), set from its position in the rack. Notes for this Voice go "
              "out on the MIDI channel with the same number; set the chain's External Instrument to match."),
    # readouts
    "readout:Cycle": ("Lane position", "Which Cycle the Lane is in and which step, from song position. 'mutated' "
                      "means Mutation or Probability has changed this Cycle from the Base."),
    "readout:Base": ("Base", "What Mutation departs from: the Euclidean pattern, or a Captured Base (with how many "
                     "Captures Revert can step back through). Captured Bases are saved with the set."),
    "readout:Scale": ("Scale", "Live's current Scale, which every Lane follows. Change it in Live's control bar or "
                      "on Push."),
    "readout:Waiting": ("Voices found", "The Voice devices found in the rack after the Hub, and any missing or "
                        "duplicated Voice numbers."),
    "readout:pattern": ("Pattern", "The Lane's current Cycle as it plays: ● hit, · rest, ◉/○ the playhead."),
    "readout:voices": ("Lane Voices", "Which Voices this Lane drives, and how (see Voices and Group Mode)."),
    "readout:setup": ("Perfourmer setup", "Set the Perfourmer once: Play Mode M1, synth channels 1–4 on MIDI "
                      "channels 1–4, and Edit 3 (aftertouch → cutoff) on. The Hub does all voice allocation."),
}


def info_for(box):
    """The Info View help for a box: parameters by name, readouts by the text they start with."""
    name = box.get("saved_attribute_attributes", {}).get("valueof", {}).get("parameter_longname")
    if name:
        if name in HELP:
            return HELP[name]
        if re.fullmatch(r"L\d+ Voice \d+", name):
            return HELP["Voicing Matrix"]
        kind = re.sub(r"^L\d+ ", "", name)
        return HELP.get(kind) or HELP.get(re.sub(r" \d+$", "", kind))
    text = box.get("text", "")
    if box["maxclass"] not in ("comment", "message"):
        return None
    for start, key in (("Cycle ", "readout:Cycle"), ("Scale:", "readout:Scale"), ("Waiting for Voices", "readout:Waiting"),
                       ("Perfourmer setup", "readout:setup"), ("Base:", "readout:Base")):
        if text.startswith(start):
            return HELP[key]
    if text and set(text) <= set("·●◉○"):
        return HELP["readout:pattern"]
    if re.fullmatch(r"V\d+", text):
        return HELP["readout:voices"]
    return None


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
        self.tabs = {}  # tab_idx -> list of box varnames

    def add(self, maxclass, x, y, w=None, h=22, text=None, ins=1, outs=1, tab=None, **extra):
        self.n += 1
        oid = f"obj-{self.n}"
        box = {"id": oid, "maxclass": maxclass, "numinlets": ins, "numoutlets": outs,
               "patching_rect": [x, y, w or max(40, 7 * len(text or "") + 16), h]}
        if text is not None:
            box["text"] = text
        if outs:
            box["outlettype"] = [""] * outs
        if tab is not None:
            varname = extra.get("varname") or oid
            box["varname"] = varname
            if tab > 0:
                box["hidden"] = 1
            self.tabs.setdefault(tab, []).append(varname)
        box.update(extra)
        self.boxes.append({"box": box})
        return oid

    def obj(self, text, x, y, ins=1, outs=1, tab=None, **kw):
        return self.add("newobj", x, y, text=text, ins=ins, outs=outs, tab=tab, **kw)

    def msg(self, text, x, y, w=None, h=22, tab=None, **kw):
        return self.add("message", x, y, w=w, h=h, text=text, ins=2, outs=1, tab=tab, **kw)

    def codebox(self, code, x, y, ins=1, outs=1):
        """A v8 object whose JavaScript is stored inside the device, so copies and presets stay self-contained."""
        return self.add("v8.codebox", x, y, w=200, h=60, ins=ins, outs=outs, code=code, filename="none",
                        saved_object_attributes={"parameter_enable": 0})

    def comment(self, text, x, y, w=None, h=22, tab=None, **kw):
        return self.add("comment", x, y, w=w, h=h, text=text, ins=1, outs=0, tab=tab, **kw)

    def param(self, maxclass, name, x, y, lo, hi, initial, w=44, h=48, short=None, enum=None, stored_only=False, tab=None, **extra):
        valueof = {"parameter_longname": name, "parameter_shortname": short or name,
                   "parameter_type": 1, "parameter_mmin": lo, "parameter_mmax": hi,
                   "parameter_initial": [initial], "parameter_initial_enable": 1}
        if stored_only:  # saved with the set, but not automatable or mappable
            valueof["parameter_invisible"] = 1
        if enum:  # named choices, e.g. rates; the object outputs the choice's index
            valueof.update(parameter_type=2, parameter_enum=enum, parameter_mmax=len(enum) - 1)
        elif maxclass == "live.text":
            valueof.update(parameter_type=2, parameter_enum=["off", "on"], parameter_mmax=1)
        return self.add(maxclass, x, y, w=w, h=h, ins=1, outs=2, parameter_enable=1, tab=tab,
                        saved_attribute_attributes={"valueof": valueof}, **extra)

    def c(self, a, b, outlet=0, inlet=0):
        self.lines.append({"patchline": {"source": [a, outlet], "destination": [b, inlet], "hidden": 1}})

    def save_amxd(self, name, width):
        for entry in self.boxes:
            info = info_for(entry["box"])
            if info:
                entry["box"]["annotation_name"], entry["box"]["annotation"] = info
        doc = {"patcher": {
            "fileversion": 1,
            "appversion": {"major": 9, "minor": 1, "revision": 5, "architecture": "x64", "modernui": 1},
            "classnamespace": "box", "rect": [100, 100, 1100, 800],
            "openrect": [0.0, 0.0, float(width), 169.0], "openrectmode": 0,
            "default_fontsize": 10.0, "default_fontname": "Ableton Sans Medium", "gridsize": [8.0, 8.0],
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
        stem = name[:-len(".amxd")]
        for old in glob.glob(os.path.join(HERE, f"{stem}*.amxd")):  # builds for other tickets
            os.remove(old)
        with open(os.path.join(HERE, device_file(name)), "wb") as f:
            f.write(header + body)


LANES = 4
LANE_DEFAULTS = [
    (16, 16, 0, 6),  # L1: 16 of 16, rot 0, rate 1/16 (index 6)
    (4, 16, 2, 6),   # L2: 4 of 16, rot 2, rate 1/16 (index 6)
    (2, 7, 0, 2),    # L3: 2 of 7, rot 0, rate 1/4 (index 2)
    (5, 13, 0, 6),   # L4: 5 of 13, rot 0, rate 1/16 (index 6)
]  # must match params in pf4-hub.js
PITCH_DEFAULTS = [
    ([0, 0, 7, 0, 5], -2),
    ([0, 3], -1),
    ([0, 2, 4], 0),
    ([7, 9, 11, 12, 14], 1),
]  # (Pitch Cycle, octave)
PITCH_STEPS = 8
ARTICULATION_DEFAULTS = [
    (50, 100, 15),
    (30, 100, 0),
    (100, 90, 0),
    (50, 85, 0),
]  # per Lane: (Gate %, Velocity, Accent); must match pf4-hub.js
LFO_DEFAULTS = [(7, 5), (11, 9), (13, 15), (17, 19)]  # per Lane: (AT rate, CC1 rate) in bars; depths default to 0 (off)
LFO_UPDATE_MS = 40  # LFO sampling; only changed values are sent, so the MIDI port isn't flooded
EVOLUTION_DEFAULTS = [
    (100, 0),
    (100, 0),
    (100, 0),
    (100, 20),
]  # per Lane: (Probability %, Mutation); the seed defaults to the Lane number (pf4-hub.js)
PLAYER_DICT = "pf4.player"  # each Lane's playing bank, read by the adapter (pf4-hub.js)
RATES = ["1/1", "1/2", "1/4", "1/4T", "1/8", "1/8T", "1/16", "1/16Q", "1/16T", "1/16S", "1/32", "1/32Q"]  # = engine RATES
DEFAULT_RATE = RATES.index("1/16")
NEVER = 1e12  # "no Reset" period, as in pf4-hub.js


def from_engine(expression):
    """A value from the built engine bundle (e.g. menu choices), so the devices can't drift from the engine."""
    script = f'const engine = require("./pf4-engine.js"); console.log(JSON.stringify({expression}))'
    return json.loads(subprocess.check_output(["node", "-e", script], cwd=HERE))
HUB_BUS = "pf4.hub"


def build_hub():
    P = Patch()
    Y = 220  # logic lives below the visible 169px device area

    # --- adapter + shared player table
    adapter = P.codebox(embedded("pf4-hub.js", inline_engine=True), 4, Y + 900, ins=1, outs=14)
    thispatcher = P.obj("thispatcher", 4, Y + 1020, ins=1, outs=2)
    P.c(adapter, thispatcher, 13, 0)
    preset_dials = P.obj("route 0 1 2 3", 1300, Y + 150, ins=2, outs=5)
    preset_menus = P.obj("route 0 1 2 3", 1300, Y + 180, ins=2, outs=5)
    P.c(adapter, preset_dials, 9); P.c(adapter, preset_menus, 10)
    presets = ["—"] + from_engine("engine.RHYTHM_PRESETS.map((p) => p.name)")
    group_modes = from_engine("engine.GROUP_MODES")
    chord_shapes = from_engine("Object.keys(engine.CHORD_SHAPES)")
    lane_voices = P.obj("route 0 1 2 3", 1300, Y + 210, ins=2, outs=5)
    P.c(adapter, lane_voices, 11)
    release_reach = P.obj("route 0 1 2 3", 1300, Y + 240, ins=2, outs=5)
    P.c(adapter, release_reach, 12)
    table = P.obj("coll", 4, Y + 40, ins=1, outs=4)
    shared_notes = P.obj("zl iter 3", 4, Y + 80, ins=2, outs=2)
    pending = P.obj("route 0 1 2 3", 200, Y + 40, ins=2, outs=5)
    bus = P.obj(f"send {VOICE_BUS}", 4, Y + 700)
    hub_in = P.obj(f"receive {HUB_BUS}", 200, Y - 30, ins=0)
    P.c(adapter, table, 0, 0); P.c(adapter, pending, 1); P.c(hub_in, adapter)
    P.c(table, shared_notes); P.c(shared_notes, bus)

    # --- Permanent Left Section (x = 0..275, y = 0..169)
    # Global Controls: Reset
    P.comment("Reset", 6, 12, 32)
    reset = P.param("live.numbox", "Reset Bars", 42, 12, 0, 64, 0, w=30, h=18, short="Reset")
    P.comment("bars", 76, 12, 28)
    reset_msg = P.obj("prepend reset", 700, Y - 30)
    P.c(reset, reset_msg); P.c(reset_msg, adapter)

    # Section header
    P.comment("Pattern", 28, 32, 50)

    # Captured Bases pattr (stored only)
    player_state = P.obj(f"dict {PLAYER_DICT}", 1500, Y, ins=2, outs=4)
    stored = P.obj("pattr pf4_bases", 1500, Y + 60, ins=2, outs=3, varname="pf4_bases",
                   saved_object_attributes={"parameter_enable": 1},
                   saved_attribute_attributes={"valueof": {
                       "parameter_longname": "Captured Bases", "parameter_shortname": "Bases",
                       "parameter_type": 3, "parameter_invisible": 1}})
    to_bases = P.obj("prepend bases", 1500, Y + 90)
    P.c(adapter, stored, 7); P.c(stored, to_bases); P.c(to_bases, adapter)

    # Pattern and position routing
    patterns = P.obj("route 0 1 2 3", 1300, Y + 120, ins=2, outs=5)
    P.c(adapter, patterns, 8)

    # --- Live API (via the adapter): transport running/stopped and time signature
    here = P.obj("live.thisdevice", 1000, Y, ins=1, outs=3)
    observe = P.msg("observe", 1000, Y + 30)
    started = P.obj("sel 0 1", 1000, Y + 120, ins=3, outs=3)
    release_all = P.msg("releaseall", 1000, Y + 150)
    rollcall = P.msg("rollcall", 1100, Y + 30)
    load = P.obj("loadbang", 1200, Y)
    P.c(here, observe); P.c(observe, adapter)
    P.c(adapter, started, 5)
    stopped_now = P.obj("== 0", 1100, Y + 90, ins=2)  # 1 while the transport is stopped
    P.c(adapter, stopped_now, 5)
    P.c(started, release_all, 0); P.c(release_all, bus)
    late_release = P.obj("delay 50", 1100, Y + 150, ins=2)   # catch any straggler after the stop
    P.c(started, late_release, 0); P.c(late_release, release_all)
    P.c(here, rollcall); P.c(rollcall, bus)          # ask Voices that loaded before us to announce
    # position readouts: poll song position and let the engine's locate() describe each Lane
    poll = P.obj("metro 100 @active 1", 1300, Y, ins=2)
    poll_pos = P.obj("transport", 1300, Y + 30, ins=2, outs=9)
    where = P.obj("prepend where", 1300, Y + 60)
    readouts = P.obj("route 0 1 2 3 4 5 6 7", 1300, Y + 90, ins=2, outs=9)  # 0–3 positions, 4–7 Bases
    P.c(poll, poll_pos); P.c(poll_pos, where, 7); P.c(where, adapter); P.c(adapter, readouts, 4)
    P.c(load, adapter)                               # render every Lane once

    # --- clock: fine tick grid (ticket 01 verdict), fanned out to every Lane
    clock = P.obj(f"metro {GRID_TICKS} ticks @quantize {GRID_TICKS} ticks @active 1", 600, Y, ins=2)
    pos = P.obj("transport", 600, Y + 30, ins=2, outs=9)
    tick = P.obj("expr int($f1+0.5)", 600, Y + 60)
    clock_t = P.obj("t i i i", 600, Y + 75, ins=1, outs=3)
    fan = P.obj("t " + " ".join(["i"] * LANES), 600, Y + 90, ins=1, outs=LANES)
    # a Cycle wrap only counts when the song position moved on by a grid step or so; a jump (start, locate) doesn't
    delta = P.obj("- 0", 700, Y + 90, ins=2)
    contiguous = P.obj("expr ($i1 > 0) && ($i1 <= 16)", 700, Y + 110)
    P.c(clock, pos); P.c(pos, tick, 7); P.c(tick, clock_t)
    P.c(clock_t, delta, 2, 0); P.c(delta, contiguous); P.c(clock_t, delta, 1, 1); P.c(clock_t, fan, 0)
    # --- timbre LFO clock: song position a few times a second (the LFOs follow the song, so they replay)
    lfo_clock = P.obj(f"metro {LFO_UPDATE_MS} @active 1", 1700, Y, ins=2)
    lfo_pos = P.obj("transport", 1700, Y + 30, ins=2, outs=9)
    lfo_fan = P.obj("t " + " ".join(["f"] * (2 * LANES)), 1700, Y + 60, ins=1, outs=2 * LANES)
    P.c(lfo_clock, lfo_pos); P.c(lfo_pos, lfo_fan, 7)
    # a jump in song position skips note-offs: release every Voice (this runs before any Lane's lookups)
    jumped = P.obj("sel 0", 700, Y + 130, ins=2, outs=2)
    P.c(contiguous, jumped); P.c(jumped, release_all)

    # --- Tab Selector (x = 285, y = 4, w = 360, h = 20)
    hub_tab = P.param("live.tab", "Hub Tab", 285, 4, 0, 5, 0, w=360, h=20, short="Tab",
                      enum=["Rhythm", "Pitch", "Feel", "Evolve", "Timbre", "Voicing"])

    # Tab Headers at y = 26
    # Tab 1 (Pitch) headers
    P.comment("Len", 306, 26, 24, tab=1)
    P.comment("Pitch Cycle (scale degrees)", 336, 26, 175, tab=1)
    P.comment("Trans", 525, 26, 32, tab=1)
    P.comment("Oct", 560, 26, 30, tab=1)

    # Tab 2 (Feel) headers
    P.comment("Gate %", 325, 32, 48, tab=2)
    P.comment("Velocity", 405, 32, 48, tab=2)
    P.comment("Accent", 485, 32, 48, tab=2)

    # Tab 3 (Evolve) headers
    P.comment("Prob %", 310, 32, 36, tab=3)
    P.comment("Mutate", 352, 32, 36, tab=3)
    P.comment("Seed", 394, 32, 32, tab=3)
    P.comment("Capture / Revert", 448, 32, 95, tab=3)
    P.comment("Base", 550, 32, 40, tab=3)

    # Tab 4 (Timbre) headers
    P.comment("VCF Depth", 315, 32, 55, tab=4)
    P.comment("VCF Bars", 375, 32, 55, tab=4)
    P.comment("PWM Depth", 435, 32, 55, tab=4)
    P.comment("PWM Bars", 495, 32, 55, tab=4)

    # Tab 5 (Voicing) headers & section labels
    P.comment("V1", 318, 32, 18, tab=5)
    P.comment("V2", 342, 32, 18, tab=5)
    P.comment("V3", 366, 32, 18, tab=5)
    P.comment("V4", 390, 32, 18, tab=5)
    P.comment("Group Mode", 422, 32, 80, tab=5)
    P.comment("Chord Shape", 530, 32, 90, tab=5)

    for n in range(LANES):
        hits_d, len_d, rot_d, rate_d = LANE_DEFAULTS[n]
        row_y = 52 + 28 * n
        ry = row_y   # row Y in permanent left section
        ty = row_y   # row Y in tabbed section (tabs 1–4)
        vy = row_y   # row Y in voicing tab (tab 5)
        lx = 200 + 300 * n  # this Lane's logic column

        # Permanent Left: Lane label & broad 252px Pattern glyphs (16 steps/line). Menlo on purpose: the steps must line
        # up in columns across Lanes, and Ableton Sans gives ● and · different widths; all other text is Ableton Sans
        P.comment(f"L{n + 1}", 6, ry + 3, 18)
        initial_dots = " ".join(["·"] * min(16, len_d))
        view = P.add("comment", 28, ry, w=252, h=20, text=initial_dots,
                     fontname="Menlo", fontsize=9.0, ins=1, outs=0)
        P.c(patterns, view, n)
        if n < LANES - 1:
            P.add("live.line", 6, ry + 25, w=268, h=2, ins=1, outs=0)

        # --- Tab 0: Rhythm (4 columns side-by-side, 90px each)
        rx = 285 + 90 * n
        P.comment(f"Lane {n + 1}", rx, 26, 60, tab=0)
        hits = P.param("live.dial", f"L{n + 1} Hits", rx, 42, 0, 32, hits_d, short="Hits", tab=0,
                       varname=f"dial_L{n + 1}_hits")
        length = P.param("live.dial", f"L{n + 1} Length", rx + 44, 42, 1, 32, len_d, short="Length", tab=0,
                         varname=f"dial_L{n + 1}_len")
        rotate = P.param("live.dial", f"L{n + 1} Rotate", rx, 92, 0, 31, rot_d, short="Rotate", tab=0,
                         varname=f"dial_L{n + 1}_rot")
        rate = P.param("live.dial", f"L{n + 1} Rate", rx + 44, 92, 0, 0, rate_d, short="Rate", enum=RATES, tab=0,
                       varname=f"dial_L{n + 1}_rate")
        menu = P.param("live.menu", f"L{n + 1} Rhythm", rx, 142, 0, 0, 0, w=88, h=16, short="Rhythm", enum=presets, tab=0,
                       varname=f"menu_L{n + 1}_rhythm")
        to_rhythm = P.obj(f"prepend rhythm {n}", lx, Y + 910)
        P.c(menu, to_rhythm); P.c(to_rhythm, adapter); P.c(preset_menus, menu, n)
        dials = P.obj("unpack 0 0 0", lx, Y + 940, ins=1, outs=3)
        P.c(preset_dials, dials, n)
        P.c(dials, length, 2); P.c(dials, rotate, 1); P.c(dials, hits, 0)

        # --- Tab 1: Pitch Cycle editor
        degrees, octave = PITCH_DEFAULTS[n]
        P.comment(f"L{n + 1}", 285, ty, 20, tab=1)
        plen = P.param("live.numbox", f"L{n + 1} Pitch Length", 306, ty, 1, PITCH_STEPS, len(degrees),
                       w=26, h=18, short="Len", tab=1)
        steps = [P.param("live.numbox", f"L{n + 1} Degree {i + 1}", 336 + 23 * i, ty, -14, 14,
                         degrees[i] if i < len(degrees) else 0, w=22, h=18, short=f"Deg {i + 1}", tab=1)
                 for i in range(PITCH_STEPS)]
        trans = P.param("live.numbox", f"L{n + 1} Transpose", 525, ty, -7, 7, 0, w=32, h=18, short="Trans", tab=1)
        octv = P.param("live.numbox", f"L{n + 1} Octave", 560, ty, -3, 3, octave, w=32, h=18, short="Oct", tab=1)
        py_l = Y + 700
        initial = " ".join(str(degrees[i] if i < len(degrees) else 0) for i in range(PITCH_STEPS))
        pitch = P.obj(f"pak {len(degrees)} {initial}", lx, py_l, ins=9)
        to_pitch = P.obj(f"prepend pitch {n}", lx, py_l + 30)
        P.c(plen, pitch, 0, 0); P.c(pitch, to_pitch); P.c(to_pitch, adapter)
        for i, step in enumerate(steps):
            P.c(step, pitch, 0, i + 1)
            if i:
                used = P.obj(f"expr $i1 > {i}", lx + 40 * (i % 4), py_l + 60 + 20 * (i // 4))
                active = P.obj("prepend active", lx + 40 * (i % 4), py_l + 110 + 20 * (i // 4))
                P.c(plen, used); P.c(used, active); P.c(active, step)
        shift = P.obj(f"pak 0 {octave}", lx + 150, py_l, ins=2)
        to_shift = P.obj(f"prepend transpose {n}", lx + 150, py_l + 30)
        P.c(trans, shift, 0, 0); P.c(octv, shift, 0, 1); P.c(shift, to_shift); P.c(to_shift, adapter)

        # --- Tab 2: Dynamics / Articulation (Feel)
        gate_d, vel_d, acc_d = ARTICULATION_DEFAULTS[n]
        P.comment(f"L{n + 1}", 285, ty, 20, tab=2)
        gate = P.param("live.numbox", f"L{n + 1} Gate", 325, ty, 1, 100, gate_d, w=48, h=18, short="Gate %", tab=2)
        vel = P.param("live.numbox", f"L{n + 1} Velocity", 405, ty, 1, 127, vel_d, w=48, h=18, short="Vel", tab=2)
        acc = P.param("live.numbox", f"L{n + 1} Accent", 485, ty, 0, 127, acc_d, w=48, h=18, short="Accent", tab=2)
        artic = P.obj(f"pak {gate_d} {vel_d} {acc_d}", lx, Y + 850, ins=3)
        to_artic = P.obj(f"prepend articulate {n}", lx, Y + 880)
        for i, box in enumerate((gate, vel, acc)):
            P.c(box, artic, 0, i)
        P.c(artic, to_artic); P.c(to_artic, adapter)

        # --- Tab 3: Evolution & Capture (Evolve)
        prob_d, mut_d = EVOLUTION_DEFAULTS[n]
        P.comment(f"L{n + 1}", 285, ty, 20, tab=3)
        prob = P.param("live.numbox", f"L{n + 1} Probability", 310, ty, 0, 100, prob_d, w=36, h=18, short="Prob %", tab=3)
        mut = P.param("live.numbox", f"L{n + 1} Mutation", 352, ty, 0, 127, mut_d, w=36, h=18, short="Mutate", tab=3)
        seed = P.param("live.numbox", f"L{n + 1} Seed", 394, ty, 0, 999, n + 1, w=32, h=18, short="Seed",
                       stored_only=True, tab=3)
        dice = P.add("live.text", 428, ty, w=18, h=18, ins=1, outs=2, text="⚄", texton="⚄", mode=0,
                     parameter_enable=1, tab=3, fontsize=12.0, saved_attribute_attributes={"valueof": {
                         "parameter_longname": f"L{n + 1} New Seed", "parameter_shortname": "New Seed",
                         "parameter_type": 2, "parameter_enum": ["off", "on"], "parameter_mmax": 1}})
        new_seed = P.obj("random 1000", lx + 200, Y + 820, ins=2)
        P.c(dice, new_seed); P.c(new_seed, seed)
        evo = P.obj(f"pak {prob_d} {mut_d} {n + 1}", lx + 150, Y + 850, ins=3)
        to_evo = P.obj(f"prepend evolve {n}", lx + 150, Y + 880)
        for i, box in enumerate((prob, mut, seed)):
            P.c(box, evo, 0, i)
        P.c(evo, to_evo); P.c(to_evo, adapter)

        capture_btn = P.add("live.text", 448, ty, w=48, h=18, ins=1, outs=2, text="Capture", texton="Capture", mode=0,
                            parameter_enable=1, tab=3, saved_attribute_attributes={"valueof": {
                                "parameter_longname": f"L{n + 1} Capture", "parameter_shortname": "Capture",
                                "parameter_type": 2, "parameter_enum": ["off", "on"], "parameter_mmax": 1}})
        revert_btn = P.add("live.text", 500, ty, w=46, h=18, ins=1, outs=2, text="Revert", texton="Revert", mode=0,
                           parameter_enable=1, tab=3, saved_attribute_attributes={"valueof": {
                               "parameter_longname": f"L{n + 1} Revert", "parameter_shortname": "Revert",
                               "parameter_type": 2, "parameter_enum": ["off", "on"], "parameter_mmax": 1}})
        cap_action = P.msg(f"capture {n}", lx + 230, Y + 880)
        rev_action = P.msg(f"revert {n}", lx + 280, Y + 880)
        P.c(capture_btn, cap_action); P.c(cap_action, adapter)
        P.c(revert_btn, rev_action); P.c(rev_action, adapter)

        base_readout = P.add("comment", 550, ty + 2, w=92, h=14, text="Euclidean", fontsize=9, ins=1, outs=0, tab=3)
        P.c(readouts, base_readout, LANES + n)

        # --- Tab 4: Timbre LFOs (VCF cutoff & PWM)
        P.comment(f"L{n + 1}", 285, ty, 20, tab=4)
        for k, (kind, label, ax, message) in enumerate((("vcf", "VCF", 315, "touch"), ("pwm", "PWM", 435, "cc1"))):
            depth = P.param("live.numbox", f"L{n + 1} {label} Depth", ax, ty, 0, 127, 0, w=50, h=18,
                            short=f"{label} Dep", tab=4)
            bars = P.param("live.numbox", f"L{n + 1} {label} Rate", ax + 60, ty, 1, 128, LFO_DEFAULTS[n][k],
                           w=50, h=18, short=f"{label} Bars", tab=4)
            lfo = P.obj("expr int($f2 * (0.5 - 0.5 * cos(6.2831853 * fmod($f1, $f3) / $f3)) + 0.5)",
                        1700 + 160 * (2 * n + k), Y + 100, ins=3)
            period = P.obj("* 1920.", 1780 + 160 * (2 * n + k), Y + 70, ins=2)
            init_period = P.msg(str(LFO_DEFAULTS[n][k] * 1920), 1700 + 160 * (2 * n + k), Y + 70)
            changed = P.obj("change 0", 1700 + 160 * (2 * n + k), Y + 130, ins=2, outs=3)
            out = P.obj(f"prepend {message} {n + 1}", 1700 + 160 * (2 * n + k), Y + 160)
            P.c(lfo_fan, lfo, 2 * LANES - 1 - (2 * n + k), 0)
            P.c(depth, lfo, 0, 1); P.c(bars, period); P.c(period, lfo, 0, 2)
            P.c(load, init_period); P.c(init_period, lfo, 0, 2)
            P.c(lfo, changed); P.c(changed, out); P.c(out, bus)

        # --- Tab 5: Voicing (Voice Matrix, Group Mode, Chord Shape)
        vy = 62 + 26 * n
        P.comment(f"L{n + 1}", 285, vy + 2, 24, tab=5)
        for v in (1, 2, 3, 4):
            bx = 316 + 24 * (v - 1)
            btn = P.param("live.text", f"L{n + 1} Voice {v}", bx, vy, 0, 1, 1 if n == v - 1 else 0,
                          w=22, h=20, short=f"L{n + 1} V{v}", tab=5, varname=f"btn_L{n + 1}_V{v}",
                          text=str(v), texton=str(v), mode=1)
            to_voice = P.obj(f"prepend voice {n} {v}", lx + 20 * v, Y + 960)
            P.c(btn, to_voice); P.c(to_voice, adapter)

        gm = P.param("live.menu", f"L{n + 1} Group Mode", 422, vy + 2, 0, 0, 0, w=95, h=16, short="Group",
                     enum=group_modes, tab=5, varname=f"menu_L{n + 1}_gm")
        shape = P.param("live.menu", f"L{n + 1} Chord Shape", 525, vy + 2, 0, 0, chord_shapes.index("triad"), w=115,
                        h=16, short="Chord", enum=chord_shapes, tab=5, varname=f"menu_L{n + 1}_chord")
        grouping = P.obj(f"pak 0 {chord_shapes.index('triad')}", lx + 150, Y + 910, ins=2)
        to_group = P.obj(f"prepend group {n}", lx + 150, Y + 940)
        P.c(gm, grouping, 0, 0); P.c(shape, grouping, 0, 1); P.c(grouping, to_group); P.c(to_group, adapter)

        ly = Y + 100
        # Hits range follows Length, so a full encoder sweep is always valid
        len_t = P.obj("t i i", lx, ly, ins=1, outs=2)
        rng = P.obj("prepend _parameter_range 0", lx + 60, ly + 30)
        P.c(length, len_t); P.c(len_t, rng, 1); P.c(rng, hits)

        lane = P.obj(f"pak {hits_d} {len_d} {rot_d} {DEFAULT_RATE}", lx, ly + 60, ins=4)
        prep = P.obj(f"prepend lane {n}", lx, ly + 90)
        P.c(hits, lane, 0, 0); P.c(len_t, lane, 0, 1); P.c(rotate, lane, 0, 2); P.c(rate, lane, 0, 3)
        P.c(lane, prep); P.c(prep, adapter)

        # pending bank, Cycle length (fractional for odd rates), "now" flag (take it up at the next tick) and
        # "release" flag (release the Voice on taking it up), held until adopted
        arrived = P.obj("t b l", lx, ly + 110, ins=1, outs=2)
        unpack = P.obj("unpack 0 0. 0 0", lx, ly + 130, ins=1, outs=4)
        pend_bank = P.obj("i -1", lx, ly + 160, ins=2)
        pend_ticks = P.obj(f"f {len_d * 120}", lx + 60, ly + 160, ins=2)
        now_flag = P.obj("i 0", lx + 180, ly + 160, ins=2)
        rel_flag = P.obj("i 0", lx + 220, ly + 160, ins=2)
        P.c(pending, arrived, n); P.c(arrived, unpack, 1)
        P.c(unpack, pend_bank, 0, 1); P.c(unpack, pend_ticks, 1, 1)
        P.c(unpack, now_flag, 2, 1); P.c(unpack, rel_flag, 3, 1)
        when_stopped = P.obj("gate 1 1", lx + 120, ly + 130, ins=2)  # stopped: take it up now, not at play
        P.c(arrived, when_stopped, 0, 1); P.c(stopped_now, when_stopped, 0, 0)

        # player: position = (song mod Reset period) mod Cycle length, exactly as the engine's locate()
        where = "fmod(fmod($f1,$f3),$f2)"
        tick_t = P.obj("t i i b i", lx, ly + 200, ins=1, outs=4)
        pos_now = P.obj(f"expr {where}", lx + 60, ly + 230, ins=3)
        pos_t = P.obj("t f f", lx + 60, ly + 260, ins=1, outs=2)
        wrapped = P.obj("expr ($f1 < $f2) && $i3", lx + 60, ly + 290, ins=3)  # position went backwards = new Cycle
        is_new = P.obj("sel 1", lx + 60, ly + 320, ins=2, outs=2)
        # slot = floor(position / grid): consecutive ticks read slots 0, 1, 2, … from every Cycle's start
        key = P.obj(f"expr $i4*{BANK_SIZE} + int({where}/{GRID_TICKS}.)", lx, ly + 460, ins=4)
        P.c(fan, tick_t, LANES - 1 - n)
        P.c(tick_t, now_flag, 2, 0)                      # first: a "now" offer is taken up straight away
        take_now = P.obj("sel 1", lx + 180, ly + 190, ins=2, outs=2)
        P.c(now_flag, take_now)
        P.c(tick_t, pos_now, 1, 0)                       # then: adopt a pending bank if a Cycle began
        P.c(pos_now, pos_t); P.c(pos_t, wrapped, 1, 0); P.c(pos_t, wrapped, 0, 1)
        P.c(wrapped, is_new); P.c(contiguous, wrapped, 0, 2)
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
        adopt_t = P.obj("t i b i i b", lx + 60, ly + 410, ins=1, outs=5)
        bank_key = P.obj(f"+ {n * 2}", lx + 110, ly + 440, ins=2)
        noted = P.obj(f"prepend replace lane{n}", lx + 200, ly + 440)
        at_tick = P.obj("pack 0 0", lx + 160, ly + 470, ins=2)
        to_adapter = P.obj(f"prepend adopt {n}", lx + 160, ly + 500)
        # releasing a Lane releases every Voice it may be sounding on (its group, from the adapter)
        release = P.obj("t b", lx + 60, ly + 470)
        reach = P.obj("zl reg", lx + 60, ly + 490, ins=2, outs=2)
        each = P.obj("zl iter 1", lx + 60, ly + 510, ins=2, outs=2)
        to_voice = P.obj("prepend release", lx + 60, ly + 530)
        init_reach = P.msg(str(n + 1), lx + 120, ly + 490)
        P.c(release, reach); P.c(reach, each); P.c(each, to_voice); P.c(to_voice, bus)
        P.c(release_reach, reach, n, 1); P.c(load, init_reach); P.c(init_reach, reach, 0, 1)
        clear_pending = P.msg("-1", lx + 110, ly + 500)
        clear_now = P.msg("0", lx + 140, ly + 500)
        releasing = P.obj("sel 1", lx + 20, ly + 440, ins=2, outs=2)
        # Taking a bank up at once (the stopped path) also releases the Voice: v8 learns the transport started a
        # moment late, so this can happen just after playback begins; ending the sounding note here keeps it from
        # hanging when the new bank's note-off is for a different pitch
        at_once = P.obj("t b b", lx + 120, ly + 330, ins=1, outs=2)
        P.c(is_new, adopt_now); P.c(when_stopped, at_once); P.c(at_once, adopt_now, 1); P.c(at_once, release, 0); P.c(adopt_now, pend_bank); P.c(pend_bank, has_pending)
        P.c(has_pending, adopt_t, 1)
        P.c(has_pending, release, 0)  # a Cycle boundary with nothing pending (v8 fell behind): release, don't hang
        P.c(take_now, adopt_now)
        # adopting (right to left): new Cycle length; new bank for lookups and in the player dict; clear pending and
        # the "now" flag; release the Voice if flagged; then tell the adapter (it may offer the next bank at once,
        # so everything above must already be done)
        P.c(adopt_t, pend_ticks, 4); P.c(pend_ticks, pos_now, 0, 1); P.c(pend_ticks, key, 0, 1)
        P.c(adopt_t, bank_key, 3); P.c(bank_key, key, 0, 3); P.c(adopt_t, noted, 3); P.c(noted, player_state)
        P.c(adopt_t, clear_pending, 2); P.c(clear_pending, pend_bank, 0, 1)
        P.c(adopt_t, clear_now, 2); P.c(clear_now, now_flag, 0, 1)
        P.c(adopt_t, rel_flag, 1); P.c(rel_flag, releasing); P.c(releasing, release)
        P.c(tick_t, at_tick, 3, 1)                       # the song tick of this adoption
        P.c(adopt_t, at_tick, 0, 0); P.c(at_tick, to_adapter); P.c(to_adapter, adapter)
        # (no adoption on transport start: the playing bank already holds the Cycle at the song position, and a
        # bank still pending from before the stop would swap tables under a sounding note)

    # --- Tab Router Logic (v8.codebox)
    tab_script = f"""
const TABS = {json.dumps(P.tabs)};

function msg_int(selectedTab) {{
  for (let t = 0; t < 6; t++) {{
    const hide = (t !== selectedTab) ? 1 : 0;
    const list = TABS[t] || [];
    for (let i = 0; i < list.length; i++) {{
      const name = list[i];
      const obj = this.patcher.getnamed(name);
      if (obj) {{
        obj.hidden = hide;
      }}
      if (this.patcher.message) {{
        this.patcher.message("script", hide ? "hide" : "show", name);
      }}
    }}
  }}
}}

function msg_float(f) {{
  msg_int(Math.floor(f));
}}
"""
    tab_router = P.codebox(tab_script, 285, Y - 30, ins=1, outs=0)
    P.c(hub_tab, tab_router, 0, 0)

    P.save_amxd("PF4 Hub.amxd", 650)


def build_voice():
    V = Patch()
    V.comment("PF4 Voice", 4, 2, 120)
    voice = V.param("live.numbox", "Voice", 4, 24, 1, 8, 1, w=44, h=18)
    V.comment("= chain number; set this chain's External Instrument to the same MIDI channel", 4, 48, 170)

    rcv = V.obj(f"receive {VOICE_BUS}", 4, 200, ins=0)
    route = V.obj("route release releaseall rollcall touch cc1", 4, 230, ins=2, outs=6)
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
    V.c(route, split, 5)
    V.c(split, who, 1); V.c(who, mine); V.c(mine, gate, 0, 0)   # right first: is it for this Voice?
    V.c(split, body, 0); V.c(body, gate, 1, 1)                  # then pass [pitch velocity]
    V.c(gate, held); V.c(held, pk, 0, 0); V.c(held, pk, 1, 1); V.c(pk, fmt); V.c(fmt, out)
    # Voice number drives filtering, MIDI channel, release addressing and the Hub announcement
    # timbre LFOs: "touch <voice> <value>" -> channel aftertouch, "cc1 <voice> <value>" -> CC1, if the voice is ours
    for k, (outlet_index, fmt_inlet) in enumerate(((3, 4), (4, 2))):
        t = V.obj("t l l", 600, 260 + 120 * k, ins=1, outs=2)
        whose = V.obj("zl nth 1", 700, 290 + 120 * k, ins=2, outs=2)
        is_mine = V.obj("== 1", 700, 320 + 120 * k, ins=2)
        value = V.obj("zl nth 2", 600, 290 + 120 * k, ins=2, outs=2)
        g = V.obj("gate 1", 600, 350 + 120 * k, ins=2)
        V.c(route, t, outlet_index); V.c(t, whose, 1); V.c(whose, is_mine); V.c(is_mine, g, 0, 0)
        V.c(t, value, 0); V.c(value, g, 0, 1)
        V.c(voice, is_mine, 0, 1)
        if fmt_inlet == 2:  # control change: <controller> <value>
            as_cc = V.obj("prepend 1", 600, 380 + 120 * k)
            V.c(g, as_cc); V.c(as_cc, fmt, 0, 2)
        else:
            V.c(g, fmt, 0, fmt_inlet)
    V.c(voice, mine, 0, 1); V.c(voice, fmt, 0, 6); V.c(voice, rel_mine, 0, 1); V.c(voice, brain)
    here = V.obj("live.thisdevice", 400, 200, ins=1, outs=3)
    V.c(here, brain); V.c(brain, voice)
    V.save_amxd("PF4 Voice.amxd", 180)


if __name__ == "__main__":
    build_hub()
    build_voice()
    print(f"built {device_file('PF4 Hub.amxd')}, {device_file('PF4 Voice.amxd')}")
