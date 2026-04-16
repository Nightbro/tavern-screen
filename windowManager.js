const path = require('path');

const DEFAULT_SETTINGS = {
  gridVisible: true,
  cellSizeInches: 1.0,
  zoom: 1.0,
  dpi: 96,
  gridColor: '#ffffff',
  gridOpacity: 0.25,
};

function createWindowManager({ BrowserWindow, screen, preloadPath, gmRendererPath, screenRendererPath }) {
  let gmWindow = null;
  let screenWindow = null;
  let activeDisplayId = null;
  let settings = { ...DEFAULT_SETTINGS };

  function notifyGM(channel, ...args) {
    if (gmWindow && !gmWindow.isDestroyed()) {
      gmWindow.webContents.send(channel, ...args);
    }
  }

  function createGMWindow() {
    gmWindow = new BrowserWindow({
      width: 1100,
      height: 720,
      minWidth: 800,
      minHeight: 500,
      backgroundColor: '#1a1a2e',
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    gmWindow.loadFile(gmRendererPath);

    gmWindow.on('closed', () => {
      gmWindow = null;
      if (screenWindow) {
        screenWindow.removeAllListeners('closed');
        screenWindow.destroy();
        screenWindow = null;
        activeDisplayId = null;
      }
    });
  }

  function selectDisplay(displayId) {
    const displays = screen.getAllDisplays();
    const display = displays.find((d) => d.id === displayId);
    if (!display) return false;

    // Close existing screen window without triggering the 'closed' → screen-closed flow,
    // because we are switching monitors, not closing the screen entirely.
    if (screenWindow) {
      screenWindow.removeAllListeners('closed');
      screenWindow.destroy();
      screenWindow = null;
    }

    activeDisplayId = displayId;
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
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    screenWindow.loadFile(screenRendererPath);

    screenWindow.webContents.on('did-finish-load', () => {
      if (screenWindow && !screenWindow.isDestroyed()) {
        screenWindow.webContents.send('settings-update', settings);
      }
    });

    screenWindow.on('closed', () => {
      screenWindow = null;
      activeDisplayId = null;
      notifyGM('screen-closed');
    });

    notifyGM('screen-opened', displayId, suggestedDpi);
    return true;
  }

  function closeScreen() {
    if (!screenWindow) return false;
    screenWindow.close();
    return true;
  }

  function updateSettings(patch) {
    settings = { ...settings, ...patch };
    if (screenWindow && !screenWindow.isDestroyed()) {
      screenWindow.webContents.send('settings-update', settings);
    }
  }

  function getDisplays() {
    const primary = screen.getPrimaryDisplay();
    return screen.getAllDisplays().map((d) => ({
      id: d.id,
      bounds: d.bounds,
      scaleFactor: d.scaleFactor,
      isPrimary: d.id === primary.id,
      active: d.id === activeDisplayId,
    }));
  }

  function getSettings() {
    return { ...settings };
  }

  return { createGMWindow, selectDisplay, closeScreen, updateSettings, getDisplays, getSettings };
}

module.exports = { createWindowManager, DEFAULT_SETTINGS };
