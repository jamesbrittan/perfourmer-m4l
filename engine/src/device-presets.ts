import { Split, LaneParams } from "./index";

export interface DevicePreset {
  readonly name: string;
  readonly description: string;
  readonly split: Split;
  readonly lanes: readonly [LaneParams, LaneParams, LaneParams, LaneParams];
}

export const DEVICE_PRESETS: readonly DevicePreset[] = [
  {
    name: "Minimalist Phasing",
    description: "Sparse high accents, interlocking Reich-style 12-step diatonic cells with shifting phase counterpoints, and a 5-step pendulum bass in discrete mono.",
    split: "1+1+1+1",
    lanes: [
      {
        hits: 3, length: 7, rotate: 1, rate: "1/16",
        pitchCycle: [7, 9, 11], transpose: 0, octave: 1,
        gate: 40, velocity: 80, accent: 25,
        probability: 80, mutation: 15, seed: 4,
        groupMode: "poly", chordShape: "triad",
      },
      {
        hits: 8, length: 12, rotate: 0, rate: "1/16",
        pitchCycle: [0, 1, 4, 5, 6], transpose: 0, octave: 0,
        gate: 70, velocity: 95, accent: 15,
        probability: 100, mutation: 0, seed: 1,
        groupMode: "poly", chordShape: "triad",
      },
      {
        hits: 6, length: 12, rotate: 2, rate: "1/16",
        pitchCycle: [0, 1, 4, 5, 6], transpose: 2, octave: 0,
        gate: 70, velocity: 85, accent: 10,
        probability: 100, mutation: 0, seed: 2,
        groupMode: "poly", chordShape: "triad",
      },
      {
        hits: 3, length: 8, rotate: 0, rate: "1/8",
        pitchCycle: [0, 2, 0], transpose: 0, octave: -1,
        gate: 60, velocity: 100, accent: 20,
        probability: 100, mutation: 0, seed: 3,
        groupMode: "poly", chordShape: "triad",
      },
    ],
  },
  {
    name: "Hypnotic Techno",
    description: "Driving 16th sub-bass, syncopated 303 acid sequence with legato glide, 2-voice chord stabs, and micro-mutating 5-step rolling fills.",
    split: "1+1+2",
    lanes: [
      {
        hits: 16, length: 16, rotate: 0, rate: "1/16",
        pitchCycle: [0], transpose: 0, octave: -2,
        gate: 55, velocity: 110, accent: 15,
        probability: 100, mutation: 0, seed: 10,
        groupMode: "poly", chordShape: "triad",
      },
      {
        hits: 11, length: 16, rotate: 2, rate: "1/16",
        pitchCycle: [0, 7, 0, 7, 0, 2, 7, 0], transpose: 0, octave: -1,
        gate: 95, velocity: 90, accent: 25,
        probability: 100, mutation: 10, seed: 11,
        groupMode: "poly", chordShape: "triad",
      },
      {
        hits: 4, length: 16, rotate: 2, rate: "1/16",
        pitchCycle: [0, 2, 4], transpose: 0, octave: 0,
        gate: 25, velocity: 100, accent: 0,
        probability: 100, mutation: 0, seed: 12,
        groupMode: "poly", chordShape: "triad",
      },
      {
        hits: 3, length: 5, rotate: 0, rate: "1/16",
        pitchCycle: [0, 0, 2, 0], transpose: 0, octave: 0,
        gate: 50, velocity: 80, accent: 20,
        probability: 90, mutation: 25, seed: 13,
        groupMode: "poly", chordShape: "triad",
      },
    ],
  },
  {
    name: "Berlin School",
    description: "Classic alternating octave bass, 5-step Tangerine Dream ostinato, cascading diatonic 7th arpeggios, and slow counter-melody.",
    split: "1+1+1+1",
    lanes: [
      {
        hits: 16, length: 16, rotate: 0, rate: "1/16",
        pitchCycle: [0, 7], transpose: 0, octave: -2,
        gate: 50, velocity: 100, accent: 15,
        probability: 100, mutation: 0, seed: 20,
        groupMode: "poly", chordShape: "triad",
      },
      {
        hits: 5, length: 5, rotate: 0, rate: "1/16",
        pitchCycle: [0, 0, 7, 0, 5], transpose: 0, octave: -1,
        gate: 60, velocity: 90, accent: 15,
        probability: 100, mutation: 0, seed: 21,
        groupMode: "poly", chordShape: "triad",
      },
      {
        hits: 4, length: 8, rotate: 1, rate: "1/16",
        pitchCycle: [0, 2, 4, 6], transpose: 0, octave: 0,
        gate: 40, velocity: 85, accent: 10,
        probability: 100, mutation: 10, seed: 22,
        groupMode: "poly", chordShape: "triad",
      },
      {
        hits: 3, length: 8, rotate: 0, rate: "1/8",
        pitchCycle: [7, 4, 2], transpose: 0, octave: 0,
        gate: 80, velocity: 90, accent: 0,
        probability: 100, mutation: 5, seed: 23,
        groupMode: "poly", chordShape: "triad",
      },
    ],
  },
  {
    name: "Dub Techno",
    description: "Spacious minor 7th chord stabs on dotted-eighths (3-voice poly), deep mono sub pedal, and reverberant syncopated percussion pings.",
    split: "1+3",
    lanes: [
      {
        hits: 2, length: 7, rotate: 0, rate: "1/8",
        pitchCycle: [4, 6], transpose: 0, octave: 0,
        gate: 20, velocity: 75, accent: 10,
        probability: 80, mutation: 20, seed: 33,
        groupMode: "poly", chordShape: "triad",
      },
      {
        hits: 3, length: 11, rotate: 1, rate: "1/16",
        pitchCycle: [0, 4, 7], transpose: 0, octave: 0,
        gate: 15, velocity: 85, accent: 30,
        probability: 65, mutation: 30, seed: 32,
        groupMode: "poly", chordShape: "triad",
      },
      {
        hits: 5, length: 16, rotate: 2, rate: "1/16",
        pitchCycle: [0, 2, 4, 6], transpose: 0, octave: -1,
        gate: 22, velocity: 100, accent: 15,
        probability: 100, mutation: 0, seed: 31,
        groupMode: "poly", chordShape: "7th",
      },
      {
        hits: 2, length: 16, rotate: 0, rate: "1/16",
        pitchCycle: [0], transpose: 0, octave: -2,
        gate: 70, velocity: 105, accent: 10,
        probability: 100, mutation: 0, seed: 30,
        groupMode: "poly", chordShape: "triad",
      },
    ],
  },
  {
    name: "Detroit Electro",
    description: "High resonant syncopated blips, generative evolving fill lane, 5-step rolling triads, and syncopated 8-step clave bass in discrete mono.",
    split: "1+1+1+1",
    lanes: [
      {
        hits: 3, length: 16, rotate: 3, rate: "1/16",
        pitchCycle: [7, 9, 12], transpose: 0, octave: 1,
        gate: 20, velocity: 95, accent: 25,
        probability: 90, mutation: 15, seed: 42,
        groupMode: "poly", chordShape: "triad",
      },
      {
        hits: 7, length: 16, rotate: 1, rate: "1/16",
        pitchCycle: [0, 4, 7], transpose: 0, octave: 0,
        gate: 40, velocity: 80, accent: 15,
        probability: 85, mutation: 45, seed: 43,
        groupMode: "poly", chordShape: "triad",
      },
      {
        hits: 5, length: 5, rotate: 0, rate: "1/16",
        pitchCycle: [0, 2, 4, 2, 0], transpose: 0, octave: -1,
        gate: 35, velocity: 90, accent: 10,
        probability: 100, mutation: 0, seed: 41,
        groupMode: "poly", chordShape: "triad",
      },
      {
        hits: 5, length: 8, rotate: 0, rate: "1/16",
        pitchCycle: [0, -1, 0, 2, 0], transpose: 0, octave: -2,
        gate: 45, velocity: 110, accent: 20,
        probability: 100, mutation: 0, seed: 40,
        groupMode: "poly", chordShape: "triad",
      },
    ],
  },
  {
    name: "Ambient Drone",
    description: "Delicate shimmer arpeggios, 2-voice 7th chord swell, 7-step polymetric melodic lead, and slow tied root & 5th drone.",
    split: "1+1+2",
    lanes: [
      {
        hits: 5, length: 13, rotate: 0, rate: "1/16",
        pitchCycle: [7, 9, 11, 12, 14], transpose: 0, octave: 1,
        gate: 50, velocity: 75, accent: 15,
        probability: 75, mutation: 35, seed: 53,
        groupMode: "poly", chordShape: "triad",
      },
      {
        hits: 2, length: 5, rotate: 1, rate: "1/4",
        pitchCycle: [0, 2, 4, 6], transpose: 0, octave: 0,
        gate: 90, velocity: 80, accent: 0,
        probability: 100, mutation: 5, seed: 52,
        groupMode: "poly", chordShape: "7th",
      },
      {
        hits: 3, length: 7, rotate: 0, rate: "1/8",
        pitchCycle: [0, 2, 4, 7, 5], transpose: 0, octave: 0,
        gate: 85, velocity: 90, accent: 10,
        probability: 90, mutation: 10, seed: 51,
        groupMode: "poly", chordShape: "triad",
      },
      {
        hits: 1, length: 4, rotate: 0, rate: "1/4",
        pitchCycle: [0, 4], transpose: 0, octave: -1,
        gate: 100, velocity: 85, accent: 0,
        probability: 100, mutation: 0, seed: 50,
        groupMode: "poly", chordShape: "triad",
      },
    ],
  },
];
