const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');

// Suppress Chromium GPU shader cache warnings on Windows (harmless, caused by
// a locked temp directory when a previous instance didn't fully shut down).
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
const path = require('path');

const { createConfig }           = require('./config');
const { createLibrary }          = require('./library');
const { createCampaignLibrary }  = require('./campaignLibrary');
const { createWindowManager }    = require('./windowManager');
const { registerDisplayHandlers }  = require('./ipc/display');
const { registerLibraryHandlers }  = require('./ipc/library');
const { registerCampaignHandlers } = require('./ipc/campaign');
const { registerSceneHandlers }    = require('./ipc/scene');

const config      = createConfig(path.join(app.getPath('userData'), 'config.json'));
const lib         = createLibrary(config);
const campaignLib = createCampaignLibrary(config);

const manager = createWindowManager({
  BrowserWindow, screen,
  preloadPath:                path.join(__dirname, 'preload.js'),
  gmRendererPath:             path.join(__dirname, 'renderer', 'gm',              'index.html'),
  screenRendererPath:         path.join(__dirname, 'renderer', 'screen',          'index.html'),
  screenAdvancedRendererPath: path.join(__dirname, 'renderer', 'screen-advanced', 'index.html'),
  initialSettings:            config.get('settings', null),
});

registerDisplayHandlers(ipcMain,  { manager, config });
registerLibraryHandlers(ipcMain,  { lib, campaignLib, manager, dialog, BrowserWindow });
registerCampaignHandlers(ipcMain, { campaignLib, manager });
registerSceneHandlers(ipcMain,    { manager, campaignLib, dialog, BrowserWindow });

// ── CSS hot-reload (dev only) ──────────────────────────────────────────────
if (!app.isPackaged) {
  const fs = require('fs');
  fs.watch(path.join(__dirname, 'renderer'), { recursive: true }, (_event, filename) => {
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
