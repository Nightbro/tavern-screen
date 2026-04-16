const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Display management
  getDisplays:    ()           => ipcRenderer.invoke('get-displays'),
  selectDisplay:  (id)         => ipcRenderer.send('select-display', id),
  closeScreen:    ()           => ipcRenderer.send('close-screen'),
  onScreenClosed: (cb)         => ipcRenderer.on('screen-closed', () => cb()),
  onScreenOpened: (cb)         => ipcRenderer.on('screen-opened', (_e, id, dpi) => cb(id, dpi)),

  // Settings
  updateSettings:   (patch)    => ipcRenderer.send('update-settings', patch),
  onSettingsUpdate: (cb)       => ipcRenderer.on('settings-update', (_e, s) => cb(s)),

  // Maps (GM → main)
  openMapDialog:  ()           => ipcRenderer.invoke('open-map-dialog'),
  getMaps:        ()           => ipcRenderer.invoke('get-maps'),
  setActiveMap:   (id)         => ipcRenderer.send('set-active-map', id),
  removeMap:      (id)         => ipcRenderer.send('remove-map', id),

  // Map update (main → screen renderer)
  onMapUpdate:    (cb)         => ipcRenderer.on('map-update', (_e, map) => cb(map)),

  // Preview (main → GM)
  requestPreview: ()           => ipcRenderer.send('request-preview'),
  onScreenPreview:(cb)         => ipcRenderer.on('screen-preview', (_e, dataUrl) => cb(dataUrl)),
});
