// File-system campaign library: manages campaigns, sessions, notes, HUDs, and scenes.

const fs   = require('fs');
const path = require('path');
const { saveSnapshot, listSnapshots, loadSnapshot, deleteSnapshot, renameSnapshot } = require('./snapshotStore');

const CAMPAIGNS_DIR = 'campaigns';
const SESSIONS_DIR  = 'sessions';
const NOTES_FILE    = 'notes.md';
const SCENES_DIR    = 'scenes';
const HUDS_DIR      = 'Huds';
const HUDS_FILE     = 'huds.json';

// Creates the campaign library backed by config (use createConfig() for file persistence).
function createCampaignLibrary(config) {
  let rootFolder = (() => {
    const r = config.get('rootFolder', null);
    return (r && fs.existsSync(r)) ? r : null;
  })();

  // ── Paths ──────────────────────────────────────────────────────────────────

  // Returns the campaigns/ directory path, or null if no root folder is set.
  function getCampaignsDir() {
    return rootFolder ? path.join(rootFolder, CAMPAIGNS_DIR) : null;
  }

  // Creates the campaigns/ directory if needed and returns its path.
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

  // Returns the global Huds/ directory path, or null if no root folder is set.
  function getHudsDir() {
    return rootFolder ? path.join(rootFolder, HUDS_DIR) : null;
  }

  // Returns the path to the global huds.json file, or null if no root folder is set.
  function hudsFilePath() {
    const dir = getHudsDir();
    return dir ? path.join(dir, HUDS_FILE) : null;
  }

  // ── Root folder ────────────────────────────────────────────────────────────

  // Sets the root folder, persists it, and ensures the campaigns/ and Huds/ directories exist.
  function setRootFolder(folderPath) {
    rootFolder = folderPath;
    config.set('rootFolder', folderPath);
    ensureCampaignsDir();
    fs.mkdirSync(path.join(folderPath, HUDS_DIR), { recursive: true });
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

  // ── HUDs (global, shared across all campaigns) ────────────────────────────

  // Persists the HUDs array to the global Huds/huds.json.
  function saveHuds(huds) {
    const dir = getHudsDir();
    if (!dir) return;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(hudsFilePath(), JSON.stringify(huds ?? [], null, 2), 'utf8');
  }

  // Loads the global HUDs array from Huds/huds.json, returning [] if absent.
  function loadHuds() {
    const file = hudsFilePath();
    if (!file || !fs.existsSync(file)) return [];
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return []; }
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

  return {
    setRootFolder, getRootFolder, getCampaignsDir,
    scan,
    createCampaign, renameCampaign, deleteCampaign,
    createSession, renameSession, deleteSession,
    readCampaignNotes, writeCampaignNotes,
    readNotes, writeNotes,
    saveHuds, loadHuds,
    saveScene, listScenes, loadScene, deleteScene, renameScene,
  };
}

module.exports = { createCampaignLibrary };
