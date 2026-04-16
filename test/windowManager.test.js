const { createWindowManager, DEFAULT_SETTINGS } = require('../windowManager');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockWindow() {
  const handlers = {};
  const webHandlers = {};
  const win = {
    loadFile:           jest.fn(),
    destroy:            jest.fn(),
    close:              jest.fn(),
    isDestroyed:        jest.fn(() => false),
    removeAllListeners: jest.fn((event) => { delete handlers[event]; }),
    on:                 jest.fn((event, cb) => { handlers[event] = cb; }),
    webContents: {
      send: jest.fn(),
      on:   jest.fn((event, cb) => { webHandlers[event] = cb; }),
    },
    // Test helpers
    _fire:        (event, ...args) => handlers[event]?.(...args),
    _fireWeb:     (event, ...args) => webHandlers[event]?.(...args),
  };
  // close() fires the 'closed' handler, like Electron does
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
    getAllDisplays:   jest.fn(() => displays),
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
    manager.createGMWindow(); // windows[0] = GM

    const result = manager.selectDisplay(DISPLAY_1.id);

    expect(result).toBe(true);
    expect(windows).toHaveLength(2);
    expect(windows[1].loadFile).toHaveBeenCalledWith('/fake/screen.html');
  });

  test('player screen window is positioned on the selected display bounds', () => {
    const { manager, MockBrowserWindow } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_2.id);

    const screenWindowOpts = MockBrowserWindow.mock.calls[1][0]; // 2nd constructor call
    expect(screenWindowOpts.x).toBe(DISPLAY_2.bounds.x);
    expect(screenWindowOpts.y).toBe(DISPLAY_2.bounds.y);
    expect(screenWindowOpts.fullscreen).toBe(true);
    expect(screenWindowOpts.frame).toBe(false);
  });

  test('notifies GM of screen-opened with displayId and suggestedDpi', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_2.id);

    const gmWin = windows[0];
    expect(gmWin.webContents.send).toHaveBeenCalledWith(
      'screen-opened',
      DISPLAY_2.id,
      Math.round(96 * DISPLAY_2.scaleFactor)
    );
  });

  test('sends current settings to screen window after it loads', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);

    const screenWin = windows[1];
    // Simulate did-finish-load
    screenWin._fireWeb('did-finish-load');

    expect(screenWin.webContents.send).toHaveBeenCalledWith('settings-update', expect.objectContaining({
      gridVisible: DEFAULT_SETTINGS.gridVisible,
      cellSizeInches: DEFAULT_SETTINGS.cellSizeInches,
    }));
  });

  // ── KEY BUG SCENARIO ──────────────────────────────────────────────────────

  test('switching monitors destroys old screen without sending screen-closed to GM', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();

    manager.selectDisplay(DISPLAY_1.id); // Open on monitor 1
    const firstScreen = windows[1];

    manager.selectDisplay(DISPLAY_2.id); // Switch to monitor 2

    // Old screen should be destroyed (not closed via .close())
    expect(firstScreen.destroy).toHaveBeenCalled();
    expect(firstScreen.removeAllListeners).toHaveBeenCalledWith('closed');

    // GM must NOT have received screen-closed during the switch
    const gmWin = windows[0];
    const screenClosedCalls = gmWin.webContents.send.mock.calls.filter(
      ([channel]) => channel === 'screen-closed'
    );
    expect(screenClosedCalls).toHaveLength(0);
  });

  test('switching monitors opens a new screen window on the new display', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    manager.selectDisplay(DISPLAY_2.id);

    // 3 windows: GM + screen1 + screen2
    expect(windows).toHaveLength(3);
    expect(windows[2].loadFile).toHaveBeenCalledWith('/fake/screen.html');
  });

  test('switching monitors sends screen-opened for the new display', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    manager.selectDisplay(DISPLAY_2.id);

    const gmWin = windows[0];
    const openedCalls = gmWin.webContents.send.mock.calls.filter(
      ([channel]) => channel === 'screen-opened'
    );
    expect(openedCalls).toHaveLength(2); // once per selectDisplay call
    expect(openedCalls[1][1]).toBe(DISPLAY_2.id);
  });

  test('selecting the same display twice still replaces the window', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    manager.selectDisplay(DISPLAY_1.id);

    // Two separate screen windows created
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
    manager.closeScreen(); // triggers the closed handler via mock

    const gmWin = windows[0];
    expect(gmWin.webContents.send).toHaveBeenCalledWith('screen-closed');
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

    const screenWin = windows[1];
    const settingsCalls = screenWin.webContents.send.mock.calls.filter(
      ([channel]) => channel === 'settings-update'
    );
    const lastPayload = settingsCalls.at(-1)[1];
    expect(lastPayload.zoom).toBe(1.5);
  });

  test('merges patch into existing settings (does not reset other values)', () => {
    const { manager } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    manager.updateSettings({ zoom: 2.0 });
    manager.updateSettings({ gridVisible: false });

    const s = manager.getSettings();
    expect(s.zoom).toBe(2.0);
    expect(s.gridVisible).toBe(false);
    expect(s.cellSizeInches).toBe(DEFAULT_SETTINGS.cellSizeInches); // unchanged
  });

  test('does not throw when no screen window is open', () => {
    const { manager } = makeManager();
    manager.createGMWindow();
    expect(() => manager.updateSettings({ zoom: 1.5 })).not.toThrow();
  });
});

// ── getDisplays ───────────────────────────────────────────────────────────────

describe('getDisplays', () => {
  test('marks the active display correctly after selectDisplay', () => {
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

    const displays = manager.getDisplays();
    expect(displays.every((d) => !d.active)).toBe(true);
  });

  test('no display is marked active after closeScreen', () => {
    const { manager } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);
    manager.closeScreen();

    const displays = manager.getDisplays();
    expect(displays.every((d) => !d.active)).toBe(true);
  });
});

// ── GM window closed ──────────────────────────────────────────────────────────

describe('GM window closed', () => {
  test('destroys the screen window when GM is closed', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    manager.selectDisplay(DISPLAY_1.id);

    const screenWin = windows[1];
    windows[0]._fire('closed'); // simulate GM window close

    expect(screenWin.removeAllListeners).toHaveBeenCalledWith('closed');
    expect(screenWin.destroy).toHaveBeenCalled();
  });

  test('closing GM with no screen open does not throw', () => {
    const { manager, windows } = makeManager();
    manager.createGMWindow();
    expect(() => windows[0]._fire('closed')).not.toThrow();
  });
});
