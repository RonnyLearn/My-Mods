import { foldIntoPiano } from './notes';

export interface Note {
  midi: number;
  /** Start time in seconds. */
  time: number;
  /** How long the key is held, in seconds. */
  duration: number;
  /** When the sound stops, taking the sustain pedal into account. */
  end: number;
  /** 1..127 */
  velocity: number;
  track: number;
}

export interface PedalEvent {
  time: number;
  down: boolean;
}

export interface Song {
  title: string;
  tracks: { name: string }[];
  /** Sorted by time, then pitch. */
  notes: Note[];
  pedal: PedalEvent[];
  duration: number;
  /** Longest note duration, used to find visible notes quickly. */
  maxDuration: number;
  source: 'demo' | 'file' | 'recording';
}

export type RawNote = Omit<Note, 'end'> & { end?: number };

/**
 * Extends each note's sound until the sustain pedal is lifted.
 * `pedal` must be sorted by time.
 */
export function applyPedal(notes: RawNote[], pedal: PedalEvent[]): void {
  for (const n of notes) {
    const off = n.time + n.duration;
    let end = off;
    // Pedal state just before note-off (a pedal pressed at the same moment doesn't catch the note).
    let down = false;
    let i = 0;
    for (; i < pedal.length && pedal[i].time < off; i++) down = pedal[i].down;
    if (down) {
      end = Infinity;
      for (; i < pedal.length; i++) {
        if (!pedal[i].down) { end = pedal[i].time; break; }
      }
    }
    n.end = Math.max(n.end ?? off, end);
  }
}

/** Normalises notes into a playable Song: folds pitches, drops empty tracks, sorts. */
export function makeSong(
  title: string,
  trackNames: string[],
  raw: RawNote[],
  pedal: PedalEvent[],
  source: Song['source'],
): Song {
  const used = [...new Set(raw.map(n => n.track))].sort((a, b) => a - b);
  const remap = new Map(used.map((t, i) => [t, i]));
  const notes: Note[] = raw
    .map(n => {
      const end = n.end === undefined || !Number.isFinite(n.end) ? n.time + n.duration : n.end;
      return {
        midi: foldIntoPiano(n.midi),
        time: n.time,
        duration: Math.max(0.03, n.duration),
        end: Math.max(end, n.time + Math.max(0.03, n.duration)),
        velocity: Math.min(127, Math.max(1, Math.round(n.velocity))),
        track: remap.get(n.track)!,
      };
    })
    .sort((a, b) => a.time - b.time || a.midi - b.midi);

  let duration = 0;
  let maxDuration = 0;
  for (const n of notes) {
    duration = Math.max(duration, n.time + n.duration);
    maxDuration = Math.max(maxDuration, n.duration);
  }
  return {
    title,
    tracks: used.map((t, i) => ({ name: trackNames[t] || `Track ${i + 1}` })),
    notes,
    pedal: [...pedal].sort((a, b) => a.time - b.time),
    duration,
    maxDuration,
    source,
  };
}

/** Index of the first note whose start time is >= t. */
export function lowerBound(notes: Note[], t: number): number {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].time < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
