import {
  sceneState, campaign, viewport, autosaveTimer, genId,
  sceneAutosaveBadge, sceneNameInput, btnRefreshScenes,
  hudGroupsContent, btnNewHudGroup, btnRefreshHudGroups, hudGroupAutosaveBadge,
  btnSaveScene, btnLoadScene, btnResetScene,
  layerDetail, initiativeEditor, elCanvasBg,
  monitorSectionBody, btnToggleMonitors,
  panelMaps, panelSettings, resizeHandleLeft, resizeHandleRight,
} from './gm-state.js';

import { loadDisplays, applySettingsToUI, renderMonitorMap } from './gm-monitor.js';
import { initCampaigns, confirmInline }                       from './gm-campaign.js';
import { initScene, updateVpZoomUI, renderLayerList }         from './gm-layers.js';
import { renderHudList, renderHudPreview }                    from './gm-huds.js';
import { initAssets }                                         from './gm-assets.js';

// ════════════════════════════════════════════════════════════════════════════
// SCENE I/O
// ════════════════════════════════════════════════════════════════════════════

function setAutosaveBadge(state) {
  for (const el of [sceneAutosaveBadge, hudGroupAutosaveBadge]) {
    if (!el) continue;
    el.dataset.state = state;
    el.textContent = state === 'saving' ? 'Saving…' : state === 'saved' ? '✓ Saved' : '';
  }
}

export function scheduleAutosave() {
  const canSaveScene    = sceneState.ready && !!campaign.selectedId;
  const canSaveHudGroup = !!sceneState.loadedHudGroupId;
  if (!canSaveScene && !canSaveHudGroup) return;
  clearTimeout(autosaveTimer);
  setAutosaveBadge('saving');
  window.autosaveTimer = setTimeout(async () => {
    const sceneSave = canSaveScene
      ? window.electronAPI.saveSceneCampaign(campaign.selectedId, campaign.sessionId)
      : Promise.resolve(null);
    const hudGroupSave = sceneState.loadedHudGroupId
      ? window.electronAPI.saveHudGroup({
          id:   sceneState.loadedHudGroupId,
          name: sceneState.loadedHudGroupName,
          huds: sceneState.huds,
        })
      : Promise.resolve(null);
    const [meta] = await Promise.all([sceneSave, hudGroupSave]);
    if (meta) sceneState.loadedId = meta.id;
    setAutosaveBadge('saved');
    renderSceneList();
    renderHudGroupList();
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
// HUD GROUPS
// ════════════════════════════════════════════════════════════════════════════

export async function renderHudGroupList() {
  if (!hudGroupsContent) return;
  hudGroupsContent.innerHTML = '';
  const { groups } = await window.electronAPI.listHudGroups();
  if (!groups.length) return;
  for (const g of groups) hudGroupsContent.appendChild(buildHudGroupRow(g));
}

function buildHudGroupRow(g) {
  const row = document.createElement('div');
  row.className    = 'scene-row' + (g.id === sceneState.loadedHudGroupId ? ' active' : '');
  row.dataset.groupId = g.id;

  const nameEl = document.createElement('span');
  nameEl.className   = 'scene-row-name';
  nameEl.textContent = g.name || '(unnamed)';
  row.addEventListener('click', () => applyLoadedHudGroup(g.id).catch(console.error));

  const actions = document.createElement('div');
  actions.className = 'scene-actions';

  const btnRename = document.createElement('button');
  btnRename.className   = 'btn-icon-xs';
  btnRename.title       = 'Rename group';
  btnRename.textContent = '✏';
  btnRename.addEventListener('click', (e) => {
    e.stopPropagation();
    startHudGroupRename(row, nameEl, g);
  });

  const btnDel = document.createElement('button');
  btnDel.className   = 'btn-icon-xs danger';
  btnDel.textContent = '×';
  btnDel.title       = 'Delete group';
  btnDel.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete HUD group "${g.name || '(unnamed)'}"?`)) return;
    if (sceneState.loadedHudGroupId === g.id) {
      sceneState.loadedHudGroupId   = null;
      sceneState.loadedHudGroupName = null;
      sceneState.huds = [];
      renderHudList();
    }
    await window.electronAPI.deleteHudGroup(g.id);
    renderHudGroupList();
  });

  actions.appendChild(btnRename);
  actions.appendChild(btnDel);
  row.appendChild(nameEl);
  row.appendChild(actions);
  return row;
}

function startHudGroupRename(row, nameEl, g) {
  const input = document.createElement('input');
  input.className = 'scene-row-name-input';
  input.value     = g.name || '';
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  async function commit() {
    const newName = input.value.trim();
    if (newName && newName !== g.name) {
      await window.electronAPI.renameHudGroup(g.id, newName);
      if (sceneState.loadedHudGroupId === g.id) {
        sceneState.loadedHudGroupName = newName;
      }
    }
    renderHudGroupList();
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  input.blur();
    if (e.key === 'Escape') { input.value = g.name || ''; input.blur(); }
  });
}

async function applyLoadedHudGroup(groupId) {
  if (!groupId) return;
  // Flush current group before switching so no changes are lost.
  if (sceneState.loadedHudGroupId) {
    try {
      await window.electronAPI.saveHudGroup({
        id:   sceneState.loadedHudGroupId,
        name: sceneState.loadedHudGroupName,
        huds: sceneState.huds,
      });
    } catch (e) { /* ignore flush errors — proceed with load */ }
  }
  let group;
  try {
    group = await window.electronAPI.loadHudGroup(groupId);
  } catch (e) {
    console.error('[HUD] loadHudGroup failed:', e);
    return;
  }
  if (!group) return;
  sceneState.huds              = group.huds ?? [];
  sceneState.loadedHudGroupId   = group.id ?? groupId;
  sceneState.loadedHudGroupName = group.name ?? '';
  renderHudList();
  renderHudPreview();
  renderHudGroupList();
}

export async function loadMostRecentHudGroup() {
  const { lastActiveId, groups } = await window.electronAPI.listHudGroups();
  if (!groups.length) return;
  const targetId = lastActiveId && groups.some(g => g.id === lastActiveId)
    ? lastActiveId
    : groups[0].id;
  await applyLoadedHudGroup(targetId);
}

btnNewHudGroup?.addEventListener('click', () => {
  const input = document.createElement('input');
  input.className    = 'scene-row-name-input';
  input.placeholder  = 'Group name…';
  input.maxLength    = 64;
  input.style.margin = '2px 8px';
  hudGroupsContent.prepend(input);
  input.focus();

  async function commit() {
    const name = input.value.trim();
    input.remove();
    if (!name) return;
    const id = genId();
    await window.electronAPI.saveHudGroup({ id, name, huds: [] });
    await applyLoadedHudGroup(id);
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  input.blur();
    if (e.key === 'Escape') { input.value = ''; input.blur(); }
  });
});

btnRefreshHudGroups?.addEventListener('click', renderHudGroupList);

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
    viewport.cx = 4096; viewport.cy = 4096; viewport.zoom = 1.0;
    sceneState.bg = '#1a1a2e';
    if (elCanvasBg) elCanvasBg.value = sceneState.bg;
    sceneNameInput.value = '';
    updateVpZoomUI();
    renderLayerList();
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
initCampaigns();
initAssets();
renderHudGroupList();
loadMostRecentHudGroup();

// ── Window bridge (for other modules that still call via window) ──────────────
Object.assign(window, {
  scheduleAutosave,
  renderSceneList,
  loadMostRecentScene,
  renderHudGroupList,
  loadMostRecentHudGroup,
  setMonitorSectionCollapsed,
});
