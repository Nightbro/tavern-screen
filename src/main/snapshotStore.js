// Generic JSON snapshot store: save, list, load, delete, and rename named snapshots on disk.

const fs   = require('fs');
const path = require('path');

const EXT = '.json';

// Writes item to dir/<item.id>.json, stripping any listed keys, and returns its summary.
function saveSnapshot(dir, item, { strip = [] } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const data = { ...item, savedAt: new Date().toISOString() };
  for (const key of strip) delete data[key];
  fs.writeFileSync(path.join(dir, item.id + EXT), JSON.stringify(data, null, 2), 'utf8');
  return { id: item.id, name: item.name || '', savedAt: data.savedAt };
}

// Returns all snapshots in dir sorted by savedAt descending.
function listSnapshots(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(EXT))
    .map(f => {
      try {
        const d  = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const id = f.slice(0, -EXT.length); // filename is the authoritative id
        return { id, name: d.name || '(unnamed)', savedAt: d.savedAt ?? '' };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

// Loads and returns a single snapshot by id, or null if not found.
function loadSnapshot(dir, id) {
  const file = path.join(dir, id + EXT);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Deletes the snapshot file for id if it exists.
function deleteSnapshot(dir, id) {
  const file = path.join(dir, id + EXT);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

// Updates the name field inside the snapshot file.
function renameSnapshot(dir, id, newName) {
  const file = path.join(dir, id + EXT);
  if (!fs.existsSync(file)) return false;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.name = newName;
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  return true;
}

module.exports = { saveSnapshot, listSnapshots, loadSnapshot, deleteSnapshot, renameSnapshot };
