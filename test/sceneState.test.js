const { createSceneState, buildDefaultScene } = require('../sceneState');

// ── buildDefaultScene ─────────────────────────────────────────────────────────

describe('buildDefaultScene', () => {
  test('returns scene with empty layers and huds', () => {
    const scene = buildDefaultScene();
    expect(scene.layers).toEqual([]);
    expect(scene.huds).toEqual([]);
  });

  test('returns a UUID id, empty name, default viewport, and background', () => {
    const scene = buildDefaultScene();
    expect(scene.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(scene.name).toBe('');
    expect(scene.viewport).toEqual({ cx: 4096, cy: 4096, zoom: 1.0 });
    expect(scene.background).toBe('#1a1a2e');
    expect(scene.map).toBeNull();
  });

  test('generates a different UUID on each call', () => {
    expect(buildDefaultScene().id).not.toBe(buildDefaultScene().id);
  });
});

// ── createSceneState ──────────────────────────────────────────────────────────

describe('createSceneState', () => {
  function make() { return createSceneState(); }

  // ── get ────────────────────────────────────────────────────────────────────

  test('get returns a deep copy — mutations do not affect internal state', () => {
    const s = make();
    const snap = s.get();
    snap.name = 'mutated';
    expect(s.get().name).toBe('');
  });

  // ── set ────────────────────────────────────────────────────────────────────

  test('set replaces scene data', () => {
    const s = make();
    s.set({ id: 'new-id', name: 'Loaded', viewport: { cx: 100, cy: 100, zoom: 1 }, layers: [], background: '#000', map: null });
    expect(s.get().id).toBe('new-id');
    expect(s.get().name).toBe('Loaded');
  });

  test('set preserves existing in-memory huds (huds come from separate store)', () => {
    const s = make();
    s.addHud({ type: 'initiative' });
    const hudId = s.getHuds()[0].id;
    s.set({ id: 'x', name: '', viewport: { cx: 4096, cy: 4096, zoom: 1 }, layers: [], background: '#000', map: null });
    expect(s.getHuds()[0].id).toBe(hudId);
  });

  test('set discards huds property from the incoming scene', () => {
    const s = make();
    s.addHud({ type: 'init' });
    s.set({ id: 'x', name: '', viewport: { cx: 4096, cy: 4096, zoom: 1 }, layers: [], background: '#000', huds: [] });
    expect(s.getHuds()).toHaveLength(1); // original hud preserved, not replaced with []
  });

  // ── reset ──────────────────────────────────────────────────────────────────

  test('reset assigns a new UUID id', () => {
    const s = make();
    const firstId = s.get().id;
    s.reset();
    expect(s.get().id).not.toBe(firstId);
  });

  test('reset clears layers, huds, and name', () => {
    const s = make();
    s.addLayer({ type: 'fog' });
    s.addHud({ type: 'initiative' });
    s.updateMeta({ name: 'Before' });
    s.reset();
    expect(s.get().layers).toHaveLength(0);
    expect(s.get().huds).toHaveLength(0);
    expect(s.get().name).toBe('');
  });

  // ── setMap ─────────────────────────────────────────────────────────────────

  test('setMap updates the map in the scene', () => {
    const s = make();
    s.setMap({ id: 'dungeon', path: '/dungeon.jpg' });
    expect(s.get().map).toMatchObject({ id: 'dungeon' });
  });

  test('setMap(null) clears the map', () => {
    const s = make();
    s.setMap({ id: 'x' });
    s.setMap(null);
    expect(s.get().map).toBeNull();
  });

  // ── updateMeta ─────────────────────────────────────────────────────────────

  test('updateMeta sets name', () => {
    const s = make();
    s.updateMeta({ name: 'My Scene' });
    expect(s.get().name).toBe('My Scene');
  });

  test('updateMeta sets background', () => {
    const s = make();
    s.updateMeta({ background: '#ff0000' });
    expect(s.get().background).toBe('#ff0000');
  });

  test('updateMeta ignores unknown fields', () => {
    const s = make();
    s.updateMeta({ name: 'Good', evil: 'injected', layers: ['hacked'] });
    expect(s.get().evil).toBeUndefined();
    expect(s.get().layers).toEqual([]);
  });

  // ── updateViewport ─────────────────────────────────────────────────────────

  test('updateViewport merges the patch', () => {
    const s = make();
    s.updateViewport({ zoom: 2.0 });
    expect(s.get().viewport.zoom).toBe(2.0);
    expect(s.get().viewport.cx).toBe(4096); // unchanged
  });

  test('updateViewport returns the new viewport object', () => {
    const s = make();
    const vp = s.updateViewport({ zoom: 1.5 });
    expect(vp.zoom).toBe(1.5);
  });

  // ── HUDs (setHuds / getHuds) ───────────────────────────────────────────────

  test('setHuds replaces the entire huds array', () => {
    const s = make();
    s.setHuds([{ id: 'h1', type: 'clock' }]);
    expect(s.getHuds()).toHaveLength(1);
    expect(s.getHuds()[0].id).toBe('h1');
  });

  // ── Layers ─────────────────────────────────────────────────────────────────

  test('addLayer assigns a UUID id and returns updated layers', () => {
    const s = make();
    const layers = s.addLayer({ type: 'image' });
    expect(layers).toHaveLength(1);
    expect(layers[0].id).toMatch(/^[0-9a-f]{8}-/);
    expect(layers[0].type).toBe('image');
  });

  test('updateLayer patches by id', () => {
    const s = make();
    s.addLayer({ type: 'image', visible: true });
    const id = s.get().layers[0].id;
    s.updateLayer(id, { visible: false });
    expect(s.get().layers[0].visible).toBe(false);
  });

  test('updateLayer does not affect other layers', () => {
    const s = make();
    s.addLayer({ type: 'a' });
    s.addLayer({ type: 'b' });
    const [l1, l2] = s.get().layers;
    s.updateLayer(l1.id, { visible: false });
    expect(s.get().layers.find(l => l.id === l2.id).visible).toBeUndefined();
  });

  test('removeLayer removes by id', () => {
    const s = make();
    s.addLayer({ type: 'fog' });
    const id = s.get().layers[0].id;
    const layers = s.removeLayer(id);
    expect(layers).toHaveLength(0);
  });

  test('reorderLayers reorders by provided id array', () => {
    const s = make();
    s.addLayer({ type: 'a' });
    s.addLayer({ type: 'b' });
    const [l1, l2] = s.get().layers;
    s.reorderLayers([l2.id, l1.id]);
    const result = s.get().layers;
    expect(result[0].id).toBe(l2.id);
    expect(result[1].id).toBe(l1.id);
  });

  // ── HUDs (addHud / updateHud / removeHud) ─────────────────────────────────

  test('addHud assigns a UUID id and returns updated huds', () => {
    const s = make();
    const huds = s.addHud({ type: 'initiative' });
    expect(huds).toHaveLength(1);
    expect(huds[0].id).toMatch(/^[0-9a-f]{8}-/);
    expect(huds[0].type).toBe('initiative');
  });

  test('updateHud patches by id', () => {
    const s = make();
    s.addHud({ type: 'initiative', visible: true });
    const id = s.getHuds()[0].id;
    s.updateHud(id, { visible: false });
    expect(s.getHuds()[0].visible).toBe(false);
  });

  test('updateHud can replace the entries array', () => {
    const s = make();
    s.addHud({ type: 'initiative', entries: [] });
    const id = s.getHuds()[0].id;
    const entries = [{ id: 'e1', name: 'Fighter', initiative: 20 }];
    s.updateHud(id, { entries });
    expect(s.getHuds()[0].entries).toEqual(entries);
  });

  test('removeHud removes by id and returns updated huds', () => {
    const s = make();
    s.addHud({ type: 'initiative' });
    const id = s.getHuds()[0].id;
    const huds = s.removeHud(id);
    expect(huds).toHaveLength(0);
  });
});
