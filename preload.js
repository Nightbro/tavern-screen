const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Display ──────────────────────────────────────────────────────────────
  getDisplays:    ()           => ipcRenderer.invoke('get-displays'),
  selectDisplay:  (id)         => ipcRenderer.send('select-display', id),
  closeScreen:    ()           => ipcRenderer.send('close-screen'),
  onScreenClosed: (cb)         => ipcRenderer.on('screen-closed', () => cb()),
  onScreenOpened: (cb)         => ipcRenderer.on('screen-opened', (_e, id, dpi) => cb(id, dpi)),

  // ── Settings ─────────────────────────────────────────────────────────────
  updateSettings:    (patch)   => ipcRenderer.send('update-settings', patch),
  onSettingsUpdate:  (cb)      => ipcRenderer.on('settings-update',  (_e, s) => cb(s)),
  onInitialSettings: (cb)      => ipcRenderer.on('initial-settings', (_e, s) => cb(s)),

  // ── Active map ────────────────────────────────────────────────────────────
  setActiveMap:   (map)        => ipcRenderer.send('set-active-map', map),
  onMapUpdate:    (cb)         => ipcRenderer.on('map-update', (_e, map) => cb(map)),

  // ── Preview ───────────────────────────────────────────────────────────────
  requestPreview: ()           => ipcRenderer.send('request-preview'),
  onScreenPreview:(cb)         => ipcRenderer.on('screen-preview', (_e, url) => cb(url)),

  // ── Library: folder ───────────────────────────────────────────────────────
  getLibraryRoot:    ()        => ipcRenderer.invoke('get-library-root'),
  selectRootFolder:  ()        => ipcRenderer.invoke('select-root-folder'),

  // ── Library: scan ─────────────────────────────────────────────────────────
  scanLibrary:       ()        => ipcRenderer.invoke('scan-library'),

  // ── Library: projects ────────────────────────────────────────────────────
  createProject:  (name)       => ipcRenderer.invoke('create-project', name),
  renameProject:  (oldId, n)   => ipcRenderer.invoke('rename-project', oldId, n),
  deleteProject:  (id)         => ipcRenderer.invoke('delete-project', id),

  // ── Library: maps ────────────────────────────────────────────────────────
  copyFiles:      (paths, pid) => ipcRenderer.invoke('copy-files', paths, pid),
  moveMap:        (id, pid)    => ipcRenderer.invoke('move-map', id, pid),
  deleteMap:      (id)         => ipcRenderer.send('delete-map', id),
  openMapDialog:  ()           => ipcRenderer.invoke('open-map-dialog'),
  getFilePath:    (file)       => webUtils.getPathForFile(file),

  // ── Campaigns ─────────────────────────────────────────────────────────────
  scanCampaigns:   ()                                    => ipcRenderer.invoke('scan-campaigns'),
  createCampaign:  (name)                                => ipcRenderer.invoke('create-campaign', name),
  renameCampaign:  (oldId, newName)                      => ipcRenderer.invoke('rename-campaign', oldId, newName),
  deleteCampaign:  (id)                                  => ipcRenderer.invoke('delete-campaign', id),
  createSession:   (campaignId, name)                    => ipcRenderer.invoke('create-session', campaignId, name),
  renameSession:   (campaignId, oldId, newName)          => ipcRenderer.invoke('rename-session', campaignId, oldId, newName),
  deleteSession:   (campaignId, id)                      => ipcRenderer.invoke('delete-session', campaignId, id),
  readCampaignNotes:  (campaignId)                       => ipcRenderer.invoke('read-campaign-notes', campaignId),
  writeCampaignNotes: (campaignId, content)              => ipcRenderer.invoke('write-campaign-notes', campaignId, content),
  readNotes:          (campaignId, sessionId)            => ipcRenderer.invoke('read-notes', campaignId, sessionId),
  writeNotes:         (campaignId, sessionId, content)   => ipcRenderer.invoke('write-notes', campaignId, sessionId, content),
});
