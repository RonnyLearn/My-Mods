import type { MidiBackend, OpenedFile, Platform } from './platform';
import { WebMidiBackend } from './web';

/** Bridge exposed by electron/preload.cjs. */
export interface DesktopBridge {
  platform: string;
  getSetting(key: string): string | null;
  setSetting(key: string, value: string): void;
  openFile(extensions: string[]): Promise<OpenedFile | null>;
  saveFile(name: string, data: Uint8Array): Promise<boolean>;
}

declare global {
  interface Window { neonDesktop?: DesktopBridge }
}

/** Desktop (Electron) build: native dialogs, settings in the user profile, MIDI always allowed. */
export class DesktopPlatform implements Platform {
  readonly kind = 'desktop' as const;
  readonly midi: MidiBackend;

  constructor(private readonly bridge: DesktopBridge) {
    const web = new WebMidiBackend();
    // The main process grants MIDI without prompting, so connect straight away.
    this.midi = { supported: web.supported, hasPermission: async () => web.supported, connect: h => web.connect(h) };
  }

  async saveFile(name: string, data: Uint8Array): Promise<void> {
    await this.bridge.saveFile(name, data);
  }

  openFile(accept: string[]): Promise<OpenedFile | null> {
    return this.bridge.openFile(accept);
  }

  loadSetting(key: string): string | null {
    return this.bridge.getSetting(key);
  }

  saveSetting(key: string, value: string): void {
    this.bridge.setSetting(key, value);
  }

  assetUrl(path: string): string {
    return import.meta.env.BASE_URL + path;
  }
}
