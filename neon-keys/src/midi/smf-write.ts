import type { Song } from '../music/song';

const PPQ = 480;
const US_PER_QUARTER = 500000; // 120 BPM
const TICKS_PER_SEC = PPQ * (1e6 / US_PER_QUARTER);

function vlq(value: number): number[] {
  const out = [value & 0x7f];
  value >>= 7;
  while (value > 0) {
    out.unshift((value & 0x7f) | 0x80);
    value >>= 7;
  }
  return out;
}

const u32 = (v: number) => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];

/** Writes a Song as a format-0 Standard MIDI File (120 BPM, 480 PPQ). */
export function writeMidi(song: Song): Uint8Array {
  interface Ev { tick: number; order: number; bytes: number[] }
  const events: Ev[] = [];
  const tick = (sec: number) => Math.max(0, Math.round(sec * TICKS_PER_SEC));

  for (const n of song.notes) {
    const ch = Math.min(n.track, 15) === 9 ? 10 : Math.min(n.track, 15);
    events.push({ tick: tick(n.time), order: 2, bytes: [0x90 | ch, n.midi, n.velocity] });
    // Note-offs sort before note-ons at the same tick so repeated notes re-strike.
    events.push({ tick: tick(n.time + n.duration), order: 0, bytes: [0x80 | ch, n.midi, 0] });
  }
  for (const p of song.pedal) {
    events.push({ tick: tick(p.time), order: 1, bytes: [0xb0, 64, p.down ? 127 : 0] });
  }
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const name = Array.from(new TextEncoder().encode(song.title));
  const track: number[] = [
    0x00, 0xff, 0x03, ...vlq(name.length), ...name,
    0x00, 0xff, 0x51, 0x03, (US_PER_QUARTER >> 16) & 0xff, (US_PER_QUARTER >> 8) & 0xff, US_PER_QUARTER & 0xff,
  ];
  let last = 0;
  for (const e of events) {
    track.push(...vlq(e.tick - last), ...e.bytes);
    last = e.tick;
  }
  track.push(0x00, 0xff, 0x2f, 0x00);

  return new Uint8Array([
    0x4d, 0x54, 0x68, 0x64, ...u32(6), 0x00, 0x00, 0x00, 0x01, (PPQ >> 8) & 0xff, PPQ & 0xff,
    0x4d, 0x54, 0x72, 0x6b, ...u32(track.length), ...track,
  ]);
}
