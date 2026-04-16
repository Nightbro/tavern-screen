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
const tabBtns           = document.querySelectorAll('.panel-tab');
const tabPaneMaps       = document.getElementById('tab-pane-maps');
const tabPaneCampaign   = document.getElementById('tab-pane-campaign');
const campaignSelect    = document.getElementById('campaign-select');
const btnNewCampaign    = document.getElementById('btn-new-campaign');
const btnRenameCampaign = document.getElementById('btn-rename-campaign');
const btnDeleteCampaign = document.getElementById('btn-delete-campaign');
const sessionsContent   = document.getElementById('sessions-content');
const notesTextarea     = document.getElementById('notes-textarea');
const notesStatus       = document.getElementById('notes-status');
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

function activateMap(map) {
  activeMapId = map.id;
  window.electronAPI.setActiveMap(map);
  // Re-render cards to show active state without full reload
  document.querySelectorAll('.map-card').forEach((c) => {
    c.classList.toggle('active', c.dataset.mapId === map.id);
    c.querySelector('.map-card-name').style.color = c.dataset.mapId === map.id ? '' : '';
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
  btnDel.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (session.id === selectedSessionId) flushAndClearNotes();
    await window.electronAPI.deleteSession(selectedCampaignId, session.id);
    await refreshCampaigns();
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
  flushAndClearNotes();
  selectedCampaignId = campaignId;
  selectedSessionId  = sessionId;
  document.querySelectorAll('.session-row').forEach(r => {
    r.classList.toggle('active', r.dataset.sessionId === sessionId);
  });
  notesTextarea.disabled = false;
  notesTextarea.value = await window.electronAPI.readNotes(campaignId, sessionId);
  setNotesStatus('');
}

function flushAndClearNotes() {
  clearTimeout(notesDebounceTimer);
  if (selectedSessionId && notesStatus.classList.contains('unsaved')) {
    window.electronAPI.writeNotes(selectedCampaignId, selectedSessionId, notesTextarea.value);
  }
  notesTextarea.disabled = true;
  notesTextarea.value = '';
  setNotesStatus('');
  selectedSessionId = null;
}

function setNotesStatus(state) {
  notesStatus.classList.remove('saved', 'unsaved');
  if (state === 'saved')   { notesStatus.textContent = 'Saved';   notesStatus.classList.add('saved'); }
  if (state === 'unsaved') { notesStatus.textContent = 'Unsaved'; notesStatus.classList.add('unsaved'); }
  if (!state)              { notesStatus.textContent = ''; }
}

notesTextarea.addEventListener('input', () => {
  setNotesStatus('unsaved');
  clearTimeout(notesDebounceTimer);
  notesDebounceTimer = setTimeout(async () => {
    await window.electronAPI.writeNotes(selectedCampaignId, selectedSessionId, notesTextarea.value);
    setNotesStatus('saved');
    setTimeout(() => { if (notesStatus.classList.contains('saved')) setNotesStatus(''); }, 2000);
  }, NOTES_DEBOUNCE_MS);
});

// ── Campaign toolbar ──────────────────────────────────────────────────────────

campaignSelect.addEventListener('change', () => {
  flushAndClearNotes();
  selectedCampaignId = campaignSelect.value;
  renderSessions();
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

btnDeleteCampaign.addEventListener('click', async () => {
  if (!selectedCampaignId) return;
  flushAndClearNotes();
  await window.electronAPI.deleteCampaign(selectedCampaignId);
  selectedCampaignId = null;
  await refreshCampaigns();
  if (campaigns.length > 0) {
    selectedCampaignId = campaigns[0].id;
    campaignSelect.value = selectedCampaignId;
    renderSessions();
  }
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

window.electronAPI.onScreenOpened((displayId, suggestedDpi) => {
  activeDisplayId = displayId;
  displays = displays.map((d) => ({ ...d, active: d.id === displayId }));
  renderMonitorMap();
  renderMonitorCards();
  btnCloseScreen.disabled = false;
  if (suggestedDpi) { elDpi.value = suggestedDpi; sendSettings({ dpi: suggestedDpi }); }
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
  if (s.gridVisible    !== undefined) elGridVisible.checked  = s.gridVisible;
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
  Object.assign(settings, s);
}

elGridVisible.addEventListener('change',  () => sendSettings({ gridVisible: elGridVisible.checked }));
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

// Receive persisted settings from main process on startup
window.electronAPI.onInitialSettings((s) => applySettingsToUI(s));

// ── Init ──────────────────────────────────────────────────────────────────────
loadDisplays();
initLibrary();
initCampaigns();
