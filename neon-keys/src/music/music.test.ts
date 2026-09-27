import { describe, expect, it } from 'vitest';
import { fitRange } from '../render/geometry';
import { DEMOS } from './demos';
import { foldIntoPiano, noteName, parseNote } from './notes';
import { parseVoice, scoreToSong, voiceBeats } from './score';
import { applyPedal, lowerBound, makeSong } from './song';

describe('notes', () => {
  it('parses and names notes', () => {
    expect(parseNote('A4')).toBe(69);
    expect(parseNote('C4')).toBe(60);
    expect(parseNote('Bb3')).toBe(58);
    expect(noteName(61)).toBe('C#4');
    expect(foldIntoPiano(12)).toBe(24);
    expect(foldIntoPiano(120)).toBe(108);
  });
});

describe('score notation', () => {
  it('handles durations, chords, rests and hold times', () => {
    const notes = parseVoice('C4:1 R:.5 E4+G4:.5 A2:.25:2 |', 60, 0);
    expect(notes.map(n => [n.midi, n.time])).toEqual([[60, 0], [64, 1.5], [67, 1.5], [45, 2]]);
    expect(notes[3].duration).toBeCloseTo(1.9);
  });

  it('builds every demo song with aligned hands', () => {
    for (const demo of DEMOS) {
      const song = scoreToSong(demo);
      expect(song.notes.length).toBeGreaterThan(20);
      expect(song.tracks).toHaveLength(2);
      const [rh, lh] = demo.voices.map(v => voiceBeats(v.src));
      expect(rh).toBeCloseTo(lh); // both hands have the same length
    }
  });
});

describe('song helpers', () => {
  it('extends notes with the pedal', () => {
    const notes = [
      { midi: 60, time: 0, duration: 1, velocity: 80, track: 0 },
      { midi: 62, time: 2, duration: 1, velocity: 80, track: 0 },
    ];
    applyPedal(notes, [{ time: 0.5, down: true }, { time: 2.5, down: false }]);
    expect((notes[0] as { end?: number }).end).toBe(2.5);
    expect((notes[1] as { end?: number }).end).toBe(3); // pedal already up at note-off
  });

  it('sorts notes and finds them by time', () => {
    const song = makeSong('x', [], [
      { midi: 64, time: 1, duration: 1, velocity: 80, track: 3 },
      { midi: 60, time: 0, duration: 2, velocity: 80, track: 3 },
    ], [], 'file');
    expect(song.notes.map(n => n.midi)).toEqual([60, 64]);
    expect(song.notes[0].track).toBe(0); // empty tracks are dropped and remapped
    expect(song.duration).toBe(2);
    expect(song.maxDuration).toBe(2);
    expect(lowerBound(song.notes, 0.5)).toBe(1);
  });
});

describe('fitRange', () => {
  it('shows all 88 keys on wide screens', () => {
    expect(fitRange(1600, 60)).toEqual([21, 108]);
  });

  it('zooms in around the centre on narrow screens', () => {
    const [lo, hi] = fitRange(390, 60);
    expect(lo).toBeLessThan(60);
    expect(hi).toBeGreaterThan(60);
    expect(hi - lo).toBeLessThan(40);
  });
});
