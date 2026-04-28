// Persistent key-value config backed by a JSON file on disk.

const fs   = require('fs');
const path = require('path');

// Creates a config object that reads/writes a JSON file at filePath.
function createConfig(filePath) {
  // Reads and parses the JSON config file, returning {} on any error.
  function _read() {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch { return {}; }
  }

  // Serialises data to JSON and writes it to the config file.
  function _write(data) {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch { /* best-effort */ }
  }

  // Returns the value for key, or defaultValue if absent.
  function get(key, defaultValue = null) {
    const val = _read()[key];
    return val !== undefined ? val : defaultValue;
  }

  // Merges key/value into the config and persists it.
  function set(key, value) {
    const data = _read();
    data[key] = value;
    _write(data);
  }

  // Returns the full config object.
  function getAll() { return _read(); }

  return { get, set, getAll };
}

module.exports = { createConfig };
