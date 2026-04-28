// File-system map library: manages the root folder, projects, and map image files.

const fs   = require('fs');
const path = require('path');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

// Returns true if filename has a recognised image extension.
function isImage(filename) {
  return IMAGE_EXTS.has(path.extname(filename).toLowerCase());
}

// Returns a non-colliding destination path, appending _1, _2, … as needed.
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

// Reads all image files in dir and returns them as map descriptors.
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

// Creates the library backed by config (use createConfig() for file persistence, or an in-memory object for tests).
function createLibrary(config) {
  // Restore persisted root folder, but only if it still exists on disk
  const stored = config.get('rootFolder', null);
  let rootFolder = (stored && fs.existsSync(stored)) ? stored : null;

  // ── Helpers ──────────────────────────────────────────────────────────────

  // Returns the maps/ subdirectory under the current root folder, or null.
  function getMapsDir() {
    return rootFolder ? path.join(rootFolder, 'maps') : null;
  }

  // Creates the maps/ directory if needed and returns its path.
  function ensureMapsDir() {
    const d = getMapsDir();
    if (d) fs.mkdirSync(d, { recursive: true });
    return d;
  }

  // Converts a map ID (relative path) to an absolute file-system path.
  function resolveMapPath(mapId) {
    const mapsDir = getMapsDir();
    if (!mapsDir) return null;
    return path.join(mapsDir, mapId.replace(/\//g, path.sep));
  }

  // ── Public API ────────────────────────────────────────────────────────────

  // Sets the root folder, persists it, and ensures the maps/ directory exists.
  function setRootFolder(folderPath) {
    rootFolder = folderPath;
    config.set('rootFolder', folderPath);
    ensureMapsDir();
  }

  // Returns the current root folder path, or null if unset.
  function getRootFolder() { return rootFolder; }

  // Walks the maps/ directory and returns all projects and root-level maps.
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

  // Creates a new named subdirectory under maps/ and returns its descriptor.
  function createProject(name) {
    const mapsDir = ensureMapsDir();
    const projectPath = path.join(mapsDir, name);
    fs.mkdirSync(projectPath, { recursive: true });
    return { id: name, name, path: projectPath, maps: [] };
  }

  // Renames a project directory on disk.
  function renameProject(oldId, newName) {
    const mapsDir = getMapsDir();
    if (!mapsDir) throw new Error('No root folder set');
    fs.renameSync(path.join(mapsDir, oldId), path.join(mapsDir, newName));
    return newName;
  }

  // Deletes a project, moving its images to the root maps/ directory first.
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

  // Copies image files into the library, optionally under a project.
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

  // Moves a map to a different project (or to the root maps/ directory).
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

  // Permanently deletes a map file from disk.
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
