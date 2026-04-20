const { randomUUID } = require('crypto');

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

function createSceneState() {
  let scene = buildDefaultScene();

  return {
    get() { return JSON.parse(JSON.stringify(scene)); },

    set(newScene) {
      const { huds: _ignored, ...sceneData } = newScene;
      scene = { ...sceneData, huds: scene.huds };
    },

    reset() { scene = buildDefaultScene(); },

    setMap(map) {
      scene = { ...scene, map: map ?? null };
    },

    updateMeta(patch) {
      const allowed = {};
      if (patch.name       !== undefined) allowed.name       = patch.name;
      if (patch.background !== undefined) allowed.background = patch.background;
      scene = { ...scene, ...allowed };
    },

    updateViewport(patch) {
      scene = { ...scene, viewport: { ...scene.viewport, ...patch } };
      return scene.viewport;
    },

    getHuds()     { return scene.huds; },
    setHuds(huds) { scene = { ...scene, huds }; },

    addLayer(layer) {
      const newLayer = { id: randomUUID(), ...layer };
      scene = { ...scene, layers: [...scene.layers, newLayer] };
      return scene.layers;
    },

    updateLayer(id, patch) {
      scene = { ...scene, layers: scene.layers.map(l => l.id === id ? { ...l, ...patch } : l) };
      return scene.layers;
    },

    removeLayer(id) {
      scene = { ...scene, layers: scene.layers.filter(l => l.id !== id) };
      return scene.layers;
    },

    reorderLayers(orderedIds) {
      const layerMap  = new Map(scene.layers.map(l => [l.id, l]));
      const reordered = orderedIds.map(id => layerMap.get(id)).filter(Boolean);
      const extra     = scene.layers.filter(l => !orderedIds.includes(l.id));
      scene = { ...scene, layers: [...reordered, ...extra] };
      return scene.layers;
    },

    addHud(hud) {
      const newHud = { id: randomUUID(), ...hud };
      scene = { ...scene, huds: [...scene.huds, newHud] };
      return scene.huds;
    },

    updateHud(id, patch) {
      scene = { ...scene, huds: scene.huds.map(h => h.id === id ? { ...h, ...patch } : h) };
      return scene.huds;
    },

    removeHud(id) {
      scene = { ...scene, huds: scene.huds.filter(h => h.id !== id) };
      return scene.huds;
    },
  };
}

module.exports = { createSceneState, buildDefaultScene };
