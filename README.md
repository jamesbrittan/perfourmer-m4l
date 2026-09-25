# Perfourmer M4L

A Max for Live sequencer for the Vermona Perfourmer MKII (and multi-timbral synthesizer setups): interlocking, polymetric, slowly evolving patterns across four voices in the tradition of minimalism and kosmische music.

Built for Ableton Live 12.2+ (Max 9).

---

## Overview

The Vermona Perfourmer MKII comprises four independent analog synthesizer channels that can be played individually or combined. **Perfourmer M4L** takes full musical advantage of this architecture by driving the four voices with four interlocking algorithmic **Lanes**:

- **Polymetric Euclidean Rhythms**: Each Lane runs its own pattern length (1–32 steps) and rate (straight, triplets, quintuplets, septuplets), drifting and phasing against the other Lanes.
- **Phasing Pitch Cycles**: Each Lane has an independent pitch cycle (up to 8 scale degrees) that steps forward on every hit, automatically mapped to Ableton Live's global Scale. When the pitch cycle length differs from rhythm hits, melodies drift against the rhythm.
- **Seeded Mutation & Capture**: Patterns evolve predictably across cycles based on a mutation rate. Any compelling mutation can be **Captured** as the Lane's new Base pattern, or **Reverted** back to its foundation.
- **4×4 Voicing Matrix**: Assign Perfourmer voice channels directly to Lanes. Group multiple voices onto a single Lane for **Polyphonic chords** (with selectable chord shapes), cyclic **Round-Robin** distribution, or stacked **Unison**.
- **Timbre Modulation**: Per-Lane tempo-synced LFOs generate Channel Aftertouch (VCF frequency) and CC1 (Pulse Width Modulation) tailored to the Perfourmer's MIDI control capabilities.

---

## Architecture: Hub and Voices

The system splits into two complementary devices connected over an internal zero-latency bus (`pf4.voice`):

```
Live MIDI Track
└── PF4 Hub
    └── Instrument Rack
        ├── Voice 1 Chain: PF4 Voice (Voice 1) ── External Instrument (MIDI Ch 1)
        ├── Voice 2 Chain: PF4 Voice (Voice 2) ── External Instrument (MIDI Ch 2)
        ├── Voice 3 Chain: PF4 Voice (Voice 3) ── External Instrument (MIDI Ch 3)
        └── Voice 4 Chain: PF4 Voice (Voice 4) ── External Instrument (MIDI Ch 4)
```

1. **PF4 Hub (`PF4 Hub.amxd`)**:
   The central control and sequencing device. Contains the rhythm generators, pitch cycles, mutation engines, timbre LFOs, and voice allocation matrix. Displays live pattern representations with moving playheads.
2. **PF4 Voice (`PF4 Voice.amxd`)**:
   A lightweight voice receiver placed at the head of each voice chain in an Instrument Rack. Filters and gates note and timbre messages addressed to its voice number (1–4) and routes them directly to an External Instrument device or soft synth.

> **Perfourmer Setting**: Set the Vermona Perfourmer's front-panel Play Mode switch to **M1** (Monophonic 1). The sequencer handles all polyphony, chord spacing, and voice cycling internally.

---

## Hub Pages & Controls

The Hub interface adheres to native Ableton Live 12 device design (169 px tall) organized into six functional tabs alongside a permanent overview strip.

### Permanent Strip (Always Visible)
- **Reset Bars**: Periodically realigns all running Lanes to step 1 every *N* bars (1–64, or 0 to let patterns drift freely).
- **Pattern View**: Live 4-lane sequence display showing hits (`●`), rests (`·`), and current step playheads (`◉` / `○`). Monospace layout with 16-step musical wrapping.

### Tab 1: Rhythm
- **Hits** (0–32): Number of active hits distributed evenly across the Cycle using Euclidean spacing.
- **Length** (1–32): Total steps in the Lane's Cycle.
- **Rotate** (0–31): Rotates the pattern forwards or backwards by step count.
- **Rate**: Clock division per step (1/1 to 1/32, including triplets `T`, quintuplets `Q`, and septuplets `S`).
- **Rhythm Presets**: 21 published Euclidean rhythms (tresillo, cinquillo, rumba, aksak, etc.) that load directly into Hits, Length, and Rotate.

### Tab 2: Pitch
- **Pitch Length** (1–8): Number of notes in the Lane's Pitch Cycle.
- **Degree 1–8**: Scale degree offsets relative to Ableton Live's global song scale.
- **Transpose**: Offsets the melody up or down by scale degrees.
- **Octave**: Shifts the octave range (-3 to +3).

### Tab 3: Feel
- **Gate %**: Note duration as a percentage of step length (legato ties at 100%).
- **Velocity**: Base MIDI velocity (1–127).
- **Accent**: Velocity boost applied to accented hits.

### Tab 4: Evolve
- **Prob %**: Probability that a hit will trigger on any given cycle.
- **Mutate** (0–127): Depth of algorithmic mutation applied per Cycle to rhythm and pitch.
- **Seed & Randomize (`⚄`)**: Unique deterministic seed governing the mutation path.
- **Capture**: Freezes the currently sounding mutated cycle as the new Base pattern.
- **Revert**: Restores the original Base pattern, discarding mutations.

### Tab 5: Timbre
- **VCF Depth & Bars**: Tempo-synced LFO sweeping MIDI Channel Aftertouch (maps to Perfourmer VCF cutoff).
- **PWM Depth & Bars**: Tempo-synced LFO sweeping MIDI CC1 (maps to Perfourmer Pulse Width Modulation).

### Tab 6: Voicing
- **Voicing Matrix (4×4 Grid)**: Toggle buttons allocating Voices 1–4 to Lanes 1–4. Each Voice belongs to at most one Lane.
- **Group Mode**: When a Lane owns 2 or more Voices:
  - `poly`: Plays chords across the assigned voices.
  - `round-robin`: Cycles successive hits across voices.
  - `unison`: Triggers all assigned voices simultaneously on the same pitch.
- **Chord Shape**: When in `poly` mode, selects the interval stack (`unison`, `octave`, `fifth`, `triad`, `suspended`, `seventh`, `quartal`, `ninth`). Chords invert automatically to assign the lowest note to the highest voice channel, matching the Perfourmer's physical panel layout.

---

## Timing & Engine Architecture

Timing reliability is paramount in hardware sequencing:
- **Audio-Interrupt Timing**: Note scheduling and playback run natively in Max using `coll` data structures and high-priority schedulers. Timing never jitters when the UI redraws or JavaScript executes.
- **Pre-Rendered Cycles**: The JavaScript layer (`v8`) pre-computes upcoming Cycles ahead of time and stores them into buffer banks, ensuring zero latency at bar boundaries.
- **Decoupled TypeScript Engine**: All core algorithms (Euclidean math, voice allocation, chord inversion, mutation PRNG) live in `engine/src/` with 100% test coverage in Vitest, completely decoupled from the Max environment.

---

## Development & Testing

### Prerequisites
- Node.js 20+
- Python 3.9+
- Ableton Live 12.2+ with Max 9

### Build Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   cd engine && npm install && cd ..
   ```

2. **Run Tests**:
   ```bash
   # Run engine test suite
   npm test --prefix engine

   # Run timing & state simulation checks
   node .scratch/sim/check.js
   node .scratch/sim/capture-check.js
   ```

3. **Build the Engine & Devices**:
   ```bash
   # Bundle TypeScript engine to max/pf4-engine.js
   npm run build --prefix engine

   # Generate PF4 Hub.amxd and PF4 Voice.amxd
   python3 max/build_devices.py
   ```

> **Device Generation**: Never hand-patch the `.amxd` binary files directly. Max devices are programmatically constructed by `max/build_devices.py`. Scripts (`pf4-hub.js` and `pf4-voice.js`) are inlined into internal `v8.codebox` objects so devices remain fully self-contained.
