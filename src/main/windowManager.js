// Top-level coordinator: ties together scene state, display management, and settings.

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

// Creates the window manager that owns settings, scene state, and the display manager.
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

  // Merges patch into settings; reopens the screen window if the screenMode changed.
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

  // Returns a shallow copy of the current settings.
  function getSettings() { return { ...settings }; }

  // ── Display ────────────────────────────────────────────────────────────────

  // Opens the cast screen on the chosen display and updates the suggested DPI setting.
  function selectDisplay(displayId) {
    const result = display.selectDisplay(displayId);
    if (result) settings = { ...settings, dpi: result.suggestedDpi };
    return result !== null;
  }

  // ── Active map ─────────────────────────────────────────────────────────────

  // Sets the active map and pushes the appropriate update to the screen window.
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

  // Returns a deep copy of the current scene.
  function getScene() { return sceneState.get(); }

  // Replaces the scene and notifies the screen window.
  function setScene(scene) {
    sceneState.set(scene);
    display.notifyScreen('scene-update', sceneState.get());
  }

  // Resets the scene to defaults and notifies the screen window.
  function resetScene() {
    sceneState.reset();
    display.notifyScreen('scene-update', sceneState.get());
  }

  // Applies a name/background patch to the scene without pushing an update to the screen.
  function updateSceneMeta(patch) {
    sceneState.updateMeta(patch);
  }

  // Updates the viewport and pushes it to the screen window, then schedules a preview.
  function updateViewport(patch) {
    const viewport = sceneState.updateViewport(patch);
    display.notifyScreen('viewport-update', viewport);
    display.schedulePreview();
  }

  // ── Layers ─────────────────────────────────────────────────────────────────

  // Adds a layer to the scene and notifies the screen window.
  function addLayer(layer) {
    const layers = sceneState.addLayer(layer);
    display.notifyScreen('layers-update', layers);
    display.schedulePreview();
  }

  // Updates a layer by id and notifies the screen window.
  function updateLayer(id, patch) {
    const layers = sceneState.updateLayer(id, patch);
    display.notifyScreen('layers-update', layers);
    display.schedulePreview();
  }

  // Removes a layer by id and notifies the screen window.
  function removeLayer(id) {
    const layers = sceneState.removeLayer(id);
    display.notifyScreen('layers-update', layers);
    display.schedulePreview();
  }

  // Reorders layers to match orderedIds and notifies the screen window.
  function reorderLayers(orderedIds) {
    const layers = sceneState.reorderLayers(orderedIds);
    display.notifyScreen('layers-update', layers);
  }

  // ── HUDs ───────────────────────────────────────────────────────────────────

  // Returns the current HUDs array.
  function getHuds()     { return sceneState.getHuds(); }
  // Replaces the HUDs array and notifies the screen window.
  function setHuds(huds) { sceneState.setHuds(huds); display.notifyScreen('huds-update', huds); }

  // Adds a HUD to the scene and notifies the screen window.
  function addHud(hud) {
    const huds = sceneState.addHud(hud);
    display.notifyScreen('huds-update', huds);
  }

  // Updates a HUD by id and notifies the screen window.
  function updateHud(id, patch) {
    const huds = sceneState.updateHud(id, patch);
    display.notifyScreen('huds-update', huds);
  }

  // Removes a HUD by id and notifies the screen window.
  function removeHud(id) {
    const huds = sceneState.removeHud(id);
    display.notifyScreen('huds-update', huds);
  }

  // Sends a ping marker at screen coordinates (x, y) to the cast window.
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
