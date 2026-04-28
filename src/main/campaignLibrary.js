// File-system campaign library: manages campaigns, sessions, notes, HUDs, scenes, and assets.

const fs   = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { saveSnapshot, listSnapshots, loadSnapshot, deleteSnapshot, renameSnapshot } = require('./snapshotStore');

const CAMPAIGNS_DIR  = 'campaigns';
const SESSIONS_DIR   = 'sessions';
const NOTES_FILE     = 'notes.md';
const SCENES_DIR     = 'scenes';
const SAVE_DIR       = 'userdata';
const HUDS_FILE      = 'huds.json';
const ASSETS_DIR     = 'assets';
const ASSETS_INDEX   = 'assets.json';
const ASSET_META     = 'asset.json';
const DEFAULT_TYPES  = ['general', 'characters', 'maps', 'objects', 'handouts'];
const PROTECTED_TYPES = new Set(['general']);

// Creates the campaign library backed by config (use createConfig() for file persistence).
function createCampaignLibrary(config) {
  let rootFolder = (() => {
    const r = config.get('rootFolder', null);
    if (!r || !fs.existsSync(r)) return null;
    return r;
  })();

  // ── Paths ──────────────────────────────────────────────────────────────────

  // Returns the userdata/campaigns/ directory path, or null if no root folder is set.
  function getCampaignsDir() {
    return rootFolder ? path.join(rootFolder, SAVE_DIR, CAMPAIGNS_DIR) : null;
  }

  // Creates the userdata/campaigns/ directory if needed and returns its path.
  function ensureCampaignsDir() {
    const dir = getCampaignsDir();
    if (!dir) throw new Error('No root folder set');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  // Returns the directory path for a campaign.
  function campaignPath(campaignId) {
    return path.join(getCampaignsDir(), campaignId);
  }

  // Returns the sessions/ directory path for a campaign.
  function sessionsDir(campaignId) {
    return path.join(campaignPath(campaignId), SESSIONS_DIR);
  }

  // Returns the directory path for a specific session.
  function sessionPath(campaignId, sessionId) {
    return path.join(sessionsDir(campaignId), sessionId);
  }

  // Returns the notes file path for a session.
  function notesPath(campaignId, sessionId) {
    return path.join(sessionPath(campaignId, sessionId), NOTES_FILE);
  }

  // Returns the scenes directory for a session, or the campaign root if sessionId is falsy.
  function scenesDir(campaignId, sessionId) {
    return sessionId
      ? path.join(sessionPath(campaignId, sessionId), SCENES_DIR)
      : path.join(campaignPath(campaignId), SCENES_DIR);
  }

  // Returns the userdata/huds.json file path, or null if no root folder is set.
  function getHudsFile() {
    return rootFolder ? path.join(rootFolder, SAVE_DIR, HUDS_FILE) : null;
  }

  // Reads huds.json and returns { lastActiveId, groups }.
  // Handles three legacy formats transparently:
  //   - New:  { lastActiveId, groups: [...] }
  //   - Old array (previous code iteration): [...]
  //   - Old single-object (pre-redesign): { id, name, huds, savedAt }
  // Also migrates from the old per-file Huds/huds.json location if present.
  function readHudsFile() {
    const file = getHudsFile();
    if (!file) return { lastActiveId: null, groups: [] };

    if (fs.existsSync(file)) {
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        // New format
        if (data && !Array.isArray(data) && Array.isArray(data.groups)) {
          return { lastActiveId: data.lastActiveId ?? null, groups: data.groups };
        }
        // Old array format (previous code iteration stored a plain array)
        if (Array.isArray(data)) {
          return { lastActiveId: null, groups: data };
        }
        // Old single-object format accidentally written to the new path
        if (data && Array.isArray(data.huds)) {
          const group = { id: data.id || ('g-' + Date.now()), name: data.name || 'HUD Group', huds: data.huds };
          return { lastActiveId: group.id, groups: [group] };
        }
      } catch { /* fall through to migration */ }
    }

    // Migrate from old root-level huds.json
    if (rootFolder) {
      const rootHudsFile = path.join(rootFolder, HUDS_FILE);
      if (fs.existsSync(rootHudsFile)) {
        try {
          const data = JSON.parse(fs.readFileSync(rootHudsFile, 'utf8'));
          let result = null;
          if (data && !Array.isArray(data) && Array.isArray(data.groups)) {
            result = { lastActiveId: data.lastActiveId ?? null, groups: data.groups };
          } else if (Array.isArray(data)) {
            result = { lastActiveId: null, groups: data };
          } else if (data && Array.isArray(data.huds)) {
            const group = { id: data.id || ('g-' + Date.now()), name: data.name || 'HUD Group', huds: data.huds };
            result = { lastActiveId: group.id, groups: [group] };
          }
          if (result) {
            writeHudsFile(result);
            return result;
          }
        } catch { /* fall through */ }
      }
    }

    // Migrate from old Huds/huds.json single-object format
    if (rootFolder) {
      const oldFile = path.join(rootFolder, 'Huds', 'huds.json');
      if (fs.existsSync(oldFile)) {
        try {
          const old = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
          if (old && !Array.isArray(old) && Array.isArray(old.huds)) {
            const group = { id: old.id || ('g-' + Date.now()), name: old.name || 'HUD Group', huds: old.huds };
            const result = { lastActiveId: group.id, groups: [group] };
            writeHudsFile(result);  // persist to new location immediately
            return result;
          }
        } catch { /* ignore, use empty */ }
      }
    }

    return { lastActiveId: null, groups: [] };
  }

  // Writes { lastActiveId, groups } to userdata/huds.json.
  function writeHudsFile({ lastActiveId, groups }) {
    const file = getHudsFile();
    if (!file) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ lastActiveId, groups }, null, 2), 'utf8');
  }

  // ── Root folder ────────────────────────────────────────────────────────────

  // Sets the root folder, persists it, and ensures the campaigns/ directory exists.
  function setRootFolder(folderPath) {
    rootFolder = folderPath;
    config.set('rootFolder', folderPath);
    ensureCampaignsDir();
  }

  // Returns the current root folder path, or null if unset.
  function getRootFolder() {
    return rootFolder;
  }

  // ── Campaigns ──────────────────────────────────────────────────────────────

  // Scans the campaigns directory and returns all campaigns with their sessions.
  function scan() {
    const dir = getCampaignsDir();
    if (!dir || !fs.existsSync(dir)) return { campaigns: [] };

    const campaigns = fs.readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => {
        const campaignId = e.name;
        const sd = sessionsDir(campaignId);
        const sessions = fs.existsSync(sd)
          ? fs.readdirSync(sd, { withFileTypes: true })
              .filter(s => s.isDirectory())
              .map(s => ({ id: s.name, name: s.name, campaignId }))
          : [];
        return { id: campaignId, name: campaignId, sessions };
      });

    return { campaigns };
  }

  // Creates a new campaign directory with a sessions/ subdirectory.
  function createCampaign(name) {
    const dir = ensureCampaignsDir();
    fs.mkdirSync(path.join(dir, name, SESSIONS_DIR), { recursive: true });
    return { id: name, name, sessions: [] };
  }

  // Renames a campaign directory on disk.
  function renameCampaign(oldId, newName) {
    const dir = getCampaignsDir();
    if (!dir) throw new Error('No root folder set');
    fs.renameSync(path.join(dir, oldId), path.join(dir, newName));
    return newName;
  }

  // Recursively deletes a campaign and all its contents.
  function deleteCampaign(id) {
    const dir = getCampaignsDir();
    if (!dir) return;
    const p = path.join(dir, id);
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  }

  // ── Sessions ───────────────────────────────────────────────────────────────

  // Creates a new session directory inside the campaign.
  function createSession(campaignId, name) {
    const dir = getCampaignsDir();
    if (!dir) throw new Error('No root folder set');
    fs.mkdirSync(sessionPath(campaignId, name), { recursive: true });
    return { id: name, name, campaignId };
  }

  // Renames a session directory on disk.
  function renameSession(campaignId, oldId, newName) {
    const sd = sessionsDir(campaignId);
    fs.renameSync(path.join(sd, oldId), path.join(sd, newName));
    return newName;
  }

  // Recursively deletes a session and all its contents.
  function deleteSession(campaignId, id) {
    const p = sessionPath(campaignId, id);
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  }

  // ── Notes ──────────────────────────────────────────────────────────────────

  // Reads the campaign-level notes.md, returning an empty string if absent.
  function readCampaignNotes(campaignId) {
    const dir = getCampaignsDir();
    if (!dir) return '';
    const file = path.join(dir, campaignId, NOTES_FILE);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  }

  // Writes content to the campaign-level notes.md.
  function writeCampaignNotes(campaignId, content) {
    const dir = getCampaignsDir();
    if (!dir) return;
    const campaignDir = path.join(dir, campaignId);
    fs.mkdirSync(campaignDir, { recursive: true });
    fs.writeFileSync(path.join(campaignDir, NOTES_FILE), content, 'utf8');
  }

  // Reads the session notes.md, returning an empty string if absent.
  function readNotes(campaignId, sessionId) {
    const file = notesPath(campaignId, sessionId);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  }

  // Writes content to the session notes.md.
  function writeNotes(campaignId, sessionId, content) {
    const dir = sessionPath(campaignId, sessionId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(notesPath(campaignId, sessionId), content, 'utf8');
  }

  // ── HUD Groups (stored in huds.json at root folder) ──────────────────────

  // Upserts a HUD group by id and returns its summary.
  function saveHudGroup(group) {
    if (!getHudsFile()) return null;
    const { lastActiveId, groups } = readHudsFile();
    const idx = groups.findIndex(g => g.id === group.id);
    if (idx >= 0) groups[idx] = group; else groups.push(group);
    writeHudsFile({ lastActiveId, groups });
    return { id: group.id, name: group.name || '' };
  }

  // Returns { lastActiveId, groups: [{ id, name }, ...] } — no huds payload in groups.
  function listHudGroups() {
    const { lastActiveId, groups } = readHudsFile();
    return { lastActiveId, groups: groups.map(g => ({ id: g.id, name: g.name || '' })) };
  }

  // Loads and returns a full HUD group by id, or null if not found.
  function loadHudGroup(id) {
    const { groups } = readHudsFile();
    return groups.find(g => g.id === id) ?? null;
  }

  // Removes a HUD group by id; clears lastActiveId if it pointed to the deleted group.
  function deleteHudGroup(id) {
    if (!getHudsFile()) return;
    const { lastActiveId, groups } = readHudsFile();
    writeHudsFile({
      lastActiveId: lastActiveId === id ? null : lastActiveId,
      groups: groups.filter(g => g.id !== id),
    });
  }

  // Updates the name of a HUD group in place.
  function renameHudGroup(id, newName) {
    if (!getHudsFile()) return false;
    const { lastActiveId, groups } = readHudsFile();
    const group = groups.find(g => g.id === id);
    if (!group) return false;
    group.name = newName;
    writeHudsFile({ lastActiveId, groups });
    return true;
  }

  // Persists which HUD group was last activated (called on load).
  function setLastActiveHudGroupId(id) {
    if (!getHudsFile()) return;
    const data = readHudsFile();
    data.lastActiveId = id;
    writeHudsFile(data);
  }

  // ── Scenes ─────────────────────────────────────────────────────────────────

  // Saves a scene snapshot for the session, stripping live HUD state.
  function saveScene(campaignId, sessionId, scene) {
    return saveSnapshot(scenesDir(campaignId, sessionId), scene, { strip: ['huds'] });
  }

  // Lists all saved scene snapshots for the session.
  function listScenes(campaignId, sessionId) {
    return listSnapshots(scenesDir(campaignId, sessionId));
  }

  // Loads a specific scene snapshot by id.
  function loadScene(campaignId, sessionId, sceneId) {
    return loadSnapshot(scenesDir(campaignId, sessionId), sceneId);
  }

  // Deletes a scene snapshot by id.
  function deleteScene(campaignId, sessionId, sceneId) {
    deleteSnapshot(scenesDir(campaignId, sessionId), sceneId);
  }

  // Renames a scene snapshot.
  function renameScene(campaignId, sessionId, sceneId, newName) {
    return renameSnapshot(scenesDir(campaignId, sessionId), sceneId, newName);
  }

  // ── Assets ─────────────────────────────────────────────────────────────────

  // Returns the assets directory for global scope (no campaignId) or campaign scope.
  function getAssetsDir(campaignId) {
    if (!rootFolder) return null;
    return campaignId
      ? path.join(rootFolder, SAVE_DIR, CAMPAIGNS_DIR, campaignId, ASSETS_DIR)
      : path.join(rootFolder, SAVE_DIR, ASSETS_DIR);
  }

  // Reads and returns the assets.json index for the given scope.
  function readAssetsIndex(campaignId) {
    const file = campaignId
      ? path.join(getAssetsDir(campaignId), ASSETS_INDEX)
      : path.join(getAssetsDir(null), ASSETS_INDEX);
    if (!file || !fs.existsSync(file)) {
      return { types: campaignId ? undefined : [...DEFAULT_TYPES], assets: [] };
    }
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return { types: campaignId ? undefined : [...DEFAULT_TYPES], assets: [] };
    }
  }

  // Writes the assets.json index for the given scope.
  function writeAssetsIndex(data, campaignId) {
    const dir = getAssetsDir(campaignId);
    if (!dir) return;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, ASSETS_INDEX), JSON.stringify(data, null, 2), 'utf8');
  }

  // Returns all asset types (always from the global index).
  function listAssetTypes() {
    if (!rootFolder) return [...DEFAULT_TYPES];
    const { types } = readAssetsIndex(null);
    return types ?? [...DEFAULT_TYPES];
  }

  // Adds a new asset type to the global index. Returns false if it already exists.
  function addAssetType(typeName) {
    if (!rootFolder) throw new Error('No root folder set');
    const index = readAssetsIndex(null);
    if (!index.types) index.types = [...DEFAULT_TYPES];
    if (index.types.includes(typeName)) return false;
    index.types.push(typeName);
    writeAssetsIndex(index, null);
    return true;
  }

  // Removes an asset type from the global index. Returns false if it does not exist or is protected.
  function removeAssetType(typeName) {
    if (!rootFolder) throw new Error('No root folder set');
    if (PROTECTED_TYPES.has(typeName)) return false;
    const index = readAssetsIndex(null);
    if (!index.types) return false;
    const i = index.types.indexOf(typeName);
    if (i === -1) return false;
    index.types.splice(i, 1);
    writeAssetsIndex(index, null);
    return true;
  }

  // Lists assets for the given scope. If campaignId is provided, merges global + campaign assets.
  // Each asset entry includes a `scope` field: 'global' or 'campaign'.
  function listAssets(campaignId) {
    const types = listAssetTypes();
    const globalIndex = readAssetsIndex(null);
    const globalAssets = (globalIndex.assets ?? []).map(a => ({ ...a, scope: 'global' }));
    if (!campaignId) return { types, assets: globalAssets };

    const campaignIndex = readAssetsIndex(campaignId);
    const campaignAssets = (campaignIndex.assets ?? []).map(a => ({ ...a, scope: 'campaign' }));
    return { types, assets: [...globalAssets, ...campaignAssets] };
  }

  // Creates a new asset by copying srcFilePath into the asset folder.
  // Returns the new asset entry (including scope and fileName).
  function createAsset(name, type, srcFilePath, campaignId) {
    const assetsDir = getAssetsDir(campaignId);
    if (!assetsDir) throw new Error('No root folder set');

    const id       = randomUUID();
    const fileName = path.basename(srcFilePath);
    const assetDir = path.join(assetsDir, type, id);

    fs.mkdirSync(assetDir, { recursive: true });
    fs.copyFileSync(srcFilePath, path.join(assetDir, fileName));

    const meta = { id, name, type, fileName };
    fs.writeFileSync(path.join(assetDir, ASSET_META), JSON.stringify(meta, null, 2), 'utf8');

    const index = readAssetsIndex(campaignId);
    if (!index.assets) index.assets = [];
    index.assets.push(meta);
    writeAssetsIndex(index, campaignId);

    return { ...meta, scope: campaignId ? 'campaign' : 'global' };
  }

  // Updates metadata fields on an existing asset. Returns false if not found.
  function updateAsset(id, patch, campaignId) {
    const assetsDir = getAssetsDir(campaignId);
    if (!assetsDir) return false;

    const index = readAssetsIndex(campaignId);
    const entry = (index.assets ?? []).find(a => a.id === id);
    if (!entry) return false;

    const oldType = entry.type;
    const newType = patch.type && patch.type !== oldType ? patch.type : null;

    if (newType) {
      const oldDir = path.join(assetsDir, oldType, id);
      const newDir = path.join(assetsDir, newType, id);
      if (fs.existsSync(oldDir)) {
        fs.mkdirSync(path.join(assetsDir, newType), { recursive: true });
        fs.renameSync(oldDir, newDir);
      }
    }

    Object.assign(entry, patch);
    writeAssetsIndex(index, campaignId);

    const metaFile = path.join(assetsDir, entry.type, id, ASSET_META);
    if (fs.existsSync(metaFile)) {
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      Object.assign(meta, patch);
      fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2), 'utf8');
    }

    return true;
  }

  // Deletes an asset folder and removes it from the index.
  function deleteAsset(id, campaignId) {
    const assetsDir = getAssetsDir(campaignId);
    if (!assetsDir) return;

    const index = readAssetsIndex(campaignId);
    const entry = (index.assets ?? []).find(a => a.id === id);
    if (!entry) return;

    const assetDir = path.join(assetsDir, entry.type, id);
    if (fs.existsSync(assetDir)) fs.rmSync(assetDir, { recursive: true, force: true });

    index.assets = index.assets.filter(a => a.id !== id);
    writeAssetsIndex(index, campaignId);
  }

  // Moves an asset between scopes (null = global). Returns false if not found.
  function moveAsset(id, fromCampaignId, toCampaignId) {
    const fromDir = getAssetsDir(fromCampaignId);
    const toDir   = getAssetsDir(toCampaignId);
    if (!fromDir || !toDir) return false;

    const fromIndex = readAssetsIndex(fromCampaignId);
    const entry = (fromIndex.assets ?? []).find(a => a.id === id);
    if (!entry) return false;

    const destTypeDir = path.join(toDir, entry.type);
    fs.mkdirSync(destTypeDir, { recursive: true });
    fs.renameSync(path.join(fromDir, entry.type, id), path.join(destTypeDir, id));

    fromIndex.assets = fromIndex.assets.filter(a => a.id !== id);
    writeAssetsIndex(fromIndex, fromCampaignId);

    const toIndex = readAssetsIndex(toCampaignId);
    if (!toIndex.assets) toIndex.assets = [];
    toIndex.assets.push(entry);
    writeAssetsIndex(toIndex, toCampaignId);

    return true;
  }

  return {
    setRootFolder, getRootFolder, getCampaignsDir,
    scan,
    createCampaign, renameCampaign, deleteCampaign,
    createSession, renameSession, deleteSession,
    readCampaignNotes, writeCampaignNotes,
    readNotes, writeNotes,
    saveHudGroup, listHudGroups, loadHudGroup, deleteHudGroup, renameHudGroup, setLastActiveHudGroupId,
    saveScene, listScenes, loadScene, deleteScene, renameScene,
    listAssetTypes, addAssetType, removeAssetType,
    listAssets, createAsset, updateAsset, deleteAsset, moveAsset,
  };
}

module.exports = { createCampaignLibrary };
