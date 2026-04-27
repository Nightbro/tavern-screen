import {
  sceneState, campaign, viewport, autosaveTimer, genId,
  sceneAutosaveBadge, sceneNameInput, btnRefreshScenes,
  scenesContent, hudConfigsContent,
  btnSaveHudConfig, btnRefreshHudConfigs,
  btnSaveScene, btnLoadScene, btnResetScene,
  layerDetail, initiativeEditor, elCanvasBg,
  monitorSectionBody, btnToggleMonitors,
  panelMaps, panelSettings, resizeHandleLeft, resizeHandleRight,
} from './gm-state.js';

import { loadDisplays, applySettingsToUI, renderMonitorMap } from './gm-monitor.js';
import { initLibrary }                                        from './gm-library.js';
import { initCampaigns, confirmInline }                       from './gm-campaign.js';
import { initScene, updateVpZoomUI, renderLayerList }         from './gm-layers.js';
import { renderHudList, renderHudPreview }                    from './gm-huds.js';

// ════════════════════════════════════════════════════════════════════════════
// SCENE I/O
// ════════════════════════════════════════════════════════════════════════════

function setAutosaveBadge(state) {
  sceneAutosaveBadge.dataset.state = state;
  sceneAutosaveBadge.textContent =
    state === 'saving' ? 'Saving…' :
    state === 'saved'  ? '✓ Saved' : '';
}

export function scheduleAutosave() {
  if (!sceneState.ready || !campaign.selectedId) return;
  clearTimeout(autosaveTimer);
  setAutosaveBadge('saving');
  window.autosaveTimer = setTimeout(async () => {
    const [meta] = await Promise.all([
      window.electronAPI.saveSceneCampaign(campaign.selectedId, campaign.sessionId),
      window.electronAPI.saveHudsCampaign(campaign.selectedId, campaign.sessionId),
    ]);
    if (meta) sceneState.loadedId = meta.id;
    setAutosaveBadge('saved');
    renderSceneList();
  }, 800);
}

export async function loadMostRecentScene() {
  if (!sceneState.ready || !campaign.selectedId) { renderSceneList(); return; }
  const scenes = await window.electronAPI.listScenesCampaign(campaign.selectedId, campaign.sessionId);
  if (scenes.length) {
    await applyLoadedScene(scenes[0].id);
  } else {
    sceneState.loadedId = null;
    renderSceneList();
  }
}

export async function renderSceneList() {
  scenesContent.innerHTML = '';
  if (!campaign.selectedId) return;
  const scenes = await window.electronAPI.listScenesCampaign(campaign.selectedId, campaign.sessionId);
  if (!scenes.length) return;
  for (const s of scenes) {
    scenesContent.appendChild(buildSceneRow(s));
  }
}

function buildSceneRow(s) {
  const row = document.createElement('div');
  row.className = 'scene-row' + (s.id === sceneState.loadedId ? ' active' : '');
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
    if (sceneState.loadedId === s.id) sceneState.loadedId = null;
    await window.electronAPI.deleteSceneCampaign(campaign.selectedId, campaign.sessionId, s.id);
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
      await window.electronAPI.renameSceneCampaign(campaign.selectedId, campaign.sessionId, s.id, newName);
      if (sceneState.loadedId === s.id) {
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
  const fromCampaign = typeof sceneIdOrScene === 'string';
  const scene = fromCampaign
    ? await window.electronAPI.loadSceneCampaign(campaign.selectedId, campaign.sessionId, sceneIdOrScene)
    : sceneIdOrScene;
  if (!scene) return;

  // Load HUDs from separate session file when operating inside a campaign session
  if (fromCampaign && campaign.selectedId) {
    sceneState.huds = await window.electronAPI.loadHudsCampaign(campaign.selectedId, campaign.sessionId) ?? [];
  } else {
    // Imported scene: keep current in-memory HUDs (or fall back to scene's legacy huds field)
    sceneState.huds = sceneState.huds.length ? sceneState.huds : (scene.huds ?? []);
  }

  sceneState.loadedId = scene.id ?? null;
  window.electronAPI.setScene(scene);
  sceneState.layers = scene.layers   ?? [];
  viewport.cx       = scene.viewport?.cx    ?? 4096;
  viewport.cy       = scene.viewport?.cy    ?? 4096;
  viewport.zoom     = scene.viewport?.zoom   ?? 1.0;
  sceneState.bg     = scene.background ?? '#1a1a2e';
  if (elCanvasBg) elCanvasBg.value = sceneState.bg;
  sceneNameInput.value = scene.name ?? '';
  updateVpZoomUI();
  renderLayerList();
  renderHudList();
  sceneState.selectedLayerId = null;
  sceneState.selectedHudId   = null;
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

// ════════════════════════════════════════════════════════════════════════════
// HUD CONFIGS
// ════════════════════════════════════════════════════════════════════════════

export async function renderHudConfigList() {
  hudConfigsContent.innerHTML = '';
  if (!campaign.selectedId || !campaign.sessionId) return;
  const configs = await window.electronAPI.listHudConfigs(campaign.selectedId, campaign.sessionId);
  if (!configs.length) return;
  for (const c of configs) {
    hudConfigsContent.appendChild(buildHudConfigRow(c));
  }
}

function buildHudConfigRow(c) {
  const row = document.createElement('div');
  row.className = 'scene-row' + (c.id === sceneState.loadedHudConfigId ? ' active' : '');
  row.dataset.configId = c.id;
  row.title = c.savedAt ? new Date(c.savedAt).toLocaleString() : '';

  const nameEl = document.createElement('span');
  nameEl.className = 'scene-row-name';
  nameEl.textContent = c.name || '(unnamed)';
  row.addEventListener('click', () => applyLoadedHudConfig(c.id));

  const actions = document.createElement('div');
  actions.className = 'scene-actions';

  const btnRename = document.createElement('button');
  btnRename.className = 'btn-icon-xs';
  btnRename.title = 'Rename config';
  btnRename.textContent = '✏';
  btnRename.addEventListener('click', (e) => {
    e.stopPropagation();
    startHudConfigRename(row, nameEl, c);
  });

  const btnDel = document.createElement('button');
  btnDel.className = 'btn-icon-xs danger';
  btnDel.textContent = '×';
  btnDel.title = 'Delete config';
  btnDel.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete HUD config "${c.name || '(unnamed)'}"?`)) return;
    if (sceneState.loadedHudConfigId === c.id) sceneState.loadedHudConfigId = null;
    await window.electronAPI.deleteHudConfig(campaign.selectedId, campaign.sessionId, c.id);
    renderHudConfigList();
  });

  actions.appendChild(btnRename);
  actions.appendChild(btnDel);
  row.appendChild(nameEl);
  row.appendChild(actions);
  return row;
}

function startHudConfigRename(row, nameEl, c) {
  const input = document.createElement('input');
  input.className = 'scene-row-name-input';
  input.value = c.name || '';
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  async function commit() {
    const newName = input.value.trim();
    if (newName && newName !== c.name) {
      await window.electronAPI.renameHudConfig(campaign.selectedId, campaign.sessionId, c.id, newName);
    }
    renderHudConfigList();
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = c.name || ''; input.blur(); }
  });
}

async function applyLoadedHudConfig(configId) {
  const config = await window.electronAPI.loadHudConfig(campaign.selectedId, campaign.sessionId, configId);
  if (!config?.huds) return;
  sceneState.huds = config.huds;
  sceneState.loadedHudConfigId = config.id;
  renderHudList();
  renderHudPreview();
  renderHudConfigList();
}

btnSaveHudConfig?.addEventListener('click', async () => {
  if (!campaign.selectedId || !campaign.sessionId) return;
  const input = document.createElement('input');
  input.className = 'scene-row-name-input';
  input.placeholder = 'Config name…';
  input.maxLength = 64;
  input.style.margin = '2px 8px';
  hudConfigsContent.appendChild(input);
  input.focus();

  async function commit() {
    const name = input.value.trim();
    input.remove();
    if (!name) return;
    const id = genId();
    await window.electronAPI.saveHudConfig(campaign.selectedId, campaign.sessionId, { id, name, huds: sceneState.huds });
    sceneState.loadedHudConfigId = id;
    renderHudConfigList();
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = ''; input.blur(); }
  });
});

btnRefreshHudConfigs?.addEventListener('click', renderHudConfigList);

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
    sceneState.loadedId = null;
    sceneState.layers = [];
    sceneState.huds   = [];
    viewport.cx = 4096; viewport.cy = 4096; viewport.zoom = 1.0;
    sceneState.bg = '#1a1a2e';
    if (elCanvasBg) elCanvasBg.value = sceneState.bg;
    sceneNameInput.value = '';
    updateVpZoomUI();
    renderLayerList();
    renderHudList();
    sceneState.selectedLayerId = null;
    sceneState.selectedHudId   = null;
    layerDetail.style.display      = 'none';
    initiativeEditor.style.display = 'none';
    setAutosaveBadge('');
    renderSceneList();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SETTINGS (continued)
// ════════════════════════════════════════════════════════════════════════════

// Receive persisted settings from main process on startup
window.electronAPI.onInitialSettings(async (s) => {
  applySettingsToUI(s);
  if (s.screenMode === 'advanced' && !sceneState.ready) await initScene();
});

// ════════════════════════════════════════════════════════════════════════════
// PANEL RESIZE
// ════════════════════════════════════════════════════════════════════════════

let panelResizeDrag = null;

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

export function setMonitorSectionCollapsed(collapsed) {
  monitorSectionBody.classList.toggle('collapsed', collapsed);
  btnToggleMonitors.classList.toggle('collapsed', collapsed);
}

btnToggleMonitors.addEventListener('click', () => {
  const willCollapse = !monitorSectionBody.classList.contains('collapsed');
  setMonitorSectionCollapsed(willCollapse);
  if (!willCollapse) {
    setTimeout(() => renderMonitorMap(), 0);
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
loadDisplays();
initLibrary();
initCampaigns();

// ── Window bridge (for other modules that still call via window) ──────────────
Object.assign(window, {
  scheduleAutosave,
  renderSceneList,
  loadMostRecentScene,
  renderHudConfigList,
  setMonitorSectionCollapsed,
});
