const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  selectDisplay: (displayId) => ipcRenderer.send('select-display', displayId),
  closeScreen: () => ipcRenderer.send('close-screen'),
  onScreenClosed: (callback) => ipcRenderer.on('screen-closed', (_e) => callback()),
  onScreenOpened: (callback) => ipcRenderer.on('screen-opened', (_e, displayId) => callback(displayId)),
});
