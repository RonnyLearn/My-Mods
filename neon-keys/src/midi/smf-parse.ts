import { applyPedal, makeSong, type PedalEvent, type RawNote, type Song } from '../music/song';

/**
 * Standard MIDI File (format 0/1) parser.
 * Produces notes in seconds using the file's tempo map. Drum channel (10) is skipped.
 */

class Reader {
  pos = 0;
  constructor(private readonly data: Uint8Array) {}
  get eof() { return this.pos >= this.data.length; }
  u8() {
    if (this.pos >= this.data.length) throw new Error('Unexpected end of MIDI data');
    return this.data[this.pos++];
  }
  u16() { return (this.u8() << 8) | this.u8(); }
  u32() { return ((this.u8() << 24) >>> 0) + (this.u8() << 16) + (this.u8() << 8) + this.u8(); }
  str(n: number) {
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.u8());
    return s;
  }
  bytes(n: number) {
    if (this.pos + n > this.data.length) throw new Error('Unexpected end of MIDI data');
    const b = this.data.subarray(this.pos, this.pos + n);
    this.pos += n;
    return b;
  }
  vlq() {
    let v = 0;
    for (let i = 0; i < 4; i++) {
      const b = this.u8();
      v = (v << 7) | (b & 0x7f);
      if (!(b & 0x80)) return v;
    }
    throw new Error('Invalid variable-length quantity');
  }
}

interface TickNote { tick: number; endTick: number; midi: number; velocity: number; track: number; channel: number }
interface TickPedal { tick: number; down: boolean; channel: number }
interface Tempo { tick: number; usPerQuarter: number }

export function parseMidi(buffer: ArrayBuffer | Uint8Array, title = 'MIDI'): Song {
  const r = new Reader(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
  if (r.str(4) !== 'MThd') throw new Error('Not a MIDI file');
  const headerLen = r.u32();
  const headerEnd = r.pos + headerLen;
  r.u16(); // format
  const trackCount = r.u16();
  const division = r.u16();
  r.pos = headerEnd;

  // SMPTE division: ticks per second instead of per quarter note.
  let ticksPerSecondSmpte = 0;
  if (division & 0x8000) {
    const fps = 256 - (division >> 8);
    ticksPerSecondSmpte = (fps === 29 ? 29.97 : fps) * (division & 0xff);
  }

  const notes: TickNote[] = [];
  const pedals: TickPedal[] = [];
  const tempos: Tempo[] = [];
  const trackNames: string[] = [];
  let songName = '';

  for (let t = 0; t < trackCount && !r.eof; t++) {
    const id = r.str(4);
    const len = r.u32();
    const end = r.pos + len;
    if (id !== 'MTrk') { r.pos = end; continue; }

    let tick = 0;
    let status = 0;
    const open = new Map<number, TickNote[]>(); // (channel << 7 | midi) -> stack

    const noteOff = (channel: number, midi: number) => {
      const stack = open.get((channel << 7) | midi);
      const n = stack?.shift();
      if (n) n.endTick = tick;
    };

    while (r.pos < end) {
      tick += r.vlq();
      let b = r.u8();
      if (b < 0x80) {
        if (!status) throw new Error('Running status without a previous status byte');
        r.pos--; // data byte: reuse running status
        b = status;
      }
      if (b === 0xff) {
        const type = r.u8();
        const data = r.bytes(r.vlq());
        if (type === 0x51 && data.length === 3) {
          tempos.push({ tick, usPerQuarter: (data[0] << 16) | (data[1] << 8) | data[2] });
        } else if (type === 0x03) {
          const name = new TextDecoder().decode(data).trim();
          trackNames[t] = name;
          if (t === 0 && !songName) songName = name;
        } else if (type === 0x2f) {
          break;
        }
        continue;
      }
      if (b === 0xf0 || b === 0xf7) {
        r.bytes(r.vlq());
        continue;
      }
      status = b;
      const kind = b & 0xf0;
      const channel = b & 0x0f;
      if (kind === 0x80 || kind === 0x90) {
        const midi = r.u8();
        const vel = r.u8();
        if (channel === 9) continue; // drums
        if (kind === 0x90 && vel > 0) {
          const n: TickNote = { tick, endTick: -1, midi, velocity: vel, track: t, channel };
          notes.push(n);
          const key = (channel << 7) | midi;
          const stack = open.get(key) ?? [];
          stack.push(n);
          open.set(key, stack);
        } else {
          noteOff(channel, midi);
        }
      } else if (kind === 0xb0) {
        const cc = r.u8();
        const value = r.u8();
        if (cc === 64) pedals.push({ tick, down: value >= 64, channel });
      } else if (kind === 0xa0 || kind === 0xe0) {
        r.u8(); r.u8();
      } else if (kind === 0xc0 || kind === 0xd0) {
        r.u8();
      } else {
        throw new Error(`Unknown MIDI status byte 0x${b.toString(16)}`);
      }
    }
    // Close notes that never got a note-off.
    for (const stack of open.values()) for (const n of stack) n.endTick = tick;
    r.pos = end;
  }

  // Tempo map -> seconds.
  tempos.sort((a, b) => a.tick - b.tick);
  if (!tempos.length || tempos[0].tick > 0) tempos.unshift({ tick: 0, usPerQuarter: 500000 });
  const segments: { tick: number; sec: number; secPerTick: number }[] = [];
  let sec = 0;
  for (let i = 0; i < tempos.length; i++) {
    const secPerTick = ticksPerSecondSmpte ? 1 / ticksPerSecondSmpte : tempos[i].usPerQuarter / 1e6 / division;
    if (i > 0) {
      const prev = segments[segments.length - 1];
      sec = prev.sec + (tempos[i].tick - prev.tick) * prev.secPerTick;
    }
    segments.push({ tick: tempos[i].tick, sec, secPerTick });
  }
  const toSec = (tick: number) => {
    let lo = 0;
    let hi = segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segments[mid].tick <= tick) lo = mid;
      else hi = mid - 1;
    }
    const s = segments[lo];
    return s.sec + (tick - s.tick) * s.secPerTick;
  };

  const raw: RawNote[] = notes.map(n => {
    const time = toSec(n.tick);
    return { midi: n.midi, time, duration: toSec(n.endTick) - time, velocity: n.velocity, track: n.track };
  });

  // Apply sustain per channel so each note rings as it would on the original instrument.
  const pedalByChannel = new Map<number, PedalEvent[]>();
  for (const p of pedals) {
    const list = pedalByChannel.get(p.channel) ?? [];
    list.push({ time: toSec(p.tick), down: p.down });
    pedalByChannel.set(p.channel, list);
  }
  for (const [channel, list] of pedalByChannel) {
    list.sort((a, b) => a.time - b.time);
    applyPedal(raw.filter((_, i) => notes[i].channel === channel), list);
  }
  const firstPedal = pedalByChannel.values().next().value ?? [];

  return makeSong(songName || title, trackNames, raw, firstPedal, 'file');
}
