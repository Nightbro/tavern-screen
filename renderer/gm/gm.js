// ── DOM refs ──────────────────────────────────────────────────────────────────
const monitorMap     = document.getElementById('monitor-map');
const monitorList    = document.getElementById('monitor-list');
const btnCloseScreen = document.getElementById('btn-close-screen');

const elGridVisible  = document.getElementById('grid-visible');
const elCellSize     = document.getElementById('cell-size');
const elGridColor    = document.getElementById('grid-color');
const elGridOpacity  = document.getElementById('grid-opacity');
const elGridOpacityVal = document.getElementById('grid-opacity-val');
const elDpi          = document.getElementById('dpi');
const elZoomVal      = document.getElementById('zoom-val');
const elZoomSlider   = document.getElementById('zoom-slider');
const btnZoomIn      = document.getElementById('zoom-in');
const btnZoomOut     = document.getElementById('zoom-out');
const btnZoomReset   = document.getElementById('zoom-reset');

// ── State ─────────────────────────────────────────────────────────────────────
let displays = [];
let activeDisplayId = null;

const settings = {
  gridVisible: true,
  cellSizeInches: 1.0,
  zoom: 1.0,
  dpi: 96,
  gridColor: '#ffffff',
  gridOpacity: 0.25,
};

// ── Monitors ──────────────────────────────────────────────────────────────────
async function loadDisplays() {
  displays = await window.electronAPI.getDisplays();
  activeDisplayId = (displays.find((d) => d.active) || {}).id || null;
  renderMap();
  renderCards();
  btnCloseScreen.disabled = activeDisplayId === null;
}

function renderMap() {
  monitorMap.innerHTML = '';

  const pad = 14;
  const mapW = monitorMap.clientWidth - pad * 2;
  const mapH = monitorMap.clientHeight - pad * 2;

  const rights   = displays.map((d) => d.bounds.x + d.bounds.width);
  const bottoms  = displays.map((d) => d.bounds.y + d.bounds.height);
  const minX = Math.min(...displays.map((d) => d.bounds.x));
  const minY = Math.min(...displays.map((d) => d.bounds.y));
  const totalW = Math.max(...rights)  - minX;
  const totalH = Math.max(...bottoms) - minY;
  const scale  = Math.min(mapW / totalW, mapH / totalH);
  const offX   = pad + (mapW - totalW * scale) / 2;
  const offY   = pad + (mapH - totalH * scale) / 2;

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

function renderCards() {
  monitorList.innerHTML = '';
  displays.forEach((d, i) => {
    const isActive = d.id === activeDisplayId;
    const card = document.createElement('div');
    card.className = 'monitor-card' + (isActive ? ' active' : '');
    card.innerHTML = `
      <div class="monitor-card-header">
        <h2>Monitor ${i + 1}</h2>
        ${d.isPrimary ? '<span class="badge-primary">Primary</span>' : ''}
        ${isActive   ? '<span class="badge-active">Active</span>'   : ''}
      </div>
      <div class="monitor-res">${d.bounds.width} × ${d.bounds.height} &nbsp;|&nbsp; ×${d.scaleFactor}</div>
      <button class="btn-select ${isActive ? 'active' : ''}" data-id="${d.id}">
        ${isActive ? 'Screen active here' : 'Send screen here'}
      </button>
    `;
    monitorList.appendChild(card);
  });

  monitorList.querySelectorAll('.btn-select').forEach((btn) => {
    btn.addEventListener('click', () => selectDisplay(Number(btn.dataset.id)));
  });
}

function selectDisplay(displayId) {
  if (displayId === activeDisplayId) return;
  window.electronAPI.selectDisplay(displayId);
  activeDisplayId = displayId;
  displays = displays.map((d) => ({ ...d, active: d.id === displayId }));
  renderMap();
  renderCards();
  btnCloseScreen.disabled = false;
}

btnCloseScreen.addEventListener('click', () => {
  window.electronAPI.closeScreen();
  activeDisplayId = null;
  displays = displays.map((d) => ({ ...d, active: false }));
  renderMap();
  renderCards();
  btnCloseScreen.disabled = true;
});

window.electronAPI.onScreenClosed(() => {
  activeDisplayId = null;
  displays = displays.map((d) => ({ ...d, active: false }));
  renderMap();
  renderCards();
  btnCloseScreen.disabled = true;
});

window.electronAPI.onScreenOpened((displayId, suggestedDpi) => {
  activeDisplayId = displayId;
  displays = displays.map((d) => ({ ...d, active: d.id === displayId }));
  renderMap();
  renderCards();
  btnCloseScreen.disabled = false;

  // Update DPI field with the suggested value
  if (suggestedDpi) {
    elDpi.value = suggestedDpi;
    sendSettings({ dpi: suggestedDpi });
  }
});

// ── Settings ──────────────────────────────────────────────────────────────────
function sendSettings(patch) {
  Object.assign(settings, patch);
  window.electronAPI.updateSettings(patch);
}

elGridVisible.addEventListener('change', () => sendSettings({ gridVisible: elGridVisible.checked }));

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

// Zoom
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
