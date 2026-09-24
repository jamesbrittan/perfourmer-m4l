# PROTOTYPE — timing (throwaway)

**Question:** can a native, transport-synced Max player send pre-rendered events to four Voice tracks tightly enough, and which mechanism should the real player use?

- **A, fine grid:** a `metro` every 8 ticks, quantised to Live's transport, looks up a table of per-slot events.
- **B, scheduled delays:** at each bar start, every event for that bar goes into a `pipe` with a delay worked out from the tempo.

The events are hard-coded. Each bar is 1920 ticks at 480 PPQ.
- **V1:** 1/16, Euclidean 5/8.
- **V2:** 1/16 triplets, Euclidean 7/12.
- **V3:** 1/5 beat (quintuplets).
- **V4:** gap-gate ties that overlap by 8 ticks.
- **Chord test:** all four voices hit at tick 0 of every bar.

Edit `gen.py` and run `python3 gen.py` to regenerate the two `.maxpat` abstractions.

## Setup in Live (~5 min)

1. **Perfourmer:** set Play Mode M1. Put synth ch 1–4 on MIDI ch 1–4. Turn Edit param 3 (aftertouch → cutoff) on, and turn on legato/auto-glide (params 5 and 6) for the voice 4 tie test.
2. **One MIDI track** holds everything:
   ```
   PF4 Proto Hub  →  Instrument Rack
                       ├─ Chain 1: PF4 Proto Voice (voice 1) → External Instrument (Perfourmer, Ch 1)
                       ├─ Chain 2: PF4 Proto Voice (voice 2) → External Instrument (Perfourmer, Ch 2)
                       ├─ Chain 3: PF4 Proto Voice (voice 3) → External Instrument (Perfourmer, Ch 3)
                       └─ Chain 4: PF4 Proto Voice (voice 4) → External Instrument (Perfourmer, Ch 4)
   ```
   If the track stays silent, set its Monitor to **In**.
3. **Hub device:**
   - Drag a **Max MIDI Effect** onto the track and click Edit.
   - **Save As** `PF4 Proto Hub.amxd` **inside this `timing` folder**, next to the `.maxpat` files, so Max can find them.
   - Add an object `bpatcher @name pf4.proto.player.maxpat` near the top-left, resize it to about 420×130, then save and close.
4. **Voice device:**
   - Build it the same way: save it as `PF4 Proto Voice.amxd` in this folder, then add `bpatcher @name pf4.proto.voice.maxpat` at about 300×50.
   - Put it at the start of each of the four rack chains and set its **voice** box to 1–4.
5. If Max can't find the abstractions, go to the device editor → Options → File Preferences and add this folder.

## What to measure

The Hub shows:
- **late ms (last)** and **max |late| ms:** how far the scheduler was from the intended tick when it fired.
  - For A this is measured at every grid tick.
  - For B it is measured at every event.
- **slot errors (A):** grid slots that were skipped or doubled. This should stay at 0 after one reset.
- **events sent**, **tempo** and **PPQ** (should read 480).

Press **reset stats** after starting playback, since the first bar includes start-up noise. Run each check for about 2 minutes.

| Check | A (grid) | B (scheduled) |
|---|---|---|
| max \|late\| ms at 120 BPM, buffer 128 | | |
| max \|late\| ms at 120 BPM, buffer 512 | | |
| slot errors after 2 min | | — |
| tempo automation 100→140 BPM: anything wrong? | | |
| audible difference by ear (V3 quintuplets) | | |

Hardware checks:
- [ ] External Instruments in separate rack chains keep their own MIDI channels (single-track design)
- [ ] All four voices play independent lines (M1 with 4 channels)
- [ ] V4 ties glide/legato
- [ ] AT LFO on each voice sweeps that voice's filter only (voice 1 has a 2 s cycle, voice 4 an 8 s cycle)
- [ ] Chord skew at tick 0. Record the Perfourmer's audio output and measure the gap between the four onsets, or spy the port with MIDI Monitor (snoize).
- [ ] Transport stop leaves no hanging notes

## Findings

_(filled in after testing; summarised on issue #2)_
