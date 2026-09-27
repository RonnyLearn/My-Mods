import type { InstrumentId } from '../audio/engine';
import type { Platform } from '../platform/platform';

export type LabelMode = 'none' | 'notes' | 'qwerty';
export type ColorMode = 'rainbow' | 'tracks' | 'mono';
export type Lang = 'ru' | 'en';

export interface Settings {
  instrument: InstrumentId;
  volume: number;
  reverb: number;
  labels: LabelMode;
  colors: ColorMode;
  /** Visual zoom of the note timeline. */
  noteSpeed: number;
  /** Velocity used for QWERTY and mouse input (no touch sensitivity there). */
  keyVelocity: number;
  particles: boolean;
  lang: Lang;
  qwertyOctave: number;
}

export const DEFAULT_SETTINGS: Settings = {
  instrument: 'piano',
  volume: 0.8,
  reverb: 0.3,
  labels: 'qwerty',
  colors: 'rainbow',
  noteSpeed: 1,
  keyVelocity: 90,
  particles: true,
  lang: typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en',
  qwertyOctave: 0,
};

export function loadSettings(platform: Platform): Settings {
  try {
    const raw = platform.loadSetting('settings');
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(platform: Platform, s: Settings) {
  platform.saveSetting('settings', JSON.stringify(s));
}
