const fs   = require('fs');
const path = require('path');

/**
 * Simple key-value config backed by a JSON file.
 * Reads fresh on every get so concurrent writers don't overwrite each other.
 */
function createConfig(filePath) {
  function _read() {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch { return {}; }
  }

  function _write(data) {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch { /* best-effort */ }
  }

  function get(key, defaultValue = null) {
    const val = _read()[key];
    return val !== undefined ? val : defaultValue;
  }

  function set(key, value) {
    const data = _read();
    data[key] = value;
    _write(data);
  }

  function getAll() { return _read(); }

  return { get, set, getAll };
}

module.exports = { createConfig };
