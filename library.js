const fs   = require('fs');
const path = require('path');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

function isImage(filename) {
  return IMAGE_EXTS.has(path.extname(filename).toLowerCase());
}

function uniqueDest(dir, filename) {
  const ext  = path.extname(filename);
  const base = path.basename(filename, ext);
  let dest = path.join(dir, filename);
  let i = 1;
  while (fs.existsSync(dest)) {
    dest = path.join(dir, `${base}_${i}${ext}`);
    i++;
  }
  return dest;
}

function scanMaps(dir, projectId, mapsDir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && isImage(e.name))
    .map((e) => ({
      id:        path.relative(mapsDir, path.join(dir, e.name)).replace(/\\/g, '/'),
      path:      path.join(dir, e.name),
      name:      e.name,
      projectId: projectId ?? null,
    }));
}

/**
 * @param {object} config  Object with get(key, default) / set(key, value) methods.
 *                         Use createConfig() from config.js for file-backed persistence,
 *                         or pass an in-memory object for tests.
 */
function createLibrary(config) {
  // Restore persisted root folder, but only if it still exists on disk
  const stored = config.get('rootFolder', null);
  let rootFolder = (stored && fs.existsSync(stored)) ? stored : null;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getMapsDir() {
    return rootFolder ? path.join(rootFolder, 'maps') : null;
  }

  function ensureMapsDir() {
    const d = getMapsDir();
    if (d) fs.mkdirSync(d, { recursive: true });
    return d;
  }

  function resolveMapPath(mapId) {
    const mapsDir = getMapsDir();
    if (!mapsDir) return null;
    return path.join(mapsDir, mapId.replace(/\//g, path.sep));
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function setRootFolder(folderPath) {
    rootFolder = folderPath;
    config.set('rootFolder', folderPath);
    ensureMapsDir();
  }

  function getRootFolder() { return rootFolder; }

  function scan() {
    const mapsDir = getMapsDir();
    if (!mapsDir || !fs.existsSync(mapsDir)) {
      return { rootFolder, mapsDir, projects: [], rootMaps: [] };
    }

    const entries  = fs.readdirSync(mapsDir, { withFileTypes: true });
    const rootMaps = [];
    const projects = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const projectPath = path.join(mapsDir, entry.name);
        projects.push({
          id:   entry.name,
          name: entry.name,
          path: projectPath,
          maps: scanMaps(projectPath, entry.name, mapsDir),
        });
      } else if (entry.isFile() && isImage(entry.name)) {
        rootMaps.push(...scanMaps(mapsDir, null, mapsDir).filter((m) => m.name === entry.name));
      }
    }

    return { rootFolder, mapsDir, projects, rootMaps };
  }

  function createProject(name) {
    const mapsDir = ensureMapsDir();
    const projectPath = path.join(mapsDir, name);
    fs.mkdirSync(projectPath, { recursive: true });
    return { id: name, name, path: projectPath, maps: [] };
  }

  function renameProject(oldId, newName) {
    const mapsDir = getMapsDir();
    if (!mapsDir) throw new Error('No root folder set');
    fs.renameSync(path.join(mapsDir, oldId), path.join(mapsDir, newName));
    return newName;
  }

  function deleteProject(projectId) {
    const mapsDir = getMapsDir();
    if (!mapsDir) throw new Error('No root folder set');
    const projectPath = path.join(mapsDir, projectId);
    if (!fs.existsSync(projectPath)) return;

    for (const entry of fs.readdirSync(projectPath, { withFileTypes: true })) {
      if (entry.isFile() && isImage(entry.name)) {
        fs.renameSync(
          path.join(projectPath, entry.name),
          uniqueDest(mapsDir, entry.name)
        );
      }
    }
    fs.rmdirSync(projectPath);
  }

  function copyFiles(filePaths, projectId = null) {
    const mapsDir = ensureMapsDir();
    const destDir = projectId ? path.join(mapsDir, projectId) : mapsDir;
    fs.mkdirSync(destDir, { recursive: true });

    const result = [];
    for (const src of filePaths) {
      if (!isImage(path.basename(src))) continue;
      const destPath = uniqueDest(destDir, path.basename(src));
      if (path.resolve(src) !== path.resolve(destPath)) {
        fs.copyFileSync(src, destPath);
      }
      result.push({
        id:        path.relative(mapsDir, destPath).replace(/\\/g, '/'),
        path:      destPath,
        name:      path.basename(destPath),
        projectId: projectId ?? null,
      });
    }
    return result;
  }

  function moveMap(mapId, toProjectId) {
    const mapsDir = getMapsDir();
    if (!mapsDir) throw new Error('No root folder set');
    const srcPath = resolveMapPath(mapId);
    const destDir = toProjectId ? path.join(mapsDir, toProjectId) : mapsDir;
    fs.mkdirSync(destDir, { recursive: true });
    const destPath = uniqueDest(destDir, path.basename(srcPath));
    fs.renameSync(srcPath, destPath);
    return {
      id:        path.relative(mapsDir, destPath).replace(/\\/g, '/'),
      path:      destPath,
      name:      path.basename(destPath),
      projectId: toProjectId ?? null,
    };
  }

  function deleteMap(mapId) {
    const filePath = resolveMapPath(mapId);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  return {
    setRootFolder, getRootFolder, getMapsDir,
    scan,
    createProject, renameProject, deleteProject,
    copyFiles, moveMap, deleteMap,
  };
}

module.exports = { createLibrary };
