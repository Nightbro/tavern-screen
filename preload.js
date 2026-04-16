const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // GM screen — display management
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  selectDisplay: (displayId) => ipcRenderer.send('select-display', displayId),
  closeScreen: () => ipcRenderer.send('close-screen'),
  onScreenClosed: (cb) => ipcRenderer.on('screen-closed', () => cb()),
  onScreenOpened: (cb) => ipcRenderer.on('screen-opened', (_e, displayId, suggestedDpi) => cb(displayId, suggestedDpi)),

  // GM screen — settings
  updateSettings: (patch) => ipcRenderer.send('update-settings', patch),

  // Player screen — receive settings
  onSettingsUpdate: (cb) => ipcRenderer.on('settings-update', (_e, settings) => cb(settings)),
});
