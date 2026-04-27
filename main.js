const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');

// Suppress Chromium GPU shader cache warnings on Windows (harmless, caused by
// a locked temp directory when a previous instance didn't fully shut down).
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
const path = require('path');

const { createConfig }           = require('./src/main/config');
const { createLibrary }          = require('./src/main/library');
const { createCampaignLibrary }  = require('./src/main/campaignLibrary');
const { createWindowManager }    = require('./src/main/windowManager');
const { registerDisplayHandlers }  = require('./src/main/ipc/display');
const { registerLibraryHandlers }  = require('./src/main/ipc/library');
const { registerCampaignHandlers } = require('./src/main/ipc/campaign');
const { registerSceneHandlers }    = require('./src/main/ipc/scene');

const config      = createConfig(path.join(app.getPath('userData'), 'config.json'));
const lib         = createLibrary(config);
const campaignLib = createCampaignLibrary(config);

const manager = createWindowManager({
  BrowserWindow, screen,
  preloadPath:                path.join(__dirname, 'preload.js'),
  gmRendererPath:             path.join(__dirname, 'src', 'renderer', 'gm',              'index.html'),
  screenRendererPath:         path.join(__dirname, 'src', 'renderer', 'screen',          'index.html'),
  screenAdvancedRendererPath: path.join(__dirname, 'src', 'renderer', 'screen-advanced', 'index.html'),
  initialSettings:            config.get('settings', null),
});

registerDisplayHandlers(ipcMain,  { manager, config });
registerLibraryHandlers(ipcMain,  { lib, campaignLib, manager, dialog, BrowserWindow });
registerCampaignHandlers(ipcMain, { campaignLib, manager });
registerSceneHandlers(ipcMain,    { manager, campaignLib, dialog, BrowserWindow });

// ── CSS hot-reload (dev only) ──────────────────────────────────────────────
if (!app.isPackaged) {
  const fs = require('fs');
  fs.watch(path.join(__dirname, 'src', 'renderer'), { recursive: true }, (_event, filename) => {
    if (!filename?.endsWith('.css')) return;
    const snippet = `document.querySelectorAll('link[rel=stylesheet]').forEach(l => {
      const h = l.href; l.href = ''; l.href = h;
    });`;
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) win.webContents.executeJavaScript(snippet).catch(() => {});
    });
  });
}

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
