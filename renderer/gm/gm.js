// ── DOM refs ──────────────────────────────────────────────────────────────────
const monitorMap      = document.getElementById('monitor-map');
const monitorList     = document.getElementById('monitor-list');
const btnCloseScreen  = document.getElementById('btn-close-screen');
const mapLibrary      = document.getElementById('map-library');
const btnAddMaps      = document.getElementById('btn-add-maps');
const previewWrap     = document.getElementById('preview-wrap');
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
let displays       = [];
let activeDisplayId = null;
let maps           = [];
let activeMapId    = null;
const settings     = { gridVisible: true, cellSizeInches: 1.0, zoom: 1.0, dpi: 96, gridColor: '#ffffff', gridOpacity: 0.25 };

// ── Monitors ──────────────────────────────────────────────────────────────────
async function loadDisplays() {
  displays = await window.electronAPI.getDisplays();
  activeDisplayId = (displays.find((d) => d.active) || {}).id || null;
  renderMonitorMap();
  renderMonitorCards();
  btnCloseScreen.disabled = activeDisplayId === null;
}

function renderMonitorMap() {
  monitorMap.innerHTML = '';
  const pad = 12;
  const mW  = monitorMap.clientWidth  - pad * 2;
  const mH  = monitorMap.clientHeight - pad * 2;
  const rights  = displays.map((d) => d.bounds.x + d.bounds.width);
  const bottoms = displays.map((d) => d.bounds.y + d.bounds.height);
  const minX = Math.min(...displays.map((d) => d.bounds.x));
  const minY = Math.min(...displays.map((d) => d.bounds.y));
  const totW = Math.max(...rights)  - minX;
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
    el.innerHTML = `
      <span class="map-label">Monitor ${i + 1}</span>
      <span class="map-res">${d.bounds.width}×${d.bounds.height}</span>
      ${d.isPrimary ? '<span class="map-badge">Primary</span>' : ''}
    `;
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
      </button>
    `;
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
  if (suggestedDpi) {
    elDpi.value = suggestedDpi;
    sendSettings({ dpi: suggestedDpi });
  }
});

// ── Map Library ───────────────────────────────────────────────────────────────
async function loadMaps() {
  maps = await window.electronAPI.getMaps();
  renderMapLibrary();
}

function renderMapLibrary() {
  mapLibrary.innerHTML = '';

  if (maps.length === 0) {
    mapLibrary.innerHTML = '<div class="map-empty">No maps added yet.<br/>Click <strong>+ Add</strong> to import images.</div>';
    return;
  }

  maps.forEach((m) => {
    const card = document.createElement('div');
    card.className = 'map-card' + (m.id === activeMapId ? ' active' : '');
    card.dataset.id = m.id;

    const img = document.createElement('img');
    img.src = 'file:///' + m.path.replace(/\\/g, '/');
    img.alt = m.name;

    const label = document.createElement('div');
    label.className = 'map-card-label';
    label.textContent = m.name;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'map-card-remove';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove map';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.electronAPI.removeMap(m.id);
      maps = maps.filter((x) => x.id !== m.id);
      if (activeMapId === m.id) activeMapId = null;
      renderMapLibrary();
    });

    card.appendChild(img);
    card.appendChild(label);
    card.appendChild(removeBtn);
    card.addEventListener('click', () => activateMap(m.id));
    mapLibrary.appendChild(card);
  });
}

function activateMap(mapId) {
  if (mapId === activeMapId) return;
  activeMapId = mapId;
  window.electronAPI.setActiveMap(mapId);
  renderMapLibrary();
  // Preview will auto-update via schedulePreview in windowManager
  setTimeout(() => window.electronAPI.requestPreview(), 400);
}

btnAddMaps.addEventListener('click', async () => {
  const added = await window.electronAPI.openMapDialog();
  if (added.length === 0) return;
  maps = [...maps, ...added];
  renderMapLibrary();
  // Auto-activate first import if nothing is active
  if (!activeMapId && added.length > 0) activateMap(added[0].id);
});

// ── Preview ───────────────────────────────────────────────────────────────────
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

// ── Settings ──────────────────────────────────────────────────────────────────
function sendSettings(patch) {
  Object.assign(settings, patch);
  window.electronAPI.updateSettings(patch);
}

elGridVisible.addEventListener('change',  () => sendSettings({ gridVisible: elGridVisible.checked }));

elCellSize.addEventListener('change', () => {
  const v = Math.max(0.25, Math.min(4, parseFloat(elCellSize.value) || 1));
  elCellSize.value = v;
  sendSettings({ cellSizeInches: v });
});

elGridColor.addEventListener('input', () => sendSettings({ gridColor: elGridColor.value }));

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

// ── Init ──────────────────────────────────────────────────────────────────────
loadDisplays();
loadMaps();
