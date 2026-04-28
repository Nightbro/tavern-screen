const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { saveSnapshot, listSnapshots, loadSnapshot, deleteSnapshot, renameSnapshot } = require('../src/main/snapshotStore');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tavern-snap-'));
}

// ── saveSnapshot ──────────────────────────────────────────────────────────────

describe('saveSnapshot', () => {
  test('writes a JSON file named <id>.json in the given directory', () => {
    const dir = makeTmpDir();
    saveSnapshot(dir, { id: 'abc', name: 'My Scene' });
    expect(fs.existsSync(path.join(dir, 'abc.json'))).toBe(true);
  });

  test('stamps savedAt in the written file', () => {
    const dir = makeTmpDir();
    saveSnapshot(dir, { id: 'x', name: '' });
    const data = JSON.parse(fs.readFileSync(path.join(dir, 'x.json'), 'utf8'));
    expect(data.savedAt).toBeDefined();
    expect(() => new Date(data.savedAt)).not.toThrow();
  });

  test('returns a summary with id, name, and savedAt', () => {
    const dir = makeTmpDir();
    const result = saveSnapshot(dir, { id: 'r1', name: 'Test' });
    expect(result).toMatchObject({ id: 'r1', name: 'Test' });
    expect(result.savedAt).toBeDefined();
  });

  test('strips specified keys from the written file without mutating the input', () => {
    const dir = makeTmpDir();
    const item = { id: 's1', name: '', huds: [1, 2, 3], layers: [] };
    saveSnapshot(dir, item, { strip: ['huds'] });
    const data = JSON.parse(fs.readFileSync(path.join(dir, 's1.json'), 'utf8'));
    expect(data.huds).toBeUndefined();
    expect(data.layers).toEqual([]);
    expect(item.huds).toHaveLength(3); // original not mutated
  });

  test('creates the directory recursively if it does not exist', () => {
    const dir = path.join(makeTmpDir(), 'nested', 'subdir');
    expect(() => saveSnapshot(dir, { id: 'y', name: '' })).not.toThrow();
    expect(fs.existsSync(dir)).toBe(true);
  });
});

// ── listSnapshots ─────────────────────────────────────────────────────────────

describe('listSnapshots', () => {
  test('returns [] for a non-existent directory', () => {
    expect(listSnapshots('/nonexistent/path/xyz123')).toEqual([]);
  });

  test('returns summary objects sorted by savedAt descending', () => {
    const dir = makeTmpDir();
    saveSnapshot(dir, { id: 'old', name: 'Old' });
    saveSnapshot(dir, { id: 'new', name: 'New' });
    const list = listSnapshots(dir);
    // 'new' was written last so has a later savedAt
    expect(list[0].id).toBe('new');
    expect(list[1].id).toBe('old');
  });

  test('ignores non-.json files', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'readme.txt'), 'hello');
    saveSnapshot(dir, { id: 'ok', name: 'OK' });
    expect(listSnapshots(dir)).toHaveLength(1);
  });

  test('skips malformed JSON files without throwing', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'bad.json'), 'NOT_JSON');
    saveSnapshot(dir, { id: 'good', name: 'Good' });
    const list = listSnapshots(dir);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('good');
  });

  test('uses (unnamed) for items with an empty name', () => {
    const dir = makeTmpDir();
    saveSnapshot(dir, { id: 'n1', name: '' });
    expect(listSnapshots(dir)[0].name).toBe('(unnamed)');
  });

  test('uses filename stem as id even when content id is null', () => {
    const dir = makeTmpDir();
    // Simulate a file created by broken old code: named "abc.json" but content has id: null
    fs.writeFileSync(path.join(dir, 'abc.json'), JSON.stringify({ id: null, name: 'Test', savedAt: new Date().toISOString() }));
    const list = listSnapshots(dir);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('abc');
  });

  test('uses filename stem as id when content id is missing', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'xyz.json'), JSON.stringify({ name: 'No ID', savedAt: new Date().toISOString() }));
    const list = listSnapshots(dir);
    expect(list[0].id).toBe('xyz');
  });
});

// ── loadSnapshot ──────────────────────────────────────────────────────────────

describe('loadSnapshot', () => {
  test('returns null when file does not exist', () => {
    const dir = makeTmpDir();
    expect(loadSnapshot(dir, 'missing')).toBeNull();
  });

  test('returns the full stored object including savedAt', () => {
    const dir = makeTmpDir();
    saveSnapshot(dir, { id: 'full', name: 'Full', extra: 42 });
    const data = loadSnapshot(dir, 'full');
    expect(data.id).toBe('full');
    expect(data.extra).toBe(42);
    expect(data.savedAt).toBeDefined();
  });
});

// ── deleteSnapshot ────────────────────────────────────────────────────────────

describe('deleteSnapshot', () => {
  test('removes the file', () => {
    const dir = makeTmpDir();
    saveSnapshot(dir, { id: 'del', name: '' });
    deleteSnapshot(dir, 'del');
    expect(fs.existsSync(path.join(dir, 'del.json'))).toBe(false);
  });

  test('does not throw when file does not exist', () => {
    const dir = makeTmpDir();
    expect(() => deleteSnapshot(dir, 'ghost')).not.toThrow();
  });
});

// ── renameSnapshot ────────────────────────────────────────────────────────────

describe('renameSnapshot', () => {
  test('updates the name field in the file', () => {
    const dir = makeTmpDir();
    saveSnapshot(dir, { id: 'ren', name: 'Old Name' });
    renameSnapshot(dir, 'ren', 'New Name');
    const data = JSON.parse(fs.readFileSync(path.join(dir, 'ren.json'), 'utf8'));
    expect(data.name).toBe('New Name');
  });

  test('returns true on success', () => {
    const dir = makeTmpDir();
    saveSnapshot(dir, { id: 'r', name: 'A' });
    expect(renameSnapshot(dir, 'r', 'B')).toBe(true);
  });

  test('returns false when file does not exist', () => {
    const dir = makeTmpDir();
    expect(renameSnapshot(dir, 'ghost', 'Name')).toBe(false);
  });
});
