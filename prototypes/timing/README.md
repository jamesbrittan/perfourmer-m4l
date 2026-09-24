# PROTOTYPE — timing (throwaway)

**Question:** can a native, transport-synced Max player send pre-rendered events to four Voice Chains tightly enough, and which mechanism should the real player use?

- **A, fine grid:** a `metro` every 8 ticks, quantised to Live's transport, looks up a table of per-slot events.
- **B, scheduled delays:** at each bar start, every event for that bar goes into a `pipe` with a delay worked out from the tempo.

The events are hard-coded. Each bar is 1920 ticks at 480 PPQ.
- **V1:** 1/16, Euclidean 5/8.
- **V2:** 1/16 triplets, Euclidean 7/12.
- **V3:** 1/5 beat (quintuplets).
- **V4:** gap-gate ties that overlap by 8 ticks.
- **Chord test:** all four voices hit at tick 0 of every bar.

`python3 gen.py` builds the finished devices (`PF4 Proto Hub.amxd`, `PF4 Proto Voice.amxd`). There's no patching in Max.

## Setup in Live (~3 min, all standard Live actions)

1. **Perfourmer (once):**
   - Play Mode M1, with synth ch 1–4 on MIDI ch 1–4.
   - Edit param 3 (aftertouch → cutoff) on.
   - Params 5 and 6 (auto-glide, legato) on.
2. **New MIDI track.** From Finder, drag `PF4 Proto Voice.amxd` onto it.
3. **Make it a rack:** click the Voice device's title bar and press **Cmd+G**, which wraps it in an Instrument Rack.
4. **Finish chain 1:**
   - From the browser (Instruments → External Instrument), drag an **External Instrument** into the chain, *after* the Voice device.
   - Set MIDI To = your Perfourmer port, **Ch 1**.
5. **Make chains 2–4:**
   - Show the chain list (the rack's leftmost toggle), select the chain and press **Cmd+D** three times.
   - Set the External Instrument in chains 2, 3 and 4 to **Ch 2, 3, 4**. That's the only per-chain setting.
   - Each Voice device detects its own voice number from its chain position and shows it.
6. **Add the Hub:** drag `PF4 Proto Hub.amxd` onto the track, *before* the rack.
7. **Optional:** save the rack as a preset (rack title bar → Save icon) so you never have to rebuild it.

If the track stays silent, set its Monitor to **In**.

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
