import { AudioEngine } from './audio/engine';
import { Player, type Judgement } from './core/player';
import { Recorder } from './core/recorder';
import { loadSettings, saveSettings, type Settings } from './core/settings';
import { OCTAVE_MAX, OCTAVE_MIN, qwertyRange, qwertyToMidi, WHITE_CODES } from './input/qwerty';
import { parseMidi } from './midi/smf-parse';
import { writeMidi } from './midi/smf-write';
import { DEMOS } from './music/demos';
import { noteName, PIANO_HI, PIANO_LO } from './music/notes';
import { scoreToSong } from './music/score';
import type { Song } from './music/song';
import type { MidiDevice, Platform } from './platform/platform';
import { fitRange } from './render/geometry';
import { noteHue, Renderer, type HeldKey } from './render/renderer';
import { getLang, setLang, t, type Key } from './ui/i18n';

interface StoredRecording { id: string; title: string; date: number; midi: string }

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const fmtTime = (s: number) => {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const toBase64 = (bytes: Uint8Array) => btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
const fromBase64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export class App {
  private readonly settings: Settings;
  private readonly engine: AudioEngine;
  private readonly player: Player;
  private readonly recorder = new Recorder();
  private readonly renderer: Renderer;

  private readonly userKeys = new Map<number, HeldKey & { sources: Set<string> }>();
  private readonly keyboardDown = new Map<string, number>();
  private readonly pointers = new Map<number, number>();
  private sustainSources = new Set<string>();
  private energy = 0;
  private started = false;
  private midiDevices: MidiDevice[] = [];
  private midiReady = false;
  private rangeCenter = 60;
  private recordings: StoredRecording[] = [];
  private lastHud = '';
  private toastTimer = 0;

  constructor(private readonly platform: Platform) {
    this.settings = loadSettings(platform);
    this.engine = new AudioEngine((layer, file) => platform.assetUrl(`samples/${layer}/${file}`));
    this.renderer = new Renderer($<HTMLCanvasElement>('stage'));
    this.player = new Player({
      schedule: (note, delay, length) => {
        const now = this.engine.now;
        this.engine.schedule(note.midi, note.velocity, now + delay, now + delay + length);
        this.energy += 0.04 + note.velocity / 127 * 0.05;
      },
      stopScheduled: () => this.engine.stopScheduled(),
      onJudge: (note, j) => this.onJudge(note.midi, note.track, j),
      onEnd: () => this.onSongEnd(),
    });
    try {
      this.recordings = JSON.parse(platform.loadSetting('recordings') ?? '[]');
    } catch {
      this.recordings = [];
    }
  }

  init() {
    setLang(this.settings.lang);
    this.bindSettings();
    this.bindTopbar();
    this.bindKeyboard();
    this.bindPointer();
    this.bindDragDrop();
    this.bindModals();
    this.renderDemoList();
    this.renderRecordings();
    this.renderKeyboardMap();
    this.updateOctaveBadge();

    window.addEventListener('resize', () => this.layout());
    this.layout();
    // Floating badges sit under the top bar, whose height changes as it wraps.
    const topbar = $('topbar');
    new ResizeObserver(() => {
      document.documentElement.style.setProperty('--topbar-h', `${topbar.offsetHeight}px`);
    }).observe(topbar);

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    // The desktop app may start audio without a click, so skip the splash there.
    if (this.platform.kind === 'desktop') this.startAudio();
  }

  // ---------------------------------------------------------------------------
  // Audio start (needs a user gesture)
  // ---------------------------------------------------------------------------

  private startAudio() {
    if (this.started) return;
    this.started = true;
    $('startOverlay').hidden = true;
    this.engine.instrumentId = this.settings.instrument;
    const badge = $('loadingBadge');
    badge.hidden = false;
    badge.textContent = t('loadingPiano');
    const done = this.engine.start((loaded, total) => {
      badge.textContent = `${t('loadingPiano')} ${Math.round((loaded / total) * 100)}%`;
    });
    this.engine.setVolume(this.settings.volume);
    this.engine.setReverb(this.settings.reverb);
    void done.then(() => {
      badge.hidden = true;
      if (this.engine.pianoStatus === 'failed') this.toast(t('pianoFailed'));
    });
    void this.platform.midi.hasPermission().then(granted => { if (granted) void this.connectMidi(true); });
  }

  // ---------------------------------------------------------------------------
  // Note input (QWERTY, MIDI, pointer all end up here)
  // ---------------------------------------------------------------------------

  private hueFor(midi: number): number {
    const { colors } = this.settings;
    if (colors !== 'tracks') return noteHue(colors, midi);
    const song = this.player.song;
    if (song && this.player.mode !== 'listen') {
      // Colour by the part the note most likely belongs to.
      const near = song.notes.find(n => n.midi === midi && Math.abs(n.time - this.player.time) < 0.3);
      if (near) return noteHue('tracks', midi, near.track);
    }
    return noteHue('tracks', midi, midi < 60 ? 1 : 0);
  }

  noteOn(midi: number, velocity: number, source: string) {
    if (midi < PIANO_LO || midi > PIANO_HI) return;
    this.startAudio();
    const prev = this.userKeys.get(midi);
    const hue = this.hueFor(midi);
    const sources = prev?.sources ?? new Set<string>();
    sources.add(source);
    this.userKeys.set(midi, { hue, velocity, sources });
    if (prev) this.renderer.userRelease(midi);

    const now = performance.now() / 1000;
    this.engine.noteOn(midi, velocity);
    this.recorder.noteOn(midi, velocity, now);
    this.player.userPress(midi);
    this.renderer.userPress(midi, hue, velocity, !this.player.song, this.settings.particles);
    this.energy += 0.12 + (velocity / 127) * 0.12;
  }

  noteOff(midi: number, source: string) {
    const key = this.userKeys.get(midi);
    if (!key) return;
    key.sources.delete(source);
    if (key.sources.size) return;
    this.userKeys.delete(midi);
    this.engine.noteOff(midi);
    this.recorder.noteOff(midi, performance.now() / 1000);
    this.renderer.userRelease(midi);
  }

  private setSustain(down: boolean, source: string) {
    const was = this.sustainSources.size > 0;
    if (down) this.sustainSources.add(source);
    else this.sustainSources.delete(source);
    const is = this.sustainSources.size > 0;
    if (was === is) return;
    this.engine.setSustain(is);
    this.recorder.setSustain(is, performance.now() / 1000);
    $('pedalBadge').classList.toggle('on', is);
  }

  private releaseAll() {
    for (const [code, midi] of this.keyboardDown) this.noteOff(midi, `k:${code}`);
    this.keyboardDown.clear();
    for (const [id, midi] of this.pointers) this.noteOff(midi, `p:${id}`);
    this.pointers.clear();
    this.setSustain(false, 'kbd');
  }

  private bindKeyboard() {
    const isFormField = (el: EventTarget | null) =>
      el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;

    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') { this.closeModals(); return; }
      if (isFormField(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) this.setSustain(true, 'kbd');
        return;
      }
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        this.shiftOctave(e.code === 'ArrowLeft' ? -1 : 1);
        return;
      }
      const midi = qwertyToMidi(e.code, e.shiftKey, this.settings.qwertyOctave);
      if (midi === null) return;
      e.preventDefault();
      if (e.repeat || this.keyboardDown.has(e.code)) return;
      this.keyboardDown.set(e.code, midi);
      this.noteOn(midi, this.settings.keyVelocity, `k:${e.code}`);
    });

    window.addEventListener('keyup', e => {
      if (e.code === 'Space') {
        if (!isFormField(e.target)) e.preventDefault();
        this.setSustain(false, 'kbd');
        return;
      }
      const midi = this.keyboardDown.get(e.code);
      if (midi === undefined) return;
      this.keyboardDown.delete(e.code);
      this.noteOff(midi, `k:${e.code}`);
    });

    // Avoid stuck notes when the window loses focus mid-press.
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.releaseAll();
        if (this.player.playing) this.togglePlay();
      }
    });
  }

  private bindPointer() {
    const canvas = $<HTMLCanvasElement>('stage');
    const velocityAt = (y: number) => {
      const { top, height } = this.renderer.geo;
      const rel = Math.max(0, Math.min(1, (y - top) / height));
      return Math.round(Math.max(1, Math.min(127, this.settings.keyVelocity * (0.7 + 0.45 * rel))));
    };
    canvas.addEventListener('pointerdown', e => {
      const midi = this.renderer.geo.hitTest(e.clientX, e.clientY);
      if (midi === null) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, midi);
      this.noteOn(midi, velocityAt(e.clientY), `p:${e.pointerId}`);
    });
    canvas.addEventListener('pointermove', e => {
      const current = this.pointers.get(e.pointerId);
      if (current === undefined) return;
      const midi = this.renderer.geo.hitTest(e.clientX, e.clientY);
      if (midi === current) return;
      this.noteOff(current, `p:${e.pointerId}`);
      if (midi === null) {
        this.pointers.delete(e.pointerId);
        return;
      }
      this.pointers.set(e.pointerId, midi);
      this.noteOn(midi, velocityAt(e.clientY), `p:${e.pointerId}`);
    });
    const end = (e: PointerEvent) => {
      const midi = this.pointers.get(e.pointerId);
      if (midi === undefined) return;
      this.pointers.delete(e.pointerId);
      this.noteOff(midi, `p:${e.pointerId}`);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  private shiftOctave(delta: number) {
    const next = Math.max(OCTAVE_MIN, Math.min(OCTAVE_MAX, this.settings.qwertyOctave + delta));
    if (next === this.settings.qwertyOctave) return;
    // Release keys held under the old mapping.
    for (const [code, midi] of this.keyboardDown) this.noteOff(midi, `k:${code}`);
    this.keyboardDown.clear();
    this.settings.qwertyOctave = next;
    this.persist();
    this.updateOctaveBadge();
    this.renderKeyboardMap();
  }

  private updateOctaveBadge() {
    const [lo, hi] = qwertyRange(this.settings.qwertyOctave);
    $('octLabel').textContent = `QWERTY ${noteName(lo)}–${noteName(hi)}`;
  }

  // ---------------------------------------------------------------------------
  // MIDI devices
  // ---------------------------------------------------------------------------

  private async connectMidi(silent = false) {
    const status = await this.platform.midi.connect({
      onMessage: data => this.onMidiMessage(data),
      onDevicesChanged: devices => {
        this.midiDevices = devices;
        this.updateMidiButton();
        if (devices.length && !silent) this.toast(t('midiConnected', { name: devices.map(d => d.name).join(', ') }));
        silent = false;
      },
    });
    this.midiReady = status === 'ready';
    if (!silent) {
      if (status === 'unsupported') this.toast(t('midiUnsupported'));
      if (status === 'denied') this.toast(t('midiDenied'));
      if (status === 'unavailable') this.toast(t('midiUnavailable'));
      if (this.midiReady && !this.midiDevices.length) this.toast(t('midiNoDevice'));
    }
    this.updateMidiButton();
  }

  private onMidiMessage(d: Uint8Array) {
    const status = d[0] & 0xf0;
    if (status === 0x90 && d[2] > 0) this.noteOn(d[1], d[2], 'midi');
    else if (status === 0x80 || status === 0x90) this.noteOff(d[1], 'midi');
    else if (status === 0xb0 && d[1] === 64) this.setSustain(d[2] >= 64, 'midi');
    else if (status === 0xb0 && (d[1] === 123 || d[1] === 120)) this.releaseAll(); // all notes off
  }

  private updateMidiButton() {
    const on = this.midiReady && this.midiDevices.length > 0;
    $('midiDot').classList.toggle('on', on);
    $('midiBtn').title = on ? t('midiConnected', { name: this.midiDevices.map(d => d.name).join(', ') }) : t('midiConnect');
  }

  // ---------------------------------------------------------------------------
  // Songs & transport
  // ---------------------------------------------------------------------------

  loadSong(song: Song) {
    this.startAudio();
    this.player.pause();
    this.player.load(song);
    this.renderer.clearEffects();
    this.closeModals();

    $('transport').hidden = false;
    $('songTitle').textContent = song.title;
    const part = $<HTMLSelectElement>('partSel');
    part.innerHTML = '';
    part.append(new Option(t('allParts'), 'all'));
    song.tracks.forEach((tr, i) => part.append(new Option(tr.name, String(i))));
    this.setMode(this.player.mode);

    if (song.notes.length) {
      const pitches = song.notes.map(n => n.midi).sort((a, b) => a - b);
      this.rangeCenter = pitches[Math.floor(pitches.length / 2)];
    }
    this.layout();
    this.player.play();
    this.updatePlayButton();
  }

  private closeSong() {
    this.player.unload();
    $('transport').hidden = true;
    $('hud').hidden = true;
    this.renderer.clearEffects();
    this.layout();
  }

  private togglePlay() {
    if (!this.player.song) return;
    if (this.player.playing) this.player.pause();
    else this.player.play();
    this.updatePlayButton();
  }

  private updatePlayButton() {
    $('playBtn').textContent = this.player.playing ? '❚❚' : '▶';
  }

  private setMode(mode: Player['mode']) {
    this.player.mode = mode;
    document.querySelectorAll<HTMLButtonElement>('#modeSeg button').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    $('partSel').hidden = mode === 'listen' || (this.player.song?.tracks.length ?? 0) < 2;
    $('hud').hidden = mode === 'listen' || !this.player.song;
    if (this.player.song) {
      this.player.seek(this.player.time);
      this.player.resetStats();
    }
  }

  private onJudge(midi: number, track: number, j: Judgement) {
    if (this.player.mode !== 'play') return;
    const hue = j === 'miss' ? 350 : noteHue(this.settings.colors, midi, track);
    this.renderer.popup(midi, t(j as Key), hue);
  }

  private onSongEnd() {
    this.updatePlayButton();
    if (this.player.mode === 'listen') return;
    const s = this.player.stats;
    const acc = this.player.accuracy();
    $('resGrade').textContent = acc >= 0.95 ? 'S' : acc >= 0.85 ? 'A' : acc >= 0.7 ? 'B' : acc >= 0.5 ? 'C' : 'D';
    $('resAcc').textContent = `${Math.round(acc * 100)}%`;
    $('resScore').textContent = String(s.score);
    $('resCombo').textContent = String(s.maxCombo);
    $('resCounts').textContent =
      `${t('perfect')} ${s.perfect} · ${t('great')} ${s.great} · ${t('good')} ${s.good} · ${t('miss')} ${s.miss}`;
    this.openModal('resultsModal');
  }

  private async openMidiFile() {
    const file = await this.platform.openFile(['.mid', '.midi', 'audio/midi']);
    if (file) this.loadMidiData(file.data, file.name);
  }

  private loadMidiData(data: ArrayBuffer, name: string) {
    try {
      const song = parseMidi(data, name.replace(/\.midi?$/i, ''));
      if (!song.notes.length) throw new Error('No notes');
      this.loadSong(song);
    } catch (err) {
      console.warn(err);
      this.toast(t('badMidi'));
    }
  }

  // ---------------------------------------------------------------------------
  // Recording
  // ---------------------------------------------------------------------------

  private toggleRecording() {
    const now = performance.now() / 1000;
    const btn = $('recBtn');
    if (!this.recorder.recording) {
      this.startAudio();
      this.recorder.start(now);
      // Keys already held at the start are part of the take.
      for (const [midi, k] of this.userKeys) this.recorder.noteOn(midi, k.velocity, now);
      if (this.sustainSources.size) this.recorder.setSustain(true, now);
      btn.classList.add('active');
      $('recLabel').textContent = t('stop');
      return;
    }
    btn.classList.remove('active');
    $('recLabel').textContent = t('record');
    const title = t('recordingName', { n: this.recordings.length + 1 });
    const song = this.recorder.stop(now, title);
    if (!song) return;
    this.recordings.unshift({ id: String(Date.now()), title, date: Date.now(), midi: toBase64(writeMidi(song)) });
    this.saveRecordings();
    this.renderRecordings();
    this.toast(`${t('saved')}: ${title}`);
  }

  private saveRecordings() {
    this.platform.saveSetting('recordings', JSON.stringify(this.recordings.slice(0, 30)));
  }

  private renderRecordings() {
    const list = $('recList');
    list.innerHTML = '';
    if (!this.recordings.length) {
      const p = document.createElement('p');
      p.className = 'muted small';
      p.innerHTML = t('noRecordings');
      list.append(p);
      return;
    }
    for (const rec of this.recordings) {
      const row = document.createElement('div');
      row.className = 'item';
      const info = document.createElement('div');
      info.className = 'grow';
      const title = document.createElement('b');
      title.textContent = rec.title;
      const date = document.createElement('small');
      date.textContent = new Date(rec.date).toLocaleString(getLang());
      info.append(title, date);

      const mk = (label: string, fn: () => void) => {
        const b = document.createElement('button');
        b.className = 'btn mini';
        b.textContent = label;
        b.addEventListener('click', fn);
        return b;
      };
      const bytes = () => fromBase64(rec.midi);
      row.append(
        info,
        mk(t('practise'), () => {
          const song = parseMidi(bytes(), rec.title);
          song.source = 'recording';
          song.title = rec.title;
          this.loadSong(song);
        }),
        mk('⬇', () => void this.platform.saveFile(`${rec.title}.mid`, bytes(), 'audio/midi')),
        mk('✕', () => {
          this.recordings = this.recordings.filter(r => r !== rec);
          this.saveRecordings();
          this.renderRecordings();
        }),
      );
      row.lastElementChild!.setAttribute('aria-label', t('del'));
      row.children[2].setAttribute('aria-label', t('download'));
      list.append(row);
    }
  }

  // ---------------------------------------------------------------------------
  // UI wiring
  // ---------------------------------------------------------------------------

  private renderDemoList() {
    const list = $('demoList');
    list.innerHTML = '';
    for (const demo of DEMOS) {
      const b = document.createElement('button');
      b.className = 'item';
      const ru = getLang() === 'ru';
      b.innerHTML = `<div class="grow"><b></b><small></small></div><span class="level">${'●'.repeat(demo.level)}${'○'.repeat(3 - demo.level)}</span>`;
      b.querySelector('b')!.textContent = ru ? demo.titleRu : demo.title;
      b.querySelector('small')!.textContent = ru ? demo.composerRu : demo.composer;
      b.addEventListener('click', () => {
        const song = scoreToSong(demo);
        song.title = ru ? demo.titleRu : demo.title;
        if (ru) song.tracks.forEach((tr, i) => { tr.name = ['Правая рука', 'Левая рука'][i] ?? tr.name; });
        this.loadSong(song);
      });
      list.append(b);
    }
  }

  private renderKeyboardMap() {
    const rows = [WHITE_CODES.slice(0, 10), WHITE_CODES.slice(10, 20), WHITE_CODES.slice(20, 29), WHITE_CODES.slice(29)];
    const map = $('kbdMap');
    map.innerHTML = '';
    for (const row of rows) {
      const div = document.createElement('div');
      div.className = 'kbd-row';
      for (const code of row) {
        const midi = qwertyToMidi(code, false, this.settings.qwertyOctave);
        const key = document.createElement('div');
        key.className = 'kbd-key';
        const label = code.startsWith('Digit') ? code.slice(5) : code.slice(3);
        key.innerHTML = `${label}<small>${midi === null ? '' : noteName(midi)}</small>`;
        div.append(key);
      }
      map.append(div);
    }
  }

  private bindTopbar() {
    $('startBtn').addEventListener('click', () => this.startAudio());
    $('songsBtn').addEventListener('click', () => this.openModal('songsModal'));
    $('openMidiBtn').addEventListener('click', () => void this.openMidiFile());
    $('playBtn').addEventListener('click', () => this.togglePlay());
    $('restartBtn').addEventListener('click', () => {
      this.player.seek(-2);
      this.player.resetStats();
      this.player.play();
      this.updatePlayButton();
    });
    $('closeSongBtn').addEventListener('click', () => this.closeSong());
    $<HTMLSelectElement>('speedSel').addEventListener('change', e => {
      this.player.speed = Number((e.target as HTMLSelectElement).value);
      this.player.seek(this.player.time); // reschedule at the new speed
    });
    document.querySelectorAll<HTMLButtonElement>('#modeSeg button').forEach(b => {
      b.addEventListener('click', () => this.setMode(b.dataset.mode as Player['mode']));
    });
    $<HTMLSelectElement>('partSel').addEventListener('change', e => {
      const v = (e.target as HTMLSelectElement).value;
      const song = this.player.song;
      if (!song) return;
      this.player.userTracks = v === 'all' ? new Set(song.tracks.map((_, i) => i)) : new Set([Number(v)]);
      this.player.seek(this.player.time);
      this.player.resetStats();
    });

    const progress = $('progress');
    const seekTo = (e: PointerEvent) => {
      const song = this.player.song;
      if (!song) return;
      const r = progress.getBoundingClientRect();
      this.player.seek(((e.clientX - r.left) / r.width) * song.duration);
    };
    progress.addEventListener('pointerdown', e => {
      progress.setPointerCapture(e.pointerId);
      seekTo(e);
    });
    progress.addEventListener('pointermove', e => { if (progress.hasPointerCapture(e.pointerId)) seekTo(e); });

    $('recBtn').addEventListener('click', () => this.toggleRecording());
    $('midiBtn').addEventListener('click', () => {
      this.startAudio();
      void this.connectMidi();
    });
    $('helpBtn').addEventListener('click', () => this.openModal('helpModal'));
    $('settingsBtn').addEventListener('click', () => this.openModal('settingsModal'));
    $('fsBtn').addEventListener('click', () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.().catch(() => {});
    });
    $('octDown').addEventListener('click', () => this.shiftOctave(-1));
    $('octUp').addEventListener('click', () => this.shiftOctave(1));
    $('rangeLeft').addEventListener('click', () => { this.rangeCenter = Math.max(PIANO_LO + 6, this.rangeCenter - 12); this.layout(); });
    $('rangeRight').addEventListener('click', () => { this.rangeCenter = Math.min(PIANO_HI - 6, this.rangeCenter + 12); this.layout(); });
    $('resAgain').addEventListener('click', () => {
      this.closeModals();
      this.player.seek(-2);
      this.player.resetStats();
      this.player.play();
      this.updatePlayButton();
    });

    // Controls shouldn't keep focus: Space (sustain) would click a button and
    // letter keys would type-ahead in a <select> instead of playing notes.
    document.addEventListener('pointerup', () => {
      if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
    });
    document.addEventListener('change', e => {
      if (e.target instanceof HTMLSelectElement) e.target.blur();
    });
  }

  private bindSettings() {
    const s = this.settings;
    const sel = (id: string) => $<HTMLSelectElement>(id);
    const range = (id: string) => $<HTMLInputElement>(id);
    sel('setInstrument').value = s.instrument;
    range('setVolume').value = String(s.volume);
    range('setReverb').value = String(s.reverb);
    range('setVelocity').value = String(s.keyVelocity);
    sel('setLabels').value = s.labels;
    sel('setColors').value = s.colors;
    range('setNoteSpeed').value = String(s.noteSpeed);
    $<HTMLInputElement>('setParticles').checked = s.particles;
    sel('setLang').value = s.lang;

    sel('setInstrument').addEventListener('change', e => {
      s.instrument = (e.target as HTMLSelectElement).value as Settings['instrument'];
      this.engine.instrumentId = s.instrument;
      this.persist();
    });
    range('setVolume').addEventListener('input', e => { s.volume = Number((e.target as HTMLInputElement).value); this.engine.setVolume(s.volume); this.persist(); });
    range('setReverb').addEventListener('input', e => { s.reverb = Number((e.target as HTMLInputElement).value); this.engine.setReverb(s.reverb); this.persist(); });
    range('setVelocity').addEventListener('input', e => { s.keyVelocity = Number((e.target as HTMLInputElement).value); this.persist(); });
    sel('setLabels').addEventListener('change', e => { s.labels = (e.target as HTMLSelectElement).value as Settings['labels']; this.persist(); });
    sel('setColors').addEventListener('change', e => { s.colors = (e.target as HTMLSelectElement).value as Settings['colors']; this.persist(); });
    range('setNoteSpeed').addEventListener('input', e => { s.noteSpeed = Number((e.target as HTMLInputElement).value); this.persist(); });
    $<HTMLInputElement>('setParticles').addEventListener('change', e => { s.particles = (e.target as HTMLInputElement).checked; this.persist(); });
    sel('setLang').addEventListener('change', e => {
      s.lang = (e.target as HTMLSelectElement).value as Settings['lang'];
      setLang(s.lang);
      this.renderDemoList();
      this.renderRecordings();
      this.updateMidiButton();
      $('recLabel').textContent = t(this.recorder.recording ? 'stop' : 'record');
      this.persist();
    });
  }

  private persist() {
    saveSettings(this.platform, this.settings);
  }

  private bindDragDrop() {
    const overlay = $('dropOverlay');
    let depth = 0;
    window.addEventListener('dragenter', e => { e.preventDefault(); depth++; overlay.hidden = false; });
    window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; overlay.hidden = true; } });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', async e => {
      e.preventDefault();
      depth = 0;
      overlay.hidden = true;
      const file = e.dataTransfer?.files[0];
      if (file) this.loadMidiData(await file.arrayBuffer(), file.name);
    });
  }

  private bindModals() {
    document.querySelectorAll<HTMLElement>('.overlay').forEach(overlay => {
      if (overlay.id === 'startOverlay') return;
      overlay.addEventListener('pointerdown', e => { if (e.target === overlay) this.closeModals(); });
      overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => this.closeModals()));
    });
  }

  private openModal(id: string) {
    this.closeModals();
    $(id).hidden = false;
  }

  private closeModals() {
    for (const id of ['songsModal', 'settingsModal', 'helpModal', 'resultsModal']) $(id).hidden = true;
  }

  private toast(text: string) {
    const el = $('toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { el.hidden = true; }, 2600);
  }

  // ---------------------------------------------------------------------------
  // Layout & frame loop
  // ---------------------------------------------------------------------------

  private layout() {
    this.renderer.resize();
    const [lo, hi] = fitRange(this.renderer.width, this.rangeCenter);
    this.renderer.setRange(lo, hi);
    document.documentElement.style.setProperty('--kb-h', `${this.renderer.geo.height}px`);
    const partial = lo > PIANO_LO || hi < PIANO_HI;
    $('rangeLeft').hidden = !partial || lo <= PIANO_LO;
    $('rangeRight').hidden = !partial || hi >= PIANO_HI;
  }

  private frame(dt: number) {
    this.player.update(dt);
    this.energy *= Math.exp(-dt * 1.3);
    this.renderer.frame(dt, {
      song: this.player.song,
      player: this.player,
      settings: this.settings,
      userKeys: this.userKeys,
      energy: this.energy,
      level: this.engine.level(),
    });
    this.updateHud();
  }

  private updateHud() {
    const song = this.player.song;
    if (!song) return;
    const s = this.player.stats;
    const acc = Math.round(this.player.accuracy() * 100);
    const time = `${fmtTime(this.player.time)} / ${fmtTime(song.duration)}`;
    const key = `${s.score}|${s.combo}|${acc}|${time}|${this.player.playing}`;
    ($('progressFill') as HTMLElement).style.width = `${this.player.progress * 100}%`;
    if (key === this.lastHud) return;
    this.lastHud = key;
    $('timeLabel').textContent = time;
    $('hudScore').textContent = String(s.score);
    $('hudCombo').textContent = s.combo > 1 ? `${s.combo} ${t('combo')}` : '';
    $('hudAcc').textContent = `${t('accuracy')} ${acc}%`;
    this.updatePlayButton();
  }
}
