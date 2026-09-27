# Curated Device Presets

PF4 Hub includes a curated collection of full-device starting points designed specifically for the Vermona Perfourmer and analog modular/multi-voice setups. 

Because the sequencing engine operates in scale degrees and observes Live's global Scale and Key, **all presets automatically adapt to whatever Key and Scale your Live project is in**.

---

## Loading and Saving Presets

### 1. In-Device Menu
On the left panel of the Hub (next to the **Pattern** header), the **Preset** dropdown provides instant access to each full-device configuration:
- Selecting any preset updates all 4 Lanes across all tabs (Rhythm, Pitch, Feel, Evolve, and Voicing).
- Adjusting any dial, numbox, or button afterwards drops the menu back to `—`, keeping manual experimentation non-destructive.

### 2. Ableton Device Presets (`.adv`)
To save any Hub state into your Ableton User Library:
1. Click the **Save Preset** (floppy disk) icon in the device title bar inside Ableton Live.
2. Name the preset (e.g. `PF4 Hub - Berlin Ostinato.adv`).
3. It will appear under **User Library > Presets > MIDI Effects > Max MIDI Effect > PF4 Hub** in Live's browser for one-click drag-and-drop.

---

## Preset Catalog

### 1. Minimalist Phasing
* **Genre**: Minimalist Process Music / Phasing (Steve Reich, Terry Riley)
* **Voicing Split**: `1+1+1+1` (Discrete mono voices)
* **Arrangement**:
  - **Lane 1 (Voice 1)**: 12-step diatonic cell (`[0, 1, 4, 5, 6]`), 8 hits at 1/16 rate.
  - **Lane 2 (Voice 2)**: 12-step counterpoint, transposed +2 degrees, rotated by 2 steps to create shifting metric phase relationships against Lane 1.
  - **Lane 3 (Voice 3)**: 5-step pendulum bass anchor (`[0, 2, 0]`) at 1/8 rate, octave -1.
  - **Lane 4 (Voice 4)**: Sparse high-register accent on a 7-step prime cycle at 1/16, octave +1 with 80% probability.
* **Perfourmer Patch Tip**: Set all 4 voices to clean triangle or sine-like filtered saw waves. Open VCF on Voice 4 for chime-like ringing.

### 2. Hypnotic Techno
* **Genre**: Raw / Hypnotic Techno (Tresor, Ostgut)
* **Voicing Split**: `1+1+2` (Voice 1: Sub, Voice 2: 303 Acid, Voices 3+4: Chords)
* **Arrangement**:
  - **Lane 1 (Voice 1)**: Motoric 16/16 sub-bass anchor at octave -2 with 55% gate.
  - **Lane 2 (Voice 2)**: Syncopated 303 acid line with tied legato gate (95%) and high accent peaks (25) at octave -1.
  - **Lane 3 (Voices 3 & 4)**: 2-voice chord stab on offbeat 16ths with short staccato gate (25%).
  - **Lane 4**: Rolling 5-step rhythmic fill at 1/16 with subtle Mutation (25) for evolving micro-movement.
* **Perfourmer Patch Tip**: Turn portamento (Glide) up on Voice 2 to hear analog legato slide on the tied notes. Set Voices 3 and 4 to sawtooth waves with bandpass filtering.

### 3. Berlin School
* **Genre**: Kosmische Musik & Sequencer Space Rock (Tangerine Dream, Klaus Schulze)
* **Voicing Split**: `1+1+1+1` (Discrete mono voices)
* **Arrangement**:
  - **Lane 1 (Voice 1)**: Driving alternating octave bass (`[0, 7]`) at 1/16, octave -2.
  - **Lane 2 (Voice 2)**: Classic 5-step Berlin ostinato (`[0, 0, 7, 0, 5]`) at 1/16, octave -1.
  - **Lane 3 (Voice 3)**: Cascading diatonic 7th arpeggio (`[0, 2, 4, 6]`) at 1/16, octave 0.
  - **Lane 4 (Voice 4)**: Slow counter-melody (`[7, 4, 2]`) at 1/8 rate with long gate (80%).
* **Perfourmer Patch Tip**: Engage 24dB lowpass on Voice 1 with snappy envelope decay. Route an external delay/echo on Voice 3 for cascading stereo trails.

### 4. Dub Techno
* **Genre**: Deep Dub Techno (Basic Channel, Deepchord)
* **Voicing Split**: `1+3` (Voice 1: Sub Bass, Voices 2, 3 & 4: 3-Voice Poly Chords)
* **Arrangement**:
  - **Lane 1 (Voice 1)**: Sparse sub pedal on downbeats (2 hits in 16 steps) at octave -2.
  - **Lane 2 (Voices 2, 3, 4)**: 3-voice poly minor 7th chord stab (`[0, 2, 4, 6]`) on dotted-eighths (5 hits in 16 steps, rotated 2) with ultra-short staccato gate (22%).
  - **Lane 3**: High reverberant percussion ping (`[7, 11, 14]`) on an 11-step prime cycle with 65% probability and 30 mutation.
  - **Lane 4**: Subtle accent tick at 1/8 rate.
* **Perfourmer Patch Tip**: Set Voices 2, 3, and 4 to identical square/saw mixtures. Send the chord channel through heavy tape delay and cavernous reverb.

### 5. Detroit Electro
* **Genre**: Detroit Electro & Funk
* **Voicing Split**: `1+1+1+1` (Discrete mono voices)
* **Arrangement**:
  - **Lane 1 (Voice 1)**: Bouncy 8-step clave bassline with heavy punch velocity (110).
  - **Lane 2 (Voice 2)**: 5-step rolling minor triads (`[0, 2, 4, 2, 0]`) at 1/16, octave 0.
  - **Lane 3 (Voice 3)**: High resonant syncopated blips at octave +1 with high accents.
  - **Lane 4 (Voice 4)**: Generative fill lane with 85% probability and 45 mutation for non-repetitive funk variations.
* **Perfourmer Patch Tip**: Set Voice 1 to pulse wave with fast decay envelope modulation. High resonance on Voice 3 for classic electro chirps.

### 6. Ambient Drone
* **Genre**: Ambient / Generative Soundscape
* **Voicing Split**: `1+1+2` (Voices 1 & 2: Mono, Voices 3 & 4: 2-Voice Cluster)
* **Arrangement**:
  - **Lane 1 (Voice 1)**: Slow root & 5th tied drone (`[0, 4]`) at 1/4 rate with 100% gate.
  - **Lane 2 (Voice 2)**: 7-step polymetric melodic lead at 1/8 rate with 85% gate.
  - **Lane 3 (Voices 3 & 4)**: 2-voice 7th chord cluster swell at 1/4 rate with 90% gate.
  - **Lane 4**: Delicate high shimmer arpeggios on a 13-step prime cycle at 1/16, octave +1 with 35 mutation.
* **Perfourmer Patch Tip**: Dial slow VCF attack on Voices 3 & 4. Use CC1 sweeps on Voice 1 for subtle pulse-width animation.
