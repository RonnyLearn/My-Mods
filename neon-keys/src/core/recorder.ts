import { applyPedal, makeSong, type PedalEvent, type RawNote, type Song } from '../music/song';

/** Records a live performance (keys + sustain pedal) into a Song. */
export class Recorder {
  recording = false;
  private startTime = 0;
  private notes: RawNote[] = [];
  private open = new Map<number, RawNote>();
  private pedal: PedalEvent[] = [];

  start(now: number) {
    this.recording = true;
    this.startTime = now;
    this.notes = [];
    this.open.clear();
    this.pedal = [];
  }

  noteOn(midi: number, velocity: number, now: number) {
    if (!this.recording) return;
    this.noteOff(midi, now);
    const n: RawNote = { midi, time: now - this.startTime, duration: 0, velocity, track: 0 };
    this.open.set(midi, n);
    this.notes.push(n);
  }

  noteOff(midi: number, now: number) {
    const n = this.open.get(midi);
    if (!n) return;
    n.duration = now - this.startTime - n.time;
    this.open.delete(midi);
  }

  setSustain(down: boolean, now: number) {
    if (this.recording) this.pedal.push({ time: now - this.startTime, down });
  }

  /** Stops recording; returns null if nothing was played. Leading silence is trimmed. */
  stop(now: number, title: string): Song | null {
    if (!this.recording) return null;
    this.recording = false;
    for (const midi of [...this.open.keys()]) this.noteOff(midi, now);
    if (!this.notes.length) return null;

    const shift = Math.max(0, this.notes[0].time - 0.5);
    for (const n of this.notes) n.time -= shift;
    const pedal = this.pedal
      .map(p => ({ time: Math.max(0, p.time - shift), down: p.down }))
      .sort((a, b) => a.time - b.time);
    applyPedal(this.notes, pedal);
    return makeSong(title, ['Piano'], this.notes, pedal, 'recording');
  }
}
