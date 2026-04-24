// ════════════════════════════════════════════════════════════════════════════
// LIBRARY
// ════════════════════════════════════════════════════════════════════════════

async function initLibrary() {
  const root = await window.electronAPI.getLibraryRoot();
  if (!root) {
    showLibSetup();
  } else {
    await refreshLibrary();
  }
}

function showLibSetup() {
  libSetup.style.display = '';
  libRootPath.textContent = '';
  libContent.innerHTML = '';
  libFooter.style.visibility = 'hidden';
}

function hideLibSetup() {
  libSetup.style.display = 'none';
  libFooter.style.visibility = '';
}

async function refreshLibrary() {
  const { rootFolder, mapsDir, projects, rootMaps } = await window.electronAPI.scanLibrary();
  hideLibSetup();
  libRootPath.textContent = mapsDir || '';
  renderLibrary(projects, rootMaps);
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderLibrary(projects, rootMaps) {
  libContent.innerHTML = '';

  // Named projects first
  for (const proj of projects) {
    libContent.appendChild(buildProjectSection(proj.id, proj.name, proj.maps, false));
  }

  // Unsorted (root maps) — always shown, can't be deleted
  libContent.appendChild(buildProjectSection(null, 'Unsorted', rootMaps, true));
}

function buildProjectSection(projectId, label, maps, isUnsorted) {
  const section = document.createElement('div');
  section.className = 'project-section';
  section.dataset.projectId = projectId ?? '';

  // Header
  const header = document.createElement('div');
  header.className = 'project-header';

  const chevron = document.createElement('span');
  chevron.className = 'project-chevron';
  chevron.textContent = '▾';

  const nameEl = document.createElement('span');
  nameEl.className = 'project-name';
  nameEl.textContent = label;

  const countEl = document.createElement('span');
  countEl.className = 'project-count';
  countEl.textContent = maps.length || '';

  const actions = document.createElement('div');
  actions.className = 'project-actions';

  if (!isUnsorted) {
    const btnRename = document.createElement('button');
    btnRename.className = 'btn-icon-xs';
    btnRename.title = 'Rename';
    btnRename.textContent = '✏';
    btnRename.addEventListener('click', (e) => {
      e.stopPropagation();
      startRename(section, nameEl, projectId);
    });

    const btnDel = document.createElement('button');
    btnDel.className = 'btn-icon-xs danger';
    btnDel.title = 'Delete project (maps moved to Unsorted)';
    btnDel.textContent = '×';
    btnDel.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.electronAPI.deleteProject(projectId);
      await refreshLibrary();
    });

    actions.appendChild(btnRename);
    actions.appendChild(btnDel);
  }

  header.appendChild(chevron);
  header.appendChild(nameEl);
  header.appendChild(countEl);
  header.appendChild(actions);
  header.addEventListener('click', () => {
    section.classList.toggle('collapsed');
    chevron.style.transform = section.classList.contains('collapsed') ? 'rotate(-90deg)' : '';
  });

  // Maps grid (drop zone)
  const mapsGrid = document.createElement('div');
  mapsGrid.className = 'project-maps';
  mapsGrid.dataset.projectId = projectId ?? '';

  if (maps.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'project-empty';
    empty.textContent = 'Drop images here';
    mapsGrid.appendChild(empty);
  } else {
    for (const map of maps) {
      mapsGrid.appendChild(buildMapCard(map));
    }
  }

  // Drop zone: accept internal drags + filesystem drops
  mapsGrid.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = mapLib.dragId ? 'move' : 'copy';
    mapsGrid.classList.add('drag-over');
  });
  mapsGrid.addEventListener('dragleave', () => mapsGrid.classList.remove('drag-over'));
  mapsGrid.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    mapsGrid.classList.remove('drag-over');
    const targetProjectId = mapsGrid.dataset.projectId || null;

    if (mapLib.dragId) {
      // Internal move
      if (mapLib.dragId !== targetProjectId && getProjectIdFromMapId(mapLib.dragId) !== targetProjectId) {
        await window.electronAPI.moveMap(mapLib.dragId, targetProjectId);
        // If the active map moved, update its id
        if (mapLib.activeId === mapLib.dragId) {
          const result = await window.electronAPI.scanLibrary();
          const allMaps = [...result.rootMaps, ...result.projects.flatMap(p => p.maps)];
          const moved = allMaps.find(m => m.name === getNameFromMapId(mapLib.dragId) && m.projectId === targetProjectId);
          if (moved) activateMap(moved);
        }
        await refreshLibrary();
      }
      mapLib.dragId = null;
    } else if (e.dataTransfer.files.length > 0) {
      // Files dropped from filesystem — handled globally, but also accept here
      const files = [...e.dataTransfer.files]
        .filter(f => /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name))
        .map(f => window.electronAPI.getFilePath(f));
      if (files.length) {
        const added = await window.electronAPI.copyFiles(files, targetProjectId);
        if (added.length && !mapLib.activeId) activateMap(added[0]);
        await refreshLibrary();
      }
    }
  });

  section.appendChild(header);
  section.appendChild(mapsGrid);
  return section;
}

function buildMapCard(map) {
  const card = document.createElement('div');
  card.className = 'map-card' + (map.id === mapLib.activeId ? ' active' : '');
  card.title = map.name;
  card.draggable = true;
  card.dataset.mapId = map.id;

  const img = document.createElement('img');
  img.src  = 'file:///' + map.path.replace(/\\/g, '/');
  img.alt  = map.name;
  img.draggable = false;

  const nameEl = document.createElement('div');
  nameEl.className = 'map-card-name';
  nameEl.textContent = map.name;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'map-card-remove';
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove from library';
  removeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (map.id === mapLib.activeId) {
      window.electronAPI.setActiveMap(null);
      mapLib.activeId = null;
    }
    window.electronAPI.deleteMap(map.id);
    await refreshLibrary();
  });

  card.appendChild(img);
  card.appendChild(nameEl);
  card.appendChild(removeBtn);

  card.addEventListener('click', () => activateMap(map));

  // Internal drag
  card.addEventListener('dragstart', (e) => {
    mapLib.dragId = map.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', map.id);
  });
  card.addEventListener('dragend', () => {
    mapLib.dragId = null;
    card.classList.remove('dragging');
  });

  return card;
}

function imageBoundsFromSrc(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) { resolve({}); return; }
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      resolve({
        x: Math.round((CANVAS_SIZE - w) / 2),
        y: Math.round((CANVAS_SIZE - h) / 2),
        w, h,
      });
    };
    img.onerror = () => resolve({});
    img.src = src;
  });
}

function activateMap(map) {
  if (display.advanced) {
    const src = 'file:///' + map.path.replace(/\\/g, '/');
    imageBoundsFromSrc(src).then(bounds => {
      window.electronAPI.addLayer({
        type: 'image', src, name: map.name,
        visible: true, opacity: 1,
        ...bounds,
      }).then(newLayers => {
        if (newLayers) {
          layers = newLayers;
          renderLayerList();
          const layersTab = document.querySelector('#right-panel-tabs [data-right-tab="layers"]');
          if (layersTab && !layersTab.classList.contains('active')) layersTab.click();
        }
        setTimeout(() => window.electronAPI.requestPreview(), 400);
      });
    });
    return;
  }
  mapLib.activeId = map.id;
  window.electronAPI.setActiveMap(map);
  document.querySelectorAll('.map-card').forEach((c) => {
    c.classList.toggle('active', c.dataset.mapId === map.id);
  });
  setTimeout(() => window.electronAPI.requestPreview(), 400);
}

function startRename(section, nameEl, projectId) {
  const input = document.createElement('input');
  input.className = 'project-name-input';
  input.value = nameEl.textContent;
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  async function commit() {
    const newName = input.value.trim();
    if (newName && newName !== projectId) {
      await window.electronAPI.renameProject(projectId, newName);
    }
    await refreshLibrary();
  }
  input.addEventListener('blur',    commit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { input.value = projectId; input.blur(); } });
}

function getProjectIdFromMapId(mapId) {
  const parts = mapId.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join('/') : null;
}
function getNameFromMapId(mapId) {
  return mapId.split('/').at(-1);
}

// ── Toolbar actions ───────────────────────────────────────────────────────────

btnRefreshLib.addEventListener('click', refreshLibrary);

async function pickFolder() {
  const result = await window.electronAPI.selectRootFolder();
  if (result) await refreshLibrary();
}
btnSelectFolder.addEventListener('click', pickFolder);
btnSetupFolder.addEventListener('click',  pickFolder);

btnNewProject.addEventListener('click', () => {
  libFooter.innerHTML = '';
  const input = document.createElement('input');
  input.className = 'new-project-input';
  input.placeholder = 'Project name…';
  input.maxLength = 64;

  const btnOk = document.createElement('button');
  btnOk.className = 'btn-primary-sm';
  btnOk.textContent = '✓';

  const btnCancel = document.createElement('button');
  btnCancel.className = 'btn-ghost-sm';
  btnCancel.textContent = '✕';

  libFooter.appendChild(input);
  libFooter.appendChild(btnOk);
  libFooter.appendChild(btnCancel);
  input.focus();

  function restoreFooter() {
    libFooter.innerHTML = '';
    libFooter.appendChild(btnNewProject);
    libFooter.appendChild(btnAddImages);
  }

  async function commit() {
    const name = input.value.trim();
    restoreFooter();
    if (name) {
      await window.electronAPI.createProject(name);
      await refreshLibrary();
    }
  }

  btnOk.addEventListener('click', commit);
  btnCancel.addEventListener('click', restoreFooter);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  commit();
    if (e.key === 'Escape') restoreFooter();
  });
});

btnAddImages.addEventListener('click', async () => {
  const files = await window.electronAPI.openMapDialog();
  if (files.length) {
    const added = await window.electronAPI.copyFiles(files, null);
    if (added.length && !mapLib.activeId) activateMap(added[0]);
    await refreshLibrary();
  }
});

// ── Global drag & drop from filesystem ───────────────────────────────────────
document.addEventListener('dragenter', (e) => {
  if (e.dataTransfer.types.includes('Files') && !mapLib.dragId) {
    mapLib.dropCounter++;
    dropOverlay.classList.add('visible');
  }
});
document.addEventListener('dragleave', () => {
  mapLib.dropCounter--;
  if (mapLib.dropCounter <= 0) { mapLib.dropCounter = 0; dropOverlay.classList.remove('visible'); }
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  mapLib.dropCounter = 0;
  dropOverlay.classList.remove('visible');
  if (mapLib.dragId) return;

  const files = [...e.dataTransfer.files]
    .filter(f => /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name))
    .map(f => window.electronAPI.getFilePath(f));
  if (!files.length) return;

  const added = await window.electronAPI.copyFiles(files, null);
  if (added.length && !mapLib.activeId) activateMap(added[0]);
  await refreshLibrary();
});
