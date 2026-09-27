import { parseNote } from './notes';
import { makeSong, type RawNote, type Song } from './song';

/**
 * A tiny text notation for the built-in demo songs.
 *
 *   "E5:.5"        E5 for half a beat
 *   "C4+E4+G4:1"   a chord for one beat
 *   "A2:.25:1.5"   advance a quarter beat, but let the note ring for 1.5 beats
 *   "R:1"          a one-beat rest
 *   "|"            bar line (ignored, for readability)
 */
export function parseVoice(src: string, bpm: number, track: number, velocity = 80): RawNote[] {
  const beat = 60 / bpm;
  const notes: RawNote[] = [];
  let t = 0;
  for (const token of src.trim().split(/\s+/)) {
    if (token === '|' || token === '') continue;
    const [pitches, advStr, holdStr] = token.split(':');
    const adv = Number(advStr ?? '1');
    const hold = holdStr === undefined ? adv : Number(holdStr);
    if (!Number.isFinite(adv) || !Number.isFinite(hold)) throw new Error(`Invalid token: ${token}`);
    if (pitches !== 'R') {
      for (const p of pitches.split('+')) {
        notes.push({ midi: parseNote(p), time: t * beat, duration: hold * beat * 0.95, velocity, track });
      }
    }
    t += adv;
  }
  return notes;
}

/** Total length of a voice in beats. */
export function voiceBeats(src: string): number {
  return src.trim().split(/\s+/)
    .filter(tok => tok && tok !== '|')
    .reduce((sum, tok) => sum + Number(tok.split(':')[1] ?? '1'), 0);
}

export interface ScoreDef {
  id: string;
  title: string;
  composer: string;
  bpm: number;
  level: 1 | 2 | 3;
  voices: { name: string; src: string; velocity?: number }[];
}

export function scoreToSong(def: ScoreDef): Song {
  const notes = def.voices.flatMap((v, i) => parseVoice(v.src, def.bpm, i, v.velocity));
  return makeSong(def.title, def.voices.map(v => v.name), notes, [], 'demo');
}
