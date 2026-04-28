// Manages the GM window and the cast screen window, including display selection and preview capture.

// Creates the display manager; getState is called each time a new screen window loads to push initial state.
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

  // Sends an IPC message to the GM window if it is open.
  function notifyGM(channel, ...args) {
    if (gmWindow && !gmWindow.isDestroyed()) {
      gmWindow.webContents.send(channel, ...args);
    }
  }

  // Sends an IPC message to the screen window if it is open.
  function notifyScreen(channel, ...args) {
    if (screenWindow && !screenWindow.isDestroyed()) {
      screenWindow.webContents.send(channel, ...args);
    }
  }

  // ── Preview capture ────────────────────────────────────────────────────────

  // Captures a 640px-wide screenshot of the screen window and sends it to the GM.
  async function capturePreview() {
    if (!screenWindow || screenWindow.isDestroyed()) return;
    try {
      const img = await screenWindow.webContents.capturePage();
      notifyGM('screen-preview', img.resize({ width: 640 }).toDataURL());
    } catch (_) { /* window may have closed between check and capture */ }
  }

  // Debounces preview capture by 350 ms to avoid excess captures on rapid updates.
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(capturePreview, 350);
  }

  // ── GM window ──────────────────────────────────────────────────────────────

  // Creates and shows the GM control window, destroying the screen window when it closes.
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

  // Opens a fullscreen cast window on the given display, replacing any existing screen window.
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

  // Closes the screen window if one is open, returning true on success.
  function closeScreen() {
    if (!screenWindow) return false;
    screenWindow.close();
    return true;
  }

  // ── Display enumeration ────────────────────────────────────────────────────

  // Returns all connected displays with their bounds, scale factor, and active/primary flags.
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

  // Returns the id of the display currently showing the screen window, or null.
  function getActiveDisplayId() { return activeDisplayId; }

  return {
    notifyGM, notifyScreen,
    capturePreview, schedulePreview,
    createGMWindow,
    selectDisplay, closeScreen, getDisplays, getActiveDisplayId,
  };
}

module.exports = { createDisplayManager };
