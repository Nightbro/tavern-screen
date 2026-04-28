const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { createCampaignLibrary } = require('../src/main/campaignLibrary');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tavern-camp-'));
}

function makeConfig(initial = {}) {
  const data = { ...initial };
  return {
    get: (key, def = null) => (key in data ? data[key] : def),
    set: (key, val)        => { data[key] = val; },
    _data: data,
  };
}

function setup(configData = {}) {
  const tmp = makeTmpDir();
  const cfg = makeConfig(configData);
  const lib = createCampaignLibrary(cfg);
  return { lib, tmp, cfg };
}

// ── getCampaignsDir ───────────────────────────────────────────────────────────

describe('getCampaignsDir', () => {
  test('returns null when no root folder is set', () => {
    const { lib } = setup();
    expect(lib.getCampaignsDir()).toBeNull();
  });

  test('returns rootFolder/campaigns when root is set', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    expect(lib.getCampaignsDir()).toBe(path.join(tmp, 'campaigns'));
  });
});

// ── setRootFolder ─────────────────────────────────────────────────────────────

describe('setRootFolder', () => {
  test('creates campaigns/ subdirectory', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    expect(fs.existsSync(path.join(tmp, 'campaigns'))).toBe(true);
  });

  test('persists root folder via config.set', () => {
    const { lib, tmp, cfg } = setup();
    lib.setRootFolder(tmp);
    expect(cfg._data.rootFolder).toBe(tmp);
  });
});

// ── scan ──────────────────────────────────────────────────────────────────────

describe('scan', () => {
  test('returns empty when no root folder is set', () => {
    const { lib } = setup();
    expect(lib.scan()).toEqual({ campaigns: [] });
  });

  test('returns empty when campaigns/ dir does not exist', () => {
    const { lib } = setup({ rootFolder: makeTmpDir() });
    expect(lib.scan()).toEqual({ campaigns: [] });
  });

  test('returns campaigns with their sessions', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('My Campaign');
    lib.createSession('My Campaign', 'Session 1');
    lib.createSession('My Campaign', 'Session 2');

    const { campaigns } = lib.scan();
    expect(campaigns).toHaveLength(1);
    expect(campaigns[0].id).toBe('My Campaign');
    expect(campaigns[0].sessions.map(s => s.id).sort()).toEqual(['Session 1', 'Session 2']);
  });

  test('ignores non-directory entries in campaigns/', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    fs.writeFileSync(path.join(tmp, 'campaigns', 'notafolder.txt'), '');
    const { campaigns } = lib.scan();
    expect(campaigns).toHaveLength(0);
  });

  test('returns sessions: [] when sessions/ dir is absent', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    // Create campaign dir without sessions subdir
    fs.mkdirSync(path.join(tmp, 'campaigns', 'Empty'));
    const { campaigns } = lib.scan();
    expect(campaigns[0].sessions).toEqual([]);
  });

  test('session objects include campaignId', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('C');
    lib.createSession('C', 'S1');
    const { campaigns } = lib.scan();
    expect(campaigns[0].sessions[0].campaignId).toBe('C');
  });
});

// ── createCampaign ────────────────────────────────────────────────────────────

describe('createCampaign', () => {
  test('creates campaigns/<name>/sessions/ on disk', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('The Lost Mines');
    expect(fs.existsSync(path.join(tmp, 'campaigns', 'The Lost Mines', 'sessions'))).toBe(true);
  });

  test('returns the new campaign object', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    const c = lib.createCampaign('Test');
    expect(c).toMatchObject({ id: 'Test', name: 'Test', sessions: [] });
  });

  test('throws when no root folder is set', () => {
    const { lib } = setup();
    expect(() => lib.createCampaign('X')).toThrow('No root folder set');
  });
});

// ── renameCampaign ────────────────────────────────────────────────────────────

describe('renameCampaign', () => {
  test('renames the directory on disk', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('OldName');
    lib.renameCampaign('OldName', 'NewName');
    expect(fs.existsSync(path.join(tmp, 'campaigns', 'OldName'))).toBe(false);
    expect(fs.existsSync(path.join(tmp, 'campaigns', 'NewName'))).toBe(true);
  });

  test('returns the new id', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('A');
    expect(lib.renameCampaign('A', 'B')).toBe('B');
  });
});

// ── deleteCampaign ────────────────────────────────────────────────────────────

describe('deleteCampaign', () => {
  test('removes the campaign directory recursively', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('ToDelete');
    lib.createSession('ToDelete', 'S1');
    lib.writeNotes('ToDelete', 'S1', 'some notes');
    lib.deleteCampaign('ToDelete');
    expect(fs.existsSync(path.join(tmp, 'campaigns', 'ToDelete'))).toBe(false);
  });

  test('does not throw if campaign does not exist', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    expect(() => lib.deleteCampaign('Ghost')).not.toThrow();
  });

  test('does not throw when no root folder is set', () => {
    const { lib } = setup();
    expect(() => lib.deleteCampaign('X')).not.toThrow();
  });
});

// ── createSession ─────────────────────────────────────────────────────────────

describe('createSession', () => {
  test('creates sessions/<name>/ on disk', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('C');
    lib.createSession('C', 'Session 1');
    expect(fs.existsSync(path.join(tmp, 'campaigns', 'C', 'sessions', 'Session 1'))).toBe(true);
  });

  test('returns the new session object', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('C');
    const s = lib.createSession('C', 'S1');
    expect(s).toMatchObject({ id: 'S1', name: 'S1', campaignId: 'C' });
  });

  test('throws when no root folder is set', () => {
    const { lib } = setup();
    expect(() => lib.createSession('C', 'S')).toThrow('No root folder set');
  });
});

// ── renameSession ─────────────────────────────────────────────────────────────

describe('renameSession', () => {
  test('renames the session directory', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('C');
    lib.createSession('C', 'Old');
    lib.renameSession('C', 'Old', 'New');
    expect(fs.existsSync(path.join(tmp, 'campaigns', 'C', 'sessions', 'Old'))).toBe(false);
    expect(fs.existsSync(path.join(tmp, 'campaigns', 'C', 'sessions', 'New'))).toBe(true);
  });

  test('returns the new name', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('C');
    lib.createSession('C', 'A');
    expect(lib.renameSession('C', 'A', 'B')).toBe('B');
  });
});

// ── deleteSession ─────────────────────────────────────────────────────────────

describe('deleteSession', () => {
  test('removes the session directory', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('C');
    lib.createSession('C', 'S1');
    lib.deleteSession('C', 'S1');
    expect(fs.existsSync(path.join(tmp, 'campaigns', 'C', 'sessions', 'S1'))).toBe(false);
  });

  test('does not throw if session does not exist', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('C');
    expect(() => lib.deleteSession('C', 'Ghost')).not.toThrow();
  });
});

// ── readNotes / writeNotes ────────────────────────────────────────────────────

describe('readCampaignNotes / writeCampaignNotes', () => {
  test('returns empty string when campaign notes.md does not exist', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('C');
    expect(lib.readCampaignNotes('C')).toBe('');
  });

  test('writes and reads campaign-level notes.md', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('C');
    lib.writeCampaignNotes('C', 'Campaign overview');
    expect(lib.readCampaignNotes('C')).toBe('Campaign overview');
  });

  test('campaign notes file is at campaigns/<id>/notes.md (not inside sessions/)', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('C');
    lib.writeCampaignNotes('C', 'top level');
    const file = path.join(tmp, 'campaigns', 'C', 'notes.md');
    expect(fs.existsSync(file)).toBe(true);
  });

  test('overwrites existing campaign notes', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('C');
    lib.writeCampaignNotes('C', 'First');
    lib.writeCampaignNotes('C', 'Second');
    expect(lib.readCampaignNotes('C')).toBe('Second');
  });
});

describe('readNotes', () => {
  test('returns empty string when notes.md does not exist', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('C');
    lib.createSession('C', 'S1');
    expect(lib.readNotes('C', 'S1')).toBe('');
  });

  test('returns file content when notes.md exists', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('C');
    lib.createSession('C', 'S1');
    lib.writeNotes('C', 'S1', 'Hello session');
    expect(lib.readNotes('C', 'S1')).toBe('Hello session');
  });
});

describe('writeNotes', () => {
  test('creates notes.md at the correct path', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('C');
    lib.createSession('C', 'S1');
    lib.writeNotes('C', 'S1', 'My notes');
    const file = path.join(tmp, 'campaigns', 'C', 'sessions', 'S1', 'notes.md');
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toBe('My notes');
  });

  test('overwrites existing notes.md', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('C');
    lib.createSession('C', 'S1');
    lib.writeNotes('C', 'S1', 'First');
    lib.writeNotes('C', 'S1', 'Second');
    expect(lib.readNotes('C', 'S1')).toBe('Second');
  });

  test('creates intermediate directories if session dir does not yet exist', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.createCampaign('C');
    // Do NOT call createSession — writeNotes should still work
    expect(() => lib.writeNotes('C', 'S1', 'Notes')).not.toThrow();
    expect(lib.readNotes('C', 'S1')).toBe('Notes');
  });
});

// ── HUD Groups ────────────────────────────────────────────────────────────────

describe('setRootFolder — Huds/ directory', () => {
  test('creates Huds/ directory when root folder is set', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    expect(fs.existsSync(path.join(tmp, 'Huds'))).toBe(true);
  });
});

describe('createCampaignLibrary — Huds/ on startup', () => {
  test('creates Huds/ directory when config has an existing root folder', () => {
    const tmp = makeTmpDir();
    const cfg = makeConfig({ rootFolder: tmp });
    createCampaignLibrary(cfg);
    expect(fs.existsSync(path.join(tmp, 'Huds'))).toBe(true);
  });

  test('does not throw when config root folder does not exist', () => {
    const cfg = makeConfig({ rootFolder: '/nonexistent/path/abc123' });
    expect(() => createCampaignLibrary(cfg)).not.toThrow();
  });
});

describe('saveHudGroup', () => {
  test('returns null when no root folder is set', () => {
    const { lib } = setup();
    expect(lib.saveHudGroup({ id: 'g1', name: 'Group 1', huds: [] })).toBeNull();
  });

  test('writes the group to Huds/<id>.json', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'Group 1', huds: [] });
    expect(fs.existsSync(path.join(tmp, 'Huds', 'g1.json'))).toBe(true);
  });

  test('returns summary with id, name, and savedAt', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    const result = lib.saveHudGroup({ id: 'g1', name: 'My Group', huds: [] });
    expect(result).toMatchObject({ id: 'g1', name: 'My Group' });
    expect(result.savedAt).toBeDefined();
  });

  test('persists the huds array in the file', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    const huds = [{ id: 'h1', type: 'initiative' }];
    lib.saveHudGroup({ id: 'g1', name: 'G', huds });
    const data = JSON.parse(fs.readFileSync(path.join(tmp, 'Huds', 'g1.json'), 'utf8'));
    expect(data.huds).toHaveLength(1);
    expect(data.huds[0].id).toBe('h1');
  });

  test('overwrites an existing group with the same id', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'First', huds: [] });
    lib.saveHudGroup({ id: 'g1', name: 'Second', huds: [] });
    const data = JSON.parse(fs.readFileSync(path.join(tmp, 'Huds', 'g1.json'), 'utf8'));
    expect(data.name).toBe('Second');
  });
});

describe('listHudGroups', () => {
  test('returns [] when no root folder is set', () => {
    const { lib } = setup();
    expect(lib.listHudGroups()).toEqual([]);
  });

  test('returns [] when Huds/ directory is empty', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    expect(lib.listHudGroups()).toEqual([]);
  });

  test('returns summary list sorted by savedAt descending', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'old', name: 'Old', huds: [] });
    lib.saveHudGroup({ id: 'new', name: 'New', huds: [] });
    const list = lib.listHudGroups();
    expect(list[0].id).toBe('new');
    expect(list[1].id).toBe('old');
  });

  test('each item has id, name, and savedAt', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'Group', huds: [] });
    const [item] = lib.listHudGroups();
    expect(item.id).toBe('g1');
    expect(item.name).toBe('Group');
    expect(item.savedAt).toBeDefined();
  });
});

describe('loadHudGroup', () => {
  test('returns null when no root folder is set', () => {
    const { lib } = setup();
    expect(lib.loadHudGroup('g1')).toBeNull();
  });

  test('returns null when the group does not exist', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    expect(lib.loadHudGroup('nonexistent')).toBeNull();
  });

  test('returns the full group including huds array', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    const huds = [{ id: 'h1', type: 'initiative' }, { id: 'h2', type: 'status' }];
    lib.saveHudGroup({ id: 'g1', name: 'Battle', huds });
    const group = lib.loadHudGroup('g1');
    expect(group).not.toBeNull();
    expect(group.id).toBe('g1');
    expect(group.name).toBe('Battle');
    expect(group.huds).toHaveLength(2);
    expect(group.huds[0].id).toBe('h1');
  });

  test('round-trips: save then load returns identical huds', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    const huds = [{ id: 'h1', type: 'handout', visible: true, text: 'Hello' }];
    lib.saveHudGroup({ id: 'g1', name: 'G', huds });
    const loaded = lib.loadHudGroup('g1');
    expect(loaded.huds[0]).toMatchObject({ id: 'h1', type: 'handout', visible: true, text: 'Hello' });
  });
});

describe('deleteHudGroup', () => {
  test('does not throw when no root folder is set', () => {
    const { lib } = setup();
    expect(() => lib.deleteHudGroup('g1')).not.toThrow();
  });

  test('removes the group file from Huds/', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'G', huds: [] });
    lib.deleteHudGroup('g1');
    expect(fs.existsSync(path.join(tmp, 'Huds', 'g1.json'))).toBe(false);
  });

  test('does not throw when group does not exist', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    expect(() => lib.deleteHudGroup('ghost')).not.toThrow();
  });

  test('group is absent from listHudGroups after deletion', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'G', huds: [] });
    lib.deleteHudGroup('g1');
    expect(lib.listHudGroups()).toHaveLength(0);
  });
});

describe('renameHudGroup', () => {
  test('returns false when no root folder is set', () => {
    const { lib } = setup();
    expect(lib.renameHudGroup('g1', 'New Name')).toBe(false);
  });

  test('returns false when group does not exist', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    expect(lib.renameHudGroup('ghost', 'New Name')).toBe(false);
  });

  test('updates the name in the file', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'Old', huds: [] });
    lib.renameHudGroup('g1', 'New Name');
    const data = JSON.parse(fs.readFileSync(path.join(tmp, 'Huds', 'g1.json'), 'utf8'));
    expect(data.name).toBe('New Name');
  });

  test('returns true on success', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'A', huds: [] });
    expect(lib.renameHudGroup('g1', 'B')).toBe(true);
  });

  test('renamed name appears in listHudGroups', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'Old', huds: [] });
    lib.renameHudGroup('g1', 'New Name');
    expect(lib.listHudGroups()[0].name).toBe('New Name');
  });

  test('does not change the id or huds after rename', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    const huds = [{ id: 'h1', type: 'initiative' }];
    lib.saveHudGroup({ id: 'g1', name: 'Old', huds });
    lib.renameHudGroup('g1', 'New');
    const loaded = lib.loadHudGroup('g1');
    expect(loaded.id).toBe('g1');
    expect(loaded.huds).toHaveLength(1);
  });
});
