import {
  sceneState, display, viewport, ui, settings, gmImageCache,
  CANVAS_SIZE, MIN_LAYER_SIZE, POSITIONABLE_TYPES, HANDLE_SIZE,
  layerOverlay, overlayCtx,
  elScreenModeSimple, elAdvGridVisible, elGridVisible, elGridScaleViewport,
  elCanvasBg, btnFitView, elSnapToGrid,
  vpZoomIn, vpZoomOut, vpZoomReset, vpZoomSlider, vpZoomVal,
  btnPingMode, previewImg, canvasCoordsEl,
  layerListEl, layerDetail, layerDetailTitle, layerDetailFields,
  btnAddImageLayer, btnAddLightLayer, btnAddFogLayer, btnAddWeatherLayer,
} from './gm-state.js';

import { LAYER_REGISTRY } from '../layers/index.js';
import { confirmInline } from './gm-campaign.js';

function imageBoundsFromSrc(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) { resolve({}); return; }
      const w = img.naturalWidth, h = img.naturalHeight;
      resolve({ x: Math.round((CANVAS_SIZE - w) / 2), y: Math.round((CANVAS_SIZE - h) / 2), w, h });
    };
    img.onerror = () => resolve({});
    img.src = src;
  });
}

// ── Local drag state (only ever used within this module) ──────────────────────
let overlayDrag = null;
let overlayThrottleTimer = null;

// ── Reveal countdown timers — layerId → { remaining, timerId } ────────────────
const revealTimers = new Map();

function startRevealCountdown(layer) {
  if (revealTimers.has(layer.id)) {
    const { timerId } = revealTimers.get(layer.id);
    clearInterval(timerId);
    revealTimers.delete(layer.id);
    renderLayerList();
    return;
  }

  let remaining = layer.revealDelay || 3;
  const timerId = setInterval(async () => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(timerId);
      revealTimers.delete(layer.id);
      const newLayers = await window.electronAPI.updateLayer(layer.id, { visible: true });
      if (newLayers) { sceneState.layers = newLayers; }
    } else {
      revealTimers.get(layer.id).remaining = remaining;
    }
    renderLayerList();
  }, 1000);

  revealTimers.set(layer.id, { remaining, timerId });
  renderLayerList();
}

// ── Layer visibility mode toggle ──────────────────────────────────────────────

const btnLayerVisMode = document.getElementById('btn-layer-vis-mode');

btnLayerVisMode?.addEventListener('click', () => {
  ui.addLayerHidden = !ui.addLayerHidden;
  btnLayerVisMode.classList.toggle('vis-on', !ui.addLayerHidden);
  if (ui.addLayerHidden) {
    btnLayerVisMode.textContent = '○ Hidden';
    btnLayerVisMode.title = 'New layers added as hidden — click to add as visible';
  } else {
    btnLayerVisMode.textContent = '● Visible';
    btnLayerVisMode.title = 'New layers added as visible — click to add as hidden';
  }
});

function layerVisible() {
  return !ui.addLayerHidden;
}

// ── DEL key: delete selected layer ───────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Delete') return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
  if (!sceneState.selectedLayerId) return;
  e.preventDefault();
  const layer = sceneState.layers.find(l => l.id === sceneState.selectedLayerId);
  if (!layer) return;
  const row = layerListEl.querySelector(`.layer-row[data-layer-id="${CSS.escape(sceneState.selectedLayerId)}"]`);
  if (!row) return;
  const delBtn = row.querySelector('.btn-icon-xs.danger');
  if (!delBtn) return;
  confirmInline(delBtn, async () => {
    sceneState.selectedLayerId = null;
    layerDetail.style.display = 'none';
    const newLayers = await window.electronAPI.removeLayer(layer.id);
    if (newLayers) { sceneState.layers = newLayers; renderLayerList(); }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SCREEN MODE TOGGLE & ADVANCED CONTROLS
// ════════════════════════════════════════════════════════════════════════════

elScreenModeSimple.addEventListener('change', async () => {
  const isSimple = elScreenModeSimple.checked;
  const isAdv = !isSimple;
  display.advanced = isAdv;
  document.body.classList.toggle('advanced-mode', isAdv);
  window.sendSettings({ screenMode: isAdv ? 'advanced' : 'simple' });
  if (isAdv) await initScene();
  else renderLayerOverlay();
});

// Grid visibility shortcut (syncs with Settings-tab checkbox)
elAdvGridVisible.addEventListener('change', () => {
  elGridVisible.checked = elAdvGridVisible.checked;
  window.sendSettings({ gridVisible: elAdvGridVisible.checked });
});

// Grid scale mode
elGridScaleViewport.addEventListener('change', () => {
  window.sendSettings({ gridScaleWithViewport: elGridScaleViewport.checked });
});

elCanvasBg?.addEventListener('input', () => {
  sceneState.bg = elCanvasBg.value;
  window.electronAPI.updateSceneMeta({ background: sceneState.bg });
  renderLayerOverlay();
  window.scheduleAutosave();
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

elSnapToGrid?.addEventListener('change', () => { viewport.snapToGrid = elSnapToGrid.checked; });

// ── Scene init ────────────────────────────────────────────────────────────────

export async function initScene() {
  for (const { timerId } of revealTimers.values()) clearInterval(timerId);
  revealTimers.clear();
  const scene = await window.electronAPI.getScene();
  if (!scene) return;
  sceneState.layers = scene.layers   ?? [];
  sceneState.huds   = scene.huds     ?? [];
  viewport.cx       = scene.viewport?.cx   ?? 4096;
  viewport.cy       = scene.viewport?.cy   ?? 4096;
  viewport.zoom     = scene.viewport?.zoom  ?? 1.0;
  sceneState.bg     = scene.background ?? '#1a1a2e';
  renderLayerList();
  window.renderHudList();
  window.renderHudPreview();
  updateVpZoomUI();
  fitGMCamera();
  sceneState.ready = true;
  window.renderSceneList();
}

function fitGMCamera() {
  const ow = layerOverlay.width  || 400;
  const oh = layerOverlay.height || 300;
  viewport.gmCamZoom = Math.min(ow / CANVAS_SIZE, oh / CANVAS_SIZE) * 0.9;
  viewport.gmCamX = CANVAS_SIZE / 2;
  viewport.gmCamY = CANVAS_SIZE / 2;
  renderLayerOverlay();
}

function fitView() {
  if (sceneState.layers.length === 0) { fitGMCamera(); return; }
  const visible = sceneState.layers.filter(l => l.visible !== false && l.x != null);
  if (!visible.length) { fitGMCamera(); return; }
  const minX = Math.min(...visible.map(l => l.x));
  const minY = Math.min(...visible.map(l => l.y));
  const maxX = Math.max(...visible.map(l => l.x + l.w));
  const maxY = Math.max(...visible.map(l => l.y + l.h));
  const ow = layerOverlay.width, oh = layerOverlay.height;
  const padding = 40;
  viewport.gmCamZoom = Math.min((ow - padding * 2) / (maxX - minX), (oh - padding * 2) / (maxY - minY));
  viewport.gmCamX = (minX + maxX) / 2;
  viewport.gmCamY = (minY + maxY) / 2;
  renderLayerOverlay();
}

// ── Viewport zoom ─────────────────────────────────────────────────────────────

export function updateVpZoomUI() {
  const pct = Math.round(viewport.zoom * 100);
  vpZoomVal.textContent = pct + '%';
  vpZoomSlider.value    = pct;
}

function setVpZoom(value) {
  viewport.zoom = Math.max(0.1, Math.min(4, value));
  updateVpZoomUI();
  window.electronAPI.updateViewport({ zoom: viewport.zoom });
  renderLayerOverlay();
  window.scheduleAutosave();
}

vpZoomIn.addEventListener('click',     () => setVpZoom(viewport.zoom + 0.1));
vpZoomOut.addEventListener('click',    () => setVpZoom(viewport.zoom - 0.1));
vpZoomReset.addEventListener('click',  () => setVpZoom(1.0));
vpZoomSlider.addEventListener('input', () => setVpZoom(parseInt(vpZoomSlider.value) / 100));

// ── Ping mode ─────────────────────────────────────────────────────────────────

btnPingMode.addEventListener('click', () => {
  ui.pingMode = !ui.pingMode;
  btnPingMode.classList.toggle('ping-active', ui.pingMode);
  layerOverlay.parentElement.classList.toggle('ping-mode', ui.pingMode);
});

previewImg.addEventListener('click', (e) => {
  if (!ui.pingMode || previewImg.style.display === 'none' || display.advanced) return;
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
  ui.pingMode = false;
  btnPingMode.classList.remove('ping-active');
  previewImg.parentElement.classList.remove('ping-mode');
});

// ════════════════════════════════════════════════════════════════════════════
// LAYER MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════


const CONTENT_TYPES = new Set(['image', 'gif', 'video']);

export function renderLayerList() {
  layerListEl.innerHTML = '';
  if (sceneState.layers.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'layer-empty';
    empty.textContent = 'No layers yet';
    layerListEl.appendChild(empty);
    renderLayerOverlay();
    window.scheduleAutosave();
    return;
  }

  // Split into content vs effects, preserving relative stack order (top first)
  const allReversed    = [...sceneState.layers].reverse();
  const contentLayers  = allReversed.filter(l =>  CONTENT_TYPES.has(l.type));
  const effectLayers   = allReversed.filter(l => !CONTENT_TYPES.has(l.type));

  function appendSection(label, layers) {
    if (!layers.length) return;
    const header = document.createElement('div');
    header.className = 'layer-section-divider';
    header.textContent = label;
    layerListEl.appendChild(header);
    layers.forEach(l => layerListEl.appendChild(buildLayerRow(l)));
  }

  appendSection('Content', contentLayers);
  appendSection('Effects', effectLayers);

  renderLayerOverlay();
  window.scheduleAutosave();
}

function buildLayerRow(layer) {
  const row = document.createElement('div');
  row.className = 'layer-row'
    + (layer.id === sceneState.selectedLayerId ? ' active' : '')
    + (layer.visible === false ? ' hidden-layer' : '');
  row.dataset.layerId = layer.id;

  const eye = document.createElement('button');
  eye.className = 'btn-icon-xs';
  eye.textContent = layer.visible !== false ? '●' : '○';
  eye.title = layer.visible !== false ? 'Hide' : 'Show';
  eye.addEventListener('click', async (e) => {
    e.stopPropagation();
    const newLayers = await window.electronAPI.updateLayer(layer.id, { visible: !(layer.visible !== false) });
    if (newLayers) { sceneState.layers = newLayers; renderLayerList(); }
  });

  const badge = document.createElement('span');
  badge.className = 'layer-type-badge';
  badge.textContent = LAYER_REGISTRY[layer.type]?.getBadge() ?? layer.type;

  const name = document.createElement('span');
  name.className = 'layer-name';
  name.textContent = layer.name || layer.type;

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-icon-xs danger';
  delBtn.textContent = '×';
  delBtn.title = 'Remove layer';
  delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const layerName = layer.name || LAYER_REGISTRY[layer.type]?.getBadge() || layer.type;
    if (!confirm(`Delete layer "${layerName}"?\n\nThis cannot be undone.`)) return;
    if (sceneState.selectedLayerId === layer.id) { sceneState.selectedLayerId = null; layerDetail.style.display = 'none'; }
    const newLayers = await window.electronAPI.removeLayer(layer.id);
    if (newLayers) { sceneState.layers = newLayers; renderLayerList(); }
  });

  const grip = document.createElement('span');
  grip.className = 'layer-drag-grip';
  grip.textContent = '⠿';
  grip.title = 'Drag to reorder';

  row.draggable = true;

  row.addEventListener('dragstart', (e) => {
    sceneState.dragSrcLayerId = layer.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', layer.id);
    setTimeout(() => row.classList.add('dragging'), 0);
  });
  row.addEventListener('dragend', () => {
    sceneState.dragSrcLayerId = null;
    row.classList.remove('dragging');
    layerListEl.querySelectorAll('.layer-row').forEach(r => r.classList.remove('drag-over'));
  });
  row.addEventListener('dragover', (e) => {
    if (!sceneState.dragSrcLayerId || sceneState.dragSrcLayerId === layer.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    layerListEl.querySelectorAll('.layer-row').forEach(r => r.classList.remove('drag-over'));
    row.classList.add('drag-over');
  });
  row.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (!sceneState.dragSrcLayerId || sceneState.dragSrcLayerId === layer.id) return;
    layerListEl.querySelectorAll('.layer-row').forEach(r => r.classList.remove('drag-over'));

    // Collect visual order (top → bottom) from current DOM rows
    const rows = [...layerListEl.querySelectorAll('.layer-row[data-layer-id]')];
    const ids  = rows.map(r => r.dataset.layerId);

    const srcIdx = ids.indexOf(sceneState.dragSrcLayerId);
    const tgtIdx = ids.indexOf(layer.id);
    ids.splice(srcIdx, 1);
    const adjusted = srcIdx < tgtIdx ? tgtIdx - 1 : tgtIdx;
    ids.splice(adjusted, 0, sceneState.dragSrcLayerId);

    // Visual list is top→bottom; data array is bottom→top, so reverse
    const newLayers = await window.electronAPI.reorderLayers([...ids].reverse());
    if (newLayers) { sceneState.layers = newLayers; renderLayerList(); }
  });

  const countdown = revealTimers.get(layer.id);
  const showTimer = countdown || (layer.revealDelay > 0 && layer.visible === false);
  if (showTimer) {
    const timerBtn = document.createElement('button');
    timerBtn.className = 'btn-icon-xs layer-reveal-timer' + (countdown ? ' counting' : '');
    timerBtn.textContent = countdown ? countdown.remaining + 's' : '⏱';
    timerBtn.title = countdown ? 'Cancel countdown' : `Start ${layer.revealDelay}s reveal countdown`;
    if (countdown) row.classList.add('layer-counting');
    timerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startRevealCountdown(layer);
    });
    row.appendChild(grip);
    row.appendChild(eye);
    row.appendChild(badge);
    row.appendChild(name);
    row.appendChild(timerBtn);
    row.appendChild(delBtn);
  } else {
    row.appendChild(grip);
    row.appendChild(eye);
    row.appendChild(badge);
    row.appendChild(name);
    row.appendChild(delBtn);
  }

  row.addEventListener('dblclick', async (e) => {
    e.stopPropagation();
    const newVisible = layer.visible === false;
    const newLayers = await window.electronAPI.updateLayer(layer.id, { visible: newVisible });
    if (newLayers) {
      sceneState.layers = newLayers;
      sceneState.selectedLayerId = layer.id;
      renderLayerList();
    }
  });

  row.addEventListener('click', () => selectLayer(layer.id));
  return row;
}

function selectLayer(id) {
  sceneState.selectedLayerId = (id === sceneState.selectedLayerId) ? null : id;
  renderLayerList();   // also calls renderLayerOverlay
  const layer = sceneState.layers.find(l => l.id === sceneState.selectedLayerId);
  if (layer) renderLayerDetail(layer);
  else layerDetail.style.display = 'none';
}

function renderLayerDetail(layer) {
  layerDetail.style.display = '';
  const reg = LAYER_REGISTRY[layer.type];
  layerDetailTitle.textContent = (reg?.getBadge() ?? layer.type) + ' Layer';
  layerDetailFields.innerHTML = '';

  const layerCtx = {
    sceneState,
    imageBoundsFromSrc,
    refreshDetail: (updatedLayer) => renderLayerDetail(updatedLayer),
    updateLayer: async (id, patch) => {
      const newLayers = await window.electronAPI.updateLayer(id, patch);
      if (newLayers) sceneState.layers = newLayers;
      return newLayers;
    },
  };

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
    await layerCtx.updateLayer(layer.id, { name: nameInput.value });
  });

  // Reveal delay
  const delayInput = document.createElement('input');
  delayInput.type = 'number';
  delayInput.min = '0';
  delayInput.max = '3600';
  delayInput.step = '1';
  delayInput.value = layer.revealDelay ?? 0;
  delayInput.placeholder = '0';
  addField('Reveal (s)', delayInput);
  delayInput.addEventListener('change', async () => {
    const val = Math.max(0, Math.min(3600, parseInt(delayInput.value) || 0));
    delayInput.value = val;
    const newLayers = await layerCtx.updateLayer(layer.id, { revealDelay: val });
    if (newLayers) renderLayerList();
  });

  if (reg) reg.renderEditorFields(layer, addField, layerCtx);
}

// ── Quick asset buttons (left panel, advanced mode) ───────────────────────────

async function addWeatherLayerFull(type) {
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  const newLayers = await window.electronAPI.addLayer({
    ...LAYER_REGISTRY.weather.getDefaults(),
    weatherType: type,
    name: label,
    visible: layerVisible(),
  });
  if (newLayers) {
    sceneState.layers = newLayers;
    renderLayerList();
    const layersTab = document.querySelector('#right-panel-tabs [data-right-tab="layers"]');
    if (layersTab && !layersTab.classList.contains('active')) layersTab.click();
  }
}

async function addFogLayerFull() {
  const newLayers = await window.electronAPI.addLayer({
    ...LAYER_REGISTRY.fog.getDefaults(),
    name: 'Fog of War',
    visible: layerVisible(),
  });
  if (newLayers) {
    sceneState.layers = newLayers;
    renderLayerList();
    const layersTab = document.querySelector('#right-panel-tabs [data-right-tab="layers"]');
    if (layersTab && !layersTab.classList.contains('active')) layersTab.click();
  }
}

function setRegionSelectAsset(assetKey, layerType = null) {
  ui.regionSelectAsset = assetKey ?? null;
  ui.regionSelectAssetLayerType = assetKey ? layerType : null;
  const previewWrap = document.getElementById('preview-wrap');
  previewWrap.classList.toggle('region-select-mode', !!assetKey);
  document.querySelectorAll('.btn-asset').forEach(b => {
    b.classList.toggle('btn-asset-active', b.dataset.asset === assetKey);
  });
}

document.querySelectorAll('.btn-asset').forEach(btn => {
  let clickTimer = null;
  const layerType = btn.dataset.layerType ?? 'weather';

  btn.addEventListener('click', () => {
    if (clickTimer !== null) return;
    clickTimer = setTimeout(() => {
      clickTimer = null;
      const type = btn.dataset.asset;
      setRegionSelectAsset(ui.regionSelectAsset === type ? null : type, layerType);
    }, 220);
  });

  btn.addEventListener('dblclick', async () => {
    clearTimeout(clickTimer);
    clickTimer = null;
    setRegionSelectAsset(null);
    if (layerType === 'fog') {
      await addFogLayerFull();
    } else {
      await addWeatherLayerFull(btn.dataset.asset);
    }
  });
});

// ── Asset drag-and-drop onto the preview canvas ───────────────────────────────

const previewWrapEl = document.getElementById('preview-wrap');

previewWrapEl.addEventListener('dragover', (e) => {
  if (e.dataTransfer.types.includes('application/tavern-asset')) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
});

previewWrapEl.addEventListener('drop', async (e) => {
  const raw = e.dataTransfer.getData('application/tavern-asset');
  if (!raw) return;
  e.preventDefault();
  const { url, name, layerType } = JSON.parse(raw);
  const type = layerType ?? 'image';

  let bounds = {};
  if (type !== 'video') {
    if (display.advanced) {
      const rect = layerOverlay.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const imgBounds = await imageBoundsFromSrc(url);
      if (imgBounds.w) {
        const { x: cx, y: cy } = overlayToCanvas(mx, my);
        bounds = {
          x: Math.round(cx - imgBounds.w / 2),
          y: Math.round(cy - imgBounds.h / 2),
          w: imgBounds.w,
          h: imgBounds.h,
        };
      } else {
        bounds = imgBounds;
      }
    } else {
      bounds = await imageBoundsFromSrc(url);
    }
  }

  const newLayers = await window.electronAPI.addLayer({ type, src: url, name, visible: layerVisible(), opacity: 1, ...bounds });
  if (newLayers) {
    sceneState.layers = newLayers;
    renderLayerList();
    const layersTab = document.querySelector('#right-panel-tabs [data-right-tab="layers"]');
    if (layersTab && !layersTab.classList.contains('active')) layersTab.click();
    setTimeout(() => window.electronAPI.requestPreview(), 400);
  }
});

// ── Add layer buttons ─────────────────────────────────────────────────────────

btnAddImageLayer.addEventListener('click', async () => {
  const newLayers = await window.electronAPI.addLayer({ ...LAYER_REGISTRY.image.getDefaults(), visible: layerVisible() });
  if (newLayers) { sceneState.layers = newLayers; renderLayerList(); selectLayer(newLayers.at(-1)?.id); }
});

btnAddLightLayer.addEventListener('click', async () => {
  const newLayers = await window.electronAPI.addLayer({ ...LAYER_REGISTRY.light.getDefaults(), visible: layerVisible() });
  if (newLayers) { sceneState.layers = newLayers; renderLayerList(); selectLayer(newLayers.at(-1)?.id); }
});

btnAddFogLayer.addEventListener('click', async () => {
  const newLayers = await window.electronAPI.addLayer({ ...LAYER_REGISTRY.fog.getDefaults(), visible: layerVisible() });
  if (newLayers) { sceneState.layers = newLayers; renderLayerList(); }
});

btnAddWeatherLayer.addEventListener('click', async () => {
  const newLayers = await window.electronAPI.addLayer({ ...LAYER_REGISTRY.weather.getDefaults(), visible: layerVisible() });
  if (newLayers) { sceneState.layers = newLayers; renderLayerList(); selectLayer(newLayers.at(-1)?.id); }
});

// ════════════════════════════════════════════════════════════════════════════
// LAYER OVERLAY  — interactive move / resize on the preview canvas
// ════════════════════════════════════════════════════════════════════════════

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

function canvasToOverlay(cx, cy) {
  const ow = layerOverlay.width, oh = layerOverlay.height;
  return { x: (cx - viewport.gmCamX) * viewport.gmCamZoom + ow / 2, y: (cy - viewport.gmCamY) * viewport.gmCamZoom + oh / 2 };
}

function overlayToCanvas(px, py) {
  const ow = layerOverlay.width, oh = layerOverlay.height;
  return { x: (px - ow / 2) / viewport.gmCamZoom + viewport.gmCamX, y: (py - oh / 2) / viewport.gmCamZoom + viewport.gmCamY };
}

function getContentArea() {
  const cw = layerOverlay.width;
  const ch = layerOverlay.height;
  if (display.advanced) return { cx: 0, cy: 0, cw, ch };
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

function layerBoundsOnCanvas(layer) {
  if (layer.x == null || layer.y == null || layer.w == null || layer.h == null) {
    const tl = canvasToOverlay(0, 0);
    return { px: tl.x, py: tl.y, pw: CANVAS_SIZE * viewport.gmCamZoom, ph: CANVAS_SIZE * viewport.gmCamZoom };
  }
  const tl = canvasToOverlay(layer.x, layer.y);
  return { px: tl.x, py: tl.y, pw: layer.w * viewport.gmCamZoom, ph: layer.h * viewport.gmCamZoom };
}

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

function hitTestOverlay(mx, my) {
  // 1. Selected layer handles
  if (sceneState.selectedLayerId) {
    const layer = sceneState.layers.find(l => l.id === sceneState.selectedLayerId);
    if (layer && POSITIONABLE_TYPES.has(layer.type)) {
      const b = layerBoundsOnCanvas(layer);
      const handle = hitTestHandle(mx, my, b.px, b.py, b.pw, b.ph);
      if (handle) return { layerId: layer.id, mode: 'resize', handle };
      if (mx >= b.px && mx <= b.px + b.pw && my >= b.py && my <= b.py + b.ph)
        return { layerId: layer.id, mode: 'move' };
    }
  }

  // 2. Passive layer scan (fog/weather excluded; hidden layers included as ghost targets)
  for (let i = sceneState.layers.length - 1; i >= 0; i--) {
    const layer = sceneState.layers[i];
    if (!POSITIONABLE_TYPES.has(layer.type)) continue;
    if (layer.type === 'fog' || layer.type === 'weather') continue;
    const b = layerBoundsOnCanvas(layer);
    if (mx >= b.px && mx <= b.px + b.pw && my >= b.py && my <= b.py + b.ph)
      return { layerId: layer.id, mode: 'move' };
  }

  // 3. Viewport rect pan (always available)
  const halfW = display.screenW / (2 * viewport.zoom);
  const halfH = display.screenH / (2 * viewport.zoom);
  const vpTL = canvasToOverlay(viewport.cx - halfW, viewport.cy - halfH);
  const vpBR = canvasToOverlay(viewport.cx + halfW, viewport.cy + halfH);
  if (mx >= vpTL.x && mx <= vpBR.x && my >= vpTL.y && my <= vpBR.y)
    return { mode: 'vpPan' };

  return null;
}

// ── Rendering ─────────────────────────────────────────────────────────────────

export function renderLayerOverlay() {
  const ctx = overlayCtx;
  const ow = layerOverlay.width, oh = layerOverlay.height;
  ctx.clearRect(0, 0, ow, oh);

  if (!display.advanced) {
    // Simple mode: draw ghost outlines for hidden layers over the preview image
    const ca = getContentArea();
    for (const layer of sceneState.layers) {
      if (!POSITIONABLE_TYPES.has(layer.type) || layer.visible !== false) continue;
      const b = (layer.x != null && layer.y != null && layer.w != null && layer.h != null)
        ? {
            px: ca.cx + (layer.x / CANVAS_SIZE) * ca.cw,
            py: ca.cy + (layer.y / CANVAS_SIZE) * ca.ch,
            pw: (layer.w / CANVAS_SIZE) * ca.cw,
            ph: (layer.h / CANVAS_SIZE) * ca.ch,
          }
        : { px: ca.cx, py: ca.cy, pw: ca.cw, ph: ca.ch };
      ctx.save();
      ctx.globalAlpha = 0.25;
      LAYER_REGISTRY[layer.type]?.drawGMPreview(layer, ctx, b, { imageCache: gmImageCache, onImageLoaded: renderLayerOverlay, ghostAlpha: 0.25 });
      ctx.strokeStyle = 'rgba(74,144,217,0.8)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(b.px + 0.5, b.py + 0.5, b.pw, b.ph);
      ctx.restore();
    }
    return;
  }

  // Evict GM image cache entries for removed layers and clean up any DOM-attached elements
  const layerIds = new Set(sceneState.layers.map(l => l.id));
  for (const [k, el] of gmImageCache) {
    if (!layerIds.has(k.split('::')[0])) { el.remove?.(); gmImageCache.delete(k); }
  }

  // Background fill
  ctx.fillStyle = sceneState.bg;
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
    const cellPx = settings.cellSizeInches * settings.dpi * viewport.gmCamZoom;
    if (cellPx >= 4) {
      ctx.save();
      const hex = (settings.gridColor || '#ffffff').replace('#', '');
      const rr  = parseInt(hex.slice(0, 2), 16);
      const gg  = parseInt(hex.slice(2, 4), 16);
      const bb  = parseInt(hex.slice(4, 6), 16);
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

  // Layer outlines + images (hidden layers rendered at 0.25 opacity as ghost)
  for (const layer of sceneState.layers) {
    if (!POSITIONABLE_TYPES.has(layer.type)) continue;
    const isHidden  = layer.visible === false;
    const b         = layerBoundsOnCanvas(layer);
    const isSelected = layer.id === sceneState.selectedLayerId;

    ctx.save();
    if (isHidden) ctx.globalAlpha = 0.25;

    LAYER_REGISTRY[layer.type]?.drawGMPreview(layer, ctx, b, { imageCache: gmImageCache, onImageLoaded: renderLayerOverlay, ghostAlpha: isHidden ? 0.25 : 1 });

    ctx.strokeStyle = isSelected ? '#c9a84c' : 'rgba(74,144,217,0.45)';
    ctx.lineWidth   = isSelected ? 1.5 : 1;
    if (!isSelected) ctx.setLineDash([4, 4]);
    ctx.strokeRect(b.px + 0.5, b.py + 0.5, b.pw, b.ph);

    if (isSelected) {
      const handles = getHandlePositions(b.px, b.py, b.pw, b.ph);
      for (const pos of Object.values(handles)) {
        ctx.fillStyle   = '#c9a84c';
        ctx.fillRect(pos.x, pos.y, HANDLE_SIZE, HANDLE_SIZE);
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth   = 1;
        ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, HANDLE_SIZE - 1, HANDLE_SIZE - 1);
      }
    }

    ctx.restore();
  }

  // Player viewport rectangle
  const halfW = display.screenW / (2 * viewport.zoom);
  const halfH = display.screenH / (2 * viewport.zoom);
  const vpTL = canvasToOverlay(viewport.cx - halfW, viewport.cy - halfH);
  const vpBR = canvasToOverlay(viewport.cx + halfW, viewport.cy + halfH);
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

  // Region selection rectangle (drawn while dragging for quick-asset region mode)
  if (overlayDrag?.mode === 'regionDraw') {
    const { startMx, startMy, endMx, endMy } = overlayDrag;
    const selX = Math.min(startMx, endMx), selY = Math.min(startMy, endMy);
    const selW = Math.abs(endMx - startMx),  selH = Math.abs(endMy - startMy);
    ctx.save();
    ctx.fillStyle   = 'rgba(100,200,255,0.12)';
    ctx.strokeStyle = 'rgba(100,200,255,0.85)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.fillRect(selX, selY, selW, selH);
    ctx.strokeRect(selX + 0.5, selY + 0.5, selW, selH);
    ctx.restore();
  }
}

// ── Throttled IPC update ──────────────────────────────────────────────────────

function throttledUpdateLayer(id, patch) {
  // Apply locally for instant visual feedback
  sceneState.layers = sceneState.layers.map(l => l.id === id ? { ...l, ...patch } : l);
  renderLayerOverlay();

  // Send to main process at ~20 fps
  if (!overlayThrottleTimer) {
    overlayThrottleTimer = setTimeout(() => {
      overlayThrottleTimer = null;
      if (overlayDrag) {
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
  if (display.advanced && canvasCoordsEl) {
    const { x, y } = overlayToCanvas(mx, my);
    canvasCoordsEl.textContent = `${Math.round(x)}, ${Math.round(y)} px`;
  }

  if (viewport.gmCamPanDrag) {
    const dx = (mx - viewport.gmCamPanDrag.startMx) / viewport.gmCamZoom;
    const dy = (my - viewport.gmCamPanDrag.startMy) / viewport.gmCamZoom;
    viewport.gmCamX = viewport.gmCamPanDrag.startCamX - dx;
    viewport.gmCamY = viewport.gmCamPanDrag.startCamY - dy;
    renderLayerOverlay();
    return;
  }

  if (overlayDrag) return;
  if (ui.pingMode || ui.regionSelectAsset) { layerOverlay.style.cursor = 'crosshair'; return; }
  if (!display.advanced) return;
  const hit = hitTestOverlay(mx, my);
  if (!hit)                      layerOverlay.style.cursor = 'default';
  else if (hit.mode === 'vpPan') layerOverlay.style.cursor = 'grab';
  else if (hit.mode === 'move')  layerOverlay.style.cursor = 'move';
  else                           layerOverlay.style.cursor = RESIZE_CURSORS[hit.handle] ?? 'default';
});

layerOverlay.addEventListener('wheel', (e) => {
  if (!display.advanced) return;
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  const rect = layerOverlay.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const before = overlayToCanvas(mx, my);
  viewport.gmCamZoom = Math.max(0.01, Math.min(4, viewport.gmCamZoom * factor));
  const ow = layerOverlay.width, oh = layerOverlay.height;
  viewport.gmCamX = before.x - (mx - ow / 2) / viewport.gmCamZoom;
  viewport.gmCamY = before.y - (my - oh / 2) / viewport.gmCamZoom;
  renderLayerOverlay();
}, { passive: false });

layerOverlay.addEventListener('contextmenu', e => e.preventDefault());

layerOverlay.addEventListener('mousedown', (e) => {
  const rect = layerOverlay.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Middle-click or right-click: GM camera pan
  if ((e.button === 1 || e.button === 2) && display.advanced) {
    e.preventDefault();
    viewport.gmCamPanDrag = { startMx: mx, startMy: my, startCamX: viewport.gmCamX, startCamY: viewport.gmCamY };
    layerOverlay.style.cursor = 'grabbing';
    return;
  }

  // ── Ping mode ────────────────────────────────────────────────────────────
  if (ui.pingMode) {
    if (display.advanced) {
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
    ui.pingMode = false;
    btnPingMode.classList.remove('ping-active');
    document.getElementById('preview-wrap').classList.remove('ping-mode');
    return;
  }

  // ── Region select mode (quick asset) ─────────────────────────────────────
  if (ui.regionSelectAsset && display.advanced && e.button === 0) {
    e.preventDefault();
    overlayDrag = { mode: 'regionDraw', startMx: mx, startMy: my, endMx: mx, endMy: my };
    return;
  }

  if (!display.advanced) return;

  const hit = hitTestOverlay(mx, my);

  if (!hit) {
    if (sceneState.selectedLayerId) selectLayer(null);
    return;
  }

  e.preventDefault();

  // ── Viewport pan drag ────────────────────────────────────────────────────
  if (hit.mode === 'vpPan') {
    overlayDrag = { mode: 'vpPan', startMx: mx, startMy: my, startCx: viewport.cx, startCy: viewport.cy };
    layerOverlay.style.cursor = 'grabbing';
    return;
  }

  // Select the hit layer if it isn't already
  if (hit.layerId !== sceneState.selectedLayerId) {
    sceneState.selectedLayerId = hit.layerId;
    renderLayerList();
    const layer = sceneState.layers.find(l => l.id === sceneState.selectedLayerId);
    if (layer) renderLayerDetail(layer);
  }

  const layer = sceneState.layers.find(l => l.id === hit.layerId);
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

  if (hit.mode === 'move') layerOverlay.style.cursor = 'move';
  else layerOverlay.style.cursor = RESIZE_CURSORS[hit.handle] ?? 'default';
});

document.addEventListener('mousemove', (e) => {
  if (!overlayDrag) return;

  const rect = layerOverlay.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const { startMx, startMy } = overlayDrag;

  // ── Region draw ───────────────────────────────────────────────────────────
  if (overlayDrag.mode === 'regionDraw') {
    overlayDrag.endMx = mx;
    overlayDrag.endMy = my;
    renderLayerOverlay();
    return;
  }

  // ── Viewport pan ──────────────────────────────────────────────────────────
  if (overlayDrag.mode === 'vpPan') {
    const dx_canvas = (mx - startMx) / viewport.gmCamZoom;
    const dy_canvas = (my - startMy) / viewport.gmCamZoom;
    viewport.cx = overlayDrag.startCx + dx_canvas;
    viewport.cy = overlayDrag.startCy + dy_canvas;
    renderLayerOverlay();
    window.electronAPI.updateViewport({ cx: viewport.cx, cy: viewport.cy });
    return;
  }

  const { startLayer } = overlayDrag;
  const dx_canvas = (mx - startMx) / viewport.gmCamZoom;
  const dy_canvas = (my - startMy) / viewport.gmCamZoom;
  const MIN = MIN_LAYER_SIZE;

  let patch;

  if (overlayDrag.mode === 'move') {
    if (viewport.snapToGrid && settings.cellSizeInches && settings.dpi) {
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
  if (viewport.gmCamPanDrag) { viewport.gmCamPanDrag = null; layerOverlay.style.cursor = ''; return; }
  if (!overlayDrag) return;
  const drag = overlayDrag;
  overlayDrag = null;
  clearTimeout(overlayThrottleTimer);
  overlayThrottleTimer = null;
  layerOverlay.style.cursor = '';

  if (drag.mode === 'vpPan') {
    renderLayerOverlay();
    return;
  }

  // ── Region draw commit ────────────────────────────────────────────────────
  if (drag.mode === 'regionDraw' && ui.regionSelectAsset) {
    const start = overlayToCanvas(drag.startMx, drag.startMy);
    const end   = overlayToCanvas(drag.endMx,   drag.endMy);
    const x = Math.round(Math.min(start.x, end.x));
    const y = Math.round(Math.min(start.y, end.y));
    const w = Math.max(MIN_LAYER_SIZE, Math.round(Math.abs(end.x - start.x)));
    const h = Math.max(MIN_LAYER_SIZE, Math.round(Math.abs(end.y - start.y)));
    const assetKey       = ui.regionSelectAsset;
    const assetLayerType = ui.regionSelectAssetLayerType;
    setRegionSelectAsset(null);
    let layerDef;
    if (assetLayerType === 'fog') {
      layerDef = { ...LAYER_REGISTRY.fog.getDefaults(), name: 'Fog of War', x, y, w, h, visible: layerVisible() };
    } else {
      const label = assetKey.charAt(0).toUpperCase() + assetKey.slice(1);
      layerDef = { ...LAYER_REGISTRY.weather.getDefaults(), weatherType: assetKey, name: label, x, y, w, h, visible: layerVisible() };
    }
    const newLayers = await window.electronAPI.addLayer(layerDef);
    if (newLayers) { sceneState.layers = newLayers; renderLayerList(); renderLayerOverlay(); }
    return;
  }

  // Flush the final layer position to main
  const layer = sceneState.layers.find(l => l.id === drag.layerId);
  if (layer) {
    const { x, y, w, h } = layer;
    const newLayers = await window.electronAPI.updateLayer(drag.layerId, { x, y, w, h });
    if (newLayers) { sceneState.layers = newLayers; renderLayerOverlay(); }
  }
});

// ── Double-click on overlay canvas: toggle layer visibility ──────────────────

layerOverlay.addEventListener('dblclick', async (e) => {
  if (!display.advanced) return;
  const rect = layerOverlay.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const hit = hitTestOverlay(mx, my);
  if (!hit?.layerId) return;
  const layer = sceneState.layers.find(l => l.id === hit.layerId);
  if (!layer) return;
  const newVisible = layer.visible === false;
  const newLayers = await window.electronAPI.updateLayer(layer.id, { visible: newVisible });
  if (newLayers) {
    sceneState.layers = newLayers;
    sceneState.selectedLayerId = layer.id;
    renderLayerList();
  }
});

// ── Window bridge (for unconverted classic scripts) ───────────────────────────
Object.assign(window, { initScene, renderLayerList, renderLayerOverlay, updateVpZoomUI });
