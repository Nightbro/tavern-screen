const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { createCampaignLibrary } = require('../src/main/campaignLibrary');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tavern-assets-'));
}

function makeConfig(initial = {}) {
  const data = { ...initial };
  return {
    get: (key, def = null) => (key in data ? data[key] : def),
    set: (key, val)        => { data[key] = val; },
  };
}

function setup() {
  const tmp = makeTmpDir();
  const lib = createCampaignLibrary(makeConfig());
  lib.setRootFolder(tmp);
  return { lib, tmp };
}

// Creates a real temp file to use as an asset source.
function makeSrcFile(dir, name = 'portrait.png', content = 'data') {
  const p = path.join(dir, name);
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

function assetsIndexPath(tmp, campaignId) {
  return campaignId
    ? path.join(tmp, 'userdata', 'campaigns', campaignId, 'assets', 'assets.json')
    : path.join(tmp, 'userdata', 'assets', 'assets.json');
}

function readIndex(tmp, campaignId) {
  return JSON.parse(fs.readFileSync(assetsIndexPath(tmp, campaignId), 'utf8'));
}

// ── listAssetTypes ────────────────────────────────────────────────────────────

describe('listAssetTypes', () => {
  test('returns default types when no index exists', () => {
    const { lib } = setup();
    expect(lib.listAssetTypes()).toEqual(['characters', 'maps', 'objects', 'handouts']);
  });

  test('returns types when no root folder is set', () => {
    const lib = createCampaignLibrary(makeConfig());
    expect(lib.listAssetTypes()).toEqual(['characters', 'maps', 'objects', 'handouts']);
  });
});

// ── addAssetType ──────────────────────────────────────────────────────────────

describe('addAssetType', () => {
  test('adds a new type and returns true', () => {
    const { lib } = setup();
    expect(lib.addAssetType('tokens')).toBe(true);
    expect(lib.listAssetTypes()).toContain('tokens');
  });

  test('returns false when type already exists', () => {
    const { lib } = setup();
    lib.addAssetType('tokens');
    expect(lib.addAssetType('tokens')).toBe(false);
  });

  test('persists to assets.json', () => {
    const { lib, tmp } = setup();
    lib.addAssetType('tokens');
    const index = readIndex(tmp, null);
    expect(index.types).toContain('tokens');
  });

  test('throws when no root folder is set', () => {
    const lib = createCampaignLibrary(makeConfig());
    expect(() => lib.addAssetType('tokens')).toThrow('No root folder set');
  });
});

// ── removeAssetType ───────────────────────────────────────────────────────────

describe('removeAssetType', () => {
  test('removes an existing type and returns true', () => {
    const { lib } = setup();
    lib.addAssetType('tokens');
    expect(lib.removeAssetType('tokens')).toBe(true);
    expect(lib.listAssetTypes()).not.toContain('tokens');
  });

  test('returns false when type does not exist', () => {
    const { lib } = setup();
    expect(lib.removeAssetType('ghost')).toBe(false);
  });

  test('throws when no root folder is set', () => {
    const lib = createCampaignLibrary(makeConfig());
    expect(() => lib.removeAssetType('maps')).toThrow('No root folder set');
  });
});

// ── listAssets ────────────────────────────────────────────────────────────────

describe('listAssets', () => {
  test('returns empty assets and default types when no assets exist', () => {
    const { lib } = setup();
    const { types, assets } = lib.listAssets(null);
    expect(assets).toEqual([]);
    expect(types).toEqual(['characters', 'maps', 'objects', 'handouts']);
  });

  test('global assets have scope: global', () => {
    const { lib, tmp } = setup();
    const src = makeSrcFile(tmp);
    lib.createAsset('Hero', 'characters', src, null);
    const { assets } = lib.listAssets(null);
    expect(assets[0].scope).toBe('global');
  });

  test('campaign assets have scope: campaign', () => {
    const { lib, tmp } = setup();
    lib.createCampaign('C');
    const src = makeSrcFile(tmp);
    lib.createAsset('Villain', 'characters', src, 'C');
    const { assets } = lib.listAssets('C');
    const campaign = assets.filter(a => a.scope === 'campaign');
    expect(campaign).toHaveLength(1);
    expect(campaign[0].name).toBe('Villain');
  });

  test('merges global and campaign assets when campaignId is provided', () => {
    const { lib, tmp } = setup();
    lib.createCampaign('C');
    lib.createAsset('Global Map', 'maps', makeSrcFile(tmp, 'g.png'), null);
    lib.createAsset('Local Map', 'maps', makeSrcFile(tmp, 'l.png'), 'C');
    const { assets } = lib.listAssets('C');
    expect(assets).toHaveLength(2);
    expect(assets.map(a => a.scope).sort()).toEqual(['campaign', 'global']);
  });

  test('global-only call does not include campaign assets', () => {
    const { lib, tmp } = setup();
    lib.createCampaign('C');
    lib.createAsset('Local', 'maps', makeSrcFile(tmp), 'C');
    const { assets } = lib.listAssets(null);
    expect(assets).toHaveLength(0);
  });
});

// ── createAsset ───────────────────────────────────────────────────────────────

describe('createAsset', () => {
  test('returns asset with id, name, type, scope, fileName', () => {
    const { lib, tmp } = setup();
    const src = makeSrcFile(tmp, 'hero.png');
    const asset = lib.createAsset('Hero', 'characters', src, null);
    expect(asset).toMatchObject({ name: 'Hero', type: 'characters', scope: 'global' });
    expect(asset.id).toBeTruthy();
  });

  test('persists fileName in assets.json index', () => {
    const { lib, tmp } = setup();
    const src = makeSrcFile(tmp, 'hero.png');
    lib.createAsset('Hero', 'characters', src, null);
    const index = readIndex(tmp, null);
    expect(index.assets[0].fileName).toBe('hero.png');
  });

  test('creates the asset folder on disk', () => {
    const { lib, tmp } = setup();
    const src = makeSrcFile(tmp);
    const asset = lib.createAsset('Hero', 'characters', src, null);
    const dir = path.join(tmp, 'userdata', 'assets', 'characters', asset.id);
    expect(fs.existsSync(dir)).toBe(true);
  });

  test('copies the source file into the asset folder', () => {
    const { lib, tmp } = setup();
    const src = makeSrcFile(tmp, 'map.png', 'pixels');
    const asset = lib.createAsset('Dungeon', 'maps', src, null);
    const dest = path.join(tmp, 'userdata', 'assets', 'maps', asset.id, 'map.png');
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.readFileSync(dest, 'utf8')).toBe('pixels');
  });

  test('writes asset.json inside the asset folder', () => {
    const { lib, tmp } = setup();
    const src = makeSrcFile(tmp);
    const asset = lib.createAsset('Hero', 'characters', src, null);
    const metaFile = path.join(tmp, 'userdata', 'assets', 'characters', asset.id, 'asset.json');
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    expect(meta).toMatchObject({ id: asset.id, name: 'Hero', type: 'characters' });
  });

  test('adds entry to assets.json index', () => {
    const { lib, tmp } = setup();
    const src = makeSrcFile(tmp);
    const asset = lib.createAsset('Hero', 'characters', src, null);
    const index = readIndex(tmp, null);
    expect(index.assets).toHaveLength(1);
    expect(index.assets[0].id).toBe(asset.id);
  });

  test('creates campaign-scoped asset in campaign assets folder', () => {
    const { lib, tmp } = setup();
    lib.createCampaign('C');
    const src = makeSrcFile(tmp);
    const asset = lib.createAsset('NPC', 'characters', src, 'C');
    const dir = path.join(tmp, 'userdata', 'campaigns', 'C', 'assets', 'characters', asset.id);
    expect(fs.existsSync(dir)).toBe(true);
    expect(asset.scope).toBe('campaign');
  });

  test('throws when no root folder is set', () => {
    const lib = createCampaignLibrary(makeConfig());
    expect(() => lib.createAsset('X', 'maps', '/some/file.png', null)).toThrow('No root folder set');
  });

  test('each asset gets a unique id', () => {
    const { lib, tmp } = setup();
    const a = lib.createAsset('A', 'maps', makeSrcFile(tmp, 'a.png'), null);
    const b = lib.createAsset('B', 'maps', makeSrcFile(tmp, 'b.png'), null);
    expect(a.id).not.toBe(b.id);
  });
});

// ── updateAsset ───────────────────────────────────────────────────────────────

describe('updateAsset', () => {
  test('returns true and updates the name in the index', () => {
    const { lib, tmp } = setup();
    const asset = lib.createAsset('Old', 'characters', makeSrcFile(tmp), null);
    expect(lib.updateAsset(asset.id, { name: 'New' }, null)).toBe(true);
    const { assets } = lib.listAssets(null);
    expect(assets[0].name).toBe('New');
  });

  test('updates asset.json on disk', () => {
    const { lib, tmp } = setup();
    const asset = lib.createAsset('Old', 'characters', makeSrcFile(tmp), null);
    lib.updateAsset(asset.id, { name: 'New' }, null);
    const metaFile = path.join(tmp, 'userdata', 'assets', 'characters', asset.id, 'asset.json');
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    expect(meta.name).toBe('New');
  });

  test('returns false when asset does not exist', () => {
    const { lib } = setup();
    expect(lib.updateAsset('nonexistent', { name: 'X' }, null)).toBe(false);
  });

  test('returns false when no root folder is set', () => {
    const lib = createCampaignLibrary(makeConfig());
    expect(lib.updateAsset('id', { name: 'X' }, null)).toBe(false);
  });
});

// ── deleteAsset ───────────────────────────────────────────────────────────────

describe('deleteAsset', () => {
  test('removes the asset folder from disk', () => {
    const { lib, tmp } = setup();
    const asset = lib.createAsset('Hero', 'characters', makeSrcFile(tmp), null);
    lib.deleteAsset(asset.id, null);
    const dir = path.join(tmp, 'userdata', 'assets', 'characters', asset.id);
    expect(fs.existsSync(dir)).toBe(false);
  });

  test('removes the entry from the index', () => {
    const { lib, tmp } = setup();
    const asset = lib.createAsset('Hero', 'characters', makeSrcFile(tmp), null);
    lib.deleteAsset(asset.id, null);
    expect(lib.listAssets(null).assets).toHaveLength(0);
  });

  test('does not throw when asset does not exist', () => {
    const { lib } = setup();
    expect(() => lib.deleteAsset('ghost', null)).not.toThrow();
  });

  test('does not affect other assets', () => {
    const { lib, tmp } = setup();
    const a = lib.createAsset('A', 'maps', makeSrcFile(tmp, 'a.png'), null);
    const b = lib.createAsset('B', 'maps', makeSrcFile(tmp, 'b.png'), null);
    lib.deleteAsset(a.id, null);
    const { assets } = lib.listAssets(null);
    expect(assets).toHaveLength(1);
    expect(assets[0].id).toBe(b.id);
  });
});

// ── moveAsset ─────────────────────────────────────────────────────────────────

describe('moveAsset', () => {
  test('moves a global asset into a campaign scope', () => {
    const { lib, tmp } = setup();
    lib.createCampaign('C');
    const asset = lib.createAsset('Map', 'maps', makeSrcFile(tmp), null);
    expect(lib.moveAsset(asset.id, null, 'C')).toBe(true);

    expect(lib.listAssets(null).assets).toHaveLength(0);
    const { assets } = lib.listAssets('C');
    expect(assets.filter(a => a.scope === 'campaign')).toHaveLength(1);
  });

  test('moves a campaign asset into global scope', () => {
    const { lib, tmp } = setup();
    lib.createCampaign('C');
    const asset = lib.createAsset('Map', 'maps', makeSrcFile(tmp), 'C');
    expect(lib.moveAsset(asset.id, 'C', null)).toBe(true);

    expect(lib.listAssets(null).assets).toHaveLength(1);
    const { assets } = lib.listAssets('C');
    expect(assets.filter(a => a.scope === 'campaign')).toHaveLength(0);
  });

  test('moves the folder on disk', () => {
    const { lib, tmp } = setup();
    lib.createCampaign('C');
    const asset = lib.createAsset('Map', 'maps', makeSrcFile(tmp), null);
    lib.moveAsset(asset.id, null, 'C');

    const oldDir = path.join(tmp, 'userdata', 'assets', 'maps', asset.id);
    const newDir = path.join(tmp, 'userdata', 'campaigns', 'C', 'assets', 'maps', asset.id);
    expect(fs.existsSync(oldDir)).toBe(false);
    expect(fs.existsSync(newDir)).toBe(true);
  });

  test('returns false when asset does not exist', () => {
    const { lib } = setup();
    lib.createCampaign('C');
    expect(lib.moveAsset('ghost', null, 'C')).toBe(false);
  });

  test('returns false when no root folder is set', () => {
    const lib = createCampaignLibrary(makeConfig());
    expect(lib.moveAsset('id', null, 'C')).toBe(false);
  });
});
