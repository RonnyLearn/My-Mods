import { ElectricPiano, NeonSynth, SampledPiano, SynthPiano, type Instrument, type Voice } from './instruments';

export type InstrumentId = 'piano' | 'epiano' | 'synth';

const MAX_VOICES = 96;

/**
 * Audio graph:  instruments → bus ─┬─ dry ───────────┐
 *                                  └─ reverb → wet ──┴→ compressor → master → analyser → out
 *
 * Handles live notes (with sustain pedal logic) and notes scheduled by the song player.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  instrumentId: InstrumentId = 'piano';
  pianoStatus: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';

  private bus!: GainNode;
  private master!: GainNode;
  private wet!: GainNode;
  private analyser!: AnalyserNode;
  private levelData!: Float32Array<ArrayBuffer>;
  private instruments!: Record<InstrumentId, Instrument>;
  private fallbackPiano!: Instrument;

  private readonly live = new Map<number, Voice[]>();
  private readonly held = new Set<number>();
  private readonly scheduled = new Set<Voice>();
  private voices: Voice[] = [];
  private sustain = false;
  private volume = 0.8;
  private reverb = 0.3;

  constructor(private readonly sampleUrl: (layer: string, file: string) => string) {}

  /** Must be called from a user gesture (browser autoplay policy). */
  start(onProgress: (loaded: number, total: number) => void = () => {}): Promise<void> {
    if (this.ctx) {
      void this.ctx.resume();
      return Promise.resolve();
    }
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;

    this.bus = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 3;
    comp.attack.value = 0.005;
    this.master = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.levelData = new Float32Array(this.analyser.fftSize);

    const convolver = ctx.createConvolver();
    convolver.buffer = impulseResponse(ctx, 2.8);
    this.wet = ctx.createGain();

    this.bus.connect(comp);
    this.bus.connect(convolver).connect(this.wet).connect(comp);
    comp.connect(this.master).connect(this.analyser).connect(ctx.destination);
    this.applyMix();

    const piano = new SampledPiano(ctx, this.sampleUrl);
    this.fallbackPiano = new SynthPiano(ctx);
    this.instruments = { piano, epiano: new ElectricPiano(ctx), synth: new NeonSynth(ctx) };

    this.pianoStatus = 'loading';
    return piano.load(onProgress).then(
      () => { this.pianoStatus = 'ready'; },
      err => { this.pianoStatus = 'failed'; console.warn('Piano samples unavailable, using synth piano.', err); },
    );
  }

  get now(): number { return this.ctx?.currentTime ?? 0; }

  setVolume(v: number) { this.volume = v; this.applyMix(); }
  setReverb(v: number) { this.reverb = v; this.applyMix(); }

  private applyMix() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    this.wet.gain.setTargetAtTime(this.reverb * 0.9, this.ctx.currentTime, 0.02);
  }

  /** Current output loudness (RMS, 0..~1) for audio-reactive visuals. */
  level(): number {
    if (!this.ctx) return 0;
    this.analyser.getFloatTimeDomainData(this.levelData);
    let sum = 0;
    for (const x of this.levelData) sum += x * x;
    return Math.sqrt(sum / this.levelData.length);
  }

  private instrument(): Instrument {
    const inst = this.instruments[this.instrumentId];
    return inst.ready ? inst : this.fallbackPiano;
  }

  private spawn(midi: number, velocity: number, when: number): Voice {
    this.voices = this.voices.filter(v => !v.ended);
    while (this.voices.length >= MAX_VOICES) this.voices.shift()!.stop();
    const voice = this.instrument().start(midi, velocity, when, this.bus);
    this.voices.push(voice);
    return voice;
  }

  // --- Live playing -------------------------------------------------------

  noteOn(midi: number, velocity: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Re-striking a ringing note: damp the previous one quickly, like a real string.
    for (const v of this.live.get(midi) ?? []) v.release(t);
    this.live.set(midi, [this.spawn(midi, velocity, t)]);
    this.held.add(midi);
  }

  noteOff(midi: number) {
    this.held.delete(midi);
    if (!this.ctx || this.sustain) return;
    this.releaseLive(midi);
  }

  setSustain(down: boolean) {
    this.sustain = down;
    if (down) return;
    for (const midi of [...this.live.keys()]) {
      if (!this.held.has(midi)) this.releaseLive(midi);
    }
  }

  get sustainDown() { return this.sustain; }

  private releaseLive(midi: number) {
    const t = this.now;
    for (const v of this.live.get(midi) ?? []) v.release(t);
    this.live.delete(midi);
  }

  // --- Song playback --------------------------------------------------------

  schedule(midi: number, velocity: number, when: number, end: number) {
    if (!this.ctx) return;
    const voice = this.spawn(midi, velocity, Math.max(when, this.ctx.currentTime));
    voice.release(end);
    this.scheduled.add(voice);
    if (this.scheduled.size > 256) {
      for (const v of this.scheduled) if (v.ended) this.scheduled.delete(v);
    }
  }

  stopScheduled() {
    for (const v of this.scheduled) v.stop();
    this.scheduled.clear();
  }

  allNotesOff() {
    this.stopScheduled();
    for (const voices of this.live.values()) for (const v of voices) v.stop();
    this.live.clear();
    this.held.clear();
  }
}

/** Synthetic stereo hall reverb: decaying noise with a few early reflections. */
function impulseResponse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / rate;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2) * Math.exp(-t * 1.6) * 0.5;
    }
    for (const [ms, g] of [[11, 0.5], [23, 0.35], [37, 0.25], [53, 0.18]]) {
      const i = Math.floor(((ms + ch * 3) / 1000) * rate);
      d[i] += ch ? -g : g;
    }
  }
  return buf;
}
