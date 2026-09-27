import { isBlack, PIANO_HI, PIANO_LO } from '../music/notes';

/**
 * QWERTY piano layout compatible with the popular "virtual piano" convention
 * (also used by PianoGlow): 36 keys play the white notes C2..C7, and
 * Shift + key plays the black note right above. Keys are matched by their
 * physical position (KeyboardEvent.code), so the layout works on QWERTY,
 * AZERTY, QWERTZ and Cyrillic (ЙЦУКЕН) keyboards alike.
 */
export const WHITE_CODES = [
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0',
  'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP',
  'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL',
  'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM',
];

const SHIFTED_DIGITS: Record<string, string> = {
  Digit1: '!', Digit2: '@', Digit3: '#', Digit4: '$', Digit5: '%',
  Digit6: '^', Digit7: '&', Digit8: '*', Digit9: '(', Digit0: ')',
};

const BASE_MIDI = 36; // C2 on "1"

/** Allowed octave shifts that keep the whole layout on an 88-key piano. */
export const OCTAVE_MIN = -1;
export const OCTAVE_MAX = 1;

const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];

function whiteMidi(index: number): number {
  return BASE_MIDI + Math.floor(index / 7) * 12 + WHITE_OFFSETS[index % 7];
}

const codeLabel = (code: string) => (code.startsWith('Digit') ? code.slice(5) : code.slice(3).toLowerCase());

/** Returns the MIDI note for a key press, or null if the key is not part of the layout. */
export function qwertyToMidi(code: string, shift: boolean, octave = 0): number | null {
  const i = WHITE_CODES.indexOf(code);
  if (i < 0) return null;
  let midi = whiteMidi(i);
  if (shift) {
    if (i === WHITE_CODES.length - 1) return null; // the layout ends on C
    midi += 1;
    if (!isBlack(midi)) return null; // E and B have no black key above
  }
  midi += octave * 12;
  return midi >= PIANO_LO && midi <= PIANO_HI ? midi : null;
}

const labelCache = new Map<number, Map<number, string>>();

/** Label printed on a piano key / falling note for the given MIDI note, or '' if unmapped. */
export function midiToQwertyLabel(midi: number, octave = 0): string {
  let labels = labelCache.get(octave);
  if (!labels) {
    labels = new Map();
    for (const code of WHITE_CODES) {
      const white = qwertyToMidi(code, false, octave);
      if (white !== null) labels.set(white, codeLabel(code));
      const black = qwertyToMidi(code, true, octave);
      if (black !== null) labels.set(black, SHIFTED_DIGITS[code] ?? codeLabel(code).toUpperCase());
    }
    labelCache.set(octave, labels);
  }
  return labels.get(midi) ?? '';
}

/** MIDI range covered by the layout at a given octave shift. */
export function qwertyRange(octave = 0): [number, number] {
  return [whiteMidi(0) + octave * 12, whiteMidi(WHITE_CODES.length - 1) + octave * 12];
}
