// ── DOM refs ──────────────────────────────────────────────────────────────────
const libSetup        = document.getElementById('lib-setup');
const libRootPath     = document.getElementById('lib-root-path');
const libContent      = document.getElementById('lib-content');
const libFooter       = document.querySelector('.lib-footer');
const btnRefreshLib   = document.getElementById('btn-refresh-lib');
const btnSelectFolder = document.getElementById('btn-select-folder');
const btnSetupFolder  = document.getElementById('btn-setup-folder');
const btnNewProject   = document.getElementById('btn-new-project');
const btnAddImages    = document.getElementById('btn-add-images');
const dropOverlay     = document.getElementById('drop-overlay');

// ── Campaign tab ──────────────────────────────────────────────────────────────
const tabBtns           = document.querySelectorAll('#left-panel-tabs .panel-tab');
const tabPaneMaps       = document.getElementById('tab-pane-maps');
const tabPaneCampaign   = document.getElementById('tab-pane-campaign');
const campaignSelect    = document.getElementById('campaign-select');
const btnNewCampaign    = document.getElementById('btn-new-campaign');
const btnRenameCampaign = document.getElementById('btn-rename-campaign');
const btnDeleteCampaign = document.getElementById('btn-delete-campaign');
const sessionsContent   = document.getElementById('sessions-content');
const notesTextarea     = document.getElementById('notes-textarea');
const notesStatus       = document.getElementById('notes-status');
const notesTitle        = document.getElementById('notes-title');
const btnNewSession     = document.getElementById('btn-new-session');

const monitorMap      = document.getElementById('monitor-map');
const monitorList     = document.getElementById('monitor-list');
const btnCloseScreen  = document.getElementById('btn-close-screen');
const previewImg      = document.getElementById('preview-img');
const previewPlaceholder = document.getElementById('preview-placeholder');
const btnRefreshPreview  = document.getElementById('btn-refresh-preview');

const elGridVisible   = document.getElementById('grid-visible');
const elCellSize      = document.getElementById('cell-size');
const elGridColor     = document.getElementById('grid-color');
const elGridOpacity   = document.getElementById('grid-opacity');
const elGridOpacityVal= document.getElementById('grid-opacity-val');
const elDpi           = document.getElementById('dpi');
const elZoomVal       = document.getElementById('zoom-val');
const elZoomSlider    = document.getElementById('zoom-slider');
const btnZoomIn       = document.getElementById('zoom-in');
const btnZoomOut      = document.getElementById('zoom-out');
const btnZoomReset    = document.getElementById('zoom-reset');

// ── State ─────────────────────────────────────────────────────────────────────
let campaigns           = [];
let selectedCampaignId  = null;
let selectedSessionId   = null;
let notesDebounceTimer  = null;
const NOTES_DEBOUNCE_MS = 800;

let displays        = [];
let activeDisplayId = null;
let activeMapId     = null;   // map.id (relative path from mapsDir)
let dragMapId       = null;   // id of card being dragged internally
let dropCounter     = 0;      // track enter/leave for nested children
const settings      = { gridVisible: true, cellSizeInches: 1.0, zoom: 1.0, dpi: 96, gridColor: '#ffffff', gridOpacity: 0.25 };

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
    e.dataTransfer.dropEffect = dragMapId ? 'move' : 'copy';
    mapsGrid.classList.add('drag-over');
  });
  mapsGrid.addEventListener('dragleave', () => mapsGrid.classList.remove('drag-over'));
  mapsGrid.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    mapsGrid.classList.remove('drag-over');
    const targetProjectId = mapsGrid.dataset.projectId || null;

    if (dragMapId) {
      // Internal move
      if (dragMapId !== targetProjectId && getProjectIdFromMapId(dragMapId) !== targetProjectId) {
        await window.electronAPI.moveMap(dragMapId, targetProjectId);
        // If the active map moved, update its id
        if (activeMapId === dragMapId) {
          const result = await window.electronAPI.scanLibrary();
          const allMaps = [...result.rootMaps, ...result.projects.flatMap(p => p.maps)];
          const moved = allMaps.find(m => m.name === getNameFromMapId(dragMapId) && m.projectId === targetProjectId);
          if (moved) activateMap(moved);
        }
        await refreshLibrary();
      }
      dragMapId = null;
    } else if (e.dataTransfer.files.length > 0) {
      // Files dropped from filesystem — handled globally, but also accept here
      const files = [...e.dataTransfer.files]
        .filter(f => /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name))
        .map(f => window.electronAPI.getFilePath(f));
      if (files.length) {
        const added = await window.electronAPI.copyFiles(files, targetProjectId);
        if (added.length && !activeMapId) activateMap(added[0]);
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
  card.className = 'map-card' + (map.id === activeMapId ? ' active' : '');
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
    if (map.id === activeMapId) {
      window.electronAPI.setActiveMap(null);
      activeMapId = null;
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
    dragMapId = map.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', map.id);
  });
  card.addEventListener('dragend', () => {
    dragMapId = null;
    card.classList.remove('dragging');
  });

  return card;
}

/**
 * Loads an image from src and returns normalised {x, y, w, h} bounds so it
 * appears at its natural pixel size, centred on the screen.  Falls back to
 * full-screen contain-fit when no preview reference is available.
 */
function imageBoundsFromSrc(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const sw = previewImg?.naturalWidth  || 0;
      const sh = previewImg?.naturalHeight || 0;
      if (!sw || !sh || !img.naturalWidth || !img.naturalHeight) {
        resolve({});
        return;
      }
      const w = Math.min(img.naturalWidth  / sw, 1);
      const h = Math.min(img.naturalHeight / sh, 1);
      resolve({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
    };
    img.onerror = () => resolve({});
    img.src = src;
  });
}

function activateMap(map) {
  if (screenModeAdvanced) {
    // In advanced mode: add the map as an image layer instead of setting the background
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
          // Switch to Layers tab so the GM sees the new layer
          const layersTab = document.querySelector('#right-panel-tabs [data-right-tab="layers"]');
          if (layersTab && !layersTab.classList.contains('active')) layersTab.click();
        }
        setTimeout(() => window.electronAPI.requestPreview(), 400);
      });
    });
    return;
  }
  activeMapId = map.id;
  window.electronAPI.setActiveMap(map);
  // Re-render cards to show active state without full reload
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

// Helper: get project id from a map id (e.g. "Session 1/map.jpg" → "Session 1")
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
  // Replace footer buttons with inline input
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
    if (added.length && !activeMapId) activateMap(added[0]);
    await refreshLibrary();
  }
});

// ── Global drag & drop from filesystem ───────────────────────────────────────
document.addEventListener('dragenter', (e) => {
  if (e.dataTransfer.types.includes('Files') && !dragMapId) {
    dropCounter++;
    dropOverlay.classList.add('visible');
  }
});
document.addEventListener('dragleave', () => {
  dropCounter--;
  if (dropCounter <= 0) { dropCounter = 0; dropOverlay.classList.remove('visible'); }
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropCounter = 0;
  dropOverlay.classList.remove('visible');
  if (dragMapId) return; // internal drag handled by drop zone

  const files = [...e.dataTransfer.files]
    .filter(f => /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name))
    .map(f => window.electronAPI.getFilePath(f));
  if (!files.length) return;

  const added = await window.electronAPI.copyFiles(files, null);
  if (added.length && !activeMapId) activateMap(added[0]);
  await refreshLibrary();
});

// ════════════════════════════════════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════════════════════════════════════

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    tabPaneMaps.style.display     = tab === 'maps'     ? '' : 'none';
    tabPaneCampaign.style.display = tab === 'campaign' ? '' : 'none';
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CAMPAIGNS
// ════════════════════════════════════════════════════════════════════════════

async function initCampaigns() {
  const { campaigns: list } = await window.electronAPI.scanCampaigns();
  campaigns = list;
  renderCampaignSelect();
  if (campaigns.length > 0) {
    selectedCampaignId = campaigns[0].id;
    campaignSelect.value = selectedCampaignId;
    renderSessions();
  }
  await loadCurrentNotes();
}

async function refreshCampaigns() {
  const { campaigns: list } = await window.electronAPI.scanCampaigns();
  campaigns = list;
  renderCampaignSelect();
  renderSessions();
}

function renderCampaignSelect() {
  campaignSelect.innerHTML = '';
  if (campaigns.length === 0) {
    const opt = document.createElement('option');
    opt.disabled = true;
    opt.selected = true;
    opt.textContent = 'No campaigns yet';
    campaignSelect.appendChild(opt);
    return;
  }
  for (const c of campaigns) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    campaignSelect.appendChild(opt);
  }
  if (selectedCampaignId && campaigns.find(c => c.id === selectedCampaignId)) {
    campaignSelect.value = selectedCampaignId;
  } else {
    selectedCampaignId = campaigns[0]?.id ?? null;
    campaignSelect.value = selectedCampaignId ?? '';
  }
}

function renderSessions() {
  sessionsContent.innerHTML = '';
  const campaign = campaigns.find(c => c.id === selectedCampaignId);
  if (!campaign || campaign.sessions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'sessions-empty';
    empty.textContent = campaign ? 'No sessions yet' : '';
    sessionsContent.appendChild(empty);
    return;
  }
  for (const session of campaign.sessions) {
    sessionsContent.appendChild(buildSessionRow(session));
  }
}

// ── Inline confirmation helper ────────────────────────────────────────────────

function confirmInline(deleteBtn, onConfirm) {
  const wrapper = document.createElement('span');
  wrapper.style.cssText = 'display:inline-flex;gap:3px;align-items:center;';

  const label = document.createElement('span');
  label.style.cssText = 'font-size:10px;color:#e05555;';
  label.textContent = 'Sure?';

  const btnYes = document.createElement('button');
  btnYes.className = 'btn-icon-xs danger';
  btnYes.title = 'Yes, delete';
  btnYes.textContent = '✓';

  const btnNo = document.createElement('button');
  btnNo.className = 'btn-icon-xs';
  btnNo.title = 'Cancel';
  btnNo.textContent = '✕';

  wrapper.appendChild(label);
  wrapper.appendChild(btnYes);
  wrapper.appendChild(btnNo);
  deleteBtn.replaceWith(wrapper);

  btnYes.addEventListener('click', (e) => { e.stopPropagation(); onConfirm(); });
  btnNo.addEventListener('click',  (e) => { e.stopPropagation(); wrapper.replaceWith(deleteBtn); });
}

// ── Notes helpers ─────────────────────────────────────────────────────────────

function setNotesStatus(state) {
  notesStatus.classList.remove('saved', 'unsaved');
  if (state === 'saved')   { notesStatus.textContent = 'Saved';   notesStatus.classList.add('saved'); }
  if (state === 'unsaved') { notesStatus.textContent = 'Unsaved'; notesStatus.classList.add('unsaved'); }
  if (!state)              { notesStatus.textContent = ''; }
}

async function flushNotes() {
  clearTimeout(notesDebounceTimer);
  if (!notesStatus.classList.contains('unsaved')) return;
  if (selectedSessionId) {
    await window.electronAPI.writeNotes(selectedCampaignId, selectedSessionId, notesTextarea.value);
  } else if (selectedCampaignId) {
    await window.electronAPI.writeCampaignNotes(selectedCampaignId, notesTextarea.value);
  }
  setNotesStatus('');
}

async function loadCurrentNotes() {
  if (!selectedCampaignId) {
    notesTextarea.disabled = true;
    notesTextarea.value = '';
    notesTextarea.placeholder = 'Select a campaign to edit notes…';
    notesTitle.textContent = 'Notes';
    setNotesStatus('');
    return;
  }
  notesTextarea.disabled = false;
  if (selectedSessionId) {
    notesTitle.textContent = selectedSessionId;
    notesTextarea.placeholder = 'Session notes…';
    notesTextarea.value = await window.electronAPI.readNotes(selectedCampaignId, selectedSessionId);
  } else {
    notesTitle.textContent = 'Campaign Notes';
    notesTextarea.placeholder = 'Campaign notes…';
    notesTextarea.value = await window.electronAPI.readCampaignNotes(selectedCampaignId);
  }
  setNotesStatus('');
}

notesTextarea.addEventListener('input', () => {
  setNotesStatus('unsaved');
  clearTimeout(notesDebounceTimer);
  notesDebounceTimer = setTimeout(async () => {
    if (selectedSessionId) {
      await window.electronAPI.writeNotes(selectedCampaignId, selectedSessionId, notesTextarea.value);
    } else if (selectedCampaignId) {
      await window.electronAPI.writeCampaignNotes(selectedCampaignId, notesTextarea.value);
    }
    setNotesStatus('saved');
    setTimeout(() => { if (notesStatus.classList.contains('saved')) setNotesStatus(''); }, 2000);
  }, NOTES_DEBOUNCE_MS);
});

// ── Session rows ──────────────────────────────────────────────────────────────

function buildSessionRow(session) {
  const row = document.createElement('div');
  row.className = 'session-row' + (session.id === selectedSessionId ? ' active' : '');
  row.dataset.sessionId = session.id;

  const nameEl = document.createElement('span');
  nameEl.className = 'session-name';
  nameEl.textContent = session.name;

  const actions = document.createElement('div');
  actions.className = 'session-actions';

  const btnRename = document.createElement('button');
  btnRename.className = 'btn-icon-xs';
  btnRename.title = 'Rename session';
  btnRename.textContent = '✏';
  btnRename.addEventListener('click', (e) => {
    e.stopPropagation();
    startSessionRename(row, nameEl, session.id);
  });

  const btnDel = document.createElement('button');
  btnDel.className = 'btn-icon-xs danger';
  btnDel.title = 'Delete session';
  btnDel.textContent = '×';
  btnDel.addEventListener('click', (e) => {
    e.stopPropagation();
    confirmInline(btnDel, async () => {
      await flushNotes();
      if (session.id === selectedSessionId) selectedSessionId = null;
      await window.electronAPI.deleteSession(selectedCampaignId, session.id);
      await refreshCampaigns();
      await loadCurrentNotes();
    });
  });

  actions.appendChild(btnRename);
  actions.appendChild(btnDel);
  row.appendChild(nameEl);
  row.appendChild(actions);

  row.addEventListener('click', () => selectSession(selectedCampaignId, session.id));
  return row;
}

function startSessionRename(row, nameEl, sessionId) {
  const input = document.createElement('input');
  input.className = 'session-name-input';
  input.value = sessionId;
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  async function commit() {
    const newName = input.value.trim();
    if (newName && newName !== sessionId) {
      await window.electronAPI.renameSession(selectedCampaignId, sessionId, newName);
      if (selectedSessionId === sessionId) selectedSessionId = newName;
    }
    await refreshCampaigns();
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = sessionId; input.blur(); }
  });
}

async function selectSession(campaignId, sessionId) {
  await flushNotes();
  // Clicking the active session deselects it
  if (selectedCampaignId === campaignId && selectedSessionId === sessionId) {
    selectedSessionId = null;
  } else {
    selectedCampaignId = campaignId;
    selectedSessionId  = sessionId;
  }
  document.querySelectorAll('.session-row').forEach(r => {
    r.classList.toggle('active', r.dataset.sessionId === selectedSessionId);
  });
  await loadCurrentNotes();
}

// ── Campaign toolbar ──────────────────────────────────────────────────────────

campaignSelect.addEventListener('change', async () => {
  await flushNotes();
  selectedCampaignId = campaignSelect.value;
  selectedSessionId  = null;
  renderSessions();
  await loadCurrentNotes();
});

btnNewCampaign.addEventListener('click', () => {
  // Inline input replaces the select temporarily
  const input = document.createElement('input');
  input.className = 'campaign-name-input';
  input.placeholder = 'Campaign name…';
  input.maxLength = 64;
  const toolbar = campaignSelect.parentElement;
  campaignSelect.replaceWith(input);
  input.focus();

  async function commit() {
    const name = input.value.trim();
    input.replaceWith(campaignSelect);
    if (name) {
      await window.electronAPI.createCampaign(name);
      selectedCampaignId = name;
      await refreshCampaigns();
    }
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  input.blur();
    if (e.key === 'Escape') { input.value = ''; input.blur(); }
  });
});

btnRenameCampaign.addEventListener('click', () => {
  if (!selectedCampaignId) return;
  const input = document.createElement('input');
  input.className = 'campaign-name-input';
  input.value = selectedCampaignId;
  input.maxLength = 64;
  const toolbar = campaignSelect.parentElement;
  campaignSelect.replaceWith(input);
  input.focus();
  input.select();

  async function commit() {
    const newName = input.value.trim();
    input.replaceWith(campaignSelect);
    if (newName && newName !== selectedCampaignId) {
      await window.electronAPI.renameCampaign(selectedCampaignId, newName);
      selectedCampaignId = newName;
      await refreshCampaigns();
    }
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  input.blur();
    if (e.key === 'Escape') { input.value = selectedCampaignId; input.blur(); }
  });
});

btnDeleteCampaign.addEventListener('click', () => {
  if (!selectedCampaignId) return;
  confirmInline(btnDeleteCampaign, async () => {
    await flushNotes();
    selectedSessionId = null;
    await window.electronAPI.deleteCampaign(selectedCampaignId);
    selectedCampaignId = null;
    await refreshCampaigns();
    if (campaigns.length > 0) {
      selectedCampaignId = campaigns[0].id;
      campaignSelect.value = selectedCampaignId;
      renderSessions();
    }
    await loadCurrentNotes();
  });
});

btnNewSession.addEventListener('click', () => {
  if (!selectedCampaignId) return;
  // Inline input appended to sessions list
  const input = document.createElement('input');
  input.className = 'session-name-input';
  input.placeholder = 'Session name…';
  input.maxLength = 64;
  input.style.margin = '2px 8px';
  sessionsContent.appendChild(input);
  input.focus();

  async function commit() {
    const name = input.value.trim();
    input.remove();
    if (name) {
      await window.electronAPI.createSession(selectedCampaignId, name);
      await refreshCampaigns();
      selectSession(selectedCampaignId, name);
    }
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  input.blur();
    if (e.key === 'Escape') { input.value = ''; input.blur(); }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// MONITORS
// ════════════════════════════════════════════════════════════════════════════

async function loadDisplays() {
  displays = await window.electronAPI.getDisplays();
  activeDisplayId = (displays.find((d) => d.active) || {}).id || null;
  renderMonitorMap();
  renderMonitorCards();
  btnCloseScreen.disabled = activeDisplayId === null;
}

function renderMonitorMap() {
  monitorMap.innerHTML = '';
  const pad = 10;
  const mW = monitorMap.clientWidth - pad * 2;
  const mH = monitorMap.clientHeight - pad * 2;
  const rights  = displays.map((d) => d.bounds.x + d.bounds.width);
  const bottoms = displays.map((d) => d.bounds.y + d.bounds.height);
  const minX = Math.min(...displays.map((d) => d.bounds.x));
  const minY = Math.min(...displays.map((d) => d.bounds.y));
  const totW = Math.max(...rights) - minX;
  const totH = Math.max(...bottoms) - minY;
  const scale = Math.min(mW / totW, mH / totH);
  const offX  = pad + (mW - totW * scale) / 2;
  const offY  = pad + (mH - totH * scale) / 2;

  displays.forEach((d, i) => {
    const el = document.createElement('div');
    el.className = 'map-monitor' + (d.id === activeDisplayId ? ' active' : '');
    el.style.left   = offX + (d.bounds.x - minX) * scale + 'px';
    el.style.top    = offY + (d.bounds.y - minY) * scale + 'px';
    el.style.width  = d.bounds.width  * scale + 'px';
    el.style.height = d.bounds.height * scale + 'px';
    el.innerHTML = `<span class="map-label">Monitor ${i + 1}</span><span class="map-res">${d.bounds.width}×${d.bounds.height}</span>${d.isPrimary ? '<span class="map-badge">Primary</span>' : ''}`;
    el.addEventListener('click', () => selectDisplay(d.id));
    monitorMap.appendChild(el);
  });
}

function renderMonitorCards() {
  monitorList.innerHTML = '';
  displays.forEach((d, i) => {
    const isActive = d.id === activeDisplayId;
    const card = document.createElement('div');
    card.className = 'monitor-card' + (isActive ? ' active' : '');
    card.innerHTML = `
      <div class="monitor-card-header">
        <h2>Monitor ${i + 1}</h2>
        ${d.isPrimary ? '<span class="badge-primary">Primary</span>' : ''}
        ${isActive    ? '<span class="badge-active">Active</span>'   : ''}
      </div>
      <div class="monitor-res">${d.bounds.width} × ${d.bounds.height} &nbsp;|&nbsp; ×${d.scaleFactor}</div>
      <button class="btn-select ${isActive ? 'active' : ''}" data-id="${d.id}">
        ${isActive ? 'Screen active here' : 'Send screen here'}
      </button>`;
    monitorList.appendChild(card);
  });
  monitorList.querySelectorAll('.btn-select').forEach((btn) =>
    btn.addEventListener('click', () => selectDisplay(Number(btn.dataset.id)))
  );
}

function selectDisplay(displayId) {
  if (displayId === activeDisplayId) return;
  window.electronAPI.selectDisplay(displayId);
  activeDisplayId = displayId;
  displays = displays.map((d) => ({ ...d, active: d.id === displayId }));
  renderMonitorMap();
  renderMonitorCards();
  btnCloseScreen.disabled = false;
}

btnCloseScreen.addEventListener('click', () => {
  window.electronAPI.closeScreen();
  activeDisplayId = null;
  displays = displays.map((d) => ({ ...d, active: false }));
  renderMonitorMap();
  renderMonitorCards();
  btnCloseScreen.disabled = true;
  showPreviewPlaceholder();
});

window.electronAPI.onScreenClosed(() => {
  activeDisplayId = null;
  displays = displays.map((d) => ({ ...d, active: false }));
  renderMonitorMap();
  renderMonitorCards();
  btnCloseScreen.disabled = true;
  showPreviewPlaceholder();
});

window.electronAPI.onScreenOpened(async (displayId, suggestedDpi) => {
  activeDisplayId = displayId;
  displays = displays.map((d) => ({ ...d, active: d.id === displayId }));
  renderMonitorMap();
  renderMonitorCards();
  btnCloseScreen.disabled = false;
  if (suggestedDpi) { elDpi.value = suggestedDpi; sendSettings({ dpi: suggestedDpi }); }
  if (screenModeAdvanced) await initScene();
});

// ════════════════════════════════════════════════════════════════════════════
// PREVIEW
// ════════════════════════════════════════════════════════════════════════════

function showPreviewPlaceholder() {
  previewImg.style.display = 'none';
  previewPlaceholder.style.display = '';
}

window.electronAPI.onScreenPreview((dataUrl) => {
  previewImg.src = dataUrl;
  previewImg.style.display = 'block';
  previewPlaceholder.style.display = 'none';
});

btnRefreshPreview.addEventListener('click', () => window.electronAPI.requestPreview());

// ════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════════════════

function sendSettings(patch) {
  Object.assign(settings, patch);
  window.electronAPI.updateSettings(patch);
}

/** Apply a settings object to the UI controls without re-sending to main. */
function applySettingsToUI(s) {
  if (s.gridVisible    !== undefined) {
    elGridVisible.checked = s.gridVisible;
    if (elAdvGridVisible) elAdvGridVisible.checked = s.gridVisible;
  }
  if (s.cellSizeInches !== undefined) elCellSize.value       = s.cellSizeInches;
  if (s.gridColor      !== undefined) elGridColor.value      = s.gridColor;
  if (s.gridOpacity    !== undefined) {
    elGridOpacity.value     = Math.round(s.gridOpacity * 100);
    elGridOpacityVal.textContent = Math.round(s.gridOpacity * 100) + '%';
  }
  if (s.dpi  !== undefined) elDpi.value = s.dpi;
  if (s.zoom !== undefined) {
    const z = Math.max(0.25, Math.min(4, s.zoom));
    settings.zoom = z;
    elZoomSlider.value    = Math.round(z * 100);
    elZoomVal.textContent = Math.round(z * 100) + '%';
  }
  if (s.screenMode !== undefined) {
    const isAdv = s.screenMode === 'advanced';
    screenModeAdvanced = isAdv;
    if (elScreenModeAdvanced) elScreenModeAdvanced.checked = isAdv;
    document.body.classList.toggle('advanced-mode', isAdv);
    renderLayerOverlay();
  }
  if (s.gridScaleWithViewport !== undefined) {
    if (elGridScaleViewport) elGridScaleViewport.checked = s.gridScaleWithViewport;
  }
  Object.assign(settings, s);
}

elGridVisible.addEventListener('change', () => {
  if (elAdvGridVisible) elAdvGridVisible.checked = elGridVisible.checked;
  sendSettings({ gridVisible: elGridVisible.checked });
});
elCellSize.addEventListener('change', () => {
  const v = Math.max(0.25, Math.min(4, parseFloat(elCellSize.value) || 1));
  elCellSize.value = v;
  sendSettings({ cellSizeInches: v });
});
elGridColor.addEventListener('input',   () => sendSettings({ gridColor: elGridColor.value }));
elGridOpacity.addEventListener('input', () => {
  const pct = parseInt(elGridOpacity.value);
  elGridOpacityVal.textContent = pct + '%';
  sendSettings({ gridOpacity: pct / 100 });
});
elDpi.addEventListener('change', () => {
  const v = Math.max(48, Math.min(600, parseInt(elDpi.value) || 96));
  elDpi.value = v;
  sendSettings({ dpi: v });
});

function setZoom(value) {
  const z = Math.max(0.25, Math.min(4, value));
  settings.zoom = z;
  elZoomSlider.value = Math.round(z * 100);
  elZoomVal.textContent = Math.round(z * 100) + '%';
  window.electronAPI.updateSettings({ zoom: z });
}
btnZoomIn.addEventListener('click',    () => setZoom(settings.zoom + 0.1));
btnZoomOut.addEventListener('click',   () => setZoom(settings.zoom - 0.1));
btnZoomReset.addEventListener('click', () => setZoom(1.0));
elZoomSlider.addEventListener('input', () => setZoom(parseInt(elZoomSlider.value) / 100));

// ════════════════════════════════════════════════════════════════════════════
// RIGHT PANEL TABS
// ════════════════════════════════════════════════════════════════════════════

const rightTabBtns         = document.querySelectorAll('#right-panel-tabs .panel-tab');
const rightTabPaneSettings = document.getElementById('right-tab-pane-settings');
const rightTabPaneLayers   = document.getElementById('right-tab-pane-layers');

rightTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    rightTabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.rightTab;
    rightTabPaneSettings.style.display = tab === 'settings' ? '' : 'none';
    rightTabPaneLayers.style.display   = tab === 'layers'   ? '' : 'none';
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ADVANCED / LAYER MODE
// ════════════════════════════════════════════════════════════════════════════

// ── DOM refs ──────────────────────────────────────────────────────────────────
const elScreenModeAdvanced = document.getElementById('screen-mode-advanced');
const elAdvGridVisible     = document.getElementById('adv-grid-visible');
const elGridScaleViewport  = document.getElementById('grid-scale-viewport');
const vpZoomOut            = document.getElementById('vp-zoom-out');
const vpZoomIn             = document.getElementById('vp-zoom-in');
const vpZoomReset          = document.getElementById('vp-zoom-reset');
const vpZoomVal            = document.getElementById('vp-zoom-val');
const vpZoomSlider         = document.getElementById('vp-zoom-slider');
const btnPingMode          = document.getElementById('btn-ping-mode');
const layerListEl          = document.getElementById('layer-list');
const layerDetail          = document.getElementById('layer-detail');
const layerDetailTitle     = document.getElementById('layer-detail-title');
const layerDetailFields    = document.getElementById('layer-detail-fields');
const hudListEl            = document.getElementById('hud-list');
const initiativeEditor     = document.getElementById('initiative-editor');
const initiativeEntriesEl  = document.getElementById('initiative-entries');
const btnCombatToggle      = document.getElementById('btn-combat-toggle');
const btnCombatPrev        = document.getElementById('btn-combat-prev');
const btnCombatNext        = document.getElementById('btn-combat-next');
const btnAddEntry          = document.getElementById('btn-add-entry');
const btnAddInitiative     = document.getElementById('btn-add-initiative');
const btnAddImageLayer     = document.getElementById('btn-add-image-layer');
const btnAddLightLayer     = document.getElementById('btn-add-light-layer');
const btnAddFogLayer       = document.getElementById('btn-add-fog-layer');
const btnAddWeatherLayer   = document.getElementById('btn-add-weather-layer');
const btnSaveScene         = document.getElementById('btn-save-scene');
const btnLoadScene         = document.getElementById('btn-load-scene');
const btnResetScene        = document.getElementById('btn-reset-scene');

// ── State ─────────────────────────────────────────────────────────────────────
let layers           = [];
let huds             = [];
let selectedLayerId  = null;
let selectedHudId    = null;
let vpZoom           = 1.0;
let pingMode         = false;
let screenModeAdvanced = false;

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── Screen mode toggle ────────────────────────────────────────────────────────

elScreenModeAdvanced.addEventListener('change', async () => {
  const isAdv = elScreenModeAdvanced.checked;
  screenModeAdvanced = isAdv;
  document.body.classList.toggle('advanced-mode', isAdv);
  sendSettings({ screenMode: isAdv ? 'advanced' : 'simple' });
  if (isAdv) await initScene();
  else renderLayerOverlay(); // clear overlay when switching to simple
});

// Grid visibility shortcut (syncs with Settings-tab checkbox)
elAdvGridVisible.addEventListener('change', () => {
  elGridVisible.checked = elAdvGridVisible.checked;
  sendSettings({ gridVisible: elAdvGridVisible.checked });
});

// Grid scale mode
elGridScaleViewport.addEventListener('change', () => {
  sendSettings({ gridScaleWithViewport: elGridScaleViewport.checked });
});

// ── Scene init ────────────────────────────────────────────────────────────────

async function initScene() {
  const scene = await window.electronAPI.getScene();
  if (!scene) return;
  layers = scene.layers ?? [];
  huds   = scene.huds   ?? [];
  vpZoom = scene.viewport?.zoom ?? 1.0;
  renderLayerList();
  renderHudList();
  updateVpZoomUI();
}

// ── Viewport zoom ─────────────────────────────────────────────────────────────

function updateVpZoomUI() {
  const pct = Math.round(vpZoom * 100);
  vpZoomVal.textContent = pct + '%';
  vpZoomSlider.value    = pct;
}

function setVpZoom(value) {
  vpZoom = Math.max(0.25, Math.min(8, value));
  updateVpZoomUI();
  window.electronAPI.updateViewport({ zoom: vpZoom });
}

vpZoomIn.addEventListener('click',     () => setVpZoom(vpZoom + 0.1));
vpZoomOut.addEventListener('click',    () => setVpZoom(vpZoom - 0.1));
vpZoomReset.addEventListener('click',  () => setVpZoom(1.0));
vpZoomSlider.addEventListener('input', () => setVpZoom(parseInt(vpZoomSlider.value) / 100));

// ── Ping mode ─────────────────────────────────────────────────────────────────

btnPingMode.addEventListener('click', () => {
  pingMode = !pingMode;
  btnPingMode.classList.toggle('ping-active', pingMode);
  previewImg.parentElement.classList.toggle('ping-mode', pingMode);
});

previewImg.addEventListener('click', (e) => {
  if (!pingMode || previewImg.style.display === 'none' || screenModeAdvanced) return;
  const rect     = previewImg.getBoundingClientRect();
  const imgAR    = previewImg.naturalWidth / (previewImg.naturalHeight || 1);
  const boxAR    = rect.width / (rect.height || 1);
  let cx, cy, cw, ch;
  if (imgAR > boxAR) {
    cw = rect.width;  ch = cw / imgAR;
    cx = rect.left;   cy = rect.top + (rect.height - ch) / 2;
  } else {
    ch = rect.height; cw = ch * imgAR;
    cy = rect.top;    cx = rect.left + (rect.width - cw) / 2;
  }
  const nx = (e.clientX - cx) / cw;
  const ny = (e.clientY - cy) / ch;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;
  window.electronAPI.sendPing(nx, ny);
  pingMode = false;
  btnPingMode.classList.remove('ping-active');
  previewImg.parentElement.classList.remove('ping-mode');
});

// ════════════════════════════════════════════════════════════════════════════
// LAYER MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════

const LAYER_TYPE_LABELS = {
  image: 'Img', gif: 'GIF', video: 'Vid', light: 'Lgt', fog: 'Fog', weather: 'Wx',
};
const WEATHER_TYPES = ['rain', 'snow', 'embers', 'fog', 'fireflies'];

function renderLayerList() {
  layerListEl.innerHTML = '';
  if (layers.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'layer-empty';
    empty.textContent = 'No layers yet';
    layerListEl.appendChild(empty);
    renderLayerOverlay();
    return;
  }
  // Render in reverse (top of stack first visually)
  for (let i = layers.length - 1; i >= 0; i--) {
    layerListEl.appendChild(buildLayerRow(layers[i]));
  }
  renderLayerOverlay();
}

function buildLayerRow(layer) {
  const row = document.createElement('div');
  row.className = 'layer-row' + (layer.id === selectedLayerId ? ' active' : '');
  row.dataset.layerId = layer.id;

  const eye = document.createElement('button');
  eye.className = 'btn-icon-xs';
  eye.textContent = layer.visible !== false ? '●' : '○';
  eye.title = layer.visible !== false ? 'Hide' : 'Show';
  eye.addEventListener('click', async (e) => {
    e.stopPropagation();
    const newLayers = await window.electronAPI.updateLayer(layer.id, { visible: !(layer.visible !== false) });
    if (newLayers) { layers = newLayers; renderLayerList(); }
  });

  const badge = document.createElement('span');
  badge.className = 'layer-type-badge';
  badge.textContent = LAYER_TYPE_LABELS[layer.type] ?? layer.type;

  const name = document.createElement('span');
  name.className = 'layer-name';
  name.textContent = layer.name || layer.type;

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-icon-xs danger';
  delBtn.textContent = '×';
  delBtn.title = 'Remove layer';
  delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const layerName = layer.name || LAYER_TYPE_LABELS[layer.type] || layer.type;
    if (!confirm(`Delete layer "${layerName}"?\n\nThis cannot be undone.`)) return;
    if (selectedLayerId === layer.id) { selectedLayerId = null; layerDetail.style.display = 'none'; }
    const newLayers = await window.electronAPI.removeLayer(layer.id);
    if (newLayers) { layers = newLayers; renderLayerList(); }
  });

  row.appendChild(eye);
  row.appendChild(badge);
  row.appendChild(name);
  row.appendChild(delBtn);
  row.addEventListener('click', () => selectLayer(layer.id));
  return row;
}

function selectLayer(id) {
  selectedLayerId = (id === selectedLayerId) ? null : id;
  renderLayerList();   // also calls renderLayerOverlay
  const layer = layers.find(l => l.id === selectedLayerId);
  if (layer) renderLayerDetail(layer);
  else layerDetail.style.display = 'none';
}

function renderLayerDetail(layer) {
  layerDetail.style.display = '';
  layerDetailTitle.textContent = (LAYER_TYPE_LABELS[layer.type] ?? layer.type) + ' Layer';
  layerDetailFields.innerHTML = '';

  function addField(labelText, inputEl) {
    const row = document.createElement('div');
    row.className = 'detail-field';
    const lbl = document.createElement('label');
    lbl.textContent = labelText;
    row.appendChild(lbl);
    row.appendChild(inputEl);
    layerDetailFields.appendChild(row);
    return inputEl;
  }

  // Name (all types)
  const nameInput = document.createElement('input');
  nameInput.type = 'text'; nameInput.value = layer.name || '';
  nameInput.placeholder = 'Layer name…';
  addField('Name', nameInput);
  nameInput.addEventListener('change', async () => {
    const newLayers = await window.electronAPI.updateLayer(layer.id, { name: nameInput.value });
    if (newLayers) layers = newLayers;
  });

  if (layer.type === 'image' || layer.type === 'gif' || layer.type === 'video') {
    // Source file
    const srcWrap = document.createElement('div');
    srcWrap.style.cssText = 'display:flex;gap:4px;flex:1;min-width:0;align-items:center;';
    const srcSpan = document.createElement('span');
    srcSpan.style.cssText = 'font-size:10px;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;';
    srcSpan.title = layer.src ?? '';
    srcSpan.textContent = layer.src ? layer.src.split(/[/\\]/).at(-1) : '(none)';
    const pickBtn = document.createElement('button');
    pickBtn.className = 'btn-ghost-sm';
    pickBtn.textContent = '📁';
    pickBtn.title = 'Pick file';
    pickBtn.addEventListener('click', async () => {
      const files = await window.electronAPI.openMapDialog();
      if (files.length) {
        const src = 'file:///' + files[0].replace(/\\/g, '/');
        const hasBounds = layer.w != null && layer.h != null;
        const bounds = hasBounds ? {} : await imageBoundsFromSrc(src);
        const newLayers = await window.electronAPI.updateLayer(layer.id, { src, ...bounds });
        if (newLayers) {
          layers = newLayers;
          const updated = layers.find(l => l.id === layer.id);
          if (updated) renderLayerDetail(updated);
        }
      }
    });
    srcWrap.appendChild(srcSpan);
    srcWrap.appendChild(pickBtn);
    addField('Src', srcWrap);

    // Opacity
    const opInput = document.createElement('input');
    opInput.type = 'number'; opInput.min = 0; opInput.max = 1; opInput.step = 0.05;
    opInput.value = layer.opacity ?? 1;
    addField('Opacity', opInput);
    opInput.addEventListener('change', async () => {
      const newLayers = await window.electronAPI.updateLayer(layer.id, { opacity: parseFloat(opInput.value) || 1 });
      if (newLayers) layers = newLayers;
    });
  }

  if (layer.type === 'light') {
    const colorInput = document.createElement('input');
    colorInput.type = 'color'; colorInput.value = layer.color ?? '#000033';
    addField('Color', colorInput);
    colorInput.addEventListener('input', async () => {
      const newLayers = await window.electronAPI.updateLayer(layer.id, { color: colorInput.value });
      if (newLayers) layers = newLayers;
    });

    const opInput = document.createElement('input');
    opInput.type = 'number'; opInput.min = 0; opInput.max = 1; opInput.step = 0.05;
    opInput.value = layer.opacity ?? 0.6;
    addField('Opacity', opInput);
    opInput.addEventListener('change', async () => {
      const newLayers = await window.electronAPI.updateLayer(layer.id, { opacity: parseFloat(opInput.value) || 0.6 });
      if (newLayers) layers = newLayers;
    });
  }

  if (layer.type === 'weather') {
    const typeSelect = document.createElement('select');
    WEATHER_TYPES.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      if (t === (layer.weatherType ?? 'rain')) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    addField('Type', typeSelect);
    typeSelect.addEventListener('change', async () => {
      const newLayers = await window.electronAPI.updateLayer(layer.id, { weatherType: typeSelect.value });
      if (newLayers) layers = newLayers;
    });

    const intInput = document.createElement('input');
    intInput.type = 'number'; intInput.min = 0.1; intInput.max = 3; intInput.step = 0.1;
    intInput.value = layer.intensity ?? 1;
    addField('Intensity', intInput);
    intInput.addEventListener('change', async () => {
      const newLayers = await window.electronAPI.updateLayer(layer.id, { intensity: parseFloat(intInput.value) || 1 });
      if (newLayers) layers = newLayers;
    });
  }
}

// ── Quick asset buttons (left panel, advanced mode) ───────────────────────────

document.querySelectorAll('.btn-asset').forEach(btn => {
  btn.addEventListener('click', async () => {
    const type = btn.dataset.asset;
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    const newLayers = await window.electronAPI.addLayer({
      type: 'weather', weatherType: type, intensity: 1, visible: true, name: label,
    });
    if (newLayers) {
      layers = newLayers;
      renderLayerList();
      // Switch to layers tab so the GM sees it
      const layersTab = document.querySelector('#right-panel-tabs [data-right-tab="layers"]');
      if (layersTab && !layersTab.classList.contains('active')) layersTab.click();
    }
  });
});

// ── Add layer buttons ─────────────────────────────────────────────────────────

btnAddImageLayer.addEventListener('click', async () => {
  const newLayers = await window.electronAPI.addLayer({ type: 'image', visible: true, opacity: 1 });
  if (newLayers) { layers = newLayers; renderLayerList(); selectLayer(newLayers.at(-1)?.id); }
});

btnAddLightLayer.addEventListener('click', async () => {
  const newLayers = await window.electronAPI.addLayer({ type: 'light', visible: true, color: '#000033', opacity: 0.6 });
  if (newLayers) { layers = newLayers; renderLayerList(); selectLayer(newLayers.at(-1)?.id); }
});

btnAddFogLayer.addEventListener('click', async () => {
  const newLayers = await window.electronAPI.addLayer({ type: 'fog', visible: true, revealed: [] });
  if (newLayers) { layers = newLayers; renderLayerList(); }
});

btnAddWeatherLayer.addEventListener('click', async () => {
  const newLayers = await window.electronAPI.addLayer({ type: 'weather', visible: true, weatherType: 'rain', intensity: 1 });
  if (newLayers) { layers = newLayers; renderLayerList(); selectLayer(newLayers.at(-1)?.id); }
});

// ════════════════════════════════════════════════════════════════════════════
// HUD MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════

function renderHudList() {
  hudListEl.innerHTML = '';
  if (huds.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'layer-empty';
    empty.textContent = 'No HUDs';
    hudListEl.appendChild(empty);
    return;
  }
  for (const hud of huds) {
    hudListEl.appendChild(buildHudRow(hud));
  }
}

function buildHudRow(hud) {
  const row = document.createElement('div');
  row.className = 'layer-row' + (hud.id === selectedHudId ? ' active' : '');
  row.dataset.hudId = hud.id;

  const eye = document.createElement('button');
  eye.className = 'btn-icon-xs';
  eye.textContent = hud.visible !== false ? '●' : '○';
  eye.title = hud.visible !== false ? 'Hide' : 'Show';
  eye.addEventListener('click', async (e) => {
    e.stopPropagation();
    const newHuds = await window.electronAPI.updateHud(hud.id, { visible: !(hud.visible !== false) });
    if (newHuds) { huds = newHuds; renderHudList(); }
  });

  const badge = document.createElement('span');
  badge.className = 'layer-type-badge';
  badge.textContent = 'INIT';

  const name = document.createElement('span');
  name.className = 'layer-name';
  name.textContent = 'Initiative';

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-icon-xs danger';
  delBtn.textContent = '×';
  delBtn.title = 'Remove HUD';
  delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (selectedHudId === hud.id) { selectedHudId = null; initiativeEditor.style.display = 'none'; }
    const newHuds = await window.electronAPI.removeHud(hud.id);
    if (newHuds) { huds = newHuds; renderHudList(); }
  });

  row.appendChild(eye);
  row.appendChild(badge);
  row.appendChild(name);
  row.appendChild(delBtn);
  row.addEventListener('click', () => selectHud(hud.id));
  return row;
}

function selectHud(id) {
  selectedHudId = (id === selectedHudId) ? null : id;
  renderHudList();
  const hud = huds.find(h => h.id === selectedHudId);
  if (hud && hud.type === 'initiative') renderInitiativeEditor(hud);
  else initiativeEditor.style.display = 'none';
}

btnAddInitiative.addEventListener('click', async () => {
  const newHuds = await window.electronAPI.addHud({
    type: 'initiative', visible: true, combat: false, currentIndex: 0, entries: [],
  });
  if (newHuds) { huds = newHuds; renderHudList(); selectHud(newHuds.at(-1)?.id); }
});

// ════════════════════════════════════════════════════════════════════════════
// INITIATIVE TRACKER EDITOR
// ════════════════════════════════════════════════════════════════════════════

function renderInitiativeEditor(hud) {
  initiativeEditor.style.display = '';
  const inCombat = hud.combat ?? false;
  btnCombatToggle.textContent = inCombat ? '■ Stop' : '▶ Start';
  btnCombatPrev.disabled = !inCombat;
  btnCombatNext.disabled = !inCombat;
  renderInitiativeEntries(hud);
}

function renderInitiativeEntries(hud) {
  initiativeEntriesEl.innerHTML = '';
  if (!hud.entries || hud.entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'layer-empty';
    empty.textContent = 'No entries';
    initiativeEntriesEl.appendChild(empty);
    return;
  }
  hud.entries.forEach((entry, idx) => {
    const row = document.createElement('div');
    row.className = 'initiative-entry-row';

    const turnInd = document.createElement('span');
    turnInd.className = 'init-entry-active';
    turnInd.textContent = (hud.combat && idx === hud.currentIndex) ? '▶' : '';

    const nameInput = document.createElement('input');
    nameInput.className = 'init-entry-name';
    nameInput.value = entry.name;
    nameInput.placeholder = 'Name…';
    nameInput.addEventListener('change', () => updateEntryField(hud, idx, { name: nameInput.value }));

    const rollInput = document.createElement('input');
    rollInput.className = 'init-entry-roll';
    rollInput.type = 'number';
    rollInput.value = entry.initiative ?? '';
    rollInput.placeholder = '—';
    rollInput.addEventListener('change', () =>
      updateEntryField(hud, idx, { initiative: parseInt(rollInput.value) || 0 })
    );

    const hiddenChk = document.createElement('input');
    hiddenChk.type = 'checkbox';
    hiddenChk.title = 'Hide from players (show as ???)';
    hiddenChk.checked = entry.hidden ?? false;
    hiddenChk.style.cssText = 'accent-color:#c9a84c;cursor:pointer;flex-shrink:0;';
    hiddenChk.addEventListener('change', () => updateEntryField(hud, idx, { hidden: hiddenChk.checked }));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon-xs danger';
    delBtn.textContent = '×';
    delBtn.title = 'Remove entry';
    delBtn.addEventListener('click', () => removeEntry(hud, idx));

    row.appendChild(turnInd);
    row.appendChild(nameInput);
    row.appendChild(rollInput);
    row.appendChild(hiddenChk);
    row.appendChild(delBtn);
    initiativeEntriesEl.appendChild(row);
  });
}

async function updateEntryField(hud, idx, patch) {
  const newEntries = hud.entries.map((e, i) => i === idx ? { ...e, ...patch } : e);
  const newHuds = await window.electronAPI.updateHud(hud.id, { entries: newEntries });
  if (newHuds) {
    huds = newHuds;
    const updated = huds.find(h => h.id === hud.id);
    if (updated) Object.assign(hud, updated);
  }
}

async function removeEntry(hud, idx) {
  const newEntries = hud.entries.filter((_, i) => i !== idx);
  const newHuds = await window.electronAPI.updateHud(hud.id, { entries: newEntries });
  if (newHuds) {
    huds = newHuds;
    const updated = huds.find(h => h.id === selectedHudId);
    if (updated) renderInitiativeEditor(updated);
  }
}

btnCombatToggle.addEventListener('click', async () => {
  const hud = huds.find(h => h.id === selectedHudId);
  if (!hud) return;
  const inCombat = !(hud.combat ?? false);
  const newHuds = await window.electronAPI.updateHud(hud.id, { combat: inCombat, currentIndex: 0 });
  if (newHuds) { huds = newHuds; const upd = huds.find(h => h.id === selectedHudId); if (upd) renderInitiativeEditor(upd); }
});

btnCombatNext.addEventListener('click', async () => {
  const hud = huds.find(h => h.id === selectedHudId);
  if (!hud || !hud.entries.length) return;
  const next = ((hud.currentIndex ?? 0) + 1) % hud.entries.length;
  const newHuds = await window.electronAPI.updateHud(hud.id, { currentIndex: next });
  if (newHuds) { huds = newHuds; const upd = huds.find(h => h.id === selectedHudId); if (upd) renderInitiativeEditor(upd); }
});

btnCombatPrev.addEventListener('click', async () => {
  const hud = huds.find(h => h.id === selectedHudId);
  if (!hud || !hud.entries.length) return;
  const prev = ((hud.currentIndex ?? 0) - 1 + hud.entries.length) % hud.entries.length;
  const newHuds = await window.electronAPI.updateHud(hud.id, { currentIndex: prev });
  if (newHuds) { huds = newHuds; const upd = huds.find(h => h.id === selectedHudId); if (upd) renderInitiativeEditor(upd); }
});

btnAddEntry.addEventListener('click', async () => {
  const hud = huds.find(h => h.id === selectedHudId);
  if (!hud) return;
  const newEntry = { id: genId(), name: '', initiative: 0, hidden: false, statuses: [] };
  const newHuds = await window.electronAPI.updateHud(hud.id, { entries: [...(hud.entries ?? []), newEntry] });
  if (newHuds) { huds = newHuds; const upd = huds.find(h => h.id === selectedHudId); if (upd) renderInitiativeEditor(upd); }
});

// ════════════════════════════════════════════════════════════════════════════
// SCENE I/O
// ════════════════════════════════════════════════════════════════════════════

btnSaveScene.addEventListener('click', async () => {
  const scene = await window.electronAPI.getScene();
  if (scene) await window.electronAPI.saveSceneDialog(scene);
});

btnLoadScene.addEventListener('click', async () => {
  const scene = await window.electronAPI.loadSceneDialog();
  if (!scene) return;
  window.electronAPI.setScene(scene);
  layers = scene.layers ?? [];
  huds   = scene.huds   ?? [];
  vpZoom = scene.viewport?.zoom ?? 1.0;
  updateVpZoomUI();
  renderLayerList();
  renderHudList();
  selectedLayerId = null;
  selectedHudId   = null;
  layerDetail.style.display      = 'none';
  initiativeEditor.style.display = 'none';
});

btnResetScene.addEventListener('click', () => {
  confirmInline(btnResetScene, () => {
    window.electronAPI.resetScene();
    layers = [];
    huds   = [];
    vpZoom = 1.0;
    updateVpZoomUI();
    renderLayerList();
    renderHudList();
    selectedLayerId = null;
    selectedHudId   = null;
    layerDetail.style.display      = 'none';
    initiativeEditor.style.display = 'none';
  });
});

// ════════════════════════════════════════════════════════════════════════════
// LAYER OVERLAY  — interactive move / resize on the preview canvas
// ════════════════════════════════════════════════════════════════════════════

const layerOverlay  = document.getElementById('layer-overlay');
const overlayCtx    = layerOverlay.getContext('2d');

const POSITIONABLE_TYPES = new Set(['image', 'gif', 'video', 'light', 'fog', 'weather']);
const HANDLE_SIZE        = 8;   // px, square handle side
const MIN_LAYER_SIZE     = 0.02; // minimum 2% of screen in each dimension

// Drag state: null when idle
let overlayDrag = null; // { layerId, mode:'move'|'resize', handle, startMx, startMy, startLayer:{x,y,w,h}, ca }
let overlayThrottleTimer = null;

// ── Canvas sizing ─────────────────────────────────────────────────────────────

function resizeOverlayCanvas() {
  const wrap = document.getElementById('preview-wrap');
  const rect = wrap.getBoundingClientRect();
  layerOverlay.width  = rect.width;
  layerOverlay.height = rect.height;
  renderLayerOverlay();
}

new ResizeObserver(resizeOverlayCanvas).observe(document.getElementById('preview-wrap'));

// ── Coordinate helpers ────────────────────────────────────────────────────────

/**
 * Returns the pixel rect within the overlay canvas that corresponds to the
 * "screen" content (the area the player actually sees), accounting for the
 * preview image's object-fit:contain letterboxing.
 */
function getContentArea() {
  const cw = layerOverlay.width;
  const ch = layerOverlay.height;
  if (previewImg.style.display === 'none' || !previewImg.naturalWidth) {
    return { cx: 0, cy: 0, cw, ch };
  }
  const iw = previewImg.naturalWidth;
  const ih = previewImg.naturalHeight;
  const imgAR = iw / ih;
  const boxAR = cw / ch;
  let cx, cy, contentW, contentH;
  if (imgAR > boxAR) {
    contentW = cw;  contentH = cw / imgAR;
    cx = 0;         cy = (ch - contentH) / 2;
  } else {
    contentH = ch;  contentW = ch * imgAR;
    cy = 0;         cx = (cw - contentW) / 2;
  }
  return { cx, cy, cw: contentW, ch: contentH };
}

/** Converts a layer's normalised (0-1) coords to canvas pixels. */
function layerBoundsOnCanvas(layer, ca) {
  if (layer.x == null || layer.y == null || layer.w == null || layer.h == null) {
    // Contain-fit: fills the entire content area
    return { px: ca.cx, py: ca.cy, pw: ca.cw, ph: ca.ch };
  }
  return {
    px: ca.cx + layer.x * ca.cw,
    py: ca.cy + layer.y * ca.ch,
    pw: layer.w * ca.cw,
    ph: layer.h * ca.ch,
  };
}

/** Returns the 8 handle rects (top-left corner, HANDLE_SIZE square). */
function getHandlePositions(px, py, pw, ph) {
  const hs = HANDLE_SIZE;
  return {
    TL: { x: px - hs / 2,        y: py - hs / 2        },
    TC: { x: px + pw / 2 - hs / 2, y: py - hs / 2      },
    TR: { x: px + pw - hs / 2,   y: py - hs / 2        },
    ML: { x: px - hs / 2,        y: py + ph / 2 - hs / 2 },
    MR: { x: px + pw - hs / 2,   y: py + ph / 2 - hs / 2 },
    BL: { x: px - hs / 2,        y: py + ph - hs / 2   },
    BC: { x: px + pw / 2 - hs / 2, y: py + ph - hs / 2 },
    BR: { x: px + pw - hs / 2,   y: py + ph - hs / 2   },
  };
}

/** Hit-test a single set of handles, returning the handle key or null. */
function hitTestHandle(mx, my, px, py, pw, ph) {
  const handles = getHandlePositions(px, py, pw, ph);
  for (const [key, pos] of Object.entries(handles)) {
    if (mx >= pos.x && mx <= pos.x + HANDLE_SIZE &&
        my >= pos.y && my <= pos.y + HANDLE_SIZE) {
      return key;
    }
  }
  return null;
}

/** Returns { layerId, mode, handle? } or null. */
function hitTestOverlay(mx, my) {
  const ca = getContentArea();

  // Handles on the selected layer take priority
  if (selectedLayerId) {
    const layer = layers.find(l => l.id === selectedLayerId);
    if (layer && POSITIONABLE_TYPES.has(layer.type)) {
      const b = layerBoundsOnCanvas(layer, ca);
      const handle = hitTestHandle(mx, my, b.px, b.py, b.pw, b.ph);
      if (handle) return { layerId: layer.id, mode: 'resize', handle };
      if (mx >= b.px && mx <= b.px + b.pw && my >= b.py && my <= b.py + b.ph) {
        return { layerId: layer.id, mode: 'move' };
      }
    }
  }

  // Scan layers top-to-bottom (highest index = visually on top)
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!POSITIONABLE_TYPES.has(layer.type) || layer.visible === false) continue;
    const b = layerBoundsOnCanvas(layer, ca);
    if (mx >= b.px && mx <= b.px + b.pw && my >= b.py && my <= b.py + b.ph) {
      return { layerId: layer.id, mode: 'move' };
    }
  }
  return null;
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderLayerOverlay() {
  const ctx = overlayCtx;
  ctx.clearRect(0, 0, layerOverlay.width, layerOverlay.height);
  if (!screenModeAdvanced) return;

  const ca = getContentArea();

  for (const layer of layers) {
    if (!POSITIONABLE_TYPES.has(layer.type) || layer.visible === false) continue;
    const b = layerBoundsOnCanvas(layer, ca);
    const isSelected = layer.id === selectedLayerId;

    ctx.save();
    ctx.strokeStyle = isSelected ? '#c9a84c' : 'rgba(74,144,217,0.45)';
    ctx.lineWidth   = isSelected ? 1.5 : 1;
    if (!isSelected) ctx.setLineDash([4, 4]);
    ctx.strokeRect(b.px + 0.5, b.py + 0.5, b.pw, b.ph);
    ctx.restore();

    if (isSelected) {
      const handles = getHandlePositions(b.px, b.py, b.pw, b.ph);
      for (const pos of Object.values(handles)) {
        ctx.fillStyle = '#c9a84c';
        ctx.fillRect(pos.x, pos.y, HANDLE_SIZE, HANDLE_SIZE);
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 1;
        ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, HANDLE_SIZE - 1, HANDLE_SIZE - 1);
      }
    }
  }
}

// ── Throttled IPC update ──────────────────────────────────────────────────────

function throttledUpdateLayer(id, patch) {
  // Apply locally for instant visual feedback
  layers = layers.map(l => l.id === id ? { ...l, ...patch } : l);
  renderLayerOverlay();

  // Send to main process at ~20 fps
  if (!overlayThrottleTimer) {
    overlayThrottleTimer = setTimeout(() => {
      overlayThrottleTimer = null;
      if (overlayDrag) {    // still dragging — fire but don't sync back yet
        window.electronAPI.updateLayer(id, patch);
      }
    }, 50);
  }
}

// ── Mouse events ──────────────────────────────────────────────────────────────

const RESIZE_CURSORS = {
  TL: 'nw-resize', TC: 'n-resize', TR: 'ne-resize',
  ML: 'w-resize',                  MR: 'e-resize',
  BL: 'sw-resize', BC: 's-resize', BR: 'se-resize',
};

layerOverlay.addEventListener('mousemove', (e) => {
  if (overlayDrag) return; // cursor locked during drag
  if (pingMode) { layerOverlay.style.cursor = 'crosshair'; return; }
  if (!screenModeAdvanced) return;
  const rect = layerOverlay.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const hit = hitTestOverlay(mx, my);
  if (!hit)                   layerOverlay.style.cursor = 'default';
  else if (hit.mode === 'move') layerOverlay.style.cursor = 'move';
  else                         layerOverlay.style.cursor = RESIZE_CURSORS[hit.handle] ?? 'default';
});

layerOverlay.addEventListener('mousedown', (e) => {
  const rect = layerOverlay.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // ── Ping mode ────────────────────────────────────────────────────────────
  if (pingMode) {
    const ca = getContentArea();
    const nx = (mx - ca.cx) / ca.cw;
    const ny = (my - ca.cy) / ca.ch;
    if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
      window.electronAPI.sendPing(nx, ny);
    }
    pingMode = false;
    btnPingMode.classList.remove('ping-active');
    document.getElementById('preview-wrap').classList.remove('ping-mode');
    return;
  }

  if (!screenModeAdvanced) return;

  const hit = hitTestOverlay(mx, my);

  if (!hit) {
    // Click on empty area — deselect
    if (selectedLayerId) selectLayer(null);
    return;
  }

  // Select the hit layer if it isn't already
  if (hit.layerId !== selectedLayerId) {
    // Directly set without toggle: selectLayer toggles, so set first if different
    selectedLayerId = hit.layerId;
    renderLayerList();
    const layer = layers.find(l => l.id === selectedLayerId);
    if (layer) renderLayerDetail(layer);
  }

  e.preventDefault();

  const layer = layers.find(l => l.id === hit.layerId);
  if (!layer) return;

  const ca = getContentArea();
  const b  = layerBoundsOnCanvas(layer, ca);

  overlayDrag = {
    layerId: hit.layerId,
    mode:    hit.mode,
    handle:  hit.handle,
    startMx: mx,
    startMy: my,
    startLayer: {
      x: layer.x ?? (b.px - ca.cx) / ca.cw,
      y: layer.y ?? (b.py - ca.cy) / ca.ch,
      w: layer.w ?? b.pw / ca.cw,
      h: layer.h ?? b.ph / ca.ch,
    },
    ca,
  };

  // Lock cursor while dragging
  if (hit.mode === 'move') layerOverlay.style.cursor = 'move';
  else layerOverlay.style.cursor = RESIZE_CURSORS[hit.handle] ?? 'default';
});

document.addEventListener('mousemove', (e) => {
  if (!overlayDrag) return;

  const rect = layerOverlay.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const { startMx, startMy, startLayer, ca } = overlayDrag;

  const dxN = (mx - startMx) / ca.cw;
  const dyN = (my - startMy) / ca.ch;
  const MIN = MIN_LAYER_SIZE;

  let patch;

  if (overlayDrag.mode === 'move') {
    patch = {
      x: startLayer.x + dxN,
      y: startLayer.y + dyN,
      w: startLayer.w,
      h: startLayer.h,
    };
  } else {
    let { x, y, w, h } = startLayer;
    switch (overlayDrag.handle) {
      case 'TL': x = startLayer.x + dxN; y = startLayer.y + dyN; w = Math.max(MIN, startLayer.w - dxN); h = Math.max(MIN, startLayer.h - dyN); break;
      case 'TC':                          y = startLayer.y + dyN;                                         h = Math.max(MIN, startLayer.h - dyN); break;
      case 'TR':                          y = startLayer.y + dyN; w = Math.max(MIN, startLayer.w + dxN); h = Math.max(MIN, startLayer.h - dyN); break;
      case 'ML': x = startLayer.x + dxN;                         w = Math.max(MIN, startLayer.w - dxN);                                        break;
      case 'MR':                                                  w = Math.max(MIN, startLayer.w + dxN);                                        break;
      case 'BL': x = startLayer.x + dxN;                         w = Math.max(MIN, startLayer.w - dxN); h = Math.max(MIN, startLayer.h + dyN); break;
      case 'BC':                                                                                          h = Math.max(MIN, startLayer.h + dyN); break;
      case 'BR':                                                  w = Math.max(MIN, startLayer.w + dxN); h = Math.max(MIN, startLayer.h + dyN); break;
    }
    patch = { x, y, w, h };
  }

  throttledUpdateLayer(overlayDrag.layerId, patch);
});

document.addEventListener('mouseup', async () => {
  if (!overlayDrag) return;
  const { layerId } = overlayDrag;
  overlayDrag = null;
  clearTimeout(overlayThrottleTimer);
  overlayThrottleTimer = null;

  // Flush the final position to main
  const layer = layers.find(l => l.id === layerId);
  if (layer) {
    const { x, y, w, h } = layer;
    const newLayers = await window.electronAPI.updateLayer(layerId, { x, y, w, h });
    if (newLayers) { layers = newLayers; renderLayerOverlay(); }
  }

  layerOverlay.style.cursor = '';
});

// Repaint overlay when a new preview screenshot arrives
window.electronAPI.onScreenPreview(() => {
  // Small delay so the img element has updated naturalWidth/Height
  setTimeout(renderLayerOverlay, 50);
});

// ════════════════════════════════════════════════════════════════════════════
// SETTINGS (continued)
// ════════════════════════════════════════════════════════════════════════════

// Receive persisted settings from main process on startup
window.electronAPI.onInitialSettings(async (s) => {
  applySettingsToUI(s);
  if (s.screenMode === 'advanced') await initScene();
});

// ── Init ──────────────────────────────────────────────────────────────────────
loadDisplays();
initLibrary();
initCampaigns();
