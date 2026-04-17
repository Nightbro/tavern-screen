const { randomUUID } = require('crypto');

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

function buildDefaultScene() {
  return {
    id:       randomUUID(),
    name:     '',
    map:      null,
    viewport: { centerX: 0.5, centerY: 0.5, zoom: 1.0 },
    layers:   [],
    huds:     [],
  };
}

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
  let currentScene    = null;

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

    if (isAdvanced && !currentScene) {
      currentScene = buildDefaultScene();
    }

    screenWindow.webContents.on('did-finish-load', () => {
      notifyScreen('settings-update', settings);
      if (settings.screenMode === 'advanced') {
        notifyScreen('scene-update', { ...currentScene, map: currentMap });
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
    const prevMode = settings.screenMode;
    settings = { ...settings, ...patch };

    if ('screenMode' in patch && patch.screenMode !== prevMode && screenWindow) {
      // Reload the screen window with the correct renderer
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
    if (settings.screenMode === 'advanced' && currentScene) {
      currentScene = { ...currentScene, map: currentMap };
      notifyScreen('scene-update', currentScene);
    } else {
      notifyScreen('map-update', currentMap);
    }
    schedulePreview();
  }

  // ── Scene ──────────────────────────────────────────────────────────────────

  function getScene() {
    return currentScene ? JSON.parse(JSON.stringify(currentScene)) : null;
  }

  function setScene(scene) {
    currentScene = { ...scene };
    notifyScreen('scene-update', currentScene);
  }

  function resetScene() {
    currentScene = buildDefaultScene();
    notifyScreen('scene-update', currentScene);
  }

  function updateSceneMeta(patch) {
    if (!currentScene) return;
    const allowed = {};
    if (patch.name !== undefined) allowed.name = patch.name;
    currentScene = { ...currentScene, ...allowed };
  }

  function updateViewport(patch) {
    if (!currentScene) return;
    currentScene = { ...currentScene, viewport: { ...currentScene.viewport, ...patch } };
    notifyScreen('viewport-update', currentScene.viewport);
    schedulePreview();
  }

  // ── Layers ─────────────────────────────────────────────────────────────────

  function addLayer(layer) {
    if (!currentScene) return;
    const newLayer = { id: randomUUID(), ...layer };
    currentScene = { ...currentScene, layers: [...currentScene.layers, newLayer] };
    notifyScreen('layers-update', currentScene.layers);
    schedulePreview();
  }

  function updateLayer(id, patch) {
    if (!currentScene) return;
    currentScene = {
      ...currentScene,
      layers: currentScene.layers.map(l => l.id === id ? { ...l, ...patch } : l),
    };
    notifyScreen('layers-update', currentScene.layers);
    schedulePreview();
  }

  function removeLayer(id) {
    if (!currentScene) return;
    currentScene = { ...currentScene, layers: currentScene.layers.filter(l => l.id !== id) };
    notifyScreen('layers-update', currentScene.layers);
    schedulePreview();
  }

  function reorderLayers(orderedIds) {
    if (!currentScene) return;
    const layerMap  = new Map(currentScene.layers.map(l => [l.id, l]));
    const reordered = orderedIds.map(id => layerMap.get(id)).filter(Boolean);
    const extra     = currentScene.layers.filter(l => !orderedIds.includes(l.id));
    currentScene = { ...currentScene, layers: [...reordered, ...extra] };
    notifyScreen('layers-update', currentScene.layers);
  }

  // ── HUDs ───────────────────────────────────────────────────────────────────

  function addHud(hud) {
    if (!currentScene) return;
    const newHud = { id: randomUUID(), ...hud };
    currentScene = { ...currentScene, huds: [...currentScene.huds, newHud] };
    notifyScreen('huds-update', currentScene.huds);
  }

  function updateHud(id, patch) {
    if (!currentScene) return;
    currentScene = {
      ...currentScene,
      huds: currentScene.huds.map(h => h.id === id ? { ...h, ...patch } : h),
    };
    notifyScreen('huds-update', currentScene.huds);
  }

  function removeHud(id) {
    if (!currentScene) return;
    currentScene = { ...currentScene, huds: currentScene.huds.filter(h => h.id !== id) };
    notifyScreen('huds-update', currentScene.huds);
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
    updateViewport,
    addLayer, updateLayer, removeLayer, reorderLayers,
    addHud, updateHud, removeHud,
    sendPing,
  };
}

module.exports = { createWindowManager, DEFAULT_SETTINGS };
