import { isBlack, PIANO_HI, PIANO_LO } from '../music/notes';

export interface KeyRect {
  midi: number;
  x: number;
  w: number;
  black: boolean;
}

/** Nudges black keys the way a real keyboard does (fraction of black key width). */
const BLACK_SHIFT: Record<number, number> = { 1: -0.12, 3: 0.12, 6: -0.15, 8: 0, 10: 0.15 };

/** Pixel layout of a piano keyboard spanning [lo, hi]. */
export class KeyboardGeometry {
  lo = PIANO_LO;
  hi = PIANO_HI;
  x0 = 0;
  width = 0;
  top = 0;
  height = 0;
  blackHeight = 0;
  whiteWidth = 0;
  private keys: KeyRect[] = [];

  layout(lo: number, hi: number, x0: number, width: number, top: number, height: number) {
    // Always start and end on white keys.
    if (isBlack(lo)) lo--;
    if (isBlack(hi)) hi++;
    Object.assign(this, { lo, hi, x0, width, top, height, blackHeight: height * 0.62 });

    let whites = 0;
    for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites++;
    const ww = width / whites;
    const bw = ww * 0.6;
    this.whiteWidth = ww;
    this.keys = [];
    let wi = 0;
    for (let m = lo; m <= hi; m++) {
      if (isBlack(m)) {
        const boundary = x0 + wi * ww;
        this.keys.push({ midi: m, x: boundary - bw / 2 + BLACK_SHIFT[m % 12] * bw, w: bw, black: true });
      } else {
        this.keys.push({ midi: m, x: x0 + wi * ww, w: ww, black: false });
        wi++;
      }
    }
  }

  get whiteKeys() { return this.keys.filter(k => !k.black); }
  get blackKeys() { return this.keys.filter(k => k.black); }

  rect(midi: number): KeyRect | null {
    return midi >= this.lo && midi <= this.hi ? this.keys[midi - this.lo] : null;
  }

  /** Key under a point, or null. Black keys win where they overlap white keys. */
  hitTest(x: number, y: number): number | null {
    if (y < this.top || y > this.top + this.height) return null;
    if (y <= this.top + this.blackHeight) {
      const b = this.keys.find(k => k.black && x >= k.x && x < k.x + k.w);
      if (b) return b.midi;
    }
    const w = this.keys.find(k => !k.black && x >= k.x && x < k.x + k.w);
    return w ? w.midi : null;
  }
}

/** Number of white keys between two notes (inclusive). */
export function whiteKeyCount(lo: number, hi: number): number {
  let n = 0;
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) n++;
  return n;
}

/**
 * Picks a visible range: the full 88 keys when they fit, otherwise the
 * widest window around `center` with keys at least `minWhite` px wide.
 */
export function fitRange(width: number, center: number, minWhite = 24): [number, number] {
  const maxWhites = Math.max(15, Math.floor(width / minWhite));
  if (maxWhites >= 52) return [PIANO_LO, PIANO_HI];
  let lo = center;
  let hi = center;
  while (whiteKeyCount(lo, hi) < maxWhites) {
    if (lo > PIANO_LO) lo--;
    if (whiteKeyCount(lo, hi) >= maxWhites) break;
    if (hi < PIANO_HI) hi++;
    if (lo === PIANO_LO && hi === PIANO_HI) break;
  }
  if (isBlack(lo)) lo++;
  if (isBlack(hi)) hi--;
  return [lo, hi];
}
