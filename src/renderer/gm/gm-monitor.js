import {
  display, ui, sceneState, settings,
  monitorMap, monitorList, btnCloseScreen,
  previewImg, previewPlaceholder, btnRefreshPreview,
  elGridVisible, elAdvGridVisible, elCellSize, elGridColor, elGridOpacity, elGridOpacityVal,
  elDpi,
  elScreenModeSimple, elGridScaleViewport,
} from './gm-state.js';

// ════════════════════════════════════════════════════════════════════════════
// MONITORS
// ════════════════════════════════════════════════════════════════════════════

export async function loadDisplays() {
  display.list = await window.electronAPI.getDisplays();
  display.activeId = (display.list.find((d) => d.active) || {}).id || null;
  renderMonitorMap();
  renderMonitorCards();
  btnCloseScreen.disabled = display.activeId === null;
}

export function renderMonitorMap() {
  monitorMap.innerHTML = '';
  const pad = 10;
  const mW = monitorMap.clientWidth - pad * 2;
  const mH = monitorMap.clientHeight - pad * 2;
  const rights  = display.list.map((d) => d.bounds.x + d.bounds.width);
  const bottoms = display.list.map((d) => d.bounds.y + d.bounds.height);
  const minX = Math.min(...display.list.map((d) => d.bounds.x));
  const minY = Math.min(...display.list.map((d) => d.bounds.y));
  const totW = Math.max(...rights) - minX;
  const totH = Math.max(...bottoms) - minY;
  const scale = Math.min(mW / totW, mH / totH);
  const offX  = pad + (mW - totW * scale) / 2;
  const offY  = pad + (mH - totH * scale) / 2;

  display.list.forEach((d, i) => {
    const el = document.createElement('div');
    el.className = 'map-monitor' + (d.id === display.activeId ? ' active' : '');
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
  display.list.forEach((d, i) => {
    const isActive = d.id === display.activeId;
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
  if (displayId === display.activeId) return;
  window.electronAPI.selectDisplay(displayId);
  display.activeId = displayId;
  display.list = display.list.map((d) => ({ ...d, active: d.id === displayId }));
  renderMonitorMap();
  renderMonitorCards();
  btnCloseScreen.disabled = false;
  window.setMonitorSectionCollapsed(true);
}

btnCloseScreen.addEventListener('click', () => {
  window.electronAPI.closeScreen();
  display.activeId = null;
  display.list = display.list.map((d) => ({ ...d, active: false }));
  renderMonitorMap();
  renderMonitorCards();
  btnCloseScreen.disabled = true;
  showPreviewPlaceholder();
});

window.electronAPI.onScreenClosed(() => {
  display.activeId = null;
  display.list = display.list.map((d) => ({ ...d, active: false }));
  renderMonitorMap();
  renderMonitorCards();
  btnCloseScreen.disabled = true;
  showPreviewPlaceholder();
});

window.electronAPI.onScreenOpened(async (displayId, suggestedDpi, sw, sh) => {
  display.activeId = displayId;
  display.list = display.list.map((d) => ({ ...d, active: d.id === displayId }));
  renderMonitorMap();
  renderMonitorCards();
  btnCloseScreen.disabled = false;
  if (suggestedDpi) { elDpi.value = suggestedDpi; sendSettings({ dpi: suggestedDpi }); }
  if (sw) display.screenW = sw;
  if (sh) display.screenH = sh;
  if (display.advanced) await window.initScene();
});

// ════════════════════════════════════════════════════════════════════════════
// PREVIEW
// ════════════════════════════════════════════════════════════════════════════

export function showPreviewPlaceholder() {
  previewImg.style.display = 'none';
  previewPlaceholder.style.display = '';
}

window.electronAPI.onScreenPreview((dataUrl) => {
  display.previewUrl = dataUrl;
  // Write through the window setter so the gm-state module binding stays in sync.
  window.lastScreenPreviewUrl = dataUrl;
  const hudMiniImg = document.getElementById('hud-tab-preview-img');
  if (hudMiniImg) { hudMiniImg.src = dataUrl; hudMiniImg.style.display = 'block'; }
  if (!display.advanced) {
    previewImg.src = dataUrl;
    previewImg.style.display = 'block';
    previewPlaceholder.style.display = 'none';
    setTimeout(() => window.renderLayerOverlay(), 50);
  } else {
    if (!ui.simDragging) window.updateHudSimulation();
  }
});

btnRefreshPreview.addEventListener('click', () => window.electronAPI.requestPreview());

// ════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════════════════

export function sendSettings(patch) {
  Object.assign(settings, patch);
  window.electronAPI.updateSettings(patch);
}

export function applySettingsToUI(s) {
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
  if (s.zoom !== undefined) settings.zoom = Math.max(0.25, Math.min(4, s.zoom));
  if (s.screenMode !== undefined) {
    const isAdv = s.screenMode === 'advanced';
    display.advanced = isAdv;
    if (elScreenModeSimple) elScreenModeSimple.checked = !isAdv;
    document.body.classList.toggle('advanced-mode', isAdv);
    if (isAdv && !sceneState.ready) window.initScene();
    else window.renderLayerOverlay();
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


// ── Center preview tabs (Preview / HUD Sim / HUDs) ───────────────────────────
const centerPreviewTabs  = document.querySelectorAll('#center-preview-tabs .panel-tab');
const centerTabPreview   = document.getElementById('center-tab-preview');
const centerTabHudSim    = document.getElementById('center-tab-hud-sim');
const centerTabHuds      = document.getElementById('center-tab-huds');
const rightPanel         = document.getElementById('panel-settings');
const rightResizeHandle  = document.getElementById('resize-right');

let activeCenterTab = 'preview';

centerPreviewTabs.forEach(btn => {
  btn.addEventListener('click', () => {
    const prevTab = activeCenterTab;
    centerPreviewTabs.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.centerTab;
    activeCenterTab = tab;

    // Leaving HUDs tab: move pane back to right panel and restore it
    if (prevTab === 'huds' && tab !== 'huds') {
      const hudPane = document.getElementById('right-tab-pane-huds');
      if (hudPane && rightPanel) {
        hudPane.style.removeProperty('display');
        hudPane.style.display = 'none'; // back to hidden (layers tab active)
        rightPanel.appendChild(hudPane);
      }
      if (rightPanel)        rightPanel.style.display = '';
      if (rightResizeHandle) rightResizeHandle.style.display = '';
    }

    centerTabPreview.style.display = tab === 'preview' ? '' : 'none';
    centerTabHudSim.style.display  = tab === 'hud-sim' ? '' : 'none';
    if (centerTabHuds) centerTabHuds.style.display = tab === 'huds' ? '' : 'none';

    if (tab === 'preview') {
      const btn = document.querySelector('#right-panel-tabs [data-right-tab="layers"]');
      if (btn && !btn.classList.contains('active')) btn.click();
    }

    if (tab === 'hud-sim') {
      const btn = document.querySelector('#right-panel-tabs [data-right-tab="huds"]');
      if (btn && !btn.classList.contains('active')) btn.click();
      window.electronAPI.requestPreview();
      window.updateHudSimulation();
    }

    if (tab === 'huds') {
      // Move HUD pane from right panel into center tab, hide right panel
      const hudPane = document.getElementById('right-tab-pane-huds');
      if (hudPane && centerTabHuds) {
        hudPane.style.display = '';
        centerTabHuds.appendChild(hudPane);
      }
      if (rightPanel)        rightPanel.style.display = 'none';
      if (rightResizeHandle) rightResizeHandle.style.display = 'none';
      window.electronAPI.requestPreview();
    }
  });
});

// ── Window bridge (for unconverted classic scripts) ───────────────────────────
Object.assign(window, { loadDisplays, showPreviewPlaceholder, applySettingsToUI, sendSettings });
