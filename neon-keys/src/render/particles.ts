/** Pre-rendered glow sprites per hue bucket, drawn with additive blending. */
const HUE_STEP = 10;
const SPRITE = 48;
const sprites = new Map<number, HTMLCanvasElement>();

export function glowSprite(hue: number): HTMLCanvasElement {
  const bucket = ((Math.round(hue / HUE_STEP) * HUE_STEP) % 360 + 360) % 360;
  let c = sprites.get(bucket);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = SPRITE;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
    grad.addColorStop(0, `hsla(${bucket},100%,92%,1)`);
    grad.addColorStop(0.18, `hsla(${bucket},100%,70%,0.8)`);
    grad.addColorStop(0.45, `hsla(${bucket},100%,55%,0.22)`);
    grad.addColorStop(1, `hsla(${bucket},100%,50%,0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, SPRITE, SPRITE);
    sprites.set(bucket, c);
  }
  return c;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; hue: number;
}

const MAX_PARTICLES = 1400;

export class Particles {
  private list: Particle[] = [];
  private carry = new Map<number, number>();

  burst(x: number, y: number, hue: number, count: number, power = 1) {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const v = (80 + Math.random() * 260) * power;
      this.add({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 0, max: 0.5 + Math.random() * 0.7, size: 6 + Math.random() * 14, hue: hue + (Math.random() - 0.5) * 30,
      });
    }
  }

  /** Continuous sparks from a held key; `id` keeps fractional emission per key. */
  stream(id: number, x: number, width: number, y: number, hue: number, rate: number, dt: number) {
    const n = (this.carry.get(id) ?? 0) + rate * dt;
    const whole = Math.floor(n);
    this.carry.set(id, n - whole);
    for (let i = 0; i < whole; i++) {
      this.add({
        x: x + (Math.random() - 0.5) * width, y,
        vx: (Math.random() - 0.5) * 30, vy: -(60 + Math.random() * 140),
        life: 0, max: 0.6 + Math.random() * 0.9, size: 4 + Math.random() * 10, hue: hue + (Math.random() - 0.5) * 20,
      });
    }
  }

  private add(p: Particle) {
    if (this.list.length >= MAX_PARTICLES) this.list.shift();
    this.list.push(p);
  }

  /** `lift` scales upward drift, so sparks move faster when the music is busier. */
  update(dt: number, lift: number) {
    for (const p of this.list) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt * lift;
      p.vx *= 1 - dt * 1.5;
      p.vy = p.vy * (1 - dt * 0.8) - 20 * dt;
    }
    this.list = this.list.filter(p => p.life < p.max);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.list) {
      const k = 1 - p.life / p.max;
      const s = p.size * (0.4 + 0.6 * k);
      ctx.globalAlpha = k;
      ctx.drawImage(glowSprite(p.hue), p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.restore();
  }

  clear() { this.list = []; }
}
