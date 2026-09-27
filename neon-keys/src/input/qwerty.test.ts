import { describe, expect, it } from 'vitest';
import { noteName } from '../music/notes';
import { midiToQwertyLabel, qwertyRange, qwertyToMidi } from './qwerty';

const name = (code: string, shift = false, octave = 0) => {
  const m = qwertyToMidi(code, shift, octave);
  return m === null ? null : noteName(m);
};

describe('QWERTY layout', () => {
  it('maps white keys like the virtual piano layout', () => {
    expect(name('Digit1')).toBe('C2');
    expect(name('Digit8')).toBe('C3');
    expect(name('KeyT')).toBe('C4'); // middle C
    expect(name('KeyS')).toBe('C5');
    expect(name('KeyL')).toBe('C6');
    expect(name('KeyM')).toBe('C7');
  });

  it('plays black keys with Shift and ignores E/B', () => {
    expect(name('KeyT', true)).toBe('C#4');
    expect(name('Digit4', true)).toBe('F#2');
    expect(name('KeyU', true)).toBeNull(); // E4 has no sharp
    expect(name('KeyM', true)).toBeNull();
  });

  it('shifts by octaves', () => {
    expect(name('KeyT', false, 1)).toBe('C5');
    expect(name('KeyT', false, -1)).toBe('C3');
    expect(qwertyRange(1)).toEqual([48, 108]);
  });

  it('ignores unrelated keys', () => {
    expect(qwertyToMidi('Enter', false)).toBeNull();
    expect(qwertyToMidi('Semicolon', false)).toBeNull();
  });

  it('labels keys for display', () => {
    expect(midiToQwertyLabel(60)).toBe('t');
    expect(midiToQwertyLabel(61)).toBe('T');
    expect(midiToQwertyLabel(37)).toBe('!');
    expect(midiToQwertyLabel(72, 1)).toBe('t');
    expect(midiToQwertyLabel(21)).toBe(''); // A0 is outside the default layout
    expect(midiToQwertyLabel(97)).toBe(''); // C#7: the layout ends on C7
  });
});
