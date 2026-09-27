/** Lowest and highest keys of an 88-key piano (A0 and C8). */
export const PIANO_LO = 21;
export const PIANO_HI = 108;

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PITCH_CLASS: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

export const isBlack = (midi: number): boolean => [1, 3, 6, 8, 10].includes(midi % 12);

export const noteName = (midi: number): string => NAMES[midi % 12] + (Math.floor(midi / 12) - 1);

export const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** Parses scientific pitch notation ("C4", "F#5", "Bb2") into a MIDI number. */
export function parseNote(name: string): number {
  const m = /^([A-G](?:#|b)?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Invalid note name: ${name}`);
  return (Number(m[2]) + 1) * 12 + PITCH_CLASS[m[1]];
}

/** Moves a note by octaves until it fits on an 88-key piano. */
export function foldIntoPiano(midi: number): number {
  while (midi < PIANO_LO) midi += 12;
  while (midi > PIANO_HI) midi -= 12;
  return midi;
}
