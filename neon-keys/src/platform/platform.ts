/**
 * Everything that depends on the host environment lives behind these
 * interfaces. The browser implementation is in `web.ts`; a desktop build
 * (Electron / Tauri → .exe) only has to provide its own `Platform`, e.g. with
 * native file dialogs and a native MIDI backend, without touching the app.
 */

export interface MidiDevice {
  id: string;
  name: string;
}

export interface MidiHandlers {
  /** Raw MIDI message bytes (status, data1, data2). */
  onMessage(data: Uint8Array): void;
  onDevicesChanged(devices: MidiDevice[]): void;
}

export type MidiStatus = 'unsupported' | 'denied' | 'unavailable' | 'ready';

export interface MidiBackend {
  readonly supported: boolean;
  /** True if access was granted earlier, so connecting will not prompt the user. */
  hasPermission(): Promise<boolean>;
  connect(handlers: MidiHandlers): Promise<MidiStatus>;
}

export interface OpenedFile {
  name: string;
  data: ArrayBuffer;
}

export interface Platform {
  readonly kind: 'web' | 'desktop';
  midi: MidiBackend;
  saveFile(name: string, data: Uint8Array, mime: string): Promise<void>;
  openFile(accept: string[]): Promise<OpenedFile | null>;
  loadSetting(key: string): string | null;
  saveSetting(key: string, value: string): void;
  /** Base URL for bundled assets (piano samples). */
  assetUrl(path: string): string;
}
