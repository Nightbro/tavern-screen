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
const tabPaneAssets     = document.getElementById('tab-pane-assets');
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

const monitorMap          = document.getElementById('monitor-map');
const monitorList         = document.getElementById('monitor-list');
const monitorSectionBody  = document.getElementById('monitor-section-body');
const btnToggleMonitors   = document.getElementById('btn-toggle-monitors');
const btnCloseScreen      = document.getElementById('btn-close-screen');
const panelMaps           = document.getElementById('panel-maps');
const panelSettings       = document.getElementById('panel-settings');
const resizeHandleLeft    = document.getElementById('resize-left');
const resizeHandleRight   = document.getElementById('resize-right');
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
 * Loads an image from src and returns canvas-pixel {x, y, w, h} bounds so it
 * appears at its natural pixel size, centred on the 8192×8192 canvas.
 */
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
    tabPaneAssets.style.display   = tab === 'assets'   ? '' : 'none';
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
  const badge = document.createElement('span');
  badge.className = 'session-badge';
  badge.textContent = 'SES';
  row.appendChild(badge);
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
  await loadMostRecentScene();
}

// ── Campaign toolbar ──────────────────────────────────────────────────────────

campaignSelect.addEventListener('change', async () => {
  await flushNotes();
  selectedCampaignId = campaignSelect.value;
  selectedSessionId  = null;
  renderSessions();
  await loadCurrentNotes();
  await loadMostRecentScene();
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
  setMonitorSectionCollapsed(true);
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

window.electronAPI.onScreenOpened(async (displayId, suggestedDpi, sw, sh) => {
  activeDisplayId = displayId;
  displays = displays.map((d) => ({ ...d, active: d.id === displayId }));
  renderMonitorMap();
  renderMonitorCards();
  btnCloseScreen.disabled = false;
  if (suggestedDpi) { elDpi.value = suggestedDpi; sendSettings({ dpi: suggestedDpi }); }
  if (sw) playerScreenW = sw;
  if (sh) playerScreenH = sh;
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
  if (!screenModeAdvanced) {
    previewImg.src = dataUrl;
    previewImg.style.display = 'block';
    previewPlaceholder.style.display = 'none';
    setTimeout(renderLayerOverlay, 50);
  }
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
    if (elScreenModeSimple) elScreenModeSimple.checked = !isAdv;
    document.body.classList.toggle('advanced-mode', isAdv);
    if (isAdv && !sceneReady) initScene();
    else renderLayerOverlay();
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
    if (tab === 'layers') renderSceneList();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ADVANCED / LAYER MODE
// ════════════════════════════════════════════════════════════════════════════

// ── DOM refs ──────────────────────────────────────────────────────────────────
const elScreenModeSimple   = document.getElementById('screen-mode-simple');
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
const btnAddStatusHud      = document.getElementById('btn-add-status-hud');
const btnAddHandout        = document.getElementById('btn-add-handout');
const statusesEditor       = document.getElementById('statuses-editor');
const statusesEntriesEl    = document.getElementById('statuses-entries');
const handoutEditor        = document.getElementById('handout-editor');
const hudSimWrap           = document.getElementById('hud-sim-wrap');
const hudSimViewport       = document.getElementById('hud-sim-viewport');
const hudSimScreen         = document.getElementById('hud-sim-screen');
const btnAddImageLayer     = document.getElementById('btn-add-image-layer');
const btnAddLightLayer     = document.getElementById('btn-add-light-layer');
const btnAddFogLayer       = document.getElementById('btn-add-fog-layer');
const btnAddWeatherLayer   = document.getElementById('btn-add-weather-layer');
const btnSaveScene         = document.getElementById('btn-save-scene');
const btnLoadScene         = document.getElementById('btn-load-scene');
const btnResetScene        = document.getElementById('btn-reset-scene');
const sceneNameInput       = document.getElementById('scene-name-input');
const sceneAutosaveBadge   = document.getElementById('scene-autosave-badge');
const scenesContent        = document.getElementById('scenes-content');
const btnRefreshScenes     = document.getElementById('btn-refresh-scenes');
const elCanvasBg           = document.getElementById('canvas-bg');
const btnFitView           = document.getElementById('btn-fit-view');
const elSnapToGrid         = document.getElementById('snap-to-grid');
const canvasCoordsEl       = document.getElementById('canvas-coords');

const CANVAS_SIZE    = 8192;
const MIN_LAYER_SIZE = 20; // canvas pixels minimum

// ── State ─────────────────────────────────────────────────────────────────────
let layers           = [];
let huds             = [];
let selectedLayerId  = null;
let dragSrcLayerId   = null;
let vpCx             = 4096;  // player viewport center, canvas px
let vpCy             = 4096;
let vpZoom           = 1.0;   // screen px per canvas px
let gmCamX           = 4096;  // GM camera center, canvas px
let gmCamY           = 4096;
let gmCamZoom        = 0.05;  // preview px per canvas px
let gmCamPanDrag     = null;
let playerScreenW    = 1920;  // updated on screen-opened
let playerScreenH    = 1080;
let snapToGrid       = false;
let canvasBg         = '#1a1a2e';
let sceneReady       = false;
let autosaveTimer    = null;
let loadedSceneId    = null;
let selectedHudId    = null;
let pingMode         = false;
let screenModeAdvanced = false;

const gmImageCache   = new Map();

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── Screen mode toggle ────────────────────────────────────────────────────────

elScreenModeSimple.addEventListener('change', async () => {
  const isSimple = elScreenModeSimple.checked;
  const isAdv = !isSimple;
  screenModeAdvanced = isAdv;
  document.body.classList.toggle('advanced-mode', isAdv);
  sendSettings({ screenMode: isAdv ? 'advanced' : 'simple' });
  if (isAdv) await initScene();
  else renderLayerOverlay();
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

elCanvasBg?.addEventListener('input', () => {
  canvasBg = elCanvasBg.value;
  window.electronAPI.updateSceneMeta({ background: canvasBg });
  renderLayerOverlay();
  scheduleAutosave();
});

btnFitView?.addEventListener('click', fitView);

// Grid group collapse
const btnToggleGrid  = document.getElementById('btn-toggle-grid');
const gridGroupBody  = document.getElementById('grid-group-body');
if (btnToggleGrid && gridGroupBody) {
  btnToggleGrid.addEventListener('click', (e) => {
    e.stopPropagation();
    const collapsed = gridGroupBody.classList.toggle('group-body-collapsed');
    btnToggleGrid.classList.toggle('collapsed', collapsed);
  });
  document.getElementById('grid-group-title')?.addEventListener('click', () => {
    const collapsed = gridGroupBody.classList.toggle('group-body-collapsed');
    btnToggleGrid.classList.toggle('collapsed', collapsed);
  });
}

elSnapToGrid?.addEventListener('change', () => { snapToGrid = elSnapToGrid.checked; });

// ── Scene init ────────────────────────────────────────────────────────────────

async function initScene() {
  const scene = await window.electronAPI.getScene();
  if (!scene) return;
  layers    = scene.layers   ?? [];
  huds      = scene.huds     ?? [];
  vpCx      = scene.viewport?.cx   ?? 4096;
  vpCy      = scene.viewport?.cy   ?? 4096;
  vpZoom    = scene.viewport?.zoom  ?? 1.0;
  canvasBg  = scene.background ?? '#1a1a2e';
  sceneNameInput.value = scene.name ?? '';
  renderLayerList();
  renderHudList();
  renderHudPreview();
  updateVpZoomUI();
  fitGMCamera();
  sceneReady = true;
  renderSceneList();
}

function fitGMCamera() {
  const ow = layerOverlay.width  || 400;
  const oh = layerOverlay.height || 300;
  gmCamZoom = Math.min(ow / CANVAS_SIZE, oh / CANVAS_SIZE) * 0.9;
  gmCamX = CANVAS_SIZE / 2;
  gmCamY = CANVAS_SIZE / 2;
  renderLayerOverlay();
}

function fitView() {
  if (layers.length === 0) { fitGMCamera(); return; }
  const visible = layers.filter(l => l.visible !== false && l.x != null);
  if (!visible.length) { fitGMCamera(); return; }
  const minX = Math.min(...visible.map(l => l.x));
  const minY = Math.min(...visible.map(l => l.y));
  const maxX = Math.max(...visible.map(l => l.x + l.w));
  const maxY = Math.max(...visible.map(l => l.y + l.h));
  const ow = layerOverlay.width, oh = layerOverlay.height;
  const padding = 40;
  gmCamZoom = Math.min((ow - padding * 2) / (maxX - minX), (oh - padding * 2) / (maxY - minY));
  gmCamX = (minX + maxX) / 2;
  gmCamY = (minY + maxY) / 2;
  renderLayerOverlay();
}

// ── Viewport zoom ─────────────────────────────────────────────────────────────

function updateVpZoomUI() {
  const pct = Math.round(vpZoom * 100);
  vpZoomVal.textContent = pct + '%';
  vpZoomSlider.value    = pct;
}

function setVpZoom(value) {
  vpZoom = Math.max(0.1, Math.min(4, value));
  updateVpZoomUI();
  window.electronAPI.updateViewport({ zoom: vpZoom });
  renderLayerOverlay();
  scheduleAutosave();
}

vpZoomIn.addEventListener('click',     () => setVpZoom(vpZoom + 0.1));
vpZoomOut.addEventListener('click',    () => setVpZoom(vpZoom - 0.1));
vpZoomReset.addEventListener('click',  () => setVpZoom(1.0));
vpZoomSlider.addEventListener('input', () => setVpZoom(parseInt(vpZoomSlider.value) / 100));

// ── Ping mode ─────────────────────────────────────────────────────────────────

btnPingMode.addEventListener('click', () => {
  pingMode = !pingMode;
  btnPingMode.classList.toggle('ping-active', pingMode);
  layerOverlay.parentElement.classList.toggle('ping-mode', pingMode);
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
    scheduleAutosave();
    return;
  }
  // Render in reverse (top of stack first visually)
  for (let i = layers.length - 1; i >= 0; i--) {
    layerListEl.appendChild(buildLayerRow(layers[i]));
  }
  renderLayerOverlay();
  scheduleAutosave();
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

  const grip = document.createElement('span');
  grip.className = 'layer-drag-grip';
  grip.textContent = '⠿';
  grip.title = 'Drag to reorder';

  row.draggable = true;

  row.addEventListener('dragstart', (e) => {
    dragSrcLayerId = layer.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', layer.id);
    setTimeout(() => row.classList.add('dragging'), 0);
  });
  row.addEventListener('dragend', () => {
    dragSrcLayerId = null;
    row.classList.remove('dragging');
    layerListEl.querySelectorAll('.layer-row').forEach(r => r.classList.remove('drag-over'));
  });
  row.addEventListener('dragover', (e) => {
    if (!dragSrcLayerId || dragSrcLayerId === layer.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    layerListEl.querySelectorAll('.layer-row').forEach(r => r.classList.remove('drag-over'));
    row.classList.add('drag-over');
  });
  row.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (!dragSrcLayerId || dragSrcLayerId === layer.id) return;
    layerListEl.querySelectorAll('.layer-row').forEach(r => r.classList.remove('drag-over'));

    // Collect visual order (top → bottom) from current DOM rows
    const rows = [...layerListEl.querySelectorAll('.layer-row[data-layer-id]')];
    const ids  = rows.map(r => r.dataset.layerId);

    const srcIdx = ids.indexOf(dragSrcLayerId);
    const tgtIdx = ids.indexOf(layer.id);
    ids.splice(srcIdx, 1);
    const adjusted = srcIdx < tgtIdx ? tgtIdx - 1 : tgtIdx;
    ids.splice(adjusted, 0, dragSrcLayerId);

    // Visual list is top→bottom; data array is bottom→top, so reverse
    const newLayers = await window.electronAPI.reorderLayers([...ids].reverse());
    if (newLayers) { layers = newLayers; renderLayerList(); }
  });

  row.appendChild(grip);
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
    scheduleAutosave();
    renderHudPreview();
    return;
  }
  for (const hud of huds) {
    hudListEl.appendChild(buildHudRow(hud));
  }
  scheduleAutosave();
  renderHudPreview();
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
  badge.textContent = hud.type === 'status' ? 'ST' : hud.type === 'handout' ? 'HO' : 'IN';

  const name = document.createElement('span');
  name.className = 'layer-name';
  name.textContent = hud.type === 'status' ? (hud.label || 'Statuses') : hud.type === 'handout' ? (hud.name || 'Handout') : 'Initiative';

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
  initiativeEditor.style.display = 'none';
  if (statusesEditor) statusesEditor.style.display = 'none';
  if (handoutEditor)  handoutEditor.style.display  = 'none';
  if (hud && hud.type === 'initiative') {
    renderInitiativeEditor(hud);
  } else if (hud && hud.type === 'status') {
    renderStatusesEditor(hud);
  } else if (hud && hud.type === 'handout') {
    renderHandoutEditor(hud);
  } else {
    initiativeEditor.style.display = 'none';
  }
}

btnAddInitiative.addEventListener('click', async () => {
  const newHuds = await window.electronAPI.addHud({
    type: 'initiative', visible: true, combat: false, currentIndex: 0, entries: [],
    sides: [{ corner: 'top-left', facing: 'up' }], fontSize: DEFAULT_HUD_FONT_SIZE,
  });
  if (newHuds) { huds = newHuds; renderHudList(); selectHud(newHuds.at(-1)?.id); }
});

btnAddStatusHud?.addEventListener('click', async () => {
  const newHuds = await window.electronAPI.addHud({
    type: 'status', visible: true, label: 'Status',
    entries: [], sides: [{ corner: 'top-right', facing: 'up' }],
    fontSize: DEFAULT_HUD_FONT_SIZE, showLabels: false,
  });
  if (newHuds) { huds = newHuds; renderHudList(); selectHud(newHuds.at(-1)?.id); }
});

btnAddHandout?.addEventListener('click', async () => {
  const newHuds = await window.electronAPI.addHud({
    type: 'handout', visible: true, name: 'Handout',
    src: null, width: 300, sides: [{ corner: 'top-left', facing: 'up' }],
  });
  if (newHuds) { huds = newHuds; renderHudList(); selectHud(newHuds.at(-1)?.id); }
});

document.getElementById('initiative-font-size')?.addEventListener('change', async () => {
  if (!selectedHudId) return;
  const v = parseInt(document.getElementById('initiative-font-size').value);
  if (isNaN(v) || v < 8 || v > 48) return;
  const newHuds = await window.electronAPI.updateHud(selectedHudId, { fontSize: v });
  if (newHuds) { huds = newHuds; }
});

// ════════════════════════════════════════════════════════════════════════════
// STATUS PRESETS
// ════════════════════════════════════════════════════════════════════════════

// PF1E_CONDITIONS is defined in settings.js (loaded before this file)

function getCustomPresets() {
  try { return JSON.parse(localStorage.getItem('customStatusPresets') ?? '[]'); }
  catch { return []; }
}
function saveCustomPresets(presets) {
  localStorage.setItem('customStatusPresets', JSON.stringify(presets));
}

function renderCustomPresetsPanel() {
  const el = document.getElementById('initiative-custom-presets');
  if (!el) return;
  el.innerHTML = '';
  for (const [i, p] of getCustomPresets().entries()) {
    const chip = document.createElement('span');
    chip.className = 'preset-chip';

    const dot = document.createElement('span');
    dot.className = 'preset-chip-dot';
    dot.style.background = p.color;

    const lbl = document.createElement('span');
    lbl.textContent = p.name;

    const del = document.createElement('button');
    del.className = 'init-status-del';
    del.textContent = '×';
    del.addEventListener('click', () => {
      const list = getCustomPresets();
      list.splice(i, 1);
      saveCustomPresets(list);
      renderCustomPresetsPanel();
    });

    chip.appendChild(dot);
    chip.appendChild(lbl);
    chip.appendChild(del);
    el.appendChild(chip);
  }
}

document.getElementById('btn-add-preset')?.addEventListener('click', () => {
  const nameEl  = document.getElementById('new-preset-name');
  const colorEl = document.getElementById('new-preset-color');
  const name = nameEl?.value.trim();
  if (!name) return;
  const list = getCustomPresets();
  list.push({ name, color: colorEl?.value ?? '#888' });
  saveCustomPresets(list);
  if (nameEl) nameEl.value = '';
  renderCustomPresetsPanel();
});

// ════════════════════════════════════════════════════════════════════════════
// INITIATIVE TRACKER EDITOR
// ════════════════════════════════════════════════════════════════════════════

const CORNERS = [
  { id: 'top-left',     label: 'Top Left' },
  { id: 'top-right',    label: 'Top Right' },
  { id: 'bottom-left',  label: 'Bottom Left' },
  { id: 'bottom-right', label: 'Bottom Right' },
];

function normalizeSides(hud) {
  if (hud.sides?.length) return hud.sides;
  return [{ corner: hud.side ?? 'top-left', facing: 'up' }];
}

function renderInitiativePositions(hud) {
  const posEl = document.getElementById('initiative-positions');
  if (!posEl) return;
  posEl.innerHTML = '';
  const sides = normalizeSides(hud);

  const getSides = () => CORNERS
    .map(({ id: corner }) => {
      const row = posEl.querySelector(`[data-corner="${corner}"]`);
      if (!row) return null;
      const chk = row.querySelector('input[type="checkbox"]');
      const sel = row.querySelector('select');
      return chk?.checked ? { corner, facing: sel?.value ?? 'up' } : null;
    })
    .filter(Boolean);

  for (const { id: corner, label } of CORNERS) {
    const existing = sides.find(s => s.corner === corner);

    const row = document.createElement('div');
    row.dataset.corner = corner;
    row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:2px 0;';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = !!existing;
    chk.style.cssText = 'accent-color:#c9a84c;cursor:pointer;flex-shrink:0;';

    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'flex:1;font-size:11px;color:#aaa;';

    const facingSelect = document.createElement('select');
    facingSelect.className = 'field-select';
    facingSelect.disabled = !existing;
    for (const [val, text] of [['up', 'Up'], ['down', 'Down'], ['left', 'Left'], ['right', 'Right']]) {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = text;
      facingSelect.appendChild(opt);
    }
    facingSelect.value = existing?.facing ?? 'up';

    const save = async () => {
      const newHuds = await window.electronAPI.updateHud(selectedHudId, { sides: getSides() });
      if (newHuds) { huds = newHuds; renderHudPreview(); }
    };

    chk.addEventListener('change', () => { facingSelect.disabled = !chk.checked; save(); });
    facingSelect.addEventListener('change', save);

    row.appendChild(chk);
    row.appendChild(lbl);
    row.appendChild(facingSelect);
    posEl.appendChild(row);
  }
}

function renderInitiativeEditor(hud) {
  initiativeEditor.style.display = '';
  const inCombat = hud.combat ?? false;
  btnCombatToggle.textContent = inCombat ? '■ Stop' : '▶ Start';
  btnCombatPrev.disabled = !inCombat;
  btnCombatNext.disabled = !inCombat;
  renderInitiativePositions(hud);
  const fontSizeEl = document.getElementById('initiative-font-size');
  if (fontSizeEl) fontSizeEl.value = hud.fontSize ?? DEFAULT_HUD_FONT_SIZE;
  const showLabelsEl = document.getElementById('initiative-show-labels');
  if (showLabelsEl) showLabelsEl.checked = hud.showLabels ?? false;
  renderCustomPresetsPanel();
  renderInitiativeEntries(hud);
}

document.getElementById('initiative-show-labels')?.addEventListener('change', async () => {
  if (!selectedHudId) return;
  const checked = document.getElementById('initiative-show-labels').checked;
  const newHuds = await window.electronAPI.updateHud(selectedHudId, { showLabels: checked });
  if (newHuds) { huds = newHuds; }
});

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
    const wrap = document.createElement('div');
    wrap.className = 'initiative-entry-wrap';

    // ── Main row ─────────────────────────────────────────────────────────────
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
    hiddenChk.title = 'Lurking – shows as ??? in player list';
    hiddenChk.checked = entry.hidden ?? false;
    hiddenChk.style.cssText = 'accent-color:#c9a84c;cursor:pointer;flex-shrink:0;';
    hiddenChk.addEventListener('change', () => updateEntryField(hud, idx, { hidden: hiddenChk.checked }));

    const invisibleChk = document.createElement('input');
    invisibleChk.type = 'checkbox';
    invisibleChk.title = 'Invisible – not shown in player list at all';
    invisibleChk.checked = entry.invisible ?? false;
    invisibleChk.style.cssText = 'accent-color:#e05555;cursor:pointer;flex-shrink:0;';
    invisibleChk.addEventListener('change', () => updateEntryField(hud, idx, { invisible: invisibleChk.checked }));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon-xs danger';
    delBtn.textContent = '×';
    delBtn.title = 'Remove entry';
    delBtn.addEventListener('click', () => removeEntry(hud, idx));

    const visGroup = document.createElement('div');
    visGroup.className = 'init-vis-group';

    const lbl1 = document.createElement('span');
    lbl1.className = 'init-vis-label';
    lbl1.title = 'Lurking – shows as ???';
    lbl1.textContent = '?';

    const lbl2 = document.createElement('span');
    lbl2.className = 'init-vis-label';
    lbl2.title = 'Invisible – not shown to players';
    lbl2.textContent = '👁';
    lbl2.style.fontSize = '10px';

    visGroup.appendChild(lbl1);
    visGroup.appendChild(hiddenChk);
    visGroup.appendChild(lbl2);
    visGroup.appendChild(invisibleChk);

    row.appendChild(turnInd);
    row.appendChild(nameInput);
    row.appendChild(rollInput);
    row.appendChild(visGroup);
    row.appendChild(delBtn);

    // ── Status row ────────────────────────────────────────────────────────────
    const statusRow = document.createElement('div');
    statusRow.className = 'init-extras-row';
    buildEntryStatusRow(statusRow, hud, idx, entry);

    // ── HP row ────────────────────────────────────────────────────────────────
    const hpRow = document.createElement('div');
    hpRow.className = 'init-extras-row';
    buildEntryHpRow(hpRow, hud, idx, entry);

    wrap.appendChild(row);
    wrap.appendChild(statusRow);
    wrap.appendChild(hpRow);
    initiativeEntriesEl.appendChild(wrap);
  });
}

function buildEntryStatusRow(container, hud, idx, entry, updateFn, refreshFn) {
  updateFn  = updateFn  ?? updateEntryField;
  refreshFn = refreshFn ?? ((upd) => renderInitiativeEntries(upd));
  container.innerHTML = '';
  const statuses = entry.statuses ?? [];

  // ── Active status chips (with × remove) ──────────────────────────────────
  const chipsRow = document.createElement('div');
  chipsRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;';

  statuses.forEach((s, si) => {
    const chip = document.createElement('span');
    chip.className = 'init-status-chip';

    const dot = document.createElement('span');
    dot.className = 'init-status-dot';
    dot.style.background = s.color ?? '#888';

    const lbl = document.createElement('span');
    lbl.className = 'init-status-lbl';
    lbl.textContent = s.label ?? '';

    const del = document.createElement('button');
    del.className = 'init-status-del';
    del.textContent = '×';
    del.addEventListener('click', async () => {
      await updateFn(hud, idx, { statuses: statuses.filter((_, i) => i !== si) });
      const updated = huds.find(h => h.id === hud.id);
      if (updated) refreshFn(updated);
    });

    chip.appendChild(dot); chip.appendChild(lbl); chip.appendChild(del);
    chipsRow.appendChild(chip);
  });
  container.appendChild(chipsRow);

  // ── Toggle preset picker ──────────────────────────────────────────────────
  let pickerOpen = false;

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'btn-icon-xs';
  toggleBtn.textContent = '+ status';
  toggleBtn.style.fontSize = '9px';

  const picker = document.createElement('div');
  picker.className = 'status-preset-picker';
  picker.style.display = 'none';

  // Quick-add helper
  const quickAdd = async (name, color) => {
    await updateFn(hud, idx, { statuses: [...statuses, { color, label: name }] });
    const updated = huds.find(h => h.id === hud.id);
    if (updated) refreshFn(updated);
  };

  // PF1e section
  const pf1eTitle = document.createElement('div');
  pf1eTitle.className = 'preset-section-title';
  pf1eTitle.textContent = 'Pathfinder 1e';
  picker.appendChild(pf1eTitle);

  const pf1eGrid = document.createElement('div');
  pf1eGrid.className = 'preset-grid';
  for (const { name, color } of PF1E_CONDITIONS) {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.title = name;

    const dot = document.createElement('span');
    dot.className = 'preset-btn-dot';
    dot.style.background = color;

    btn.appendChild(dot);
    btn.appendChild(document.createTextNode(name));
    btn.addEventListener('click', () => quickAdd(name, color));
    pf1eGrid.appendChild(btn);
  }
  picker.appendChild(pf1eGrid);

  // Custom presets section
  const customTitle = document.createElement('div');
  customTitle.className = 'preset-section-title';
  customTitle.textContent = 'Saved Presets';
  picker.appendChild(customTitle);

  const customGrid = document.createElement('div');
  customGrid.className = 'preset-grid';
  for (const { name, color } of getCustomPresets()) {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.title = name;

    const dot = document.createElement('span');
    dot.className = 'preset-btn-dot';
    dot.style.background = color;

    btn.appendChild(dot);
    btn.appendChild(document.createTextNode(name));
    btn.addEventListener('click', () => quickAdd(name, color));
    customGrid.appendChild(btn);
  }
  if (customGrid.childElementCount === 0) {
    const none = document.createElement('span');
    none.style.cssText = 'font-size:10px;color:#3a3a5e;font-style:italic;';
    none.textContent = 'No custom presets yet';
    customGrid.appendChild(none);
  }
  picker.appendChild(customGrid);

  // Manual custom entry
  const manualRow = document.createElement('div');
  manualRow.className = 'init-status-form';
  manualRow.style.marginTop = '4px';

  const colorIn = document.createElement('input');
  colorIn.type = 'color'; colorIn.value = '#c9a84c';
  colorIn.className = 'init-status-color-pick';

  const labelIn = document.createElement('input');
  labelIn.className = 'init-entry-name';
  labelIn.placeholder = 'Custom label…';
  labelIn.style.cssText = 'flex:1;font-size:10px;min-width:0;';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn-icon-xs';
  confirmBtn.textContent = '✓';
  confirmBtn.addEventListener('click', () => {
    const n = labelIn.value.trim();
    if (n) quickAdd(n, colorIn.value);
  });

  manualRow.appendChild(colorIn);
  manualRow.appendChild(labelIn);
  manualRow.appendChild(confirmBtn);
  picker.appendChild(manualRow);

  toggleBtn.addEventListener('click', () => {
    pickerOpen = !pickerOpen;
    picker.style.display = pickerOpen ? '' : 'none';
    toggleBtn.textContent = pickerOpen ? '− status' : '+ status';
  });

  container.appendChild(toggleBtn);
  container.appendChild(picker);
}

function buildEntryHpRow(container, hud, idx, entry) {
  container.innerHTML = '';

  const lbl = document.createElement('span');
  lbl.className = 'init-hp-label';
  lbl.textContent = 'HP';

  const maxIn = document.createElement('input');
  maxIn.type = 'number'; maxIn.min = 0;
  maxIn.className = 'init-hp-input';
  maxIn.value = entry.hp ?? '';
  maxIn.placeholder = 'max';
  maxIn.title = 'Max HP';
  maxIn.addEventListener('change', async () => {
    const v = parseInt(maxIn.value) || 0;
    await updateEntryField(hud, idx, { hp: v });
    const updated = huds.find(h => h.id === hud.id);
    if (updated) renderInitiativeEntries(updated);
  });

  const hpMaxHiddenChk = document.createElement('input');
  hpMaxHiddenChk.type = 'checkbox';
  hpMaxHiddenChk.checked = entry.hpMaxHidden ?? false;
  hpMaxHiddenChk.title = 'Hide max HP from players (show current/???)';
  hpMaxHiddenChk.style.cssText = 'accent-color:#e05555;cursor:pointer;flex-shrink:0;';
  hpMaxHiddenChk.addEventListener('change', () => updateEntryField(hud, idx, { hpMaxHidden: hpMaxHiddenChk.checked }));

  const sep1 = document.createElement('span');
  sep1.className = 'init-hp-sep';
  sep1.textContent = 'dmg';

  const dmgIn = document.createElement('input');
  dmgIn.type = 'number'; dmgIn.min = 0;
  dmgIn.className = 'init-hp-input';
  dmgIn.value = entry.damage ?? 0;
  dmgIn.title = 'Total damage dealt (editable)';
  dmgIn.addEventListener('change', async () => {
    const v = Math.max(0, parseInt(dmgIn.value) || 0);
    await updateEntryField(hud, idx, { damage: v });
  });

  const sep2 = document.createElement('span');
  sep2.className = 'init-hp-sep';
  sep2.textContent = '|';

  const dealIn = document.createElement('input');
  dealIn.type = 'number'; dealIn.min = 0;
  dealIn.className = 'init-hp-input';
  dealIn.placeholder = '+dmg';
  dealIn.title = 'New damage to deal';

  const applyBtn = document.createElement('button');
  applyBtn.className = 'btn-apply-dmg';
  applyBtn.textContent = '↯';
  applyBtn.title = 'Apply damage';
  applyBtn.addEventListener('click', async () => {
    const newDmg = parseInt(dealIn.value) || 0;
    if (!newDmg) return;
    const total = (entry.damage ?? 0) + newDmg;
    dealIn.value = '';
    await updateEntryField(hud, idx, { damage: total });
    const updated = huds.find(h => h.id === hud.id);
    if (updated) renderInitiativeEntries(updated);
  });

  // Current HP display
  const curHpEl = document.createElement('span');
  curHpEl.className = 'init-hp-current';
  if (entry.hp > 0) {
    const cur = Math.max(0, entry.hp - (entry.damage ?? 0));
    curHpEl.textContent = `= ${cur}/${entry.hp}`;
  }

  container.appendChild(lbl);
  container.appendChild(maxIn);
  container.appendChild(hpMaxHiddenChk);
  container.appendChild(sep1);
  container.appendChild(dmgIn);
  container.appendChild(sep2);
  container.appendChild(dealIn);
  container.appendChild(applyBtn);
  container.appendChild(curHpEl);
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
  const newEntry = { id: genId(), name: '', initiative: 0, hidden: false, invisible: true, statuses: [] };
  const newHuds = await window.electronAPI.updateHud(hud.id, { entries: [...(hud.entries ?? []), newEntry] });
  if (newHuds) { huds = newHuds; const upd = huds.find(h => h.id === selectedHudId); if (upd) renderInitiativeEditor(upd); }
});

// ════════════════════════════════════════════════════════════════════════════
// STATUSES HUD EDITOR
// ════════════════════════════════════════════════════════════════════════════

function renderStatusesEditor(hud) {
  if (!statusesEditor) return;
  statusesEditor.style.display = '';
  const labelEl = document.getElementById('statuses-label');
  if (labelEl) labelEl.value = hud.label ?? 'Status';
  const fontSizeEl = document.getElementById('statuses-font-size');
  if (fontSizeEl) fontSizeEl.value = hud.fontSize ?? DEFAULT_HUD_FONT_SIZE;
  const showLabelsEl = document.getElementById('statuses-show-labels');
  if (showLabelsEl) showLabelsEl.checked = hud.showLabels ?? false;
  renderStatusesPositions(hud);
  renderStatusesEntries(hud);
}

function renderStatusesPositions(hud) {
  const posEl = document.getElementById('statuses-positions');
  if (!posEl) return;
  posEl.innerHTML = '';
  const sides = normalizeSides(hud);

  const getSides = () => CORNERS
    .map(({ id: corner }) => {
      const row = posEl.querySelector(`[data-corner="${corner}"]`);
      if (!row) return null;
      const chk = row.querySelector('input[type="checkbox"]');
      const sel = row.querySelector('select');
      return chk?.checked ? { corner, facing: sel?.value ?? 'up' } : null;
    })
    .filter(Boolean);

  for (const { id: corner, label } of CORNERS) {
    const existing = sides.find(s => s.corner === corner);
    const row = document.createElement('div');
    row.dataset.corner = corner;
    row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:2px 0;';

    const chk = document.createElement('input');
    chk.type = 'checkbox'; chk.checked = !!existing;
    chk.style.cssText = 'accent-color:#4a90d9;cursor:pointer;flex-shrink:0;';

    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'flex:1;font-size:11px;color:#aaa;';

    const facingSelect = document.createElement('select');
    facingSelect.className = 'field-select';
    facingSelect.disabled = !existing;
    for (const [val, text] of [['up','Up'],['down','Down'],['left','Left'],['right','Right']]) {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = text;
      facingSelect.appendChild(opt);
    }
    facingSelect.value = existing?.facing ?? 'up';

    const save = async () => {
      const newHuds = await window.electronAPI.updateHud(selectedHudId, { sides: getSides() });
      if (newHuds) { huds = newHuds; renderHudPreview(); }
    };
    chk.addEventListener('change', () => { facingSelect.disabled = !chk.checked; save(); });
    facingSelect.addEventListener('change', save);

    row.appendChild(chk); row.appendChild(lbl); row.appendChild(facingSelect);
    posEl.appendChild(row);
  }
}

function renderStatusesEntries(hud) {
  if (!statusesEntriesEl) return;
  statusesEntriesEl.innerHTML = '';
  if (!hud.entries || hud.entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'layer-empty';
    empty.textContent = 'No entries';
    statusesEntriesEl.appendChild(empty);
    return;
  }
  hud.entries.forEach((entry, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'initiative-entry-wrap';

    const row = document.createElement('div');
    row.className = 'initiative-entry-row';

    const nameInput = document.createElement('input');
    nameInput.className = 'init-entry-name';
    nameInput.value = entry.name;
    nameInput.placeholder = 'Name…';
    nameInput.addEventListener('change', () => updateStatusesEntryField(hud, idx, { name: nameInput.value }));

    const hiddenChk = document.createElement('input');
    hiddenChk.type = 'checkbox'; hiddenChk.title = 'Show as ???';
    hiddenChk.checked = entry.hidden ?? false;
    hiddenChk.style.cssText = 'accent-color:#c9a84c;cursor:pointer;flex-shrink:0;';
    hiddenChk.addEventListener('change', () => updateStatusesEntryField(hud, idx, { hidden: hiddenChk.checked }));

    const invisibleChk = document.createElement('input');
    invisibleChk.type = 'checkbox'; invisibleChk.title = 'Hide from players';
    invisibleChk.checked = entry.invisible ?? false;
    invisibleChk.style.cssText = 'accent-color:#e05555;cursor:pointer;flex-shrink:0;';
    invisibleChk.addEventListener('change', () => updateStatusesEntryField(hud, idx, { invisible: invisibleChk.checked }));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon-xs danger'; delBtn.textContent = '×'; delBtn.title = 'Remove entry';
    delBtn.addEventListener('click', () => removeStatusesEntry(hud, idx));

    const visGroup = document.createElement('div');
    visGroup.className = 'init-vis-group';
    const lbl1 = document.createElement('span'); lbl1.className = 'init-vis-label'; lbl1.title = 'Lurking'; lbl1.textContent = '?';
    const lbl2 = document.createElement('span'); lbl2.className = 'init-vis-label'; lbl2.title = 'Invisible'; lbl2.textContent = '👁'; lbl2.style.fontSize = '10px';
    visGroup.appendChild(lbl1); visGroup.appendChild(hiddenChk);
    visGroup.appendChild(lbl2); visGroup.appendChild(invisibleChk);

    row.appendChild(nameInput); row.appendChild(visGroup); row.appendChild(delBtn);

    const statusRow = document.createElement('div');
    statusRow.className = 'init-extras-row';
    buildEntryStatusRow(statusRow, hud, idx, entry, updateStatusesEntryField, renderStatusesEntries);

    wrap.appendChild(row); wrap.appendChild(statusRow);
    statusesEntriesEl.appendChild(wrap);
  });
}

async function updateStatusesEntryField(hud, idx, patch) {
  const newEntries = hud.entries.map((e, i) => i === idx ? { ...e, ...patch } : e);
  const newHuds = await window.electronAPI.updateHud(hud.id, { entries: newEntries });
  if (newHuds) {
    huds = newHuds;
    const updated = huds.find(h => h.id === hud.id);
    if (updated) Object.assign(hud, updated);
  }
}

async function removeStatusesEntry(hud, idx) {
  const newEntries = hud.entries.filter((_, i) => i !== idx);
  const newHuds = await window.electronAPI.updateHud(hud.id, { entries: newEntries });
  if (newHuds) {
    huds = newHuds;
    const updated = huds.find(h => h.id === selectedHudId);
    if (updated) renderStatusesEditor(updated);
  }
}

document.getElementById('statuses-label')?.addEventListener('change', async () => {
  if (!selectedHudId) return;
  const v = document.getElementById('statuses-label').value;
  const newHuds = await window.electronAPI.updateHud(selectedHudId, { label: v });
  if (newHuds) { huds = newHuds; renderHudList(); }
});

document.getElementById('statuses-font-size')?.addEventListener('change', async () => {
  if (!selectedHudId) return;
  const v = parseInt(document.getElementById('statuses-font-size').value);
  if (isNaN(v) || v < 8 || v > 48) return;
  const newHuds = await window.electronAPI.updateHud(selectedHudId, { fontSize: v });
  if (newHuds) { huds = newHuds; }
});

document.getElementById('statuses-show-labels')?.addEventListener('change', async () => {
  if (!selectedHudId) return;
  const checked = document.getElementById('statuses-show-labels').checked;
  const newHuds = await window.electronAPI.updateHud(selectedHudId, { showLabels: checked });
  if (newHuds) { huds = newHuds; }
});

document.getElementById('btn-add-status-entry')?.addEventListener('click', async () => {
  const hud = huds.find(h => h.id === selectedHudId);
  if (!hud) return;
  const newEntry = { id: genId(), name: '', hidden: false, invisible: true, statuses: [] };
  const newHuds = await window.electronAPI.updateHud(hud.id, { entries: [...(hud.entries ?? []), newEntry] });
  if (newHuds) { huds = newHuds; const upd = huds.find(h => h.id === selectedHudId); if (upd) renderStatusesEditor(upd); }
});

// ════════════════════════════════════════════════════════════════════════════
// HANDOUT HUD EDITOR
// ════════════════════════════════════════════════════════════════════════════

function renderHandoutEditor(hud) {
  if (!handoutEditor) return;
  handoutEditor.style.display = '';
  const nameEl = document.getElementById('handout-name');
  if (nameEl) nameEl.value = hud.name ?? '';
  const widthEl = document.getElementById('handout-width');
  if (widthEl) widthEl.value = hud.width ?? 300;
  renderHandoutImagePreview(hud);
  renderHandoutPositions(hud);
}

function renderHandoutImagePreview(hud) {
  const el = document.getElementById('handout-image-preview');
  if (!el) return;
  el.innerHTML = '';
  if (hud.src) {
    const img = document.createElement('img');
    img.src = hud.src;
    img.style.cssText = 'max-width:100%;max-height:80px;border-radius:4px;margin-top:4px;display:block;';
    el.appendChild(img);
  }
}

function renderHandoutPositions(hud) {
  const posEl = document.getElementById('handout-positions');
  if (!posEl) return;
  posEl.innerHTML = '';
  const sides = normalizeSides(hud);

  const getSides = () => CORNERS
    .map(({ id: corner }) => {
      const row = posEl.querySelector(`[data-corner="${corner}"]`);
      if (!row) return null;
      const chk = row.querySelector('input[type="checkbox"]');
      const sel = row.querySelector('select');
      return chk?.checked ? { corner, facing: sel?.value ?? 'up' } : null;
    })
    .filter(Boolean);

  for (const { id: corner, label } of CORNERS) {
    const existing = sides.find(s => s.corner === corner);
    const row = document.createElement('div');
    row.dataset.corner = corner;
    row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:2px 0;';

    const chk = document.createElement('input');
    chk.type = 'checkbox'; chk.checked = !!existing;
    chk.style.cssText = 'accent-color:#4caf7d;cursor:pointer;flex-shrink:0;';

    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'flex:1;font-size:11px;color:#aaa;';

    const facingSelect = document.createElement('select');
    facingSelect.className = 'field-select';
    facingSelect.disabled = !existing;
    for (const [val, text] of [['up','Up'],['down','Down'],['left','Left'],['right','Right']]) {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = text;
      facingSelect.appendChild(opt);
    }
    facingSelect.value = existing?.facing ?? 'up';

    const save = async () => {
      const newHuds = await window.electronAPI.updateHud(selectedHudId, { sides: getSides() });
      if (newHuds) { huds = newHuds; renderHudPreview(); }
    };
    chk.addEventListener('change', () => { facingSelect.disabled = !chk.checked; save(); });
    facingSelect.addEventListener('change', save);

    row.appendChild(chk); row.appendChild(lbl); row.appendChild(facingSelect);
    posEl.appendChild(row);
  }
}

document.getElementById('handout-name')?.addEventListener('change', async () => {
  if (!selectedHudId) return;
  const v = document.getElementById('handout-name').value;
  const newHuds = await window.electronAPI.updateHud(selectedHudId, { name: v });
  if (newHuds) { huds = newHuds; renderHudList(); }
});

document.getElementById('handout-width')?.addEventListener('change', async () => {
  if (!selectedHudId) return;
  const v = parseInt(document.getElementById('handout-width').value) || 300;
  const newHuds = await window.electronAPI.updateHud(selectedHudId, { width: v });
  if (newHuds) { huds = newHuds; }
});

document.getElementById('btn-handout-pick-image')?.addEventListener('click', async () => {
  const paths = await window.electronAPI.openMapDialog();
  if (!paths || !paths.length) return;
  const src = paths[0];
  const newHuds = await window.electronAPI.updateHud(selectedHudId, { src });
  if (newHuds) {
    huds = newHuds;
    const upd = huds.find(h => h.id === selectedHudId);
    if (upd) renderHandoutEditor(upd);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// HUD SIMULATION
// ════════════════════════════════════════════════════════════════════════════

const HUD_TYPE_COLOR = { initiative: '#c9a84c', status: '#4a90d9', handout: '#4caf7d' };

let simScale = 1;

// renderHudPreview is the public alias so every existing call site works
function renderHudPreview() { updateHudSimulation(); }

function updateHudSimulation() {
  if (!hudSimScreen || !hudSimWrap || !hudSimViewport) return;

  const sw = playerScreenW || 1920;
  const sh = playerScreenH || 1080;

  // Fit simulation into the available wrapper space
  const ww = hudSimWrap.clientWidth  - 16;
  const wh = hudSimWrap.clientHeight - 16;
  simScale = Math.min(ww / sw, wh / sh, 1);
  if (simScale <= 0) simScale = 0.1;

  hudSimViewport.style.width  = Math.round(sw * simScale) + 'px';
  hudSimViewport.style.height = Math.round(sh * simScale) + 'px';

  hudSimScreen.style.width          = sw + 'px';
  hudSimScreen.style.height         = sh + 'px';
  hudSimScreen.style.transform      = `scale(${simScale})`;
  hudSimScreen.style.transformOrigin = 'top left';

  // Clear and rebuild panels
  hudSimScreen.innerHTML = '';

  for (const hud of huds) {
    if (hud.visible === false) continue;
    const sides = normalizeSides(hud);
    sides.forEach((side, sideIdx) => {
      const panel = buildSimHudPanel(hud, side, sideIdx, sw, sh);
      hudSimScreen.appendChild(panel);
    });
  }
}

function cornerToXY(corner, panelW, panelH, screenW, screenH) {
  const m = 20;
  switch (corner) {
    case 'top-right':    return { x: screenW - panelW - m, y: m };
    case 'bottom-left':  return { x: m, y: screenH - panelH - m };
    case 'bottom-right': return { x: screenW - panelW - m, y: screenH - panelH - m };
    default:             return { x: m, y: m }; // top-left
  }
}

function estimateSimPanelSize(hud) {
  const fontSize = hud.fontSize ?? 24;
  const entryH   = fontSize * 1.6 + 10;
  const entries  = (hud.entries ?? []).filter(e => !e.invisible).length;
  const bodyH    = Math.max(entries, 1) * entryH + 12;
  const headerH  = 38;
  if (hud.type === 'handout') {
    const w = hud.width ?? 300;
    const imgH = hud.src ? Math.round(w * 0.56) : 32;
    return { w, h: headerH + imgH };
  }
  return { w: 280, h: headerH + bodyH };
}

function buildSimHudPanel(hud, side, sideIdx, screenW, screenH) {
  const { w: panelW, h: panelH } = estimateSimPanelSize(hud);

  // Resolve position: stored x,y override corner-based default
  let px = side.x, py = side.y;
  if (px == null || py == null) {
    const pos = cornerToXY(side.corner, panelW, panelH, screenW, screenH);
    px = pos.x; py = pos.y;
  }

  const panel = document.createElement('div');
  panel.className = 'hud-sim-panel' + (hud.id === selectedHudId ? ' selected' : '');
  panel.dataset.hudId   = hud.id;
  panel.dataset.sideIdx = sideIdx;
  panel.style.left  = Math.round(px) + 'px';
  panel.style.top   = Math.round(py) + 'px';
  panel.style.width = panelW + 'px';
  panel.style.fontSize = (hud.fontSize ?? 24) + 'px';

  const color = HUD_TYPE_COLOR[hud.type] ?? '#888';

  // Header — drag handle
  const header = document.createElement('div');
  header.className = 'hud-sim-header';

  const badge = document.createElement('span');
  badge.className = 'hud-sim-badge';
  badge.textContent = hud.type === 'status' ? 'ST' : hud.type === 'handout' ? 'HO' : 'IN';
  badge.style.cssText = `color:${color};border-color:${color}55;`;

  const titleEl = document.createElement('span');
  titleEl.className = 'hud-sim-title-text';
  titleEl.textContent = hud.type === 'status' ? (hud.label || 'Statuses')
    : hud.type === 'handout' ? (hud.name || 'Handout') : 'Initiative';

  header.appendChild(badge);
  header.appendChild(titleEl);
  panel.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'hud-sim-body';
  buildSimBody(body, hud);
  panel.appendChild(body);

  // Interaction
  panel.addEventListener('click', (e) => { e.stopPropagation(); selectHud(hud.id); });
  makeSimPanelDraggable(panel, header, hud, sideIdx, screenW, screenH);

  return panel;
}

function buildSimBody(container, hud) {
  if (hud.type === 'handout') {
    if (hud.src) {
      const img = document.createElement('img');
      img.src   = hud.src;
      img.style.cssText = 'width:100%;display:block;border-radius:0 0 7px 7px;';
      container.appendChild(img);
    } else {
      const empty = document.createElement('div');
      empty.className = 'hud-sim-empty';
      empty.textContent = 'No image';
      container.appendChild(empty);
    }
    return;
  }

  const entries = (hud.entries ?? []).filter(e => !e.invisible);
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'hud-sim-empty';
    empty.textContent = 'Empty';
    container.appendChild(empty);
    return;
  }

  for (const entry of entries) {
    const row = document.createElement('div');
    row.className = 'hud-sim-entry';

    if (hud.type === 'initiative') {
      const roll = document.createElement('span');
      roll.className = 'hud-sim-roll';
      roll.textContent = entry.initiative ?? '—';
      row.appendChild(roll);
    }

    const name = document.createElement('span');
    name.className = 'hud-sim-name';
    name.textContent = entry.hidden ? '???' : (entry.name || '—');
    row.appendChild(name);

    const pips = document.createElement('span');
    pips.className = 'hud-sim-pips';
    for (const s of (entry.statuses ?? []).slice(0, 6)) {
      const pip = document.createElement('span');
      pip.className = 'hud-sim-pip';
      pip.style.background = s.color ?? '#888';
      pips.appendChild(pip);
    }
    row.appendChild(pips);
    container.appendChild(row);
  }
}

function makeSimPanelDraggable(panel, handle, hud, sideIdx, screenW, screenH) {
  handle.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    selectHud(hud.id);

    const startPx   = parseInt(panel.style.left) || 0;
    const startPy   = parseInt(panel.style.top)  || 0;
    const startMx   = e.clientX;
    const startMy   = e.clientY;
    const coordsEl  = document.getElementById('hud-sim-coords');
    const panelW    = panel.offsetWidth  || 280;
    const panelH    = panel.offsetHeight || 60;

    handle.style.cursor = 'grabbing';

    const onMove = (ev) => {
      const dx = (ev.clientX - startMx) / simScale;
      const dy = (ev.clientY - startMy) / simScale;
      const nx = Math.max(0, Math.min(screenW - panelW, Math.round(startPx + dx)));
      const ny = Math.max(0, Math.min(screenH - panelH, Math.round(startPy + dy)));
      panel.style.left = nx + 'px';
      panel.style.top  = ny + 'px';
      if (coordsEl) coordsEl.textContent = `x: ${nx}  y: ${ny}`;
    };

    const onUp = async () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      handle.style.cursor = 'grab';
      const coordsEl = document.getElementById('hud-sim-coords');
      const nx = parseInt(panel.style.left) || 0;
      const ny = parseInt(panel.style.top)  || 0;
      if (coordsEl) coordsEl.textContent = `x: ${nx}  y: ${ny}`;

      // Persist x,y into the side entry
      const currentHud = huds.find(h => h.id === hud.id);
      if (!currentHud) return;
      const newSides = normalizeSides(currentHud).map((s, i) =>
        i === sideIdx ? { ...s, x: nx, y: ny } : s
      );
      const newHuds = await window.electronAPI.updateHud(hud.id, { sides: newSides });
      if (newHuds) huds = newHuds;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

// Re-render simulation when the wrapper resizes
if (hudSimWrap) {
  new ResizeObserver(() => updateHudSimulation()).observe(hudSimWrap);
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE I/O
// ════════════════════════════════════════════════════════════════════════════

function setAutosaveBadge(state) {
  sceneAutosaveBadge.dataset.state = state;
  sceneAutosaveBadge.textContent =
    state === 'saving' ? 'Saving…' :
    state === 'saved'  ? '✓ Saved' : '';
}

function scheduleAutosave() {
  if (!sceneReady || !selectedCampaignId) return;
  clearTimeout(autosaveTimer);
  setAutosaveBadge('saving');
  autosaveTimer = setTimeout(async () => {
    const meta = await window.electronAPI.saveSceneCampaign(selectedCampaignId, selectedSessionId);
    if (meta) loadedSceneId = meta.id;
    setAutosaveBadge('saved');
    renderSceneList();
  }, 800);
}

async function loadMostRecentScene() {
  if (!sceneReady || !selectedCampaignId) { renderSceneList(); return; }
  const scenes = await window.electronAPI.listScenesCampaign(selectedCampaignId, selectedSessionId);
  if (scenes.length) {
    await applyLoadedScene(scenes[0].id);
  } else {
    loadedSceneId = null;
    renderSceneList();
  }
}

async function renderSceneList() {
  scenesContent.innerHTML = '';
  if (!selectedCampaignId) return;
  const scenes = await window.electronAPI.listScenesCampaign(selectedCampaignId, selectedSessionId);
  if (!scenes.length) return;
  for (const s of scenes) {
    scenesContent.appendChild(buildSceneRow(s));
  }
}

function buildSceneRow(s) {
  const row = document.createElement('div');
  row.className = 'scene-row' + (s.id === loadedSceneId ? ' active' : '');
  row.dataset.sceneId = s.id;
  row.title = s.savedAt ? new Date(s.savedAt).toLocaleString() : '';

  const nameEl = document.createElement('span');
  nameEl.className = 'scene-row-name';
  nameEl.textContent = s.name || '(unnamed)';
  row.addEventListener('click', () => applyLoadedScene(s.id));

  const actions = document.createElement('div');
  actions.className = 'scene-actions';

  const btnRename = document.createElement('button');
  btnRename.className = 'btn-icon-xs';
  btnRename.title = 'Rename scene';
  btnRename.textContent = '✏';
  btnRename.addEventListener('click', (e) => {
    e.stopPropagation();
    startSceneRename(row, nameEl, s);
  });

  const btnDel = document.createElement('button');
  btnDel.className = 'btn-icon-xs danger';
  btnDel.textContent = '×';
  btnDel.title = 'Delete scene';
  btnDel.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete scene "${s.name || '(unnamed)'}"?`)) return;
    if (loadedSceneId === s.id) loadedSceneId = null;
    await window.electronAPI.deleteSceneCampaign(selectedCampaignId, selectedSessionId, s.id);
    renderSceneList();
  });

  actions.appendChild(btnRename);
  actions.appendChild(btnDel);
  row.appendChild(nameEl);
  row.appendChild(actions);
  return row;
}

function startSceneRename(row, nameEl, s) {
  const input = document.createElement('input');
  input.className = 'scene-row-name-input';
  input.value = s.name || '';
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  async function commit() {
    const newName = input.value.trim();
    if (newName !== s.name) {
      await window.electronAPI.renameSceneCampaign(selectedCampaignId, selectedSessionId, s.id, newName);
      if (loadedSceneId === s.id) {
        window.electronAPI.updateSceneMeta({ name: newName });
        sceneNameInput.value = newName;
      }
    }
    renderSceneList();
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = s.name || ''; input.blur(); }
  });
}

async function applyLoadedScene(sceneIdOrScene) {
  const scene = typeof sceneIdOrScene === 'string'
    ? await window.electronAPI.loadSceneCampaign(selectedCampaignId, selectedSessionId, sceneIdOrScene)
    : sceneIdOrScene;
  if (!scene) return;
  loadedSceneId = scene.id ?? null;
  window.electronAPI.setScene(scene);
  layers    = scene.layers   ?? [];
  huds      = scene.huds     ?? [];
  vpCx      = scene.viewport?.cx    ?? 4096;
  vpCy      = scene.viewport?.cy    ?? 4096;
  vpZoom    = scene.viewport?.zoom   ?? 1.0;
  canvasBg  = scene.background ?? '#1a1a2e';
  if (elCanvasBg) elCanvasBg.value = canvasBg;
  sceneNameInput.value = scene.name ?? '';
  updateVpZoomUI();
  renderLayerList();
  renderHudList();
  selectedLayerId = null;
  selectedHudId   = null;
  layerDetail.style.display      = 'none';
  initiativeEditor.style.display = 'none';
  setAutosaveBadge('');
  renderSceneList();
}

// Scene name: update meta + trigger autosave
sceneNameInput.addEventListener('input', () => {
  window.electronAPI.updateSceneMeta({ name: sceneNameInput.value.trim() });
  scheduleAutosave();
});

btnRefreshScenes.addEventListener('click', renderSceneList);

// Export to file
btnSaveScene.addEventListener('click', async () => {
  const scene = await window.electronAPI.getScene();
  if (scene) await window.electronAPI.saveSceneDialog(scene);
});

// Import from file
btnLoadScene.addEventListener('click', async () => {
  const scene = await window.electronAPI.loadSceneDialog();
  if (!scene) return;
  await applyLoadedScene(scene);
});

// New scene
btnResetScene.addEventListener('click', () => {
  confirmInline(btnResetScene, () => {
    window.electronAPI.resetScene();
    loadedSceneId = null;
    layers    = [];
    huds      = [];
    vpCx = 4096; vpCy = 4096; vpZoom = 1.0;
    canvasBg = '#1a1a2e';
    if (elCanvasBg) elCanvasBg.value = canvasBg;
    sceneNameInput.value = '';
    updateVpZoomUI();
    renderLayerList();
    renderHudList();
    selectedLayerId = null;
    selectedHudId   = null;
    layerDetail.style.display      = 'none';
    initiativeEditor.style.display = 'none';
    setAutosaveBadge('');
    renderSceneList();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// LAYER OVERLAY  — interactive move / resize on the preview canvas
// ════════════════════════════════════════════════════════════════════════════

const layerOverlay  = document.getElementById('layer-overlay');
const overlayCtx    = layerOverlay.getContext('2d');

const POSITIONABLE_TYPES = new Set(['image', 'gif', 'video', 'light', 'fog', 'weather']);
const HANDLE_SIZE        = 8;   // px, square handle side

// Drag state: null when idle
let overlayDrag = null; // { layerId, mode:'move'|'resize', handle, startMx, startMy, startLayer:{x,y,w,h} }
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

/** Converts canvas pixel coordinates to overlay pixel coordinates. */
function canvasToOverlay(cx, cy) {
  const ow = layerOverlay.width, oh = layerOverlay.height;
  return { x: (cx - gmCamX) * gmCamZoom + ow / 2, y: (cy - gmCamY) * gmCamZoom + oh / 2 };
}

/** Converts overlay pixel coordinates to canvas pixel coordinates. */
function overlayToCanvas(px, py) {
  const ow = layerOverlay.width, oh = layerOverlay.height;
  return { x: (px - ow / 2) / gmCamZoom + gmCamX, y: (py - oh / 2) / gmCamZoom + gmCamY };
}

/**
 * Returns the pixel rect within the overlay canvas that corresponds to the
 * "screen" content. In advanced mode returns the full overlay; in simple mode
 * accounts for the preview image's object-fit:contain letterboxing.
 */
function getContentArea() {
  const cw = layerOverlay.width;
  const ch = layerOverlay.height;
  if (screenModeAdvanced) return { cx: 0, cy: 0, cw, ch };
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

/** Converts a layer's canvas-pixel coords to overlay pixel bounds. */
function layerBoundsOnCanvas(layer) {
  if (layer.x == null || layer.y == null || layer.w == null || layer.h == null) {
    // fullscreen: map entire canvas to overlay
    const tl = canvasToOverlay(0, 0);
    return { px: tl.x, py: tl.y, pw: CANVAS_SIZE * gmCamZoom, ph: CANVAS_SIZE * gmCamZoom };
  }
  const tl = canvasToOverlay(layer.x, layer.y);
  return { px: tl.x, py: tl.y, pw: layer.w * gmCamZoom, ph: layer.h * gmCamZoom };
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

/** Returns { layerId?, mode, handle? } or null. */
function hitTestOverlay(mx, my) {
  // 1. Selected layer handles
  if (selectedLayerId) {
    const layer = layers.find(l => l.id === selectedLayerId);
    if (layer && POSITIONABLE_TYPES.has(layer.type)) {
      const b = layerBoundsOnCanvas(layer);
      const handle = hitTestHandle(mx, my, b.px, b.py, b.pw, b.ph);
      if (handle) return { layerId: layer.id, mode: 'resize', handle };
      if (mx >= b.px && mx <= b.px + b.pw && my >= b.py && my <= b.py + b.ph)
        return { layerId: layer.id, mode: 'move' };
    }
  }

  // 2. Passive layer scan (fog/weather excluded)
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!POSITIONABLE_TYPES.has(layer.type) || layer.visible === false) continue;
    if (layer.type === 'fog' || layer.type === 'weather') continue;
    const b = layerBoundsOnCanvas(layer);
    if (mx >= b.px && mx <= b.px + b.pw && my >= b.py && my <= b.py + b.ph)
      return { layerId: layer.id, mode: 'move' };
  }

  // 3. Viewport rect pan (always available)
  const halfW = playerScreenW / (2 * vpZoom);
  const halfH = playerScreenH / (2 * vpZoom);
  const vpTL = canvasToOverlay(vpCx - halfW, vpCy - halfH);
  const vpBR = canvasToOverlay(vpCx + halfW, vpCy + halfH);
  if (mx >= vpTL.x && mx <= vpBR.x && my >= vpTL.y && my <= vpBR.y)
    return { mode: 'vpPan' };

  return null;
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderLayerOverlay() {
  const ctx = overlayCtx;
  const ow = layerOverlay.width, oh = layerOverlay.height;
  ctx.clearRect(0, 0, ow, oh);
  if (!screenModeAdvanced) return;

  // Background fill
  ctx.fillStyle = canvasBg;
  ctx.fillRect(0, 0, ow, oh);

  // Canvas boundary
  const tl = canvasToOverlay(0, 0);
  const br = canvasToOverlay(CANVAS_SIZE, CANVAS_SIZE);
  ctx.save();
  ctx.strokeStyle = 'rgba(100,100,160,0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  ctx.restore();

  // Grid (if enabled and cell is large enough)
  if (settings.gridVisible) {
    const cellPx = settings.cellSizeInches * settings.dpi * gmCamZoom;
    if (cellPx >= 4) {
      ctx.save();
      const hex = (settings.gridColor || '#ffffff').replace('#', '');
      const rr  = parseInt(hex.slice(0, 2), 16);
      const gg  = parseInt(hex.slice(2, 4), 16);
      const bb  = parseInt(hex.slice(4, 6), 16);
      const alpha = Math.round((settings.gridOpacity ?? 0.25) * 255).toString(16).padStart(2, '0');
      ctx.strokeStyle = `rgba(${rr},${gg},${bb},${settings.gridOpacity ?? 0.25})`;
      ctx.lineWidth = 0.5;
      const gridOriginX = canvasToOverlay(0, 0).x;
      const gridOriginY = canvasToOverlay(0, 0).y;
      const startX = ((gridOriginX % cellPx) + cellPx) % cellPx;
      const startY = ((gridOriginY % cellPx) + cellPx) % cellPx;
      ctx.beginPath();
      for (let x = startX; x <= ow; x += cellPx) { ctx.moveTo(x, 0); ctx.lineTo(x, oh); }
      for (let y = startY; y <= oh; y += cellPx) { ctx.moveTo(0, y); ctx.lineTo(ow, y); }
      ctx.stroke();
      ctx.restore();
    }
  }

  // Layer outlines + images
  for (const layer of layers) {
    if (!POSITIONABLE_TYPES.has(layer.type) || layer.visible === false) continue;
    const b = layerBoundsOnCanvas(layer);
    const isSelected = layer.id === selectedLayerId;

    // For image layers: draw the actual image
    if ((layer.type === 'image' || layer.type === 'gif') && layer.src) {
      const key = layer.id + '::' + layer.src;
      if (!gmImageCache.has(key)) {
        const img = new Image();
        img.onload = () => { img.loaded = true; renderLayerOverlay(); };
        img.src = layer.src;
        gmImageCache.set(key, img);
      }
      const img = gmImageCache.get(key);
      if (img?.loaded) {
        ctx.save();
        ctx.globalAlpha = layer.opacity ?? 1;
        ctx.drawImage(img, b.px, b.py, b.pw, b.ph);
        ctx.restore();
      }
    } else {
      // Colored fill for non-image layers
      const TYPE_COLORS = { light: 'rgba(80,120,200,0.25)', fog: 'rgba(20,20,30,0.6)', weather: 'rgba(80,160,220,0.2)', video: 'rgba(80,80,80,0.3)' };
      ctx.save();
      ctx.fillStyle = TYPE_COLORS[layer.type] ?? 'rgba(74,144,217,0.15)';
      ctx.fillRect(b.px, b.py, b.pw, b.ph);
      ctx.restore();
    }

    // Outline
    ctx.save();
    ctx.strokeStyle = isSelected ? '#c9a84c' : 'rgba(74,144,217,0.45)';
    ctx.lineWidth = isSelected ? 1.5 : 1;
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

  // Player viewport rectangle
  const halfW = playerScreenW / (2 * vpZoom);
  const halfH = playerScreenH / (2 * vpZoom);
  const vpTL = canvasToOverlay(vpCx - halfW, vpCy - halfH);
  const vpBR = canvasToOverlay(vpCx + halfW, vpCy + halfH);
  const rx = vpTL.x, ry = vpTL.y, rw = vpBR.x - vpTL.x, rh = vpBR.y - vpTL.y;

  // Dim outside
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.rect(0, 0, ow, oh);
  ctx.rect(rx, ry, rw, rh);
  ctx.fill('evenodd');
  ctx.restore();

  // Gold border
  ctx.save();
  ctx.strokeStyle = 'rgba(201,168,76,0.9)';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = 'rgba(201,168,76,0.5)';
  ctx.shadowBlur = 4;
  ctx.strokeRect(rx + 0.5, ry + 0.5, rw, rh);
  ctx.restore();
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
  const rect = layerOverlay.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Update canvas coordinates readout
  if (screenModeAdvanced && canvasCoordsEl) {
    const { x, y } = overlayToCanvas(mx, my);
    canvasCoordsEl.textContent = `${Math.round(x)}, ${Math.round(y)} px`;
  }

  if (gmCamPanDrag) {
    const dx = (mx - gmCamPanDrag.startMx) / gmCamZoom;
    const dy = (my - gmCamPanDrag.startMy) / gmCamZoom;
    gmCamX = gmCamPanDrag.startCamX - dx;
    gmCamY = gmCamPanDrag.startCamY - dy;
    renderLayerOverlay();
    return;
  }

  if (overlayDrag) return; // cursor locked during drag
  if (pingMode) { layerOverlay.style.cursor = 'crosshair'; return; }
  if (!screenModeAdvanced) return;
  const hit = hitTestOverlay(mx, my);
  if (!hit)                      layerOverlay.style.cursor = 'default';
  else if (hit.mode === 'vpPan') layerOverlay.style.cursor = 'grab';
  else if (hit.mode === 'move')  layerOverlay.style.cursor = 'move';
  else                           layerOverlay.style.cursor = RESIZE_CURSORS[hit.handle] ?? 'default';
});

layerOverlay.addEventListener('wheel', (e) => {
  if (!screenModeAdvanced) return;
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  const rect = layerOverlay.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const before = overlayToCanvas(mx, my);
  gmCamZoom = Math.max(0.01, Math.min(4, gmCamZoom * factor));
  const ow = layerOverlay.width, oh = layerOverlay.height;
  gmCamX = before.x - (mx - ow / 2) / gmCamZoom;
  gmCamY = before.y - (my - oh / 2) / gmCamZoom;
  renderLayerOverlay();
}, { passive: false });

layerOverlay.addEventListener('contextmenu', e => e.preventDefault());

layerOverlay.addEventListener('mousedown', (e) => {
  const rect = layerOverlay.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Middle-click or right-click: GM camera pan
  if ((e.button === 1 || e.button === 2) && screenModeAdvanced) {
    e.preventDefault();
    gmCamPanDrag = { startMx: mx, startMy: my, startCamX: gmCamX, startCamY: gmCamY };
    layerOverlay.style.cursor = 'grabbing';
    return;
  }

  // ── Ping mode ────────────────────────────────────────────────────────────
  if (pingMode) {
    if (screenModeAdvanced) {
      const canvasCoords = overlayToCanvas(mx, my);
      window.electronAPI.sendPing(canvasCoords.x, canvasCoords.y);
    } else {
      const ca = getContentArea();
      const nx = (mx - ca.cx) / ca.cw;
      const ny = (my - ca.cy) / ca.ch;
      if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
        window.electronAPI.sendPing(nx, ny);
      }
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

  e.preventDefault();

  // ── Viewport pan drag ────────────────────────────────────────────────────
  if (hit.mode === 'vpPan') {
    overlayDrag = { mode: 'vpPan', startMx: mx, startMy: my, startCx: vpCx, startCy: vpCy };
    layerOverlay.style.cursor = 'grabbing';
    return;
  }

  // Select the hit layer if it isn't already
  if (hit.layerId !== selectedLayerId) {
    selectedLayerId = hit.layerId;
    renderLayerList();
    const layer = layers.find(l => l.id === selectedLayerId);
    if (layer) renderLayerDetail(layer);
  }

  const layer = layers.find(l => l.id === hit.layerId);
  if (!layer) return;

  overlayDrag = {
    layerId: hit.layerId,
    mode:    hit.mode,
    handle:  hit.handle,
    startMx: mx,
    startMy: my,
    startLayer: {
      x: layer.x ?? 0,
      y: layer.y ?? 0,
      w: layer.w ?? CANVAS_SIZE,
      h: layer.h ?? CANVAS_SIZE,
    },
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
  const { startMx, startMy } = overlayDrag;

  // ── Viewport pan ──────────────────────────────────────────────────────────
  if (overlayDrag.mode === 'vpPan') {
    const dx_canvas = (mx - startMx) / gmCamZoom;
    const dy_canvas = (my - startMy) / gmCamZoom;
    vpCx = overlayDrag.startCx + dx_canvas;
    vpCy = overlayDrag.startCy + dy_canvas;
    renderLayerOverlay();
    window.electronAPI.updateViewport({ cx: vpCx, cy: vpCy });
    return;
  }

  const { startLayer } = overlayDrag;
  const dx_canvas = (mx - startMx) / gmCamZoom;
  const dy_canvas = (my - startMy) / gmCamZoom;
  const MIN = MIN_LAYER_SIZE;

  let patch;

  if (overlayDrag.mode === 'move') {
    if (snapToGrid && settings.cellSizeInches && settings.dpi) {
      const cellPx = settings.cellSizeInches * settings.dpi;
      patch = {
        x: Math.round((startLayer.x + dx_canvas) / cellPx) * cellPx,
        y: Math.round((startLayer.y + dy_canvas) / cellPx) * cellPx,
        w: startLayer.w, h: startLayer.h,
      };
    } else {
      patch = { x: startLayer.x + dx_canvas, y: startLayer.y + dy_canvas, w: startLayer.w, h: startLayer.h };
    }
  } else {
    let { x, y, w, h } = startLayer;
    switch (overlayDrag.handle) {
      case 'TL': x = startLayer.x + dx_canvas; y = startLayer.y + dy_canvas; w = Math.max(MIN, startLayer.w - dx_canvas); h = Math.max(MIN, startLayer.h - dy_canvas); break;
      case 'TC':                                y = startLayer.y + dy_canvas;                                               h = Math.max(MIN, startLayer.h - dy_canvas); break;
      case 'TR':                                y = startLayer.y + dy_canvas; w = Math.max(MIN, startLayer.w + dx_canvas); h = Math.max(MIN, startLayer.h - dy_canvas); break;
      case 'ML': x = startLayer.x + dx_canvas;                               w = Math.max(MIN, startLayer.w - dx_canvas);                                              break;
      case 'MR':                                                              w = Math.max(MIN, startLayer.w + dx_canvas);                                              break;
      case 'BL': x = startLayer.x + dx_canvas;                               w = Math.max(MIN, startLayer.w - dx_canvas); h = Math.max(MIN, startLayer.h + dy_canvas); break;
      case 'BC':                                                                                                            h = Math.max(MIN, startLayer.h + dy_canvas); break;
      case 'BR':                                                              w = Math.max(MIN, startLayer.w + dx_canvas); h = Math.max(MIN, startLayer.h + dy_canvas); break;
    }
    patch = { x, y, w, h };
  }

  throttledUpdateLayer(overlayDrag.layerId, patch);
});

document.addEventListener('mouseup', async () => {
  if (gmCamPanDrag) { gmCamPanDrag = null; layerOverlay.style.cursor = ''; return; }
  if (!overlayDrag) return;
  const drag = overlayDrag;
  overlayDrag = null;
  clearTimeout(overlayThrottleTimer);
  overlayThrottleTimer = null;
  layerOverlay.style.cursor = '';

  if (drag.mode === 'vpPan') {
    // Final flush already sent inline; nothing extra needed
    renderLayerOverlay();
    return;
  }

  // Flush the final layer position to main
  const layer = layers.find(l => l.id === drag.layerId);
  if (layer) {
    const { x, y, w, h } = layer;
    const newLayers = await window.electronAPI.updateLayer(drag.layerId, { x, y, w, h });
    if (newLayers) { layers = newLayers; renderLayerOverlay(); }
  }
});

// (onScreenPreview is handled above in the PREVIEW section)

// ════════════════════════════════════════════════════════════════════════════
// SETTINGS (continued)
// ════════════════════════════════════════════════════════════════════════════

// Receive persisted settings from main process on startup
window.electronAPI.onInitialSettings(async (s) => {
  applySettingsToUI(s);
  // applySettingsToUI calls initScene if advanced and not ready; call directly if needed
  if (s.screenMode === 'advanced' && !sceneReady) await initScene();
});

// ════════════════════════════════════════════════════════════════════════════
// PANEL RESIZE
// ════════════════════════════════════════════════════════════════════════════

let panelResizeDrag = null; // { side: 'left'|'right', startX, startWidth }

resizeHandleLeft.addEventListener('mousedown', (e) => {
  panelResizeDrag = { side: 'left', startX: e.clientX, startWidth: panelMaps.offsetWidth };
  resizeHandleLeft.classList.add('dragging');
  document.body.style.cursor = 'ew-resize';
  e.preventDefault();
});

resizeHandleRight.addEventListener('mousedown', (e) => {
  panelResizeDrag = { side: 'right', startX: e.clientX, startWidth: panelSettings.offsetWidth };
  resizeHandleRight.classList.add('dragging');
  document.body.style.cursor = 'ew-resize';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!panelResizeDrag) return;
  const dx = e.clientX - panelResizeDrag.startX;
  if (panelResizeDrag.side === 'left') {
    panelMaps.style.width = Math.max(180, Math.min(520, panelResizeDrag.startWidth + dx)) + 'px';
  } else {
    panelSettings.style.width = Math.max(180, Math.min(520, panelResizeDrag.startWidth - dx)) + 'px';
  }
});

document.addEventListener('mouseup', () => {
  if (!panelResizeDrag) return;
  panelResizeDrag = null;
  resizeHandleLeft.classList.remove('dragging');
  resizeHandleRight.classList.remove('dragging');
  document.body.style.cursor = '';
});

// ════════════════════════════════════════════════════════════════════════════
// MONITOR SECTION COLLAPSE
// ════════════════════════════════════════════════════════════════════════════

function setMonitorSectionCollapsed(collapsed) {
  monitorSectionBody.classList.toggle('collapsed', collapsed);
  btnToggleMonitors.classList.toggle('collapsed', collapsed);
}

btnToggleMonitors.addEventListener('click', () => {
  const willCollapse = !monitorSectionBody.classList.contains('collapsed');
  setMonitorSectionCollapsed(willCollapse);
  if (!willCollapse) {
    // Re-render monitor map so it uses the correct (now-visible) clientWidth
    setTimeout(() => renderMonitorMap(), 0);
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
loadDisplays();
initLibrary();
initCampaigns();
