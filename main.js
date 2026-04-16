const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { createWindowManager } = require('./windowManager');

const manager = createWindowManager({
  BrowserWindow,
  screen,
  preloadPath:       path.join(__dirname, 'preload.js'),
  gmRendererPath:    path.join(__dirname, 'renderer', 'gm',     'index.html'),
  screenRendererPath: path.join(__dirname, 'renderer', 'screen', 'index.html'),
});

ipcMain.handle('get-displays',    ()           => manager.getDisplays());
ipcMain.on('select-display',      (_e, id)     => manager.selectDisplay(id));
ipcMain.on('close-screen',        ()           => manager.closeScreen());
ipcMain.on('update-settings',     (_e, patch)  => manager.updateSettings(patch));

app.whenReady().then(() => {
  manager.createGMWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) manager.createGMWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
