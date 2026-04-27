const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { createConfig } = require('../src/main/config');

function makeTmpFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tavern-cfg-')), 'config.json');
}

describe('createConfig', () => {
  test('get returns defaultValue when key is not set', () => {
    const cfg = createConfig(makeTmpFile());
    expect(cfg.get('missing', 'default')).toBe('default');
  });

  test('get returns null default when no defaultValue provided', () => {
    const cfg = createConfig(makeTmpFile());
    expect(cfg.get('missing')).toBeNull();
  });

  test('set persists a value that get can retrieve', () => {
    const file = makeTmpFile();
    const cfg  = createConfig(file);
    cfg.set('name', 'tavern');
    expect(cfg.get('name')).toBe('tavern');
  });

  test('value is written to disk (readable by a new config instance)', () => {
    const file = makeTmpFile();
    createConfig(file).set('rootFolder', '/maps');
    expect(createConfig(file).get('rootFolder')).toBe('/maps');
  });

  test('set merges keys without overwriting unrelated keys', () => {
    const file = makeTmpFile();
    const cfg  = createConfig(file);
    cfg.set('a', 1);
    cfg.set('b', 2);
    expect(cfg.get('a')).toBe(1);
    expect(cfg.get('b')).toBe(2);
  });

  test('set overwrites a previously set key', () => {
    const cfg = createConfig(makeTmpFile());
    cfg.set('zoom', 1.0);
    cfg.set('zoom', 2.0);
    expect(cfg.get('zoom')).toBe(2.0);
  });

  test('getAll returns all stored keys', () => {
    const cfg = createConfig(makeTmpFile());
    cfg.set('a', 1);
    cfg.set('b', 'hello');
    expect(cfg.getAll()).toEqual({ a: 1, b: 'hello' });
  });

  test('handles corrupt config file gracefully (returns defaults)', () => {
    const file = makeTmpFile();
    fs.writeFileSync(file, 'not-valid-json');
    const cfg = createConfig(file);
    expect(cfg.get('anything', 42)).toBe(42);
  });

  test('stores complex values like settings objects', () => {
    const cfg = createConfig(makeTmpFile());
    const s = { gridVisible: true, zoom: 1.5, dpi: 96 };
    cfg.set('settings', s);
    expect(cfg.get('settings')).toEqual(s);
  });

  test('creating a config with a non-existent parent directory does not throw on set', () => {
    const file = path.join(os.tmpdir(), 'nested', 'deep', `cfg-${Date.now()}.json`);
    const cfg  = createConfig(file);
    expect(() => cfg.set('k', 'v')).not.toThrow();
    expect(cfg.get('k')).toBe('v');
  });
});
