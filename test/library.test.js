const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { createLibrary } = require('../library');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tavern-test-'));
}

function setup() {
  const tmp        = makeTmpDir();
  const configPath = path.join(tmp, 'config.json');
  const lib        = createLibrary(configPath);
  return { lib, tmp, configPath };
}

function writeImage(dir, name) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), 'fake-image-data');
}

afterEach(() => {
  // temp dirs are OS-managed; nothing to clean up explicitly
});

// ── setRootFolder / getRootFolder ─────────────────────────────────────────────

describe('setRootFolder', () => {
  test('sets root folder and creates maps/ subdirectory', () => {
    const { lib, tmp } = setup();
    const root = path.join(tmp, 'MyMaps');
    fs.mkdirSync(root);
    lib.setRootFolder(root);
    expect(lib.getRootFolder()).toBe(root);
    expect(fs.existsSync(path.join(root, 'maps'))).toBe(true);
  });

  test('persists root folder to config.json', () => {
    const { lib, tmp, configPath } = setup();
    const root = path.join(tmp, 'Root');
    fs.mkdirSync(root);
    lib.setRootFolder(root);
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(cfg.rootFolder).toBe(root);
  });

  test('loads persisted root folder on next createLibrary call', () => {
    const { tmp, configPath } = setup();
    const root = path.join(tmp, 'Persisted');
    fs.mkdirSync(root);

    const lib1 = createLibrary(configPath);
    lib1.setRootFolder(root);

    const lib2 = createLibrary(configPath);
    expect(lib2.getRootFolder()).toBe(root);
  });

  test('does not restore a root folder that no longer exists', () => {
    const { tmp, configPath } = setup();
    const fakePath = path.join(tmp, 'DoesNotExist');
    fs.writeFileSync(configPath, JSON.stringify({ rootFolder: fakePath }));

    const lib = createLibrary(configPath);
    expect(lib.getRootFolder()).toBeNull();
  });
});

// ── scan ──────────────────────────────────────────────────────────────────────

describe('scan', () => {
  test('returns empty result when no root folder is set', () => {
    const { lib } = setup();
    expect(lib.scan()).toEqual({ rootFolder: null, mapsDir: null, projects: [], rootMaps: [] });
  });

  test('returns root maps from maps/ directory', () => {
    const { lib, tmp } = setup();
    const root     = path.join(tmp, 'R');
    const mapsDir  = path.join(root, 'maps');
    fs.mkdirSync(mapsDir, { recursive: true });
    writeImage(mapsDir, 'dungeon.jpg');
    writeImage(mapsDir, 'tavern.png');

    lib.setRootFolder(root);
    const { rootMaps, projects } = lib.scan();
    expect(rootMaps).toHaveLength(2);
    expect(rootMaps.map((m) => m.name).sort()).toEqual(['dungeon.jpg', 'tavern.png']);
    expect(projects).toHaveLength(0);
  });

  test('returns projects from subdirectories', () => {
    const { lib, tmp } = setup();
    const root = path.join(tmp, 'R');
    const sess = path.join(root, 'maps', 'Session 1');
    writeImage(sess, 'map.jpg');

    lib.setRootFolder(root);
    const { projects } = lib.scan();
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('Session 1');
    expect(projects[0].maps).toHaveLength(1);
    expect(projects[0].maps[0].projectId).toBe('Session 1');
  });

  test('ignores non-image files', () => {
    const { lib, tmp } = setup();
    const root    = path.join(tmp, 'R');
    const mapsDir = path.join(root, 'maps');
    fs.mkdirSync(mapsDir, { recursive: true });
    writeImage(mapsDir, 'map.jpg');
    fs.writeFileSync(path.join(mapsDir, 'notes.txt'), 'text');

    lib.setRootFolder(root);
    expect(lib.scan().rootMaps).toHaveLength(1);
  });

  test('map id is a relative path from mapsDir', () => {
    const { lib, tmp } = setup();
    const root = path.join(tmp, 'R');
    const sess = path.join(root, 'maps', 'S1');
    writeImage(sess, 'map.jpg');

    lib.setRootFolder(root);
    const map = lib.scan().projects[0].maps[0];
    expect(map.id).toBe('S1/map.jpg');
  });
});

// ── createProject ─────────────────────────────────────────────────────────────

describe('createProject', () => {
  test('creates a subdirectory in maps/', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(path.join(tmp, 'R'));
    lib.createProject('Session 1');
    expect(fs.existsSync(path.join(tmp, 'R', 'maps', 'Session 1'))).toBe(true);
  });

  test('returns a project object with correct id and name', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(path.join(tmp, 'R'));
    const proj = lib.createProject('Session 2');
    expect(proj).toMatchObject({ id: 'Session 2', name: 'Session 2' });
  });
});

// ── renameProject ─────────────────────────────────────────────────────────────

describe('renameProject', () => {
  test('renames the directory on disk', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(path.join(tmp, 'R'));
    lib.createProject('OldName');
    lib.renameProject('OldName', 'NewName');
    expect(fs.existsSync(path.join(tmp, 'R', 'maps', 'OldName'))).toBe(false);
    expect(fs.existsSync(path.join(tmp, 'R', 'maps', 'NewName'))).toBe(true);
  });

  test('returns the new id (= new folder name)', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(path.join(tmp, 'R'));
    lib.createProject('A');
    expect(lib.renameProject('A', 'B')).toBe('B');
  });
});

// ── deleteProject ─────────────────────────────────────────────────────────────

describe('deleteProject', () => {
  test('removes the project directory', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(path.join(tmp, 'R'));
    lib.createProject('ToDelete');
    lib.deleteProject('ToDelete');
    expect(fs.existsSync(path.join(tmp, 'R', 'maps', 'ToDelete'))).toBe(false);
  });

  test('moves project maps to root before deleting directory', () => {
    const { lib, tmp } = setup();
    const root = path.join(tmp, 'R');
    lib.setRootFolder(root);
    lib.createProject('Proj');
    writeImage(path.join(root, 'maps', 'Proj'), 'map.jpg');
    lib.deleteProject('Proj');
    expect(fs.existsSync(path.join(root, 'maps', 'map.jpg'))).toBe(true);
  });

  test('does not throw if project does not exist', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(path.join(tmp, 'R'));
    expect(() => lib.deleteProject('NonExistent')).not.toThrow();
  });
});

// ── copyFiles ─────────────────────────────────────────────────────────────────

describe('copyFiles', () => {
  test('copies an image file into maps/ root', () => {
    const { lib, tmp } = setup();
    const root = path.join(tmp, 'R');
    lib.setRootFolder(root);

    const src = path.join(tmp, 'source.jpg');
    fs.writeFileSync(src, 'img');

    const [result] = lib.copyFiles([src]);
    expect(result.name).toBe('source.jpg');
    expect(fs.existsSync(result.path)).toBe(true);
    expect(result.projectId).toBeNull();
  });

  test('copies image into a project subdirectory when projectId is provided', () => {
    const { lib, tmp } = setup();
    const root = path.join(tmp, 'R');
    lib.setRootFolder(root);
    lib.createProject('S1');

    const src = path.join(tmp, 'map.png');
    fs.writeFileSync(src, 'img');

    const [result] = lib.copyFiles([src], 'S1');
    expect(result.projectId).toBe('S1');
    expect(result.id).toBe('S1/map.png');
    expect(fs.existsSync(result.path)).toBe(true);
  });

  test('skips non-image files', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(path.join(tmp, 'R'));
    const src = path.join(tmp, 'notes.txt');
    fs.writeFileSync(src, 'text');
    expect(lib.copyFiles([src])).toHaveLength(0);
  });

  test('avoids overwriting by appending _1, _2, ...', () => {
    const { lib, tmp } = setup();
    const root = path.join(tmp, 'R');
    lib.setRootFolder(root);

    const src = path.join(tmp, 'map.jpg');
    fs.writeFileSync(src, 'img');
    lib.copyFiles([src]);
    const [second] = lib.copyFiles([src]);
    expect(second.name).toBe('map_1.jpg');
  });
});

// ── moveMap ───────────────────────────────────────────────────────────────────

describe('moveMap', () => {
  test('moves a root map into a project', () => {
    const { lib, tmp } = setup();
    const root = path.join(tmp, 'R');
    lib.setRootFolder(root);
    lib.createProject('Proj');

    const src = path.join(tmp, 'hero.jpg');
    fs.writeFileSync(src, 'img');
    const [map] = lib.copyFiles([src]);

    const moved = lib.moveMap(map.id, 'Proj');
    expect(moved.projectId).toBe('Proj');
    expect(moved.id).toBe('Proj/hero.jpg');
    expect(fs.existsSync(path.join(root, 'maps', 'hero.jpg'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'maps', 'Proj', 'hero.jpg'))).toBe(true);
  });

  test('moves a project map to root (toProjectId = null)', () => {
    const { lib, tmp } = setup();
    const root = path.join(tmp, 'R');
    lib.setRootFolder(root);
    lib.createProject('P');
    writeImage(path.join(root, 'maps', 'P'), 'map.jpg');

    const moved = lib.moveMap('P/map.jpg', null);
    expect(moved.projectId).toBeNull();
    expect(moved.id).toBe('map.jpg');
  });
});

// ── deleteMap ─────────────────────────────────────────────────────────────────

describe('deleteMap', () => {
  test('removes the file from disk', () => {
    const { lib, tmp } = setup();
    const root = path.join(tmp, 'R');
    lib.setRootFolder(root);
    const src = path.join(tmp, 'x.jpg');
    fs.writeFileSync(src, 'img');
    const [map] = lib.copyFiles([src]);
    lib.deleteMap(map.id);
    expect(fs.existsSync(map.path)).toBe(false);
  });

  test('does not throw if map does not exist', () => {
    const { lib, tmp } = setup();
    lib.setRootFolder(path.join(tmp, 'R'));
    expect(() => lib.deleteMap('ghost.jpg')).not.toThrow();
  });
});
