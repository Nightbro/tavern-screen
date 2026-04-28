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
    expect(lib.getCampaignsDir()).toBe(path.join(tmp, 'save', 'campaigns'));
  });
});

// ── setRootFolder ─────────────────────────────────────────────────────────────

describe('setRootFolder', () => {
  test('creates campaigns/ subdirectory', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    expect(fs.existsSync(path.join(tmp, 'save', 'campaigns'))).toBe(true);
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
    fs.writeFileSync(path.join(tmp, 'save', 'campaigns', 'notafolder.txt'), '');
    const { campaigns } = lib.scan();
    expect(campaigns).toHaveLength(0);
  });

  test('returns sessions: [] when sessions/ dir is absent', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    // Create campaign dir without sessions subdir
    fs.mkdirSync(path.join(tmp, 'save', 'campaigns', 'Empty'));
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
    expect(fs.existsSync(path.join(tmp, 'save', 'campaigns', 'The Lost Mines', 'sessions'))).toBe(true);
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
    expect(fs.existsSync(path.join(tmp, 'save', 'campaigns', 'OldName'))).toBe(false);
    expect(fs.existsSync(path.join(tmp, 'save', 'campaigns', 'NewName'))).toBe(true);
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
    expect(fs.existsSync(path.join(tmp, 'save', 'campaigns', 'ToDelete'))).toBe(false);
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
    expect(fs.existsSync(path.join(tmp, 'save', 'campaigns', 'C', 'sessions', 'Session 1'))).toBe(true);
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
    expect(fs.existsSync(path.join(tmp, 'save', 'campaigns', 'C', 'sessions', 'Old'))).toBe(false);
    expect(fs.existsSync(path.join(tmp, 'save', 'campaigns', 'C', 'sessions', 'New'))).toBe(true);
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
    expect(fs.existsSync(path.join(tmp, 'save', 'campaigns', 'C', 'sessions', 'S1'))).toBe(false);
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
    const file = path.join(tmp, 'save', 'campaigns', 'C', 'notes.md');
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
    const file = path.join(tmp, 'save', 'campaigns', 'C', 'sessions', 'S1', 'notes.md');
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

function hudsFilePath(tmp) { return path.join(tmp, 'save', 'huds.json'); }
// Read raw file content (new format: { lastActiveId, groups })
function readHudsRaw(tmp) { return JSON.parse(fs.readFileSync(hudsFilePath(tmp), 'utf8')); }
// Convenience: just the groups array from disk
function readHudsGroups(tmp) { return readHudsRaw(tmp).groups; }

describe('saveHudGroup', () => {
  test('returns null when no root folder is set', () => {
    const { lib } = setup();
    expect(lib.saveHudGroup({ id: 'g1', name: 'Group 1', huds: [] })).toBeNull();
  });

  test('writes all groups to huds.json at the root folder', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'Group 1', huds: [] });
    expect(fs.existsSync(hudsFilePath(tmp))).toBe(true);
  });

  test('returns summary with id and name', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    const result = lib.saveHudGroup({ id: 'g1', name: 'My Group', huds: [] });
    expect(result).toEqual({ id: 'g1', name: 'My Group' });
  });

  test('multiple groups coexist in a single huds.json', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'Combat', huds: [] });
    lib.saveHudGroup({ id: 'g2', name: 'Exploration', huds: [] });
    const groups = readHudsGroups(tmp);
    expect(groups).toHaveLength(2);
    expect(groups.map(g => g.id)).toEqual(['g1', 'g2']);
  });

  test('persists the huds array inside the group entry', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    const huds = [{ id: 'h1', type: 'initiative' }];
    lib.saveHudGroup({ id: 'g1', name: 'G', huds });
    const [entry] = readHudsGroups(tmp);
    expect(entry.huds).toHaveLength(1);
    expect(entry.huds[0].id).toBe('h1');
  });

  test('overwrites an existing group with the same id', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'First', huds: [] });
    lib.saveHudGroup({ id: 'g1', name: 'Second', huds: [] });
    const groups = readHudsGroups(tmp);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Second');
  });

  test('huds.json has { lastActiveId, groups } shape', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'G', huds: [] });
    const raw = readHudsRaw(tmp);
    expect(raw).toHaveProperty('groups');
    expect(raw).toHaveProperty('lastActiveId');
    expect(Array.isArray(raw.groups)).toBe(true);
  });
});

describe('listHudGroups', () => {
  test('returns { lastActiveId: null, groups: [] } when no root folder is set', () => {
    const { lib } = setup();
    expect(lib.listHudGroups()).toEqual({ lastActiveId: null, groups: [] });
  });

  test('returns empty groups when huds.json does not exist', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    expect(lib.listHudGroups()).toEqual({ lastActiveId: null, groups: [] });
  });

  test('returns groups in insertion order', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'First', huds: [] });
    lib.saveHudGroup({ id: 'g2', name: 'Second', huds: [] });
    const { groups } = lib.listHudGroups();
    expect(groups[0].id).toBe('g1');
    expect(groups[1].id).toBe('g2');
  });

  test('each item has id and name (no huds payload)', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'Group', huds: [{ id: 'h1' }] });
    const { groups } = lib.listHudGroups();
    const [item] = groups;
    expect(item.id).toBe('g1');
    expect(item.name).toBe('Group');
    expect(item.huds).toBeUndefined();
  });

  test('reflects lastActiveId set by setLastActiveHudGroupId', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'G', huds: [] });
    lib.setLastActiveHudGroupId('g1');
    expect(lib.listHudGroups().lastActiveId).toBe('g1');
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

  test('returns null when huds.json does not exist', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    expect(lib.loadHudGroup('g1')).toBeNull();
  });

  test('returns the correct group by id including huds array', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'Combat', huds: [{ id: 'h1', type: 'initiative' }] });
    lib.saveHudGroup({ id: 'g2', name: 'Explore', huds: [] });
    const group = lib.loadHudGroup('g1');
    expect(group).not.toBeNull();
    expect(group.id).toBe('g1');
    expect(group.name).toBe('Combat');
    expect(group.huds).toHaveLength(1);
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

  test('removes the group from huds.json', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'G', huds: [] });
    lib.deleteHudGroup('g1');
    expect(lib.listHudGroups().groups).toHaveLength(0);
  });

  test('leaves other groups intact', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'A', huds: [] });
    lib.saveHudGroup({ id: 'g2', name: 'B', huds: [] });
    lib.deleteHudGroup('g1');
    const { groups } = lib.listHudGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('g2');
  });

  test('does not throw when group does not exist', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    expect(() => lib.deleteHudGroup('ghost')).not.toThrow();
  });

  test('clears lastActiveId when the active group is deleted', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'G', huds: [] });
    lib.setLastActiveHudGroupId('g1');
    lib.deleteHudGroup('g1');
    expect(lib.listHudGroups().lastActiveId).toBeNull();
  });

  test('preserves lastActiveId when a different group is deleted', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'A', huds: [] });
    lib.saveHudGroup({ id: 'g2', name: 'B', huds: [] });
    lib.setLastActiveHudGroupId('g2');
    lib.deleteHudGroup('g1');
    expect(lib.listHudGroups().lastActiveId).toBe('g2');
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

  test('updates the name in huds.json', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'Old', huds: [] });
    lib.renameHudGroup('g1', 'New Name');
    expect(readHudsGroups(tmp)[0].name).toBe('New Name');
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
    expect(lib.listHudGroups().groups[0].name).toBe('New Name');
  });

  test('does not change other groups or huds after rename', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'Old', huds: [{ id: 'h1' }] });
    lib.saveHudGroup({ id: 'g2', name: 'Other', huds: [] });
    lib.renameHudGroup('g1', 'New');
    const g1 = lib.loadHudGroup('g1');
    expect(g1.huds).toHaveLength(1);
    expect(lib.loadHudGroup('g2').name).toBe('Other');
  });
});

describe('setLastActiveHudGroupId', () => {
  test('does not throw when no root folder is set', () => {
    const { lib } = setup();
    expect(() => lib.setLastActiveHudGroupId('g1')).not.toThrow();
  });

  test('persists lastActiveId to huds.json', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'G', huds: [] });
    lib.setLastActiveHudGroupId('g1');
    expect(readHudsRaw(tmp).lastActiveId).toBe('g1');
  });

  test('updating lastActiveId does not affect groups', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'G', huds: [{ id: 'h1' }] });
    lib.setLastActiveHudGroupId('g1');
    expect(lib.loadHudGroup('g1').huds).toHaveLength(1);
  });

  test('can be overwritten with a different id', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    lib.saveHudGroup({ id: 'g1', name: 'A', huds: [] });
    lib.saveHudGroup({ id: 'g2', name: 'B', huds: [] });
    lib.setLastActiveHudGroupId('g1');
    lib.setLastActiveHudGroupId('g2');
    expect(lib.listHudGroups().lastActiveId).toBe('g2');
  });
});

describe('HUD groups — legacy format migration', () => {
  test('reads old plain-array format without lastActiveId', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    // Write old plain-array format directly
    fs.writeFileSync(
      path.join(tmp, 'huds.json'),
      JSON.stringify([{ id: 'g1', name: 'Old', huds: [] }]),
      'utf8',
    );
    const { groups, lastActiveId } = lib.listHudGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('g1');
    expect(lastActiveId).toBeNull();
  });

  test('migrates old Huds/huds.json single-object format on first read', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    // Write old single-object at the legacy location
    const oldDir = path.join(tmp, 'Huds');
    fs.mkdirSync(oldDir, { recursive: true });
    fs.writeFileSync(
      path.join(oldDir, 'huds.json'),
      JSON.stringify({ id: 'huds', name: 'My HUDs', huds: [{ id: 'h1', type: 'initiative' }], savedAt: '2026-01-01' }),
      'utf8',
    );
    const { groups, lastActiveId } = lib.listHudGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('My HUDs');
    // huds payload is only in loadHudGroup; listHudGroups returns summaries
    const full = lib.loadHudGroup(groups[0].id);
    expect(full.huds).toHaveLength(1);
    expect(lastActiveId).toBe(groups[0].id);
  });

  test('migrated data is persisted to new huds.json location', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(tmp);
    const oldDir = path.join(tmp, 'Huds');
    fs.mkdirSync(oldDir, { recursive: true });
    fs.writeFileSync(
      path.join(oldDir, 'huds.json'),
      JSON.stringify({ id: 'huds', name: 'Legacy', huds: [] }),
      'utf8',
    );
    lib.listHudGroups(); // triggers migration + write
    expect(fs.existsSync(path.join(tmp, 'save', 'huds.json'))).toBe(true);
    const raw = readHudsRaw(tmp);
    expect(raw.groups[0].name).toBe('Legacy');
  });
});
