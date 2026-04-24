function createDisplayManager({
  BrowserWindow, screen,
  preloadPath, gmRendererPath, screenRendererPath, screenAdvancedRendererPath,
  getState,
}) {
  let gmWindow        = null;
  let screenWindow    = null;
  let activeDisplayId = null;
  let previewTimer    = null;

  // ── IPC helpers ────────────────────────────────────────────────────────────

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

  // ── Preview capture ────────────────────────────────────────────────────────

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

  // ── GM window ──────────────────────────────────────────────────────────────

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

    gmWindow.webContents.on('did-finish-load', () => {
      const { settings } = getState();
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

  // ── Screen window ──────────────────────────────────────────────────────────

  function selectDisplay(displayId) {
    const displays = screen.getAllDisplays();
    const display  = displays.find((d) => d.id === displayId);
    if (!display) return null;

    if (screenWindow) {
      screenWindow.removeAllListeners('closed');
      screenWindow.destroy();
      screenWindow = null;
    }

    activeDisplayId = displayId;
    const suggestedDpi = Math.round(96 * display.scaleFactor);
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

    const { settings } = getState();
    const isAdvanced = settings.screenMode === 'advanced' && screenAdvancedRendererPath;
    screenWindow.loadFile(isAdvanced ? screenAdvancedRendererPath : screenRendererPath);

    screenWindow.webContents.on('did-finish-load', () => {
      const { settings: s, scene, currentMap } = getState();
      notifyScreen('settings-update', s);
      if (s.screenMode === 'advanced') {
        notifyScreen('scene-update', { ...scene, map: currentMap });
      } else {
        if (currentMap) notifyScreen('map-update', currentMap);
      }
      schedulePreview();
    });

    screenWindow.on('closed', () => {
      screenWindow    = null;
      activeDisplayId = null;
      clearTimeout(previewTimer);
      notifyGM('screen-closed');
    });

    notifyGM('screen-opened', displayId, suggestedDpi, display.bounds.width, display.bounds.height);
    return { suggestedDpi };
  }

  function closeScreen() {
    if (!screenWindow) return false;
    screenWindow.close();
    return true;
  }

  // ── Display enumeration ────────────────────────────────────────────────────

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

  function getActiveDisplayId() { return activeDisplayId; }

  return {
    notifyGM, notifyScreen,
    capturePreview, schedulePreview,
    createGMWindow,
    selectDisplay, closeScreen, getDisplays, getActiveDisplayId,
  };
}

module.exports = { createDisplayManager };
