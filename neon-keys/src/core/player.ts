import { lowerBound, type Note, type Song } from '../music/song';

export type PlayMode = 'listen' | 'play' | 'wait';
export type Judgement = 'perfect' | 'great' | 'good' | 'miss';

export interface Stats {
  score: number;
  combo: number;
  maxCombo: number;
  perfect: number;
  great: number;
  good: number;
  miss: number;
  wrong: number;
}

const emptyStats = (): Stats => ({ score: 0, combo: 0, maxCombo: 0, perfect: 0, great: 0, good: 0, miss: 0, wrong: 0 });

/** Hit windows in real (not song) seconds. */
const WINDOW = { perfect: 0.06, great: 0.12, good: 0.2 };
const POINTS = { perfect: 100, great: 70, good: 40 };
/** In wait mode a key pressed this early still counts for the next chord. */
const WAIT_EARLY = 0.35;
const CHORD_SPREAD = 0.06;
const LOOKAHEAD = 0.12;
export const LEAD_IN = 2;

export interface PlayerOutput {
  schedule(note: Note, delaySec: number, lengthSec: number): void;
  stopScheduled(): void;
  onJudge(note: Note, judgement: Judgement): void;
  onEnd(): void;
}

export const NOTE_PENDING = 0;
export const NOTE_HIT = 1;
export const NOTE_MISSED = 2;

/**
 * Song transport: advances song time, schedules autoplayed notes for audio,
 * and judges the notes the user is supposed to play.
 */
export class Player {
  song: Song | null = null;
  time = 0;
  playing = false;
  speed = 1;
  mode: PlayMode = 'listen';
  /** Tracks the user plays themselves (in play/wait modes). */
  userTracks = new Set<number>();
  /** Per-note judging state (NOTE_*), indexed like song.notes. */
  state = new Uint8Array(0);
  stats = emptyStats();

  private nextToSchedule = 0;
  private missCursor = 0;
  private waitCursor = 0;

  constructor(private readonly out: PlayerOutput) {}

  load(song: Song) {
    this.song = song;
    this.userTracks = new Set(song.tracks.map((_, i) => i));
    this.state = new Uint8Array(song.notes.length);
    this.seek(-LEAD_IN);
  }

  unload() {
    this.pause();
    this.song = null;
  }

  isUserNote(n: Note): boolean {
    return this.mode !== 'listen' && this.userTracks.has(n.track);
  }

  play() {
    if (!this.song) return;
    if (this.time >= this.song.duration) this.seek(-LEAD_IN);
    this.playing = true;
  }

  pause() {
    this.playing = false;
    this.out.stopScheduled();
  }

  /** Jumps to a time; judging restarts from there. */
  seek(t: number) {
    if (!this.song) return;
    this.out.stopScheduled();
    this.time = Math.max(-LEAD_IN, Math.min(t, this.song.duration));
    const i = lowerBound(this.song.notes, this.time);
    this.nextToSchedule = i;
    this.missCursor = i;
    this.waitCursor = i;
    this.state.fill(NOTE_PENDING, i);
    if (this.time <= 0) this.stats = emptyStats();
  }

  resetStats() {
    this.stats = emptyStats();
  }

  get progress(): number {
    return this.song && this.song.duration > 0 ? Math.max(0, this.time) / this.song.duration : 0;
  }

  /** Song time the transport is frozen at while waiting for the user, or null. */
  private waitBarrier(): number | null {
    if (this.mode !== 'wait' || !this.song) return null;
    const notes = this.song.notes;
    while (this.waitCursor < notes.length) {
      const n = notes[this.waitCursor];
      if (this.isUserNote(n) && this.state[this.waitCursor] === NOTE_PENDING) return n.time;
      this.waitCursor++;
    }
    return null;
  }

  update(dt: number) {
    const song = this.song;
    if (!song || !this.playing) return;

    const barrier = this.waitBarrier();
    let next = this.time + dt * this.speed;
    if (barrier !== null && next > barrier) next = Math.max(this.time, barrier);
    this.time = next;

    // Schedule autoplayed notes slightly ahead for sample-accurate timing.
    const horizon = this.time + LOOKAHEAD * this.speed;
    const notes = song.notes;
    while (this.nextToSchedule < notes.length) {
      const n = notes[this.nextToSchedule];
      if (n.time > horizon) break;
      // In wait mode nothing at or past the barrier may sound before the user plays it.
      if (barrier !== null && n.time >= barrier) break;
      if (!this.isUserNote(n) && n.time >= this.time - 0.05) {
        this.out.schedule(n, Math.max(0, (n.time - this.time) / this.speed), (n.end - n.time) / this.speed);
      }
      this.nextToSchedule++;
    }

    if (this.mode === 'play') this.collectMisses();

    if (this.time >= song.duration + 0.5) {
      this.playing = false;
      this.out.onEnd();
    }
  }

  private collectMisses() {
    const notes = this.song!.notes;
    const limit = this.time - WINDOW.good * this.speed;
    while (this.missCursor < notes.length && notes[this.missCursor].time < limit) {
      const i = this.missCursor++;
      if (this.isUserNote(notes[i]) && this.state[i] === NOTE_PENDING) {
        this.state[i] = NOTE_MISSED;
        this.stats.miss++;
        this.stats.combo = 0;
        this.out.onJudge(notes[i], 'miss');
      }
    }
  }

  /** Called for every key the user presses. Returns the matched note, if any. */
  userPress(midi: number): Note | null {
    const song = this.song;
    if (!song || this.mode === 'listen' || !this.playing) return null;
    const notes = song.notes;

    if (this.mode === 'wait') {
      const barrier = this.waitBarrier();
      if (barrier === null) return null;
      const from = lowerBound(notes, barrier - 0.001);
      for (let i = from; i < notes.length && notes[i].time <= barrier + CHORD_SPREAD; i++) {
        const n = notes[i];
        if (n.midi === midi && this.isUserNote(n) && this.state[i] === NOTE_PENDING && this.time >= barrier - WAIT_EARLY) {
          this.state[i] = NOTE_HIT;
          this.registerHit(n, 'perfect');
          return n;
        }
      }
      this.registerWrong();
      return null;
    }

    const win = WINDOW.good * this.speed;
    let best = -1;
    let bestDelta = Infinity;
    for (let i = lowerBound(notes, this.time - win); i < notes.length && notes[i].time <= this.time + win; i++) {
      const n = notes[i];
      if (n.midi !== midi || !this.isUserNote(n) || this.state[i] !== NOTE_PENDING) continue;
      const delta = Math.abs(n.time - this.time);
      if (delta < bestDelta) { bestDelta = delta; best = i; }
    }
    if (best < 0) {
      this.registerWrong();
      return null;
    }
    const real = bestDelta / this.speed;
    const j: Judgement = real <= WINDOW.perfect ? 'perfect' : real <= WINDOW.great ? 'great' : 'good';
    this.state[best] = NOTE_HIT;
    this.registerHit(notes[best], j);
    return notes[best];
  }

  private registerHit(n: Note, j: Exclude<Judgement, 'miss'>) {
    const s = this.stats;
    s[j]++;
    s.combo++;
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    s.score += Math.round(POINTS[j] * (1 + Math.min(s.combo, 50) / 50));
    this.out.onJudge(n, j);
  }

  private registerWrong() {
    this.stats.wrong++;
    if (this.mode === 'play') this.stats.combo = 0;
  }

  /** 0..1, counts misses and (at half weight) wrong keys. */
  accuracy(): number {
    const s = this.stats;
    const hits = s.perfect + s.great * 0.8 + s.good * 0.5;
    const total = s.perfect + s.great + s.good + s.miss + s.wrong * 0.5;
    return total ? hits / total : 1;
  }
}
