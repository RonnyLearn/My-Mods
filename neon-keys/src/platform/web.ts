import type { MidiBackend, MidiDevice, MidiHandlers, MidiStatus, OpenedFile, Platform } from './platform';

export class WebMidiBackend implements MidiBackend {
  readonly supported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  private access: MIDIAccess | null = null;

  async hasPermission(): Promise<boolean> {
    if (!this.supported || !navigator.permissions) return false;
    try {
      const status = await navigator.permissions.query({ name: 'midi' as PermissionName });
      return status.state === 'granted';
    } catch {
      return false;
    }
  }

  async connect(handlers: MidiHandlers): Promise<MidiStatus> {
    if (!this.supported) return 'unsupported';
    try {
      this.access ??= await navigator.requestMIDIAccess({ sysex: false });
    } catch (err) {
      const name = (err as DOMException).name;
      // Other errors mean the OS MIDI subsystem could not be initialised.
      return name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable';
    }
    const access = this.access;
    const attach = () => {
      const devices: MidiDevice[] = [];
      access.inputs.forEach(input => {
        input.onmidimessage = e => { if (e.data) handlers.onMessage(e.data); };
        if (input.state === 'connected') devices.push({ id: input.id, name: input.name || 'MIDI device' });
      });
      handlers.onDevicesChanged(devices);
    };
    access.onstatechange = attach; // hot-plugging
    attach();
    return 'ready';
  }
}

export class WebPlatform implements Platform {
  readonly kind = 'web' as const;
  readonly midi = new WebMidiBackend();

  async saveFile(name: string, data: Uint8Array, mime: string): Promise<void> {
    const url = URL.createObjectURL(new Blob([data as BlobPart], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  openFile(accept: string[]): Promise<OpenedFile | null> {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept.join(',');
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        resolve(file ? { name: file.name, data: await file.arrayBuffer() } : null);
      });
      input.addEventListener('cancel', () => resolve(null));
      input.click();
    });
  }

  loadSetting(key: string): string | null {
    try { return localStorage.getItem('neonkeys.' + key); } catch { return null; }
  }

  saveSetting(key: string, value: string): void {
    try { localStorage.setItem('neonkeys.' + key, value); } catch { /* storage unavailable */ }
  }

  assetUrl(path: string): string {
    return import.meta.env.BASE_URL + path;
  }
}
