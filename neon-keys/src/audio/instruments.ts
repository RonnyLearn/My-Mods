import { midiToFreq } from '../music/notes';

export interface Voice {
  /** Starts the release phase (key/pedal up) at the given audio time. */
  release(when: number): void;
  /** Silences the voice almost immediately (voice stealing, stop button). */
  stop(): void;
  readonly ended: boolean;
}

export interface Instrument {
  readonly ready: boolean;
  start(midi: number, velocity: number, when: number, out: AudioNode): Voice;
}

/** Shared envelope/voice plumbing: a gain node fed by one or more sources. */
class BasicVoice implements Voice {
  ended = false;
  private released = false;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly gain: GainNode,
    private readonly sources: AudioScheduledSourceNode[],
    private readonly releaseTau: number,
  ) {
    sources[0].onended = () => { this.ended = true; };
  }

  release(when: number) {
    if (this.released) return;
    this.released = true;
    const t = Math.max(when, this.ctx.currentTime);
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setTargetAtTime(0, t, this.releaseTau);
    this.stopAt(t + this.releaseTau * 8);
  }

  stop() {
    const t = this.ctx.currentTime;
    this.released = true;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setTargetAtTime(0, t, 0.015);
    this.stopAt(t + 0.1);
  }

  private stopAt(t: number) {
    for (const s of this.sources) {
      try { s.stop(t); } catch { /* not started or already stopped */ }
    }
  }
}

// ---------------------------------------------------------------------------
// Sampled grand piano
// ---------------------------------------------------------------------------

/** Salamander samples exist for every minor third: A0, C1, D#1, F#1, ... C8. */
export const SAMPLE_NOTES = Array.from({ length: 30 }, (_, i) => 21 + i * 3);

export function sampleFileName(midi: number): string {
  const names: Record<number, string> = { 9: 'A', 0: 'C', 3: 'Ds', 6: 'Fs' };
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}.mp3`;
}

interface Sample { buffer: AudioBuffer; offset: number }

interface Layer {
  id: string;
  /** Velocity the layer was recorded at, used to scale loudness. */
  refVelocity: number;
  samples: Map<number, Sample>;
}

export class SampledPiano implements Instrument {
  private readonly layers: Layer[] = [
    { id: 'v12', refVelocity: 100, samples: new Map() },
    { id: 'v5', refVelocity: 44, samples: new Map() },
  ];

  constructor(private readonly ctx: BaseAudioContext, private readonly url: (layer: string, file: string) => string) {}

  get ready() { return this.layers[0].samples.size === SAMPLE_NOTES.length; }

  /** Loads the main layer first (reporting progress), then the soft layer in the background. */
  async load(onProgress: (loaded: number, total: number) => void): Promise<void> {
    await this.loadLayer(this.layers[0], onProgress);
    this.loadLayer(this.layers[1], () => {}).catch(() => { /* optional layer */ });
  }

  private async loadLayer(layer: Layer, onProgress: (loaded: number, total: number) => void) {
    let loaded = 0;
    const queue = [...SAMPLE_NOTES].sort((a, b) => Math.abs(a - 64) - Math.abs(b - 64)); // middle first
    const worker = async () => {
      for (let midi = queue.shift(); midi !== undefined; midi = queue.shift()) {
        const res = await fetch(this.url(layer.id, sampleFileName(midi)));
        if (!res.ok) throw new Error(`Sample ${midi}: HTTP ${res.status}`);
        const buffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
        layer.samples.set(midi, { buffer, offset: leadingSilence(buffer) });
        onProgress(++loaded, SAMPLE_NOTES.length);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  }

  start(midi: number, velocity: number, when: number, out: AudioNode): Voice {
    const soft = this.layers[1];
    const layer = velocity < 60 && soft.samples.size === SAMPLE_NOTES.length ? soft : this.layers[0];
    const [root, sample] = nearest(layer.samples, midi);

    const src = this.ctx.createBufferSource();
    src.buffer = sample.buffer;
    src.playbackRate.value = Math.pow(2, (midi - root) / 12);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = layer === soft ? 18000 : 900 + 19000 * Math.pow(velocity / 127, 2);

    const pan = this.ctx.createStereoPanner();
    pan.pan.value = Math.max(-0.4, Math.min(0.4, (midi - 64) / 64 * 0.4));

    const gain = this.ctx.createGain();
    gain.gain.value = Math.min(2.2, Math.pow(velocity / layer.refVelocity, 1.3)) * 0.9;

    src.connect(filter).connect(pan).connect(gain).connect(out);
    src.start(when, sample.offset);

    // Real pianos have no dampers on the top ~1.5 octaves: those keep ringing.
    const releaseTau = midi >= 89 ? 1.2 : 0.06 + ((108 - midi) / 87) * 0.14;
    return new BasicVoice(this.ctx, gain, [src], releaseTau);
  }
}

function nearest(samples: Map<number, Sample>, midi: number): [number, Sample] {
  for (let d = 0; d < 88; d++) {
    const below = samples.get(midi - d);
    if (below) return [midi - d, below];
    const above = samples.get(midi + d);
    if (above) return [midi + d, above];
  }
  throw new Error('No samples loaded');
}

/** MP3 decoders add a little silence at the start; skip it to keep latency low. */
function leadingSilence(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  const limit = Math.min(data.length, Math.floor(buffer.sampleRate * 0.2));
  for (let i = 0; i < limit; i++) {
    if (Math.abs(data[i]) > 0.003) return Math.max(0, i - 32) / buffer.sampleRate;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Synthesised instruments (also used while samples are loading or offline)
// ---------------------------------------------------------------------------

export class SynthPiano implements Instrument {
  readonly ready = true;
  private readonly wave: PeriodicWave;

  constructor(private readonly ctx: BaseAudioContext) {
    const real = new Float32Array([0, 1, 0.45, 0.25, 0.14, 0.08, 0.05, 0.03, 0.015]);
    this.wave = ctx.createPeriodicWave(real, new Float32Array(real.length));
  }

  start(midi: number, velocity: number, when: number, out: AudioNode): Voice {
    const f = midiToFreq(midi);
    const v = velocity / 127;
    const osc = this.ctx.createOscillator();
    osc.setPeriodicWave(this.wave);
    osc.frequency.value = f;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(16000, f * (4 + 10 * v)), when);
    filter.frequency.setTargetAtTime(Math.max(f * 1.5, 300), when, 0.4);
    const gain = this.ctx.createGain();
    const decay = Math.max(0.5, Math.min(4, 2.2 * Math.sqrt(262 / f)));
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.32 * v, when + 0.004);
    gain.gain.setTargetAtTime(0, when + 0.004, decay);
    osc.connect(filter).connect(gain).connect(out);
    osc.start(when);
    osc.stop(when + decay * 7);
    return new BasicVoice(this.ctx, gain, [osc], midi >= 89 ? 0.8 : 0.1);
  }
}

/** Two-operator FM electric piano. */
export class ElectricPiano implements Instrument {
  readonly ready = true;
  constructor(private readonly ctx: BaseAudioContext) {}

  start(midi: number, velocity: number, when: number, out: AudioNode): Voice {
    const f = midiToFreq(midi);
    const v = velocity / 127;
    const carrier = this.ctx.createOscillator();
    carrier.frequency.value = f;
    const mod = this.ctx.createOscillator();
    mod.frequency.value = f;
    const modGain = this.ctx.createGain();
    modGain.gain.setValueAtTime(f * (0.6 + 2.6 * v), when);
    modGain.gain.setTargetAtTime(f * 0.25, when, 0.35);
    mod.connect(modGain).connect(carrier.frequency);

    // Metallic "tine" attack.
    const tine = this.ctx.createOscillator();
    tine.frequency.value = f * 7.02;
    const tineGain = this.ctx.createGain();
    tineGain.gain.setValueAtTime(0.06 * v, when);
    tineGain.gain.setTargetAtTime(0, when, 0.05);

    const gain = this.ctx.createGain();
    const decay = Math.max(0.8, Math.min(3.5, 2.4 * Math.sqrt(262 / f)));
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.3 * (0.35 + 0.65 * v), when + 0.003);
    gain.gain.setTargetAtTime(0, when + 0.003, decay);

    carrier.connect(gain);
    tine.connect(tineGain).connect(gain);
    gain.connect(out);
    for (const o of [carrier, mod, tine]) { o.start(when); o.stop(when + decay * 7); }
    return new BasicVoice(this.ctx, gain, [carrier, mod, tine], 0.12);
  }
}

/** Detuned saw pad with a filter sweep — the "neon" synth. */
export class NeonSynth implements Instrument {
  readonly ready = true;
  constructor(private readonly ctx: BaseAudioContext) {}

  start(midi: number, velocity: number, when: number, out: AudioNode): Voice {
    const f = midiToFreq(midi);
    const v = velocity / 127;
    const oscs = [-8, 8].map(cents => {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = cents;
      return o;
    });
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = f / 2;
    const subGain = this.ctx.createGain();
    subGain.gain.value = 0.5;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 4;
    const peak = Math.min(12000, 800 + 6000 * v + f * 2);
    filter.frequency.setValueAtTime(300, when);
    filter.frequency.linearRampToValueAtTime(peak, when + 0.03);
    filter.frequency.setTargetAtTime(Math.max(600, peak * 0.3), when + 0.03, 0.4);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.14 * (0.4 + 0.6 * v), when + 0.015);
    gain.gain.setTargetAtTime(0.08 * (0.4 + 0.6 * v), when + 0.015, 0.3);

    for (const o of oscs) o.connect(filter);
    sub.connect(subGain).connect(filter);
    filter.connect(gain).connect(out);
    for (const o of [...oscs, sub]) o.start(when);
    return new BasicVoice(this.ctx, gain, [...oscs, sub], 0.25);
  }
}
