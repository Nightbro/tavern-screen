const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const { createWindowManager } = require('./windowManager');

const manager = createWindowManager({
  BrowserWindow,
  screen,
  preloadPath:        path.join(__dirname, 'preload.js'),
  gmRendererPath:     path.join(__dirname, 'renderer', 'gm',     'index.html'),
  screenRendererPath: path.join(__dirname, 'renderer', 'screen', 'index.html'),
});

// Display
ipcMain.handle('get-displays',   ()          => manager.getDisplays());
ipcMain.on('select-display',     (_e, id)    => manager.selectDisplay(id));
ipcMain.on('close-screen',       ()          => manager.closeScreen());

// Settings
ipcMain.on('update-settings',    (_e, patch) => manager.updateSettings(patch));

// Maps
ipcMain.handle('open-map-dialog', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title:      'Select Map Images',
    properties: ['openFile', 'multiSelections'],
    filters:    [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
  });
  if (canceled) return [];
  return manager.addMaps(filePaths);
});

ipcMain.handle('get-maps',        ()         => manager.getMaps());
ipcMain.on('set-active-map',      (_e, id)   => manager.setActiveMap(id));
ipcMain.on('remove-map',          (_e, id)   => manager.removeMap(id));

// Preview
ipcMain.on('request-preview',    ()          => manager.capturePreview());

app.whenReady().then(() => {
  manager.createGMWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) manager.createGMWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
