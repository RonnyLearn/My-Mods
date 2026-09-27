import { describe, expect, it } from 'vitest';
import { makeSong } from '../music/song';
import { parseMidi } from './smf-parse';
import { writeMidi } from './smf-write';

const vlq = (v: number) => {
  const out = [v & 0x7f];
  while ((v >>= 7) > 0) out.unshift((v & 0x7f) | 0x80);
  return out;
};

/** Builds a format-1 file by hand: tempo track + one note track using running status. */
function handMadeFile(): Uint8Array {
  const tempo = [0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, /* 120 bpm */ ...vlq(960), 0xff, 0x51, 0x03, 0x0f, 0x42, 0x40, /* 60 bpm at beat 2 */ 0x00, 0xff, 0x2f, 0x00];
  const notes = [
    0x00, 0xff, 0x03, 0x05, ...Array.from('Piano', c => c.charCodeAt(0)),
    0x00, 0x90, 60, 100, // C4 on
    ...vlq(480), 64, 90, // running status: E4 on
    ...vlq(480), 60, 0, // C4 off via velocity 0 (at beat 2)
    0x00, 0xb0, 64, 127, // pedal down
    ...vlq(480), 0x80, 64, 0, // E4 off at beat 3 (pedal still down)
    ...vlq(480), 0xb0, 64, 0, // pedal up at beat 4
    0x00, 0x99, 36, 100, // drum note on channel 10: ignored
    ...vlq(10), 0x89, 36, 0,
    0x00, 0xff, 0x2f, 0x00,
  ];
  const chunk = (id: string, body: number[]) => [...Array.from(id, c => c.charCodeAt(0)), 0, 0, (body.length >> 8) & 0xff, body.length & 0xff, ...body];
  return new Uint8Array([
    ...chunk('MThd', [0, 1, 0, 2, 0x01, 0xe0]), // format 1, 2 tracks, 480 PPQ
    ...chunk('MTrk', tempo),
    ...chunk('MTrk', notes),
  ]);
}

describe('parseMidi', () => {
  const song = parseMidi(handMadeFile(), 'test');

  it('reads notes with running status and skips drums', () => {
    expect(song.notes.map(n => n.midi)).toEqual([60, 64]);
    expect(song.tracks).toEqual([{ name: 'Piano' }]);
    expect(song.title).toBe('test');
  });

  it('converts ticks to seconds through tempo changes', () => {
    const [c, e] = song.notes;
    expect(c.time).toBeCloseTo(0);
    expect(c.duration).toBeCloseTo(1); // 2 beats at 120 bpm
    expect(e.time).toBeCloseTo(0.5);
    expect(e.duration).toBeCloseTo(1.5); // 1 beat at 120 + 1 beat at 60
  });

  it('extends notes held by the sustain pedal', () => {
    const [c, e] = song.notes;
    expect(c.end).toBeCloseTo(1); // released before the pedal went down
    expect(e.end).toBeCloseTo(3); // pedal up at beat 4 = 1s + 2s
  });

  it('rejects non-MIDI data', () => {
    expect(() => parseMidi(new Uint8Array([1, 2, 3, 4]))).toThrow();
  });
});

describe('writeMidi', () => {
  it('round-trips notes and pedal through a MIDI file', () => {
    const original = makeSong('Take 1', ['Piano'], [
      { midi: 60, time: 0.5, duration: 0.25, velocity: 80, track: 0 },
      { midi: 67, time: 0.75, duration: 1, velocity: 100, track: 0 },
      { midi: 60, time: 0.75, duration: 0.5, velocity: 64, track: 0 },
    ], [{ time: 1, down: true }, { time: 2, down: false }], 'recording');

    const back = parseMidi(writeMidi(original));
    expect(back.title).toBe('Take 1');
    expect(back.notes.map(n => [n.midi, n.velocity])).toEqual(original.notes.map(n => [n.midi, n.velocity]));
    back.notes.forEach((n, i) => {
      expect(n.time).toBeCloseTo(original.notes[i].time, 2);
      expect(n.duration).toBeCloseTo(original.notes[i].duration, 2);
    });
    // The second C4 is released at 1.25s while the pedal is down → rings until 2s.
    expect(back.notes.find(n => n.midi === 60 && n.time > 0.6)!.end).toBeCloseTo(2, 2);
  });
});
