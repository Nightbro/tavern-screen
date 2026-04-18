const fs   = require('fs');
const path = require('path');

const CAMPAIGNS_DIR = 'campaigns';
const SESSIONS_DIR  = 'sessions';
const NOTES_FILE    = 'notes.md';
const SCENES_DIR    = 'scenes';
const SCENE_EXT     = '.json';
const HUDS_FILE     = 'huds.json';
const HUD_CONFIGS_DIR = 'hud-configs';

function createCampaignLibrary(config) {
  let rootFolder = (() => {
    const r = config.get('rootFolder', null);
    return (r && fs.existsSync(r)) ? r : null;
  })();

  // ── Paths ──────────────────────────────────────────────────────────────────

  function getCampaignsDir() {
    return rootFolder ? path.join(rootFolder, CAMPAIGNS_DIR) : null;
  }

  function ensureCampaignsDir() {
    const dir = getCampaignsDir();
    if (!dir) throw new Error('No root folder set');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  function campaignPath(campaignId) {
    return path.join(getCampaignsDir(), campaignId);
  }

  function sessionsDir(campaignId) {
    return path.join(campaignPath(campaignId), SESSIONS_DIR);
  }

  function sessionPath(campaignId, sessionId) {
    return path.join(sessionsDir(campaignId), sessionId);
  }

  function notesPath(campaignId, sessionId) {
    return path.join(sessionPath(campaignId, sessionId), NOTES_FILE);
  }

  function scenesDir(campaignId, sessionId) {
    return sessionId
      ? path.join(sessionPath(campaignId, sessionId), SCENES_DIR)
      : path.join(campaignPath(campaignId), SCENES_DIR);
  }

  function hudsFilePath(campaignId, sessionId) {
    return path.join(sessionPath(campaignId, sessionId), HUDS_FILE);
  }

  function hudConfigsDir(campaignId, sessionId) {
    return path.join(sessionPath(campaignId, sessionId), HUD_CONFIGS_DIR);
  }

  // ── Root folder ────────────────────────────────────────────────────────────

  function setRootFolder(folderPath) {
    rootFolder = folderPath;
    config.set('rootFolder', folderPath);
    ensureCampaignsDir();
  }

  function getRootFolder() {
    return rootFolder;
  }

  // ── Campaigns ──────────────────────────────────────────────────────────────

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

  function createCampaign(name) {
    const dir = ensureCampaignsDir();
    fs.mkdirSync(path.join(dir, name, SESSIONS_DIR), { recursive: true });
    return { id: name, name, sessions: [] };
  }

  function renameCampaign(oldId, newName) {
    const dir = getCampaignsDir();
    if (!dir) throw new Error('No root folder set');
    fs.renameSync(path.join(dir, oldId), path.join(dir, newName));
    return newName;
  }

  function deleteCampaign(id) {
    const dir = getCampaignsDir();
    if (!dir) return;
    const p = path.join(dir, id);
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  }

  // ── Sessions ───────────────────────────────────────────────────────────────

  function createSession(campaignId, name) {
    const dir = getCampaignsDir();
    if (!dir) throw new Error('No root folder set');
    fs.mkdirSync(sessionPath(campaignId, name), { recursive: true });
    return { id: name, name, campaignId };
  }

  function renameSession(campaignId, oldId, newName) {
    const sd = sessionsDir(campaignId);
    fs.renameSync(path.join(sd, oldId), path.join(sd, newName));
    return newName;
  }

  function deleteSession(campaignId, id) {
    const p = sessionPath(campaignId, id);
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  }

  // ── Notes ──────────────────────────────────────────────────────────────────

  function readCampaignNotes(campaignId) {
    const dir = getCampaignsDir();
    if (!dir) return '';
    const file = path.join(dir, campaignId, NOTES_FILE);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  }

  function writeCampaignNotes(campaignId, content) {
    const dir = getCampaignsDir();
    if (!dir) return;
    const campaignDir = path.join(dir, campaignId);
    fs.mkdirSync(campaignDir, { recursive: true });
    fs.writeFileSync(path.join(campaignDir, NOTES_FILE), content, 'utf8');
  }

  function readNotes(campaignId, sessionId) {
    const file = notesPath(campaignId, sessionId);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  }

  function writeNotes(campaignId, sessionId, content) {
    const dir = sessionPath(campaignId, sessionId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(notesPath(campaignId, sessionId), content, 'utf8');
  }

  // ── HUDs (session-scoped, separate from scene files) ──────────────────────

  function saveHuds(campaignId, sessionId, huds) {
    if (!sessionId) return;
    const dir = sessionPath(campaignId, sessionId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(hudsFilePath(campaignId, sessionId), JSON.stringify(huds ?? [], null, 2), 'utf8');
  }

  function loadHuds(campaignId, sessionId) {
    if (!sessionId) return [];
    const file = hudsFilePath(campaignId, sessionId);
    if (!fs.existsSync(file)) return [];
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return []; }
  }

  // ── HUD Configs (named snapshots of the huds array) ──────────────────────

  function saveHudConfig(campaignId, sessionId, config) {
    if (!sessionId) return null;
    const dir = hudConfigsDir(campaignId, sessionId);
    fs.mkdirSync(dir, { recursive: true });
    const data = { ...config, savedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(dir, config.id + SCENE_EXT), JSON.stringify(data, null, 2), 'utf8');
    return { id: config.id, name: config.name || '', savedAt: data.savedAt };
  }

  function listHudConfigs(campaignId, sessionId) {
    if (!sessionId) return [];
    const dir = hudConfigsDir(campaignId, sessionId);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith(SCENE_EXT))
      .map(f => {
        try {
          const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
          return { id: d.id, name: d.name || '(unnamed)', savedAt: d.savedAt ?? '' };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  function loadHudConfig(campaignId, sessionId, configId) {
    if (!sessionId) return null;
    const file = path.join(hudConfigsDir(campaignId, sessionId), configId + SCENE_EXT);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function deleteHudConfig(campaignId, sessionId, configId) {
    if (!sessionId) return;
    const file = path.join(hudConfigsDir(campaignId, sessionId), configId + SCENE_EXT);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  function renameHudConfig(campaignId, sessionId, configId, newName) {
    if (!sessionId) return false;
    const file = path.join(hudConfigsDir(campaignId, sessionId), configId + SCENE_EXT);
    if (!fs.existsSync(file)) return false;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    data.name = newName;
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  }

  // ── Scenes ─────────────────────────────────────────────────────────────────

  function saveScene(campaignId, sessionId, scene) {
    const dir = scenesDir(campaignId, sessionId);
    fs.mkdirSync(dir, { recursive: true });
    // Strip huds — they are stored separately in huds.json
    const { huds: _ignored, ...sceneData } = scene;
    const data = { ...sceneData, savedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(dir, scene.id + SCENE_EXT), JSON.stringify(data, null, 2), 'utf8');
    return { id: scene.id, name: scene.name || '', savedAt: data.savedAt };
  }

  function listScenes(campaignId, sessionId) {
    const dir = scenesDir(campaignId, sessionId);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith(SCENE_EXT))
      .map(f => {
        try {
          const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
          return { id: d.id, name: d.name || '(unnamed)', savedAt: d.savedAt ?? '' };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  function loadScene(campaignId, sessionId, sceneId) {
    const file = path.join(scenesDir(campaignId, sessionId), sceneId + SCENE_EXT);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function deleteScene(campaignId, sessionId, sceneId) {
    const file = path.join(scenesDir(campaignId, sessionId), sceneId + SCENE_EXT);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  function renameScene(campaignId, sessionId, sceneId, newName) {
    const file = path.join(scenesDir(campaignId, sessionId), sceneId + SCENE_EXT);
    if (!fs.existsSync(file)) return false;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    data.name = newName;
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  }

  return {
    setRootFolder, getRootFolder, getCampaignsDir,
    scan,
    createCampaign, renameCampaign, deleteCampaign,
    createSession, renameSession, deleteSession,
    readCampaignNotes, writeCampaignNotes,
    readNotes, writeNotes,
    saveHuds, loadHuds,
    saveHudConfig, listHudConfigs, loadHudConfig, deleteHudConfig, renameHudConfig,
    saveScene, listScenes, loadScene, deleteScene, renameScene,
  };
}

module.exports = { createCampaignLibrary };
