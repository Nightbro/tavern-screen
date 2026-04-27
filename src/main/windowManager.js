const { createSceneState } = require('./sceneState');
const { createDisplayManager } = require('./displayManager');

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
  let settings   = { ...DEFAULT_SETTINGS, ...(initialSettings ?? {}) };
  let currentMap = null;

  const sceneState = createSceneState();

  const display = createDisplayManager({
    BrowserWindow, screen,
    preloadPath, gmRendererPath, screenRendererPath, screenAdvancedRendererPath,
    getState: () => ({ settings, scene: sceneState.get(), currentMap }),
  });

  // ── Settings ───────────────────────────────────────────────────────────────

  function updateSettings(patch) {
    const prevMode = settings.screenMode;
    settings = { ...settings, ...patch };

    if ('screenMode' in patch && patch.screenMode !== prevMode && display.getActiveDisplayId()) {
      display.selectDisplay(display.getActiveDisplayId());
    } else {
      display.notifyScreen('settings-update', settings);
      display.schedulePreview();
    }
  }

  function getSettings() { return { ...settings }; }

  // ── Display ────────────────────────────────────────────────────────────────

  function selectDisplay(displayId) {
    const result = display.selectDisplay(displayId);
    if (result) settings = { ...settings, dpi: result.suggestedDpi };
    return result !== null;
  }

  // ── Active map ─────────────────────────────────────────────────────────────

  function setActiveMap(map) {
    currentMap = map ?? null;
    if (settings.screenMode === 'advanced') {
      sceneState.setMap(currentMap);
      display.notifyScreen('scene-update', sceneState.get());
    } else {
      display.notifyScreen('map-update', currentMap);
    }
    display.schedulePreview();
  }

  // ── Scene ──────────────────────────────────────────────────────────────────

  function getScene() { return sceneState.get(); }

  function setScene(scene) {
    sceneState.set(scene);
    display.notifyScreen('scene-update', sceneState.get());
  }

  function resetScene() {
    sceneState.reset();
    display.notifyScreen('scene-update', sceneState.get());
  }

  function updateSceneMeta(patch) {
    sceneState.updateMeta(patch);
  }

  function updateViewport(patch) {
    const viewport = sceneState.updateViewport(patch);
    display.notifyScreen('viewport-update', viewport);
    display.schedulePreview();
  }

  // ── Layers ─────────────────────────────────────────────────────────────────

  function addLayer(layer) {
    const layers = sceneState.addLayer(layer);
    display.notifyScreen('layers-update', layers);
    display.schedulePreview();
  }

  function updateLayer(id, patch) {
    const layers = sceneState.updateLayer(id, patch);
    display.notifyScreen('layers-update', layers);
    display.schedulePreview();
  }

  function removeLayer(id) {
    const layers = sceneState.removeLayer(id);
    display.notifyScreen('layers-update', layers);
    display.schedulePreview();
  }

  function reorderLayers(orderedIds) {
    const layers = sceneState.reorderLayers(orderedIds);
    display.notifyScreen('layers-update', layers);
  }

  // ── HUDs ───────────────────────────────────────────────────────────────────

  function getHuds()     { return sceneState.getHuds(); }
  function setHuds(huds) { sceneState.setHuds(huds); display.notifyScreen('huds-update', huds); }

  function addHud(hud) {
    const huds = sceneState.addHud(hud);
    display.notifyScreen('huds-update', huds);
  }

  function updateHud(id, patch) {
    const huds = sceneState.updateHud(id, patch);
    display.notifyScreen('huds-update', huds);
  }

  function removeHud(id) {
    const huds = sceneState.removeHud(id);
    display.notifyScreen('huds-update', huds);
  }

  function sendPing(x, y) {
    display.notifyScreen('ping', x, y);
  }

  return {
    createGMWindow: display.createGMWindow,
    selectDisplay,
    closeScreen:    display.closeScreen,
    getDisplays:    display.getDisplays,
    capturePreview: display.capturePreview,
    updateSettings, getSettings,
    setActiveMap,
    getScene, setScene, resetScene, updateSceneMeta,
    getHuds, setHuds,
    updateViewport,
    addLayer, updateLayer, removeLayer, reorderLayers,
    addHud, updateHud, removeHud,
    sendPing,
  };
}

module.exports = { createWindowManager, DEFAULT_SETTINGS };
