import type { Player } from '../core/player';
import { NOTE_HIT, NOTE_MISSED } from '../core/player';
import type { ColorMode, LabelMode, Settings } from '../core/settings';
import { midiToQwertyLabel } from '../input/qwerty';
import { isBlack, noteName, PIANO_HI, PIANO_LO } from '../music/notes';
import { lowerBound, type Song } from '../music/song';
import { KeyboardGeometry } from './geometry';
import { glowSprite, Particles } from './particles';

export interface HeldKey {
  hue: number;
  velocity: number;
}

export interface FrameView {
  song: Song | null;
  player: Player;
  settings: Settings;
  /** Keys held by the user right now. */
  userKeys: Map<number, HeldKey>;
  /** 0..~3, grows with playing activity. */
  energy: number;
  /** Audio output level (RMS). */
  level: number;
}

const TRACK_HUES = [190, 318, 45, 130, 265, 20, 160, 350];

export function noteHue(mode: ColorMode, midi: number, track = 0): number {
  if (mode === 'mono') return 190;
  if (mode === 'tracks') return TRACK_HUES[track % TRACK_HUES.length];
  return (185 + ((midi - PIANO_LO) / (PIANO_HI - PIANO_LO)) * 250) % 360;
}

export function labelFor(mode: LabelMode, midi: number, octave: number): string {
  if (mode === 'qwerty') return midiToQwertyLabel(midi, octave);
  if (mode === 'notes') return noteName(midi);
  return '';
}

interface RisingBar { midi: number; hue: number; start: number; end: number | null; velocity: number }
interface Popup { x: number; y: number; text: string; hue: number; t: number }

/** How many seconds of music fit between the top of the screen and the keys at zoom 1. */
const WINDOW_SECONDS = 3;
const RISE_SPEED = 170; // px/s for free-play bars

export class Renderer {
  readonly geo = new KeyboardGeometry();
  private readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private clock = 0;
  private bg!: CanvasGradient;
  private keyCache: HTMLCanvasElement | null = null;
  private keyCacheKey = '';
  private readonly particles = new Particles();
  private bars: RisingBar[] = [];
  private popups: Popup[] = [];
  private readonly dust = Array.from({ length: 80 }, () => ({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8 }));
  private range: [number, number] = [PIANO_LO, PIANO_HI];

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  get width() { return this.w; }

  setRange(lo: number, hi: number) {
    this.range = [lo, hi];
    this.layout();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.layout();
  }

  private layout() {
    const [lo, hi] = this.range;
    let whites = 0;
    for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites++;
    const kbH = Math.max(70, Math.min((this.w / whites) * 5.2, this.h * 0.26, 220));
    this.geo.layout(lo, hi, 0, this.w, this.h - kbH, kbH);
    const g = this.ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, '#07051a');
    g.addColorStop(0.7, '#05040f');
    g.addColorStop(1, '#0b0620');
    this.bg = g;
    this.keyCache = null;
  }

  // --- Events from the app ---------------------------------------------------

  userPress(midi: number, hue: number, velocity: number, rising: boolean, particles: boolean) {
    const r = this.geo.rect(midi);
    if (!r) return;
    if (rising) this.bars.push({ midi, hue, start: this.clock, end: null, velocity });
    if (particles) this.particles.burst(r.x + r.w / 2, this.geo.top, hue, 6 + Math.round(velocity / 10), 0.6 + velocity / 127);
  }

  userRelease(midi: number) {
    for (const b of this.bars) if (b.midi === midi && b.end === null) b.end = this.clock;
  }

  popup(midi: number, text: string, hue: number) {
    const r = this.geo.rect(midi);
    if (r) this.popups.push({ x: r.x + r.w / 2, y: this.geo.top - 24, text, hue, t: 0 });
  }

  clearEffects() {
    this.bars = [];
    this.popups = [];
    this.particles.clear();
  }

  // --- Frame ---------------------------------------------------------------------

  frame(dt: number, v: FrameView) {
    this.clock += dt;
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    const lift = 1 + Math.min(2.5, v.energy * 0.6);
    this.drawBackground(v, lift, dt);

    // Keys lit by the song (autoplayed parts) and upcoming notes to hint.
    const lit = new Map<number, HeldKey>();
    const hints = new Map<number, number>();
    if (v.song) this.drawSong(v, lit, hints);
    for (const [m, k] of v.userKeys) lit.set(m, k);

    this.drawBars();
    this.drawBeams(lit);

    if (v.settings.particles) {
      for (const [m, k] of v.userKeys) {
        const r = this.geo.rect(m);
        if (r) this.particles.stream(m, r.x + r.w / 2, r.w * 0.6, this.geo.top, k.hue, 18 + k.velocity * 0.35, dt);
      }
    }
    this.particles.update(dt, lift);
    this.particles.draw(ctx);

    this.drawHitLine(lit);
    this.drawKeyboard(v, lit, hints);
    this.drawPopups(dt);
  }

  private drawBackground(v: FrameView, lift: number, dt: number) {
    const { ctx, w, h } = this;
    const top = this.geo.top;
    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, w, h);

    const hue = (200 + this.clock * 8) % 360;
    const glow = Math.min(1, 0.25 + v.level * 3 + v.energy * 0.12);
    const g = ctx.createRadialGradient(w / 2, top + 40, 0, w / 2, top + 40, Math.max(w, h) * 0.7);
    g.addColorStop(0, `hsla(${hue},90%,55%,${0.18 * glow})`);
    g.addColorStop(0.5, `hsla(${(hue + 60) % 360},90%,45%,${0.07 * glow})`);
    g.addColorStop(1, 'hsla(0,0%,0%,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, top);

    // Octave guides at every C.
    for (let m = this.geo.lo; m <= this.geo.hi; m++) {
      if (m % 12 !== 0) continue;
      const r = this.geo.rect(m)!;
      ctx.fillStyle = m === 60 ? 'rgba(140,200,255,0.09)' : 'rgba(140,200,255,0.045)';
      ctx.fillRect(Math.round(r.x), 0, 1, top);
    }

    // Drifting dust, faster when the music is busy.
    for (const d of this.dust) {
      d.y -= (0.01 + 0.02 * d.z) * lift * dt;
      if (d.y < 0) { d.y += 1; d.x = Math.random(); }
      ctx.fillStyle = `hsla(${hue},80%,80%,${0.12 + d.z * 0.3})`;
      const s = 1 + d.z * 1.5;
      ctx.fillRect(d.x * w, d.y * top, s, s);
    }
  }

  private drawSong(v: FrameView, lit: Map<number, HeldKey>, hints: Map<number, number>) {
    const song = v.song!;
    const { player, settings } = v;
    const { ctx } = this;
    const top = this.geo.top;
    const t = player.time;
    const pps = (top / WINDOW_SECONDS) * settings.noteSpeed;
    const windowSec = top / pps;
    const notes = song.notes;
    const labelMode = settings.labels;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.w, top);
    ctx.clip();
    for (let i = lowerBound(notes, t - song.maxDuration - 0.1); i < notes.length; i++) {
      const n = notes[i];
      if (n.time > t + windowSec) break;
      if (n.time + n.duration < t) continue;
      const r = this.geo.rect(n.midi);
      if (!r) continue;

      const user = player.isUserNote(n);
      const state = player.state[i];
      const hue = noteHue(settings.colors, n.midi, n.track);
      const sounding = n.time <= t && t < n.time + n.duration;
      if (sounding && !user) lit.set(n.midi, { hue, velocity: n.velocity });
      if (user && state === 0 && n.time - t < 0.6 && n.time - t > -0.2) hints.set(n.midi, hue);

      const yBottom = top - (n.time - t) * pps;
      const yTop = yBottom - n.duration * pps;
      const inset = r.black ? 1 : Math.max(1, r.w * 0.08);
      const x = r.x + inset;
      const w = r.w - inset * 2;
      const hgt = Math.max(4, yBottom - yTop - 1);
      const radius = Math.min(6, w / 3, hgt / 2);

      let alpha = 1;
      let light = 58;
      let sat = 95;
      if (player.mode !== 'listen' && !user) alpha = 0.35; // accompaniment
      if (state === NOTE_HIT) light = 70;
      if (state === NOTE_MISSED) { sat = 10; light = 35; }

      if (sounding || state === NOTE_HIT) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5 * alpha;
        const s = w * 2.2;
        ctx.drawImage(glowSprite(hue), x + w / 2 - s / 2, Math.min(yBottom, top) - s / 2, s, s);
        ctx.restore();
      }

      ctx.globalAlpha = alpha;
      const g = ctx.createLinearGradient(0, yTop, 0, yBottom);
      g.addColorStop(0, `hsla(${hue},${sat}%,${light - 22}%,0.85)`);
      g.addColorStop(1, `hsla(${hue},${sat}%,${light}%,1)`);
      ctx.fillStyle = g;
      ctx.shadowColor = `hsla(${hue},100%,60%,${sounding ? 0.9 : 0.5})`;
      ctx.shadowBlur = sounding ? 18 : 8;
      roundRect(ctx, x, yTop, w, hgt, radius);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = state === NOTE_MISSED ? 'rgba(255,70,90,0.9)' : `hsla(${hue},100%,85%,0.55)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      const label = labelFor(labelMode, n.midi, settings.qwertyOctave);
      if (label && hgt > 16 && w > 9) {
        ctx.fillStyle = 'rgba(8,6,20,0.85)';
        ctx.font = `700 ${Math.round(Math.min(13, w * 0.62))}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(labelMode === 'notes' ? noteName(n.midi).replace(/-?\d+$/, '') : label, x + w / 2, yBottom - 3);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private drawBars() {
    const { ctx } = this;
    const top = this.geo.top;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.w, top);
    ctx.clip();
    this.bars = this.bars.filter(b => b.end === null || top - (this.clock - b.end) * RISE_SPEED > -20);
    for (const b of this.bars) {
      const r = this.geo.rect(b.midi);
      if (!r) continue;
      const yTop = top - (this.clock - b.start) * RISE_SPEED;
      const yBottom = b.end === null ? top : top - (this.clock - b.end) * RISE_SPEED;
      const inset = r.black ? 1 : Math.max(1, r.w * 0.1);
      const x = r.x + inset;
      const w = r.w - inset * 2;
      const hgt = Math.max(3, yBottom - yTop);
      const fade = Math.max(0.15, Math.min(1, yBottom / top + 0.2));
      const light = 50 + (b.velocity / 127) * 18;
      const g = ctx.createLinearGradient(0, yTop, 0, yBottom);
      g.addColorStop(0, `hsla(${b.hue},95%,${light - 20}%,${0.5 * fade})`);
      g.addColorStop(1, `hsla(${b.hue},95%,${light}%,${fade})`);
      ctx.fillStyle = g;
      ctx.shadowColor = `hsla(${b.hue},100%,60%,${fade})`;
      ctx.shadowBlur = 16;
      roundRect(ctx, x, yTop, w, hgt, Math.min(6, w / 3));
      ctx.fill();
    }
    ctx.restore();
  }

  private drawBeams(lit: Map<number, HeldKey>) {
    const { ctx } = this;
    const top = this.geo.top;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [m, k] of lit) {
      const r = this.geo.rect(m);
      if (!r) continue;
      const len = 70 + (k.velocity / 127) * 140;
      const g = ctx.createLinearGradient(0, top, 0, top - len);
      g.addColorStop(0, `hsla(${k.hue},100%,65%,0.35)`);
      g.addColorStop(1, `hsla(${k.hue},100%,50%,0)`);
      ctx.fillStyle = g;
      ctx.fillRect(r.x, top - len, r.w, len);
    }
    ctx.restore();
  }

  private drawHitLine(lit: Map<number, HeldKey>) {
    const { ctx, w } = this;
    const top = this.geo.top;
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#39e6ff');
    g.addColorStop(0.5, '#8f6bff');
    g.addColorStop(1, '#ff3fd8');
    ctx.save();
    ctx.shadowColor = '#7fb8ff';
    ctx.shadowBlur = 14;
    ctx.fillStyle = g;
    ctx.fillRect(0, top - 2, w, 3);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [m, k] of lit) {
      const r = this.geo.rect(m);
      if (!r) continue;
      const s = Math.max(40, r.w * 3.5);
      ctx.globalAlpha = 0.6 + (k.velocity / 127) * 0.4;
      ctx.drawImage(glowSprite(k.hue), r.x + r.w / 2 - s / 2, top - s / 2, s, s);
    }
    ctx.restore();
  }

  private drawKeyboard(v: FrameView, lit: Map<number, HeldKey>, hints: Map<number, number>) {
    const { ctx } = this;
    const geo = this.geo;
    const { labels, qwertyOctave } = v.settings;
    const cacheKey = `${this.w}x${this.h}@${this.dpr}|${geo.lo}-${geo.hi}|${labels}|${qwertyOctave}`;
    if (!this.keyCache || this.keyCacheKey !== cacheKey) {
      this.keyCache = this.renderWhiteKeys(labels, qwertyOctave);
      this.keyCacheKey = cacheKey;
    }
    ctx.drawImage(this.keyCache, 0, geo.top, this.w, geo.height);

    const top = geo.top;
    const h = geo.height;
    const pulse = 0.5 + 0.5 * Math.sin(this.clock * 8);

    for (const k of geo.whiteKeys) {
      const on = lit.get(k.midi);
      const hint = hints.get(k.midi);
      if (on) {
        const g = ctx.createLinearGradient(0, top, 0, top + h);
        g.addColorStop(0, `hsl(${on.hue},95%,60%)`);
        g.addColorStop(1, `hsl(${on.hue},95%,78%)`);
        ctx.fillStyle = g;
        roundRect(ctx, k.x + 1, top + 2, k.w - 2, h - 3, 4);
        ctx.fill();
        this.keyLabel(k.midi, k.x, k.w, top + h - 10, labels, qwertyOctave, 'rgba(10,8,30,0.9)');
      } else if (hint !== undefined) {
        ctx.fillStyle = `hsla(${hint},100%,60%,${0.25 + 0.25 * pulse})`;
        roundRect(ctx, k.x + 1, top + 2, k.w - 2, h - 3, 4);
        ctx.fill();
      }
    }

    for (const k of geo.blackKeys) {
      const on = lit.get(k.midi);
      const hint = hints.get(k.midi);
      const bh = geo.blackHeight;
      const g = ctx.createLinearGradient(0, top, 0, top + bh);
      if (on) {
        g.addColorStop(0, `hsl(${on.hue},90%,45%)`);
        g.addColorStop(1, `hsl(${on.hue},95%,62%)`);
      } else {
        g.addColorStop(0, '#15142a');
        g.addColorStop(0.85, '#232240');
        g.addColorStop(1, '#2d2c52');
      }
      ctx.fillStyle = g;
      roundRect(ctx, k.x, top, k.w, bh, 3);
      ctx.fill();
      if (!on) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(k.x + 2, top + bh - 7, k.w - 4, 3);
      }
      if (hint !== undefined && !on) {
        ctx.strokeStyle = `hsla(${hint},100%,65%,${0.5 + 0.5 * pulse})`;
        ctx.lineWidth = 2;
        roundRect(ctx, k.x + 1, top + 1, k.w - 2, bh - 2, 3);
        ctx.stroke();
      }
      this.keyLabel(k.midi, k.x, k.w, top + bh - 10, labels, qwertyOctave, on ? 'rgba(10,8,30,0.9)' : 'rgba(200,210,255,0.75)');
    }

    // Soft shadow under the hit line.
    const s = ctx.createLinearGradient(0, top, 0, top + 10);
    s.addColorStop(0, 'rgba(0,0,0,0.45)');
    s.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = s;
    ctx.fillRect(0, top, this.w, 10);
  }

  /** Static white keys (and their labels) are drawn once into an offscreen canvas. */
  private renderWhiteKeys(labels: LabelMode, octave: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = Math.round(this.w * this.dpr);
    c.height = Math.round(this.geo.height * this.dpr);
    const g = c.getContext('2d')!;
    g.scale(this.dpr, this.dpr);
    const h = this.geo.height;
    g.fillStyle = '#0a0918';
    g.fillRect(0, 0, this.w, h);
    for (const k of this.geo.whiteKeys) {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#c9cde4');
      grad.addColorStop(0.12, '#eef0fb');
      grad.addColorStop(1, '#f9faff');
      g.fillStyle = grad;
      roundRect(g, k.x + 1, 2, k.w - 2, h - 3, 4);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.06)';
      g.fillRect(k.x + 1, h - 8, k.w - 2, 7);
      const label = labelFor(labels, k.midi, octave);
      const show = labels === 'notes' ? k.midi % 12 === 0 || k.w > 26 : label !== '';
      if (show && k.w > 9) {
        g.fillStyle = k.midi === 60 ? '#6a4dff' : 'rgba(40,40,80,0.75)';
        g.font = `600 ${Math.round(Math.min(12, k.w * 0.5))}px ui-sans-serif, system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'bottom';
        g.fillText(label, k.x + k.w / 2, h - 10);
      }
    }
    return c;
  }

  private keyLabel(midi: number, x: number, w: number, y: number, mode: LabelMode, octave: number, color: string) {
    const label = labelFor(mode, midi, octave);
    if (!label || w < 9 || (mode === 'notes' && isBlack(midi) && w < 22)) return;
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.font = `600 ${Math.round(Math.min(11, w * 0.55))}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, x + w / 2, y);
  }

  private drawPopups(dt: number) {
    const { ctx } = this;
    this.popups = this.popups.filter(p => (p.t += dt) < 0.7);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 14px ui-sans-serif, system-ui, sans-serif';
    for (const p of this.popups) {
      ctx.globalAlpha = 1 - p.t / 0.7;
      ctx.shadowColor = `hsl(${p.hue},100%,60%)`;
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#fff';
      ctx.fillText(p.text, p.x, p.y - p.t * 50);
    }
    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
