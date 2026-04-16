const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

let gmWindow = null;
let screenWindow = null;
let activeDisplayId = null;

let settings = {
  gridVisible: true,
  cellSizeInches: 1.0,
  zoom: 1.0,
  dpi: 96,
  gridColor: '#ffffff',
  gridOpacity: 0.25,
};

function createGMWindow() {
  gmWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  gmWindow.loadFile(path.join(__dirname, 'renderer', 'gm', 'index.html'));

  gmWindow.on('closed', () => {
    gmWindow = null;
    if (screenWindow) {
      screenWindow.close();
      screenWindow = null;
    }
  });
}

ipcMain.handle('get-displays', () => {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map((d) => ({
    id: d.id,
    bounds: d.bounds,
    scaleFactor: d.scaleFactor,
    isPrimary: d.id === primary.id,
    active: d.id === activeDisplayId,
  }));
});

ipcMain.on('select-display', (event, displayId) => {
  const displays = screen.getAllDisplays();
  const display = displays.find((d) => d.id === displayId);
  if (!display) return;

  if (screenWindow) {
    screenWindow.close();
    screenWindow = null;
  }

  activeDisplayId = displayId;

  // Suggest DPI based on scale factor
  const suggestedDpi = Math.round(96 * display.scaleFactor);
  settings = { ...settings, dpi: suggestedDpi };

  const { x, y, width, height } = display.bounds;

  screenWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    fullscreen: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  screenWindow.loadFile(path.join(__dirname, 'renderer', 'screen', 'index.html'));

  screenWindow.webContents.on('did-finish-load', () => {
    screenWindow.webContents.send('settings-update', settings);
  });

  screenWindow.on('closed', () => {
    screenWindow = null;
    activeDisplayId = null;
    if (gmWindow) gmWindow.webContents.send('screen-closed');
  });

  if (gmWindow) gmWindow.webContents.send('screen-opened', displayId, suggestedDpi);
});

ipcMain.on('close-screen', () => {
  if (screenWindow) {
    screenWindow.close();
    screenWindow = null;
  }
});

ipcMain.on('update-settings', (event, patch) => {
  settings = { ...settings, ...patch };
  if (screenWindow) {
    screenWindow.webContents.send('settings-update', settings);
  }
});

app.whenReady().then(() => {
  createGMWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createGMWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
