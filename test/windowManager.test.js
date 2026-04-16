const { createWindowManager, DEFAULT_SETTINGS } = require('../windowManager');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockWindow() {
  const handlers    = {};
  const webHandlers = {};
  const win = {
    loadFile:           jest.fn(),
    destroy:            jest.fn(),
    close:              jest.fn(),
    isDestroyed:        jest.fn(() => false),
    removeAllListeners: jest.fn((event) => { delete handlers[event]; }),
    on:                 jest.fn((event, cb) => { handlers[event] = cb; }),
    webContents: {
      send:        jest.fn(),
      on:          jest.fn((event, cb) => { webHandlers[event] = cb; }),
      capturePage: jest.fn(() => Promise.resolve({
        resize:    () => ({ toDataURL: () => 'data:image/png;base64,fake' }),
        toDataURL: () => 'data:image/png;base64,fake',
      })),
    },
    _fire:    (event, ...args) => handlers[event]?.(...args),
    _fireWeb: (event, ...args) => webHandlers[event]?.(...args),
  };
  win.close.mockImplementation(() => win._fire('closed'));
  return win;
}

const DISPLAY_1 = { id: 1, bounds: { x: 0,    y: 0, width: 1920, height: 1080 }, scaleFactor: 1   };
const DISPLAY_2 = { id: 2, bounds: { x: 1920, y: 0, width: 2560, height: 1440 }, scaleFactor: 1.5 };

function makeManager(displays = [DISPLAY_1, DISPLAY_2], options = {}) {
  const windows = [];

  const MockBrowserWindow = jest.fn().mockImplementation(() => {
    const win = makeMockWindow();
    windows.push(win);
    return win;
  });

  const mockScreen = {
    getAllDisplays:    jest.fn(() => displays),
    getPrimaryDisplay: jest.fn(() => displays[0]),
  };

  const manager = createWindowManager({
    BrowserWindow:      MockBrowserWindow,
    screen:             mockScreen,
    preloadPath:        '/fake/preload.js',
    gmRendererPath:     '/fake/gm.html',
    screenRendererPath: '/fake/screen.html',
    ...options,
  });

  return { manager, MockBrowserWindow, mockScreen, windows };
}

// ── createGMWindow ────────────────────────────────────────────────────────────

describe('createGMWindow', () => {
  test('creates a BrowserWindow and loads the GM renderer', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    expect(windows).toHaveLength(1);
    expect(windows[0].loadFile).toHaveBeenCalledWith('/fake/gm.html');
  });

  test('sends initial-settings to GM after it loads', () => {
    const saved = { zoom: 2.0, dpi: 144, gridVisible: false };
    const { manager, windows } = makeManager(undefined, { initialSettings: saved });
    manager.createGMWindow();
    windows[0]._fireWeb('did-finish-load');
    expect(windows[0].webContents.send).toHaveBeenCalledWith(
      'initial-settings',
      expect.objectContaining({ zoom: 2.0, dpi: 144, gridVisible: false })
    );
  });

  test('merges initialSettings over DEFAULT_SETTINGS', () => {
    const { manager } = makeManager(undefined, { initialSettings: { zoom: 1.5 } });
    const s = manager.getSettings();
    expect(s.zoom).toBe(1.5);
    expect(s.gridVisible).toBe(DEFAULT_SETTINGS.gridVisible); // unchanged default
  });
});

// ── selectDisplay ─────────────────────────────────────────────────────────────

describe('selectDisplay', () => {
  test('returns false when display ID does not exist', () => {
    const { manager } = makeManager();
    manager.createGMWindow();
    expect(manager.selectDisplay(999)).toBe(false);
  });

  test('opens a player screen on the selected display', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    expect(manager.selectDisplay(DISPLAY_1.id)).toBe(true);
    expect(windows).toHaveLength(2);
    expect(windows[1].loadFile).toHaveBeenCalledWith('/fake/screen.html');
  });

  test('player screen is positioned on the selected display bounds', () => {
    const { manager, MockBrowserWindow } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_2.id);
    const opts = MockBrowserWindow.mock.calls[1][0];
    expect(opts.x).toBe(DISPLAY_2.bounds.x);
    expect(opts.y).toBe(DISPLAY_2.bounds.y);
    expect(opts.fullscreen).toBe(true);
    expect(opts.frame).toBe(false);
  });

  test('notifies GM of screen-opened with displayId and suggestedDpi', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_2.id);
    expect(windows[0].webContents.send).toHaveBeenCalledWith(
      'screen-opened', DISPLAY_2.id, Math.round(96 * DISPLAY_2.scaleFactor)
    );
  });

  test('sends current settings to screen window after it loads', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    windows[1]._fireWeb('did-finish-load');
    expect(windows[1].webContents.send).toHaveBeenCalledWith(
      'settings-update', expect.objectContaining({ gridVisible: DEFAULT_SETTINGS.gridVisible })
    );
  });

  test('sends current active map to screen window after it loads', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    const map = { id: 'dungeon.jpg', path: '/maps/dungeon.jpg', name: 'dungeon.jpg' };
    manager.setActiveMap(map);
    manager.selectDisplay(DISPLAY_1.id);
    windows[1]._fireWeb('did-finish-load');
    expect(windows[1].webContents.send).toHaveBeenCalledWith('map-update', map);
  });

  // ── KEY BUG: switching monitors ───────────────────────────────────────────

  test('switching monitors destroys old screen without sending screen-closed to GM', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    const firstScreen = windows[1];

    manager.selectDisplay(DISPLAY_2.id);

    expect(firstScreen.destroy).toHaveBeenCalled();
    expect(firstScreen.removeAllListeners).toHaveBeenCalledWith('closed');

    const screenClosedCalls = windows[0].webContents.send.mock.calls
      .filter(([ch]) => ch === 'screen-closed');
    expect(screenClosedCalls).toHaveLength(0);
  });

  test('switching monitors opens a new screen on the new display', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    manager.selectDisplay(DISPLAY_2.id);
    expect(windows).toHaveLength(3);
    expect(windows[2].loadFile).toHaveBeenCalledWith('/fake/screen.html');
  });

  test('switching monitors sends screen-opened for both selections', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    manager.selectDisplay(DISPLAY_2.id);
    const calls = windows[0].webContents.send.mock.calls.filter(([ch]) => ch === 'screen-opened');
    expect(calls).toHaveLength(2);
    expect(calls[1][1]).toBe(DISPLAY_2.id);
  });

  test('selecting the same display twice replaces the window', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    manager.selectDisplay(DISPLAY_1.id);
    expect(windows).toHaveLength(3);
    expect(windows[1].destroy).toHaveBeenCalled();
  });
});

// ── closeScreen ───────────────────────────────────────────────────────────────

describe('closeScreen', () => {
  test('returns false when no player screen is open', () => {
    const { manager } = makeManager();
    manager.createGMWindow();
    expect(manager.closeScreen()).toBe(false);
  });

  test('returns true and closes the window when a screen is open', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    expect(manager.closeScreen()).toBe(true);
    expect(windows[1].close).toHaveBeenCalled();
  });

  test('notifies GM of screen-closed after the window closes', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    manager.closeScreen();
    expect(windows[0].webContents.send).toHaveBeenCalledWith('screen-closed');
  });

  test('calling closeScreen twice does nothing on the second call', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    manager.closeScreen();
    expect(manager.closeScreen()).toBe(false);
    expect(windows[1].close).toHaveBeenCalledTimes(1);
  });
});

// ── updateSettings ────────────────────────────────────────────────────────────

describe('updateSettings', () => {
  test('forwards setting patches to the screen window', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    manager.updateSettings({ zoom: 1.5 });
    const calls = windows[1].webContents.send.mock.calls.filter(([ch]) => ch === 'settings-update');
    expect(calls.at(-1)[1].zoom).toBe(1.5);
  });

  test('merges patch without resetting other values', () => {
    const { manager } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    manager.updateSettings({ zoom: 2.0 });
    manager.updateSettings({ gridVisible: false });
    const s = manager.getSettings();
    expect(s.zoom).toBe(2.0);
    expect(s.gridVisible).toBe(false);
    expect(s.cellSizeInches).toBe(DEFAULT_SETTINGS.cellSizeInches);
  });

  test('does not throw when no screen window is open', () => {
    const { manager } = makeManager();
    manager.createGMWindow();
    expect(() => manager.updateSettings({ zoom: 1.5 })).not.toThrow();
  });
});

// ── setActiveMap ──────────────────────────────────────────────────────────────

describe('setActiveMap', () => {
  const map = { id: 'dungeon.jpg', path: '/maps/dungeon.jpg', name: 'dungeon.jpg' };

  test('sends map-update to the screen window', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    manager.setActiveMap(map);
    expect(windows[1].webContents.send).toHaveBeenCalledWith('map-update', map);
  });

  test('sends null map-update when called with null', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    manager.setActiveMap(null);
    expect(windows[1].webContents.send).toHaveBeenCalledWith('map-update', null);
  });

  test('does not throw when no screen window is open', () => {
    const { manager } = makeManager();
    manager.createGMWindow();
    expect(() => manager.setActiveMap(map)).not.toThrow();
  });

  test('active map is re-sent to new screen window on reconnect', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.setActiveMap(map);
    manager.selectDisplay(DISPLAY_1.id);
    windows[1]._fireWeb('did-finish-load');
    expect(windows[1].webContents.send).toHaveBeenCalledWith('map-update', map);
  });
});

// ── capturePreview ────────────────────────────────────────────────────────────

describe('capturePreview', () => {
  test('sends screen-preview data URL to GM window', async () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    await manager.capturePreview();
    expect(windows[0].webContents.send).toHaveBeenCalledWith(
      'screen-preview', expect.stringContaining('data:image/png')
    );
  });

  test('does not throw when no screen window is open', async () => {
    const { manager } = makeManager();
    manager.createGMWindow();
    await expect(manager.capturePreview()).resolves.not.toThrow();
  });
});

// ── getDisplays ───────────────────────────────────────────────────────────────

describe('getDisplays', () => {
  test('marks the active display after selectDisplay', () => {
    const { manager } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_2.id);
    const displays = manager.getDisplays();
    expect(displays.find((d) => d.id === DISPLAY_2.id).active).toBe(true);
    expect(displays.find((d) => d.id === DISPLAY_1.id).active).toBe(false);
  });

  test('no display is active before any selectDisplay call', () => {
    const { manager } = makeManager();
    manager.createGMWindow();
    expect(manager.getDisplays().every((d) => !d.active)).toBe(true);
  });

  test('no display is active after closeScreen', () => {
    const { manager } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    manager.closeScreen();
    expect(manager.getDisplays().every((d) => !d.active)).toBe(true);
  });
});

// ── GM window closed ──────────────────────────────────────────────────────────

describe('GM window closed', () => {
  test('destroys the screen window when GM is closed', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    windows[0]._fire('closed');
    expect(windows[1].removeAllListeners).toHaveBeenCalledWith('closed');
    expect(windows[1].destroy).toHaveBeenCalled();
  });

  test('closing GM with no screen open does not throw', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    expect(() => windows[0]._fire('closed')).not.toThrow();
  });
});

// ── DEFAULT_SETTINGS ──────────────────────────────────────────────────────────

describe('DEFAULT_SETTINGS', () => {
  test('screenMode defaults to simple', () => {
    expect(DEFAULT_SETTINGS.screenMode).toBe('simple');
  });
});

// ── screenMode routing in selectDisplay ──────────────────────────────────────

describe('screenMode routing in selectDisplay', () => {
  function makeAdvancedManager() {
    return makeManager(undefined, {
      screenAdvancedRendererPath: '/fake/screen-advanced.html',
      initialSettings: { screenMode: 'advanced' },
    });
  }

  test('simple mode loads the simple renderer', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    expect(windows[1].loadFile).toHaveBeenCalledWith('/fake/screen.html');
  });

  test('advanced mode loads the advanced renderer', () => {
    const { manager, windows } = makeAdvancedManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    expect(windows[1].loadFile).toHaveBeenCalledWith('/fake/screen-advanced.html');
  });

  test('advanced mode sends scene-update on did-finish-load', () => {
    const { manager, windows } = makeAdvancedManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    windows[1]._fireWeb('did-finish-load');
    expect(windows[1].webContents.send).toHaveBeenCalledWith(
      'scene-update', expect.objectContaining({ layers: [], huds: [] })
    );
  });

  test('simple mode sends map-update (not scene-update) on did-finish-load', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    windows[1]._fireWeb('did-finish-load');
    const sceneUpdateCalls = windows[1].webContents.send.mock.calls
      .filter(([ch]) => ch === 'scene-update');
    expect(sceneUpdateCalls).toHaveLength(0);
  });
});

// ── updateSettings screenMode change ─────────────────────────────────────────

describe('updateSettings screenMode change', () => {
  test('switching to advanced mode destroys old window and loads advanced renderer', () => {
    const { manager, windows } = makeManager(undefined, {
      screenAdvancedRendererPath: '/fake/screen-advanced.html',
    });
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    const oldScreen = windows[1];

    manager.updateSettings({ screenMode: 'advanced' });

    expect(oldScreen.destroy).toHaveBeenCalled();
    expect(oldScreen.removeAllListeners).toHaveBeenCalledWith('closed');
    expect(windows).toHaveLength(3);
    expect(windows[2].loadFile).toHaveBeenCalledWith('/fake/screen-advanced.html');
  });

  test('switching back to simple mode loads simple renderer', () => {
    const { manager, windows } = makeManager(undefined, {
      screenAdvancedRendererPath: '/fake/screen-advanced.html',
      initialSettings: { screenMode: 'advanced' },
    });
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);

    manager.updateSettings({ screenMode: 'simple' });

    expect(windows).toHaveLength(3);
    expect(windows[2].loadFile).toHaveBeenCalledWith('/fake/screen.html');
  });

  test('updating unrelated settings does not reload the screen window', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    manager.updateSettings({ zoom: 1.5 });
    expect(windows).toHaveLength(2);
    expect(windows[1].destroy).not.toHaveBeenCalled();
  });
});

// ── Scene state ───────────────────────────────────────────────────────────────

describe('scene state', () => {
  function makeAdvancedWithScreen() {
    const result = makeManager(undefined, {
      screenAdvancedRendererPath: '/fake/screen-advanced.html',
      initialSettings: { screenMode: 'advanced' },
    });
    result.manager.createGMWindow();
    result.manager.selectDisplay(DISPLAY_1.id);
    return result;
  }

  test('getScene returns null before selectDisplay in advanced mode', () => {
    const { manager } = makeManager(undefined, {
      screenAdvancedRendererPath: '/fake/screen-advanced.html',
      initialSettings: { screenMode: 'advanced' },
    });
    manager.createGMWindow();
    expect(manager.getScene()).toBeNull();
  });

  test('getScene returns scene with empty layers and huds after selectDisplay', () => {
    const { manager } = makeAdvancedWithScreen();
    const scene = manager.getScene();
    expect(scene).not.toBeNull();
    expect(scene.layers).toEqual([]);
    expect(scene.huds).toEqual([]);
  });

  test('addLayer adds a layer with a generated id', () => {
    const { manager } = makeAdvancedWithScreen();
    manager.addLayer({ type: 'image', src: '/maps/bg.jpg' });
    const { layers } = manager.getScene();
    expect(layers).toHaveLength(1);
    expect(layers[0].id).toBeDefined();
    expect(layers[0].type).toBe('image');
  });

  test('addLayer sends layers-update to screen', () => {
    const { manager, windows } = makeAdvancedWithScreen();
    manager.addLayer({ type: 'fog' });
    expect(windows[1].webContents.send).toHaveBeenCalledWith(
      'layers-update',
      expect.arrayContaining([expect.objectContaining({ type: 'fog' })])
    );
  });

  test('updateLayer patches a layer by id', () => {
    const { manager } = makeAdvancedWithScreen();
    manager.addLayer({ type: 'image', visible: true });
    const { layers } = manager.getScene();
    manager.updateLayer(layers[0].id, { visible: false });
    expect(manager.getScene().layers[0].visible).toBe(false);
  });

  test('removeLayer removes the layer', () => {
    const { manager } = makeAdvancedWithScreen();
    manager.addLayer({ type: 'light' });
    const { layers } = manager.getScene();
    manager.removeLayer(layers[0].id);
    expect(manager.getScene().layers).toHaveLength(0);
  });

  test('reorderLayers reorders by provided id array', () => {
    const { manager } = makeAdvancedWithScreen();
    manager.addLayer({ type: 'image' });
    manager.addLayer({ type: 'fog' });
    const [l1, l2] = manager.getScene().layers;
    manager.reorderLayers([l2.id, l1.id]);
    const reordered = manager.getScene().layers;
    expect(reordered[0].id).toBe(l2.id);
    expect(reordered[1].id).toBe(l1.id);
  });

  test('updateViewport merges viewport patch', () => {
    const { manager } = makeAdvancedWithScreen();
    manager.updateViewport({ zoom: 2.0 });
    expect(manager.getScene().viewport.zoom).toBe(2.0);
    expect(manager.getScene().viewport.centerX).toBe(0.5); // unchanged
  });

  test('updateViewport sends viewport-update to screen', () => {
    const { manager, windows } = makeAdvancedWithScreen();
    manager.updateViewport({ zoom: 1.5 });
    expect(windows[1].webContents.send).toHaveBeenCalledWith(
      'viewport-update', expect.objectContaining({ zoom: 1.5 })
    );
  });

  test('addHud adds a HUD with a generated id', () => {
    const { manager } = makeAdvancedWithScreen();
    manager.addHud({ type: 'initiative', entries: [] });
    const { huds } = manager.getScene();
    expect(huds).toHaveLength(1);
    expect(huds[0].id).toBeDefined();
    expect(huds[0].type).toBe('initiative');
  });

  test('updateHud patches a HUD by id', () => {
    const { manager } = makeAdvancedWithScreen();
    manager.addHud({ type: 'initiative', visible: true });
    const { huds } = manager.getScene();
    manager.updateHud(huds[0].id, { visible: false });
    expect(manager.getScene().huds[0].visible).toBe(false);
  });

  test('updateHud can replace entries array', () => {
    const { manager } = makeAdvancedWithScreen();
    manager.addHud({ type: 'initiative', entries: [] });
    const { huds } = manager.getScene();
    const entries = [{ id: 'e1', name: 'Fighter', initiative: 20 }];
    manager.updateHud(huds[0].id, { entries });
    expect(manager.getScene().huds[0].entries).toEqual(entries);
  });

  test('removeHud removes the HUD', () => {
    const { manager } = makeAdvancedWithScreen();
    manager.addHud({ type: 'initiative' });
    const { huds } = manager.getScene();
    manager.removeHud(huds[0].id);
    expect(manager.getScene().huds).toHaveLength(0);
  });

  test('sendPing sends ping to screen with coordinates', () => {
    const { manager, windows } = makeAdvancedWithScreen();
    manager.sendPing(0.5, 0.3);
    expect(windows[1].webContents.send).toHaveBeenCalledWith('ping', 0.5, 0.3);
  });

  test('resetScene clears layers and huds', () => {
    const { manager } = makeAdvancedWithScreen();
    manager.addLayer({ type: 'image' });
    manager.addHud({ type: 'initiative' });
    manager.resetScene();
    const scene = manager.getScene();
    expect(scene.layers).toHaveLength(0);
    expect(scene.huds).toHaveLength(0);
  });

  test('setScene replaces the full scene', () => {
    const { manager, windows } = makeAdvancedWithScreen();
    const newScene = {
      map: null,
      viewport: { centerX: 0.5, centerY: 0.5, zoom: 2.0 },
      layers: [{ id: 'l1', type: 'fog' }],
      huds: [],
    };
    manager.setScene(newScene);
    expect(manager.getScene().viewport.zoom).toBe(2.0);
    expect(manager.getScene().layers[0].id).toBe('l1');
    expect(windows[1].webContents.send).toHaveBeenCalledWith('scene-update', expect.objectContaining({ layers: newScene.layers }));
  });
});
