const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');

// Suppress Chromium GPU shader cache warnings on Windows (harmless, caused by
// a locked temp directory when a previous instance didn't fully shut down).
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
const path = require('path');
const fs   = require('fs');
const { createConfig }           = require('./config');
const { createLibrary }          = require('./library');
const { createCampaignLibrary }  = require('./campaignLibrary');
const { createWindowManager }    = require('./windowManager');

const config       = createConfig(path.join(app.getPath('userData'), 'config.json'));
const lib          = createLibrary(config);
const campaignLib  = createCampaignLibrary(config);

const manager = createWindowManager({
  BrowserWindow, screen,
  preloadPath:                path.join(__dirname, 'preload.js'),
  gmRendererPath:             path.join(__dirname, 'renderer', 'gm',              'index.html'),
  screenRendererPath:         path.join(__dirname, 'renderer', 'screen',          'index.html'),
  screenAdvancedRendererPath: path.join(__dirname, 'renderer', 'screen-advanced', 'index.html'),
  initialSettings:            config.get('settings', null),
});

// ── Display ────────────────────────────────────────────────────────────────
ipcMain.handle('get-displays',  ()          => manager.getDisplays());
ipcMain.on('select-display',    (_e, id)    => manager.selectDisplay(id));
ipcMain.on('close-screen',      ()          => manager.closeScreen());

// ── Settings ───────────────────────────────────────────────────────────────
ipcMain.on('update-settings', (_e, patch) => {
  manager.updateSettings(patch);
  config.set('settings', manager.getSettings()); // persist
});

// ── Preview ────────────────────────────────────────────────────────────────
ipcMain.on('request-preview',   ()          => manager.capturePreview());

// ── Library: folder ────────────────────────────────────────────────────────
ipcMain.handle('get-library-root', () => lib.getRootFolder());

ipcMain.handle('select-root-folder', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title:      'Select Maps Root Folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (canceled) return null;
  lib.setRootFolder(filePaths[0]);
  campaignLib.setRootFolder(filePaths[0]);
  return filePaths[0];
});

// ── Library: scan ──────────────────────────────────────────────────────────
ipcMain.handle('scan-library', () => lib.scan());

// ── Library: projects ──────────────────────────────────────────────────────
ipcMain.handle('create-project',  (_e, name)           => lib.createProject(name));
ipcMain.handle('rename-project',  (_e, oldId, newName) => lib.renameProject(oldId, newName));
ipcMain.handle('delete-project',  (_e, projectId)      => { lib.deleteProject(projectId); });

// ── Library: maps ──────────────────────────────────────────────────────────
ipcMain.handle('open-map-dialog', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title:      'Add Images',
    properties: ['openFile', 'multiSelections'],
    filters:    [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
  });
  return canceled ? [] : filePaths;
});

ipcMain.handle('copy-files', (_e, filePaths, projectId) => {
  return lib.copyFiles(filePaths, projectId ?? null);
});

ipcMain.handle('move-map', (_e, mapId, toProjectId) => {
  return lib.moveMap(mapId, toProjectId ?? null);
});

ipcMain.on('delete-map', (_e, mapId) => {
  lib.deleteMap(mapId);
  manager.setActiveMap(null);
});

// ── Campaigns ──────────────────────────────────────────────────────────────
ipcMain.handle('scan-campaigns',   ()                              => campaignLib.scan());
ipcMain.handle('create-campaign',  (_e, name)                     => campaignLib.createCampaign(name));
ipcMain.handle('rename-campaign',  (_e, oldId, newName)           => campaignLib.renameCampaign(oldId, newName));
ipcMain.handle('delete-campaign',  (_e, id)                       => { campaignLib.deleteCampaign(id); });
ipcMain.handle('create-session',   (_e, campaignId, name)         => campaignLib.createSession(campaignId, name));
ipcMain.handle('rename-session',   (_e, campaignId, oldId, newName) => campaignLib.renameSession(campaignId, oldId, newName));
ipcMain.handle('delete-session',   (_e, campaignId, id)           => { campaignLib.deleteSession(campaignId, id); });
ipcMain.handle('read-campaign-notes',  (_e, campaignId)                  => campaignLib.readCampaignNotes(campaignId));
ipcMain.handle('write-campaign-notes', (_e, campaignId, content)          => { campaignLib.writeCampaignNotes(campaignId, content); });
ipcMain.handle('read-notes',           (_e, campaignId, sessionId)        => campaignLib.readNotes(campaignId, sessionId));
ipcMain.handle('write-notes',          (_e, campaignId, sessionId, content) => { campaignLib.writeNotes(campaignId, sessionId, content); });

ipcMain.on('set-active-map', (_e, map) => {
  manager.setActiveMap(map ?? null);
});

// ── Advanced / Scene ───────────────────────────────────────────────────────────
ipcMain.handle('get-scene',      ()              => manager.getScene());
ipcMain.on(    'set-scene',      (_e, scene)     => manager.setScene(scene));
ipcMain.on(    'reset-scene',    ()              => manager.resetScene());
ipcMain.on(    'update-viewport',(_e, patch)     => manager.updateViewport(patch));

ipcMain.handle('add-layer',      (_e, layer)     => { manager.addLayer(layer);        return manager.getScene()?.layers ?? []; });
ipcMain.handle('update-layer',   (_e, id, patch) => { manager.updateLayer(id, patch); return manager.getScene()?.layers ?? []; });
ipcMain.handle('remove-layer',   (_e, id)        => { manager.removeLayer(id);        return manager.getScene()?.layers ?? []; });
ipcMain.handle('reorder-layers', (_e, ids)       => { manager.reorderLayers(ids);     return manager.getScene()?.layers ?? []; });

ipcMain.handle('add-hud',        (_e, hud)       => { manager.addHud(hud);            return manager.getScene()?.huds ?? []; });
ipcMain.handle('update-hud',     (_e, id, patch) => { manager.updateHud(id, patch);   return manager.getScene()?.huds ?? []; });
ipcMain.handle('remove-hud',     (_e, id)        => { manager.removeHud(id);          return manager.getScene()?.huds ?? []; });

ipcMain.on('send-ping',         (_e, x, y)    => manager.sendPing(x, y));
ipcMain.on('update-scene-meta', (_e, patch)   => manager.updateSceneMeta(patch));

// ── Campaign-scoped HUD persistence ───────────────────────────────────────────
ipcMain.handle('save-huds-campaign', (_e, campaignId, sessionId) => {
  campaignLib.saveHuds(campaignId, sessionId, manager.getHuds());
});

ipcMain.handle('load-huds-campaign', (_e, campaignId, sessionId) => {
  const huds = campaignLib.loadHuds(campaignId, sessionId);
  manager.setHuds(huds);
  return huds;
});

// ── HUD configs ───────────────────────────────────────────────────────────────
ipcMain.handle('save-hud-config', (_e, campaignId, sessionId, config) =>
  campaignLib.saveHudConfig(campaignId, sessionId, config)
);
ipcMain.handle('list-hud-configs', (_e, campaignId, sessionId) =>
  campaignLib.listHudConfigs(campaignId, sessionId)
);
ipcMain.handle('load-hud-config', (_e, campaignId, sessionId, configId) => {
  const config = campaignLib.loadHudConfig(campaignId, sessionId, configId);
  if (config?.huds) {
    manager.setHuds(config.huds);
    campaignLib.saveHuds(campaignId, sessionId, config.huds);
  }
  return config;
});
ipcMain.handle('delete-hud-config', (_e, campaignId, sessionId, configId) => {
  campaignLib.deleteHudConfig(campaignId, sessionId, configId);
});
ipcMain.handle('rename-hud-config', (_e, campaignId, sessionId, configId, newName) =>
  campaignLib.renameHudConfig(campaignId, sessionId, configId, newName)
);

// ── Campaign-scoped scene persistence ──────────────────────────────────────────
ipcMain.handle('save-scene-campaign', (_e, campaignId, sessionId) => {
  const scene = manager.getScene();
  if (!scene) return null;
  return campaignLib.saveScene(campaignId, sessionId, scene);
});

ipcMain.handle('list-scenes-campaign', (_e, campaignId, sessionId) =>
  campaignLib.listScenes(campaignId, sessionId)
);

ipcMain.handle('load-scene-campaign', (_e, campaignId, sessionId, sceneId) =>
  campaignLib.loadScene(campaignId, sessionId, sceneId)
);

ipcMain.handle('delete-scene-campaign', (_e, campaignId, sessionId, sceneId) => {
  campaignLib.deleteScene(campaignId, sessionId, sceneId);
});

ipcMain.handle('rename-scene-campaign', (_e, campaignId, sessionId, sceneId, newName) => {
  return campaignLib.renameScene(campaignId, sessionId, sceneId, newName);
});

ipcMain.handle('save-scene-dialog', async (event, scene) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save Scene',
    defaultPath: 'scene.json',
    filters: [{ name: 'Scene JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return false;
  try { fs.writeFileSync(filePath, JSON.stringify(scene, null, 2), 'utf8'); return true; }
  catch (_) { return false; }
});

ipcMain.handle('load-scene-dialog', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Load Scene',
    properties: ['openFile'],
    filters: [{ name: 'Scene JSON', extensions: ['json'] }],
  });
  if (canceled || !filePaths.length) return null;
  try { return JSON.parse(fs.readFileSync(filePaths[0], 'utf8')); }
  catch (_) { return null; }
});

// ── Bootstrap ──────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  manager.createGMWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) manager.createGMWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
