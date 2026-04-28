const { registerCampaignHandlers } = require('../src/main/ipc/campaign');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeIpcMain() {
  const handlers = {};
  return {
    handle: jest.fn((channel, fn) => { handlers[channel] = fn; }),
    on:     jest.fn((channel, fn) => { handlers[channel] = fn; }),
    invoke: (channel, ...args)    => handlers[channel]?.({}, ...args),
    fire:   (channel, ...args)    => handlers[channel]?.({}, ...args),
    _handlers: handlers,
  };
}

function makeCampaignLib(overrides = {}) {
  return {
    scan:               jest.fn(() => ({ campaigns: [] })),
    createCampaign:     jest.fn(),
    renameCampaign:     jest.fn(),
    deleteCampaign:     jest.fn(),
    createSession:      jest.fn(),
    renameSession:      jest.fn(),
    deleteSession:      jest.fn(),
    readCampaignNotes:  jest.fn(() => ''),
    writeCampaignNotes: jest.fn(),
    readNotes:          jest.fn(() => ''),
    writeNotes:         jest.fn(),
    saveHudGroup:       jest.fn(),
    listHudGroups:      jest.fn(() => []),
    loadHudGroup:       jest.fn(() => null),
    deleteHudGroup:     jest.fn(),
    renameHudGroup:     jest.fn(() => false),
    saveScene:          jest.fn(),
    listScenes:         jest.fn(() => []),
    loadScene:          jest.fn(() => null),
    deleteScene:        jest.fn(),
    renameScene:        jest.fn(),
    ...overrides,
  };
}

function makeManager(overrides = {}) {
  return {
    setActiveMap: jest.fn(),
    setHuds:      jest.fn(),
    ...overrides,
  };
}

function setup(libOverrides = {}, managerOverrides = {}) {
  const ipcMain = makeIpcMain();
  const campaignLib = makeCampaignLib(libOverrides);
  const manager = makeManager(managerOverrides);
  registerCampaignHandlers(ipcMain, { campaignLib, manager });
  return { ipcMain, campaignLib, manager };
}

// ── load-hud-group ────────────────────────────────────────────────────────────

describe('IPC load-hud-group', () => {
  test('returns null and does not call setHuds when group does not exist', () => {
    const { ipcMain, manager } = setup({ loadHudGroup: jest.fn(() => null) });
    const result = ipcMain.invoke('load-hud-group', 'missing-id');
    expect(result).toBeNull();
    expect(manager.setHuds).not.toHaveBeenCalled();
  });

  test('calls campaignLib.loadHudGroup with the given id', () => {
    const loadHudGroup = jest.fn(() => null);
    const { ipcMain } = setup({ loadHudGroup });
    ipcMain.invoke('load-hud-group', 'g42');
    expect(loadHudGroup).toHaveBeenCalledWith('g42');
  });

  test('calls manager.setHuds with the group huds when group is found', () => {
    const huds = [{ id: 'h1', type: 'initiative' }];
    const { ipcMain, manager } = setup({
      loadHudGroup: jest.fn(() => ({ id: 'g1', name: 'Battle', huds })),
    });
    ipcMain.invoke('load-hud-group', 'g1');
    expect(manager.setHuds).toHaveBeenCalledWith(huds);
  });

  test('returns the full group object', () => {
    const group = { id: 'g1', name: 'Exploration', huds: [{ id: 'h2', type: 'status' }] };
    const { ipcMain } = setup({ loadHudGroup: jest.fn(() => group) });
    const result = ipcMain.invoke('load-hud-group', 'g1');
    expect(result).toBe(group);
  });

  test('does not call setHuds when group has no huds field', () => {
    const { ipcMain, manager } = setup({
      loadHudGroup: jest.fn(() => ({ id: 'g1', name: 'Empty' })),
    });
    ipcMain.invoke('load-hud-group', 'g1');
    expect(manager.setHuds).not.toHaveBeenCalled();
  });
});

// ── save-hud-group ────────────────────────────────────────────────────────────

describe('IPC save-hud-group', () => {
  test('calls campaignLib.saveHudGroup with the group payload', () => {
    const { ipcMain, campaignLib } = setup();
    const group = { id: 'g1', name: 'G', huds: [] };
    ipcMain.invoke('save-hud-group', group);
    expect(campaignLib.saveHudGroup).toHaveBeenCalledWith(group);
  });

  test('returns the result of saveHudGroup', () => {
    const summary = { id: 'g1', name: 'G', savedAt: '2026-01-01T00:00:00.000Z' };
    const { ipcMain } = setup({ saveHudGroup: jest.fn(() => summary) });
    expect(ipcMain.invoke('save-hud-group', {})).toBe(summary);
  });
});

// ── list-hud-groups ───────────────────────────────────────────────────────────

describe('IPC list-hud-groups', () => {
  test('returns the list from campaignLib', () => {
    const list = [{ id: 'g1', name: 'A' }, { id: 'g2', name: 'B' }];
    const { ipcMain } = setup({ listHudGroups: jest.fn(() => list) });
    expect(ipcMain.invoke('list-hud-groups')).toBe(list);
  });

  test('returns [] when no groups exist', () => {
    const { ipcMain } = setup({ listHudGroups: jest.fn(() => []) });
    expect(ipcMain.invoke('list-hud-groups')).toEqual([]);
  });
});

// ── delete-hud-group ──────────────────────────────────────────────────────────

describe('IPC delete-hud-group', () => {
  test('calls campaignLib.deleteHudGroup with the id', () => {
    const { ipcMain, campaignLib } = setup();
    ipcMain.invoke('delete-hud-group', 'g1');
    expect(campaignLib.deleteHudGroup).toHaveBeenCalledWith('g1');
  });
});

// ── rename-hud-group ──────────────────────────────────────────────────────────

describe('IPC rename-hud-group', () => {
  test('calls campaignLib.renameHudGroup with id and newName', () => {
    const { ipcMain, campaignLib } = setup();
    ipcMain.invoke('rename-hud-group', 'g1', 'New Name');
    expect(campaignLib.renameHudGroup).toHaveBeenCalledWith('g1', 'New Name');
  });

  test('returns the result of renameHudGroup', () => {
    const { ipcMain } = setup({ renameHudGroup: jest.fn(() => true) });
    expect(ipcMain.invoke('rename-hud-group', 'g1', 'N')).toBe(true);
  });
});
