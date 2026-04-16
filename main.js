const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');

// Suppress Chromium GPU shader cache warnings on Windows (harmless, caused by
// a locked temp directory when a previous instance didn't fully shut down).
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
const path = require('path');
const { createConfig }           = require('./config');
const { createLibrary }          = require('./library');
const { createCampaignLibrary }  = require('./campaignLibrary');
const { createWindowManager }    = require('./windowManager');

const config       = createConfig(path.join(app.getPath('userData'), 'config.json'));
const lib          = createLibrary(config);
const campaignLib  = createCampaignLibrary(config);

const manager = createWindowManager({
  BrowserWindow, screen,
  preloadPath:        path.join(__dirname, 'preload.js'),
  gmRendererPath:     path.join(__dirname, 'renderer', 'gm',     'index.html'),
  screenRendererPath: path.join(__dirname, 'renderer', 'screen', 'index.html'),
  initialSettings:    config.get('settings', null),
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
