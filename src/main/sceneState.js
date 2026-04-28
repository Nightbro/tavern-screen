// In-memory scene state: holds the active scene and provides mutation helpers.

const { randomUUID } = require('crypto');

// Returns a fresh scene object with default values and a new UUID.
function buildDefaultScene() {
  return {
    id:         randomUUID(),
    name:       '',
    map:        null,
    viewport:   { cx: 4096, cy: 4096, zoom: 1.0 },
    background: '#1a1a2e',
    layers:     [],
    huds:       [],
  };
}

// Creates the scene state container used by the window manager.
function createSceneState() {
  let scene = buildDefaultScene();

  return {
    // Returns a deep copy of the current scene.
    get() { return JSON.parse(JSON.stringify(scene)); },

    // Replaces the scene, preserving live HUDs from the previous state.
    set(newScene) {
      const { huds: _ignored, ...sceneData } = newScene;
      scene = { ...sceneData, huds: scene.huds };
    },

    // Resets the scene to a fresh default.
    reset() { scene = buildDefaultScene(); },

    // Swaps the active map without touching other scene properties.
    setMap(map) {
      scene = { ...scene, map: map ?? null };
    },

    // Applies a partial update to name and/or background.
    updateMeta(patch) {
      const allowed = {};
      if (patch.name       !== undefined) allowed.name       = patch.name;
      if (patch.background !== undefined) allowed.background = patch.background;
      scene = { ...scene, ...allowed };
    },

    // Merges a viewport patch and returns the updated viewport.
    updateViewport(patch) {
      scene = { ...scene, viewport: { ...scene.viewport, ...patch } };
      return scene.viewport;
    },

    // Returns the current HUDs array.
    getHuds()     { return scene.huds; },
    // Replaces the HUDs array.
    setHuds(huds) { scene = { ...scene, huds }; },

    // Appends a new layer with a generated ID and returns the updated layers array.
    addLayer(layer) {
      const newLayer = { id: randomUUID(), ...layer };
      scene = { ...scene, layers: [...scene.layers, newLayer] };
      return scene.layers;
    },

    // Applies a patch to the layer matching id and returns the updated layers array.
    updateLayer(id, patch) {
      scene = { ...scene, layers: scene.layers.map(l => l.id === id ? { ...l, ...patch } : l) };
      return scene.layers;
    },

    // Removes the layer matching id and returns the updated layers array.
    removeLayer(id) {
      scene = { ...scene, layers: scene.layers.filter(l => l.id !== id) };
      return scene.layers;
    },

    // Reorders layers to match orderedIds, appending any unlisted layers at the end.
    reorderLayers(orderedIds) {
      const layerMap  = new Map(scene.layers.map(l => [l.id, l]));
      const reordered = orderedIds.map(id => layerMap.get(id)).filter(Boolean);
      const extra     = scene.layers.filter(l => !orderedIds.includes(l.id));
      scene = { ...scene, layers: [...reordered, ...extra] };
      return scene.layers;
    },

    // Appends a new HUD with a generated ID and returns the updated HUDs array.
    addHud(hud) {
      const newHud = { id: randomUUID(), ...hud };
      scene = { ...scene, huds: [...scene.huds, newHud] };
      return scene.huds;
    },

    // Applies a patch to the HUD matching id and returns the updated HUDs array.
    updateHud(id, patch) {
      scene = { ...scene, huds: scene.huds.map(h => h.id === id ? { ...h, ...patch } : h) };
      return scene.huds;
    },

    // Removes the HUD matching id and returns the updated HUDs array.
    removeHud(id) {
      scene = { ...scene, huds: scene.huds.filter(h => h.id !== id) };
      return scene.huds;
    },
  };
}

module.exports = { createSceneState, buildDefaultScene };
