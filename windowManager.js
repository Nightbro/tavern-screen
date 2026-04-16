const DEFAULT_SETTINGS = {
  gridVisible:    true,
  cellSizeInches: 1.0,
  zoom:           1.0,
  dpi:            96,
  gridColor:      '#ffffff',
  gridOpacity:    0.25,
};

function createWindowManager({
  BrowserWindow, screen,
  preloadPath, gmRendererPath, screenRendererPath,
  initialSettings = null,
}) {
  let gmWindow     = null;
  let screenWindow = null;
  let activeDisplayId = null;
  let settings     = { ...DEFAULT_SETTINGS, ...(initialSettings ?? {}) };
  let currentMap   = null;

  let previewTimer = null;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function notifyGM(channel, ...args) {
    if (gmWindow && !gmWindow.isDestroyed()) {
      gmWindow.webContents.send(channel, ...args);
    }
  }

  function notifyScreen(channel, ...args) {
    if (screenWindow && !screenWindow.isDestroyed()) {
      screenWindow.webContents.send(channel, ...args);
    }
  }

  async function capturePreview() {
    if (!screenWindow || screenWindow.isDestroyed()) return;
    try {
      const img = await screenWindow.webContents.capturePage();
      notifyGM('screen-preview', img.resize({ width: 640 }).toDataURL());
    } catch (_) { /* window may have closed between check and capture */ }
  }

  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(capturePreview, 350);
  }

  // ── GM Window ──────────────────────────────────────────────────────────────

  function createGMWindow() {
    gmWindow = new BrowserWindow({
      width: 1200, height: 760,
      minWidth: 900, minHeight: 560,
      backgroundColor: '#1a1a2e',
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    gmWindow.loadFile(gmRendererPath);

    // Send persisted settings to GM renderer so controls are in sync
    gmWindow.webContents.on('did-finish-load', () => {
      notifyGM('initial-settings', settings);
    });

    gmWindow.on('closed', () => {
      gmWindow = null;
      clearTimeout(previewTimer);
      if (screenWindow) {
        screenWindow.removeAllListeners('closed');
        screenWindow.destroy();
        screenWindow = null;
        activeDisplayId = null;
      }
    });
  }

  // ── Display selection ──────────────────────────────────────────────────────

  function selectDisplay(displayId) {
    const displays = screen.getAllDisplays();
    const display  = displays.find((d) => d.id === displayId);
    if (!display) return false;

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
      x, y, width, height,
      frame: false, fullscreen: true,
      backgroundColor: '#000000',
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    screenWindow.loadFile(screenRendererPath);

    screenWindow.webContents.on('did-finish-load', () => {
      notifyScreen('settings-update', settings);
      if (currentMap) notifyScreen('map-update', currentMap);
      schedulePreview();
    });

    screenWindow.on('closed', () => {
      screenWindow = null;
      activeDisplayId = null;
      clearTimeout(previewTimer);
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

  // ── Settings ───────────────────────────────────────────────────────────────

  function updateSettings(patch) {
    settings = { ...settings, ...patch };
    notifyScreen('settings-update', settings);
    schedulePreview();
  }

  // ── Active map ─────────────────────────────────────────────────────────────

  function setActiveMap(map) {
    currentMap = map ?? null;
    notifyScreen('map-update', currentMap);
    schedulePreview();
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  function getDisplays() {
    const primary = screen.getPrimaryDisplay();
    return screen.getAllDisplays().map((d) => ({
      id:          d.id,
      bounds:      d.bounds,
      scaleFactor: d.scaleFactor,
      isPrimary:   d.id === primary.id,
      active:      d.id === activeDisplayId,
    }));
  }

  function getSettings() { return { ...settings }; }

  return {
    createGMWindow,
    selectDisplay, closeScreen,
    updateSettings, setActiveMap,
    getDisplays, getSettings,
    capturePreview,
  };
}

module.exports = { createWindowManager, DEFAULT_SETTINGS };
