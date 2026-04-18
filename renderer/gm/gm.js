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

function scheduleHudAutosave() {
  if (!sceneReady || !selectedCampaignId) return;
  clearTimeout(hudAutosaveTimer);
  setAutosaveBadge('saving');
  hudAutosaveTimer = setTimeout(async () => {
    await window.electronAPI.saveHudsCampaign(selectedCampaignId, selectedSessionId);
    setAutosaveBadge('saved');
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
  const fromCampaign = typeof sceneIdOrScene === 'string';
  const scene = fromCampaign
    ? await window.electronAPI.loadSceneCampaign(selectedCampaignId, selectedSessionId, sceneIdOrScene)
    : sceneIdOrScene;
  if (!scene) return;

  // Load HUDs from separate session file when operating inside a campaign session
  if (fromCampaign && selectedCampaignId) {
    huds = await window.electronAPI.loadHudsCampaign(selectedCampaignId, selectedSessionId) ?? [];
  } else {
    // Imported scene: keep current in-memory HUDs (or fall back to scene's legacy huds field)
    huds = huds.length ? huds : (scene.huds ?? []);
  }

  loadedSceneId = scene.id ?? null;
  window.electronAPI.setScene(scene);
  layers    = scene.layers   ?? [];
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

// ════════════════════════════════════════════════════════════════════════════
// HUD CONFIGS
// ════════════════════════════════════════════════════════════════════════════

async function renderHudConfigList() {
  hudConfigsContent.innerHTML = '';
  if (!selectedCampaignId || !selectedSessionId) return;
  const configs = await window.electronAPI.listHudConfigs(selectedCampaignId, selectedSessionId);
  if (!configs.length) return;
  for (const c of configs) {
    hudConfigsContent.appendChild(buildHudConfigRow(c));
  }
}

function buildHudConfigRow(c) {
  const row = document.createElement('div');
  row.className = 'scene-row' + (c.id === loadedHudConfigId ? ' active' : '');
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
    if (loadedHudConfigId === c.id) loadedHudConfigId = null;
    await window.electronAPI.deleteHudConfig(selectedCampaignId, selectedSessionId, c.id);
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
      await window.electronAPI.renameHudConfig(selectedCampaignId, selectedSessionId, c.id, newName);
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
  const config = await window.electronAPI.loadHudConfig(selectedCampaignId, selectedSessionId, configId);
  if (!config?.huds) return;
  huds = config.huds;
  loadedHudConfigId = config.id;
  renderHudList();
  renderHudPreview();
  renderHudConfigList();
}

btnSaveHudConfig?.addEventListener('click', async () => {
  if (!selectedCampaignId || !selectedSessionId) return;
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
    await window.electronAPI.saveHudConfig(selectedCampaignId, selectedSessionId, { id, name, huds });
    loadedHudConfigId = id;
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
// SETTINGS (continued)
// ════════════════════════════════════════════════════════════════════════════

// Receive persisted settings from main process on startup
window.electronAPI.onInitialSettings(async (s) => {
  applySettingsToUI(s);
  if (s.screenMode === 'advanced' && !sceneReady) await initScene();
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

function setMonitorSectionCollapsed(collapsed) {
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
