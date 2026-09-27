// Electron main process: wraps the web build (dist/) into a desktop app.
import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, session, shell } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, normalize, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, '..', 'dist');
const devServer = process.argv.includes('--dev') ? 'http://localhost:5173' : null;

// Serve the app from app://neonkeys/ instead of file:// so fetch() (piano
// samples) works and the page is a secure context (required by Web MIDI).
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();

// --- Settings store (userData/settings.json) ---------------------------------

const storePath = () => join(app.getPath('userData'), 'settings.json');
let store = {};
function loadStore() {
  try { store = JSON.parse(readFileSync(storePath(), 'utf8')); } catch { store = {}; }
}
function saveStore() {
  mkdirSync(dirname(storePath()), { recursive: true });
  writeFileSync(storePath(), JSON.stringify(store, null, 2));
}

ipcMain.on('store:get', (e, key) => { e.returnValue = store[key] ?? null; });
ipcMain.on('store:set', (_e, key, value) => { store[key] = value; saveStore(); });

// --- Native file dialogs --------------------------------------------------------

ipcMain.handle('file:open', async (e, extensions) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const res = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'MIDI', extensions: extensions.map(x => x.replace(/^\./, '')).filter(x => !x.includes('/')) }],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const data = await readFile(res.filePaths[0]);
  return { name: basename(res.filePaths[0]), data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
});

ipcMain.handle('file:save', async (e, name, data) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const res = await dialog.showSaveDialog(win, {
    defaultPath: join(app.getPath('documents'), name),
    filters: [{ name: 'MIDI', extensions: ['mid'] }],
  });
  if (res.canceled || !res.filePath) return false;
  await writeFile(res.filePath, Buffer.from(data));
  return true;
});

// --- Window ---------------------------------------------------------------------

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: '#05040f',
    title: 'NeonKeys',
    icon: join(here, '..', 'build', 'icon.png'),
    show: false,
    webPreferences: {
      preload: join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Audio and timing must keep running when the window is in the background.
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  win.once('ready-to-show', () => win.show());

  // Keep all navigation inside the app; open external links in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://') && !(devServer && url.startsWith(devServer))) e.preventDefault();
  });

  // F11 fullscreen, Ctrl+Shift+I devtools (the app has no menu bar).
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === 'I' && input.control && input.shift) { win.webContents.toggleDevTools(); e.preventDefault(); }
  });

  void win.loadURL(devServer ?? 'app://neonkeys/index.html');
}

app.whenReady().then(() => {
  loadStore();
  Menu.setApplicationMenu(null);

  protocol.handle('app', req => {
    const { pathname } = new URL(req.url);
    const file = normalize(join(distDir, decodeURIComponent(pathname)));
    if (!file.startsWith(distDir + sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });

  // Grant MIDI and fullscreen; deny everything else. Chromium routes every Web MIDI
  // request through the "midiSysex" permission, even when SysEx isn't requested.
  const allowed = new Set(['midi', 'midiSysex', 'fullscreen']);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed.has(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission));

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('second-instance', () => {
  const [win] = BrowserWindow.getAllWindows();
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
