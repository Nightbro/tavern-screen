const { createSceneState } = require('./sceneState');

const DEFAULT_SETTINGS = {
  gridVisible:          true,
  cellSizeInches:       1.0,
  zoom:                 1.0,
  dpi:                  96,
  gridColor:            '#ffffff',
  gridOpacity:          0.25,
  screenMode:           'simple',  // 'simple' | 'advanced'
  gridScaleWithViewport: true,     // advanced: grid scales with viewport zoom
};

function createWindowManager({
  BrowserWindow, screen,
  preloadPath, gmRendererPath, screenRendererPath,
  screenAdvancedRendererPath,
  initialSettings = null,
}) {
  let gmWindow        = null;
  let screenWindow    = null;
  let activeDisplayId = null;
  let settings        = { ...DEFAULT_SETTINGS, ...(initialSettings ?? {}) };
  let currentMap      = null;

  const sceneState = createSceneState();
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

    const isAdvanced = settings.screenMode === 'advanced' && screenAdvancedRendererPath;
    screenWindow.loadFile(isAdvanced ? screenAdvancedRendererPath : screenRendererPath);

    screenWindow.webContents.on('did-finish-load', () => {
      notifyScreen('settings-update', settings);
      if (settings.screenMode === 'advanced') {
        notifyScreen('scene-update', { ...sceneState.get(), map: currentMap });
      } else {
        if (currentMap) notifyScreen('map-update', currentMap);
      }
      schedulePreview();
    });

    screenWindow.on('closed', () => {
      screenWindow = null;
      activeDisplayId = null;
      clearTimeout(previewTimer);
      notifyGM('screen-closed');
    });

    notifyGM('screen-opened', displayId, suggestedDpi, display.bounds.width, display.bounds.height);
    return true;
  }

  function closeScreen() {
    if (!screenWindow) return false;
    screenWindow.close();
    return true;
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  function updateSettings(patch) {
    const prevMode = settings.screenMode;
    settings = { ...settings, ...patch };

    if ('screenMode' in patch && patch.screenMode !== prevMode && screenWindow) {
      screenWindow.removeAllListeners('closed');
      screenWindow.destroy();
      screenWindow = null;
      selectDisplay(activeDisplayId);
    } else {
      notifyScreen('settings-update', settings);
      schedulePreview();
    }
  }

  // ── Active map ─────────────────────────────────────────────────────────────

  function setActiveMap(map) {
    currentMap = map ?? null;
    if (settings.screenMode === 'advanced') {
      sceneState.setMap(currentMap);
      notifyScreen('scene-update', sceneState.get());
    } else {
      notifyScreen('map-update', currentMap);
    }
    schedulePreview();
  }

  // ── Scene ──────────────────────────────────────────────────────────────────

  function getScene() { return sceneState.get(); }

  function setScene(scene) {
    sceneState.set(scene);
    notifyScreen('scene-update', sceneState.get());
  }

  function setHuds(huds) {
    sceneState.setHuds(huds);
    notifyScreen('huds-update', huds);
  }

  function getHuds() { return sceneState.getHuds(); }

  function resetScene() {
    sceneState.reset();
    notifyScreen('scene-update', sceneState.get());
  }

  function updateSceneMeta(patch) {
    sceneState.updateMeta(patch);
  }

  function updateViewport(patch) {
    const viewport = sceneState.updateViewport(patch);
    notifyScreen('viewport-update', viewport);
    schedulePreview();
  }

  // ── Layers ─────────────────────────────────────────────────────────────────

  function addLayer(layer) {
    const layers = sceneState.addLayer(layer);
    notifyScreen('layers-update', layers);
    schedulePreview();
  }

  function updateLayer(id, patch) {
    const layers = sceneState.updateLayer(id, patch);
    notifyScreen('layers-update', layers);
    schedulePreview();
  }

  function removeLayer(id) {
    const layers = sceneState.removeLayer(id);
    notifyScreen('layers-update', layers);
    schedulePreview();
  }

  function reorderLayers(orderedIds) {
    const layers = sceneState.reorderLayers(orderedIds);
    notifyScreen('layers-update', layers);
  }

  // ── HUDs ───────────────────────────────────────────────────────────────────

  function addHud(hud) {
    const huds = sceneState.addHud(hud);
    notifyScreen('huds-update', huds);
  }

  function updateHud(id, patch) {
    const huds = sceneState.updateHud(id, patch);
    notifyScreen('huds-update', huds);
  }

  function removeHud(id) {
    const huds = sceneState.removeHud(id);
    notifyScreen('huds-update', huds);
  }

  function sendPing(x, y) {
    notifyScreen('ping', x, y);
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
    getScene, setScene, resetScene, updateSceneMeta,
    getHuds, setHuds,
    updateViewport,
    addLayer, updateLayer, removeLayer, reorderLayers,
    addHud, updateHud, removeHud,
    sendPing,
  };
}

module.exports = { createWindowManager, DEFAULT_SETTINGS };
