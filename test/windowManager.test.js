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
      send:          jest.fn(),
      on:            jest.fn((event, cb) => { webHandlers[event] = cb; }),
      capturePage:   jest.fn(() => Promise.resolve({
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

function makeManager(displays = [DISPLAY_1, DISPLAY_2]) {
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

  test('sends active map to screen window after it loads', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.addMaps(['/maps/dungeon.jpg']);
    manager.setActiveMap(manager.getMaps()[0].id);
    manager.selectDisplay(DISPLAY_1.id);
    windows[1]._fireWeb('did-finish-load');
    expect(windows[1].webContents.send).toHaveBeenCalledWith(
      'map-update', expect.objectContaining({ name: 'dungeon.jpg' })
    );
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

  test('switching monitors opens a new screen window on the new display', () => {
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
    const openedCalls = windows[0].webContents.send.mock.calls
      .filter(([ch]) => ch === 'screen-opened');
    expect(openedCalls).toHaveLength(2);
    expect(openedCalls[1][1]).toBe(DISPLAY_2.id);
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
    const calls = windows[1].webContents.send.mock.calls
      .filter(([ch]) => ch === 'settings-update');
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

// ── Map management ────────────────────────────────────────────────────────────

describe('addMaps', () => {
  test('returns added map objects with id, path, name', () => {
    const { manager } = makeManager();
    const added = manager.addMaps(['/maps/dungeon.jpg', '/maps/forest.png']);
    expect(added).toHaveLength(2);
    expect(added[0]).toMatchObject({ path: '/maps/dungeon.jpg', name: 'dungeon.jpg' });
    expect(added[1]).toMatchObject({ path: '/maps/forest.png', name: 'forest.png' });
    expect(added[0].id).toBeTruthy();
    expect(added[0].id).not.toBe(added[1].id);
  });

  test('accumulates maps across multiple calls', () => {
    const { manager } = makeManager();
    manager.addMaps(['/maps/a.jpg']);
    manager.addMaps(['/maps/b.jpg']);
    expect(manager.getMaps()).toHaveLength(2);
  });
});

describe('setActiveMap', () => {
  test('returns false when map ID does not exist', () => {
    const { manager } = makeManager();
    expect(manager.setActiveMap('nonexistent')).toBe(false);
  });

  test('returns true and sends map-update to screen window', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    manager.addMaps(['/maps/dungeon.jpg']);
    const mapId = manager.getMaps()[0].id;

    expect(manager.setActiveMap(mapId)).toBe(true);
    expect(windows[1].webContents.send).toHaveBeenCalledWith(
      'map-update', expect.objectContaining({ id: mapId, path: '/maps/dungeon.jpg' })
    );
  });

  test('does not throw when no screen window is open', () => {
    const { manager } = makeManager();
    manager.createGMWindow();
    manager.addMaps(['/maps/dungeon.jpg']);
    const mapId = manager.getMaps()[0].id;
    expect(() => manager.setActiveMap(mapId)).not.toThrow();
  });
});

describe('removeMap', () => {
  test('removes the map from the list', () => {
    const { manager } = makeManager();
    manager.addMaps(['/maps/a.jpg', '/maps/b.jpg']);
    const id = manager.getMaps()[0].id;
    manager.removeMap(id);
    const remaining = manager.getMaps();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].path).toBe('/maps/b.jpg');
  });

  test('sends null map-update when the active map is removed', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    manager.addMaps(['/maps/a.jpg']);
    const id = manager.getMaps()[0].id;
    manager.setActiveMap(id);
    manager.removeMap(id);
    expect(windows[1].webContents.send).toHaveBeenCalledWith('map-update', null);
  });

  test('removing a non-active map does not send map-update', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    manager.addMaps(['/maps/a.jpg', '/maps/b.jpg']);
    const [mapA, mapB] = manager.getMaps();
    manager.setActiveMap(mapA.id);
    windows[1].webContents.send.mockClear();

    manager.removeMap(mapB.id); // remove non-active
    const mapUpdateCalls = windows[1].webContents.send.mock.calls
      .filter(([ch]) => ch === 'map-update');
    expect(mapUpdateCalls).toHaveLength(0);
  });

  test('removing a non-existent map does not throw', () => {
    const { manager } = makeManager();
    expect(() => manager.removeMap('nonexistent')).not.toThrow();
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
