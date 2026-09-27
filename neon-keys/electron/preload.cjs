// Exposes a minimal, typed bridge to the renderer (see src/platform/desktop.ts).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('neonDesktop', {
  platform: process.platform,
  getSetting: key => ipcRenderer.sendSync('store:get', key),
  setSetting: (key, value) => ipcRenderer.send('store:set', key, value),
  openFile: extensions => ipcRenderer.invoke('file:open', extensions),
  saveFile: (name, data) => ipcRenderer.invoke('file:save', name, data),
});
