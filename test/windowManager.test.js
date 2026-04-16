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
