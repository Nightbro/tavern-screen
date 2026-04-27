// ════════════════════════════════════════════════════════════════════════════
// HUD REGISTRY
// ════════════════════════════════════════════════════════════════════════════

const HUD_REGISTRY = {
  initiative: new InitiativeHud(),
  status:     new StatusHud(),
  handout:    new HandoutHud(),
};

const HUD_TYPE_COLOR = { initiative: '#c9a84c', status: '#4a90d9', handout: '#4caf7d' };

// Context object passed into every GM editor method.
// Uses getters so sceneState mutations are always visible.
const gmCtx = {
  get sceneState()      { return sceneState; },
  get api()             { return window.electronAPI; },
  scheduleAutosave: () => scheduleAutosave(),
  renderHudList:        () => renderHudList(),
  renderHudPreview:     () => renderHudPreview(),
  genId,
};

// Mount each HUD type's editor event listeners once.
for (const hud of Object.values(HUD_REGISTRY)) hud.mountEditor(gmCtx);

// Expose sceneState reference needed by buildEntryStatusRow in HudBase.
window._gmSceneState = sceneState;

// ════════════════════════════════════════════════════════════════════════════
// HUD LIST
// ════════════════════════════════════════════════════════════════════════════

function renderHudList() {
  hudListEl.innerHTML = '';
  if (sceneState.huds.length === 0) {
    const empty = document.createElement('div');
    empty.className   = 'layer-empty';
    empty.textContent = 'No HUDs';
    hudListEl.appendChild(empty);
    renderHudPreview();
    return;
  }
  for (const hud of sceneState.huds) hudListEl.appendChild(buildHudRow(hud));
  renderHudPreview();
}

function buildHudRow(hud) {
  const reg = HUD_REGISTRY[hud.type];
  const row = document.createElement('div');
  row.className    = 'layer-row' + (hud.id === sceneState.selectedHudId ? ' active' : '');
  row.dataset.hudId = hud.id;

  const eye = document.createElement('button');
  eye.className   = 'btn-icon-xs';
  eye.textContent = hud.visible !== false ? '●' : '○';
  eye.title       = hud.visible !== false ? 'Hide' : 'Show';
  eye.addEventListener('click', async (e) => {
    e.stopPropagation();
    const newHuds = await window.electronAPI.updateHud(hud.id, { visible: !(hud.visible !== false) });
    if (newHuds) { sceneState.huds = newHuds; scheduleAutosave(); renderHudList(); }
  });

  const badge = document.createElement('span');
  badge.className   = 'layer-type-badge';
  badge.textContent = reg?.getBadge() ?? hud.type.slice(0, 2).toUpperCase();

  const name = document.createElement('span');
  name.className   = 'layer-name';
  name.textContent = reg?.getDisplayName(hud) ?? hud.type;

  const delBtn = document.createElement('button');
  delBtn.className   = 'btn-icon-xs danger';
  delBtn.textContent = '×'; delBtn.title = 'Remove HUD';
  delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (sceneState.selectedHudId === hud.id) {
      sceneState.selectedHudId = null;
      _hideAllEditors();
    }
    const newHuds = await window.electronAPI.removeHud(hud.id);
    if (newHuds) { sceneState.huds = newHuds; scheduleAutosave(); renderHudList(); }
  });

  row.appendChild(eye); row.appendChild(badge); row.appendChild(name); row.appendChild(delBtn);
  row.addEventListener('click', () => selectHud(hud.id));
  return row;
}

function _hideAllEditors() {
  document.getElementById('initiative-editor') && (document.getElementById('initiative-editor').style.display = 'none');
  document.getElementById('statuses-editor')   && (document.getElementById('statuses-editor').style.display   = 'none');
  document.getElementById('handout-editor')    && (document.getElementById('handout-editor').style.display    = 'none');
}

function applyHudSelection(id) {
  sceneState.selectedHudId = id ?? null;
  renderHudList();
  _hideAllEditors();
  const hud = sceneState.selectedHudId
    ? sceneState.huds.find(h => h.id === sceneState.selectedHudId)
    : null;
  if (hud) HUD_REGISTRY[hud.type]?.renderEditor(hud, gmCtx);
}

function selectHud(id) {
  applyHudSelection(id === sceneState.selectedHudId ? null : id);
}

// ── Add buttons ──────────────────────────────────────────────────────────────

btnAddInitiative?.addEventListener('click', async () => {
  const newHuds = await window.electronAPI.addHud(HUD_REGISTRY.initiative.getDefaults());
  if (newHuds) { sceneState.huds = newHuds; scheduleAutosave(); renderHudList(); selectHud(newHuds.at(-1)?.id); }
});

btnAddStatusHud?.addEventListener('click', async () => {
  const newHuds = await window.electronAPI.addHud(HUD_REGISTRY.status.getDefaults());
  if (newHuds) { sceneState.huds = newHuds; scheduleAutosave(); renderHudList(); selectHud(newHuds.at(-1)?.id); }
});

btnAddHandout?.addEventListener('click', async () => {
  const newHuds = await window.electronAPI.addHud(HUD_REGISTRY.handout.getDefaults());
  if (newHuds) { sceneState.huds = newHuds; scheduleAutosave(); renderHudList(); selectHud(newHuds.at(-1)?.id); }
});

// ════════════════════════════════════════════════════════════════════════════
// HUD SIMULATION
// ════════════════════════════════════════════════════════════════════════════

let simScale = 1;

function renderHudPreview() { if (!ui.simDragging) updateHudSimulation(); }

function updateHudSimulation() {
  if (!hudSimScreen || !hudSimWrap || !hudSimViewport) return;

  const sw = display.screenW || 1920;
  const sh = display.screenH || 1080;
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
  hudSimScreen.style.backgroundImage    = lastScreenPreviewUrl ? `url('${lastScreenPreviewUrl}')` : 'none';
  hudSimScreen.style.backgroundSize     = '100% 100%';
  hudSimScreen.style.backgroundPosition = 'top left';
  hudSimScreen.style.backgroundRepeat   = 'no-repeat';

  hudSimScreen.innerHTML = '';
  for (const hud of sceneState.huds) {
    if (hud.visible === false) continue;
    const reg = HUD_REGISTRY[hud.type];
    if (!reg) continue;
    const sides = reg.normalizeSides(hud);
    sides.forEach((side, sideIdx) => {
      hudSimScreen.appendChild(buildSimHudPanel(hud, reg, side, sideIdx, sw, sh));
    });
  }
}

function buildSimHudPanel(hud, reg, side, sideIdx, screenW, screenH) {
  const { w: panelW, h: panelH } = reg.estimateSimSize(hud);

  let px = side.x, py = side.y;
  if (px == null || py == null) {
    const pos = HudBase.cornerToXY(side.corner, panelW, panelH, screenW, screenH);
    px = pos.x; py = pos.y;
  }

  const panel = document.createElement('div');
  panel.className    = 'hud-sim-panel' + (hud.id === sceneState.selectedHudId ? ' selected' : '');
  panel.dataset.hudId   = hud.id;
  panel.dataset.sideIdx = sideIdx;
  panel.style.left   = Math.round(px) + 'px';
  panel.style.top    = Math.round(py) + 'px';
  panel.style.width  = panelW + 'px';
  panel.style.fontSize = (hud.fontSize ?? 24) + 'px';

  const color = HUD_TYPE_COLOR[hud.type] ?? '#888';

  const header = document.createElement('div');
  header.className = 'hud-sim-header';

  const badge = document.createElement('span');
  badge.className   = 'hud-sim-badge';
  badge.textContent = reg.getBadge();
  badge.style.cssText = `color:${color};border-color:${color}55;`;

  const titleEl = document.createElement('span');
  titleEl.className   = 'hud-sim-title-text';
  titleEl.textContent = reg.getDisplayName(hud);

  header.appendChild(badge); header.appendChild(titleEl);
  panel.appendChild(header);

  const body = document.createElement('div');
  body.className = 'hud-sim-body';
  reg.buildSimBody(body, hud);
  panel.appendChild(body);

  panel.addEventListener('click', (e) => { e.stopPropagation(); selectHud(hud.id); });
  makeSimPanelDraggable(panel, header, hud, sideIdx, screenW, screenH);

  return panel;
}

function makeSimPanelDraggable(panel, handle, hud, sideIdx, screenW, screenH) {
  handle.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();

    const startPx = parseInt(panel.style.left) || 0;
    const startPy = parseInt(panel.style.top)  || 0;
    const startMx = e.clientX;
    const startMy = e.clientY;
    const panelW  = panel.offsetWidth  || 280;
    const panelH  = panel.offsetHeight || 60;
    let moved     = false;

    ui.simDragging     = true;
    handle.style.cursor = 'grabbing';

    const coordsEl = document.getElementById('hud-sim-coords');

    const onMove = (ev) => {
      moved = true;
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
      ui.simDragging = false;

      if (!moved) { selectHud(hud.id); return; }

      const nx = parseInt(panel.style.left) || 0;
      const ny = parseInt(panel.style.top)  || 0;
      if (coordsEl) coordsEl.textContent = `x: ${nx}  y: ${ny}`;

      const currentHud = sceneState.huds.find(h => h.id === hud.id);
      if (!currentHud) return;
      const reg      = HUD_REGISTRY[hud.type];
      const newSides = reg.normalizeSides(currentHud).map((s, i) =>
        i === sideIdx ? { ...s, x: nx, y: ny } : s
      );
      const newHuds = await window.electronAPI.updateHud(hud.id, { sides: newSides });
      if (newHuds) {
        sceneState.huds = newHuds;
        scheduleAutosave();
        applyHudSelection(hud.id);
        updateHudSimulation();
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

document.getElementById('btn-refresh-hud-sim')?.addEventListener('click', () => updateHudSimulation());

if (hudSimWrap) {
  new ResizeObserver(() => { if (!ui.simDragging) updateHudSimulation(); }).observe(hudSimWrap);
}
