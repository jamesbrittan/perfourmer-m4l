# PF4: Perfourmer MKII Max for Live Sequencer

A dedicated 4-voice algorithmic and polymetric sequencer built specifically for the **Vermona Perfourmer MKII** analog synthesizer and Ableton Live.

PF4 operates as a distributed two-device system:
- **`PF4 Hub.amxd`**: The central sequencer brain. Generates Euclidean rhythms, diatonic melodies, polymetric phrasing, and manages dynamic voice allocation across 4 independent lanes.
- **`PF4 Voice.amxd`**: Lightweight satellite receivers placed on destination MIDI tracks in Live that route note and modulation streams to the corresponding Perfourmer voice channels.

---

## Architecture & Concepts

### 1. The Perfourmer MKII Voice Architecture
The Vermona Perfourmer MKII features 4 discrete, independent monophonic synthesizer channels. PF4 provides flexible routing between its 4 sequencer lanes and the 4 physical voices:
- **Discrete (1:1)**: Each lane controls one physical synth voice.
- **Polyphonic (Shared Pool)**: A single lane polyphonically triggers 2 to 4 voices using round-robin voice allocation and voice-stealing.
- **Chord Modes**: Voices are dynamically clustered into diatonic chords (`Maj`, `Min`, `7th`, `Sus4`, etc.) from a single trigger stream.
- **Unison / Splits**: Stacks voices across lanes with detune or keyboard split points.

### 2. Polymetric & Generative Sequencing
Each lane operates with independent parameters:
- **Euclidean Rhythm**: Distributes hits evenly across step lengths ($1$ to $32$ steps) using Bjorklund's algorithm.
- **Independent Rates**: Clock rates from whole notes down to 32nd-note triplets per lane (`1/1`, `1/2`, `1/4`, `1/8`, `1/16`, `1/32`, plus dotted and triplet variants).
- **Pitch Cycles**: Diatonic scale degrees (-14 to +14) with independent loop lengths (1 to 8 steps) that phase across rhythmic hits.
- **Harmonization**: Automatically locks all pitch cycles to Ableton Live's global Scale and Key.
- **Stochastic Mutation**: Probabilistic bit-flipping and step-shifting with non-destructive **Capture** and **Revert** buffers.

---

## Device Controls & Pages

The Hub features a permanent 4-row monospaced pattern view on the left and 6 tabbed parameter pages on the right:

### Permanent Left Strip
- **Pattern View**: Live 32-step monospaced ASCII display (`●` hit, `·` rest) with active playhead tracking and automatic 2-line wrapping for sequences longer than 16 steps.

### Tabbed Pages
1. **Rhythm**: Hits (0–32), Length (1–32), Rotate (0–31), Rate selector, and a curated **Rhythm Presets** menu (Four-on-the-floor, Offbeat, Ostinatos, Dotted-8th hemiolas, and Toussaint world rhythms).
2. **Pitch**: Scale degree numboxes (1–8 steps), Transpose (-7 to +7 degrees), and Octave (-3 to +3).
3. **Feel**: Gate % (1–100%, with 100% producing tied legato overlaps for analog glide), Velocity, and Accent boost.
4. **Evolve**: Probability (0–100%), Mutation % (0–100%), and **Capture** / **Revert** buttons.
5. **Timbre**: Per-lane Aftertouch and CC1 (Modulation Wheel) LFO generators for sweeping filter cutoff and parameters over bars.
6. **Voicing**: 4×4 Lane-to-Voice routing matrix, Playback mode selector (`Mono`, `Poly`, `Split`, `Unison`), and chord shape selector.

---

## Installation & Setup

1. **Place Devices in Live's User Library**:
   Copy `PF4 Hub.amxd` and `PF4 Voice.amxd` (from the `max/` directory) into:
   `User Library/Presets/MIDI Effects/Max MIDI Effect/`

2. **Routing in an Ableton Live Set**:
   - Create a MIDI track named `PF4 Hub` and drop `PF4 Hub.amxd` onto it.
   - Create 4 destination MIDI tracks for Perfourmer Channels 1 to 4:
     - Track 1: Add `PF4 Voice.amxd` (set to **Voice 1**), route MIDI Out to Perfourmer Channel 1.
     - Track 2: Add `PF4 Voice.amxd` (set to **Voice 2**), route MIDI Out to Perfourmer Channel 2.
     - Track 3: Add `PF4 Voice.amxd` (set to **Voice 3**), route MIDI Out to Perfourmer Channel 3.
     - Track 4: Add `PF4 Voice.amxd` (set to **Voice 4**), route MIDI Out to Perfourmer Channel 4.
   - Start Live's transport. The Hub automatically communicates with the satellite Voice devices over internal Max buses (`pf4_voice_1` through `pf4_voice_4`).

---

## Development & Building

The project is split into a pure TypeScript sequencer engine (`engine/`) and a Python-based Max device builder (`max/build_devices.py`):

```
perfourmer/
├── engine/              # Zero-dependency TypeScript sequencer core
│   ├── src/index.ts     # Euclidean math, scale mapping, voice allocation
│   └── test/            # Vitest unit test suite
├── max/                 # Max for Live patches and generators
│   ├── build_devices.py # Python compiler generating .amxd files
│   ├── pf4-engine.js    # Compiled CJS engine bundle (via esbuild)
│   ├── pf4-hub.js       # Max v8 controller & timing scheduler
│   ├── PF4 Hub.amxd     # Compiled Hub device
│   └── PF4 Voice.amxd   # Compiled Voice device
└── package.json         # Workspace scripts & linting
```

### Build Workflow

1. **Install Dependencies**:
   ```bash
   npm install
   cd engine && npm install && cd ..
   ```

2. **Run Tests**:
   ```bash
   # Run engine test suite
   npm test --prefix engine

   # Type-check TypeScript sources
   npm run typecheck --prefix engine
   ```

3. **Build the Engine & Devices**:
   ```bash
   # Bundle TypeScript engine to max/pf4-engine.js
   npm run build --prefix engine

   # Generate PF4 Hub.amxd and PF4 Voice.amxd
   python3 max/build_devices.py
   ```

> **Device Generation**: Never hand-patch the `.amxd` binary files directly. Max devices are programmatically constructed by `max/build_devices.py`. Scripts (`pf4-hub.js` and `pf4-voice.js`) are inlined into internal `v8.codebox` objects so devices remain fully self-contained.
