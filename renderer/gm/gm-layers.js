// ════════════════════════════════════════════════════════════════════════════
// SCREEN MODE TOGGLE & ADVANCED CONTROLS
// ════════════════════════════════════════════════════════════════════════════

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
  return { x: (cx - gmCamX) * gmCamZoom + ow / 2, y: (cy - gmCamY) * gmCamZoom + oh / 2 };
}

function overlayToCanvas(px, py) {
  const ow = layerOverlay.width, oh = layerOverlay.height;
  return { x: (px - ow / 2) / gmCamZoom + gmCamX, y: (py - oh / 2) / gmCamZoom + gmCamY };
}

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

function layerBoundsOnCanvas(layer) {
  if (layer.x == null || layer.y == null || layer.w == null || layer.h == null) {
    const tl = canvasToOverlay(0, 0);
    return { px: tl.x, py: tl.y, pw: CANVAS_SIZE * gmCamZoom, ph: CANVAS_SIZE * gmCamZoom };
  }
  const tl = canvasToOverlay(layer.x, layer.y);
  return { px: tl.x, py: tl.y, pw: layer.w * gmCamZoom, ph: layer.h * gmCamZoom };
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

  if (overlayDrag) return;
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
