const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const { createWindowManager } = require('./windowManager');
const { createLibrary }       = require('./library');

const configPath = path.join(app.getPath('userData'), 'config.json');
const lib = createLibrary(configPath);

const manager = createWindowManager({
  BrowserWindow,
  screen,
  preloadPath:        path.join(__dirname, 'preload.js'),
  gmRendererPath:     path.join(__dirname, 'renderer', 'gm',     'index.html'),
  screenRendererPath: path.join(__dirname, 'renderer', 'screen', 'index.html'),
});

// ── Display ────────────────────────────────────────────────────────────────
ipcMain.handle('get-displays',  ()          => manager.getDisplays());
ipcMain.on('select-display',    (_e, id)    => manager.selectDisplay(id));
ipcMain.on('close-screen',      ()          => manager.closeScreen());

// ── Settings ───────────────────────────────────────────────────────────────
ipcMain.on('update-settings',   (_e, patch) => manager.updateSettings(patch));

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
  return filePaths[0];
});

// ── Library: scan ──────────────────────────────────────────────────────────
ipcMain.handle('scan-library', () => lib.scan());

// ── Library: projects ──────────────────────────────────────────────────────
ipcMain.handle('create-project',  (_e, name)           => lib.createProject(name));
ipcMain.handle('rename-project',  (_e, oldId, newName) => lib.renameProject(oldId, newName));
ipcMain.handle('delete-project',  (_e, projectId)      => { lib.deleteProject(projectId); });

// ── Library: maps ──────────────────────────────────────────────────────────
ipcMain.handle('copy-files', async (event, filePaths, projectId) => {
  return lib.copyFiles(filePaths, projectId ?? null);
});

ipcMain.handle('move-map', (_e, mapId, toProjectId) => {
  return lib.moveMap(mapId, toProjectId ?? null);
});

ipcMain.on('delete-map', (_e, mapId) => {
  lib.deleteMap(mapId);
  // If the deleted map was active, clear the screen
  manager.setActiveMap(null);
});

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
