const fs = require('fs');

function registerSceneHandlers(ipcMain, { manager, campaignLib, dialog, BrowserWindow }) {
  // ── In-memory scene state ──────────────────────────────────────────────────

  ipcMain.handle('get-scene',       ()              => manager.getScene());
  ipcMain.on(    'set-scene',       (_e, scene)     => manager.setScene(scene));
  ipcMain.on(    'reset-scene',     ()              => manager.resetScene());
  ipcMain.on(    'update-viewport', (_e, patch)     => manager.updateViewport(patch));
  ipcMain.on(    'send-ping',       (_e, x, y)      => manager.sendPing(x, y));
  ipcMain.on(    'update-scene-meta', (_e, patch)   => manager.updateSceneMeta(patch));

  ipcMain.handle('add-layer',      (_e, layer)      => { manager.addLayer(layer);        return manager.getScene()?.layers ?? []; });
  ipcMain.handle('update-layer',   (_e, id, patch)  => { manager.updateLayer(id, patch); return manager.getScene()?.layers ?? []; });
  ipcMain.handle('remove-layer',   (_e, id)         => { manager.removeLayer(id);        return manager.getScene()?.layers ?? []; });
  ipcMain.handle('reorder-layers', (_e, ids)        => { manager.reorderLayers(ids);     return manager.getScene()?.layers ?? []; });

  ipcMain.handle('add-hud',        (_e, hud)        => { manager.addHud(hud);            return manager.getScene()?.huds ?? []; });
  ipcMain.handle('update-hud',     (_e, id, patch)  => { manager.updateHud(id, patch);   return manager.getScene()?.huds ?? []; });
  ipcMain.handle('remove-hud',     (_e, id)         => { manager.removeHud(id);          return manager.getScene()?.huds ?? []; });

  // ── Campaign-scoped scene persistence ──────────────────────────────────────

  ipcMain.handle('save-scene-campaign', (_e, campaignId, sessionId) => {
    const scene = manager.getScene();
    if (!scene) return null;
    return campaignLib.saveScene(campaignId, sessionId, scene);
  });
  ipcMain.handle('list-scenes-campaign',   (_e, campaignId, sessionId)          => campaignLib.listScenes(campaignId, sessionId));
  ipcMain.handle('load-scene-campaign',    (_e, campaignId, sessionId, sceneId) => campaignLib.loadScene(campaignId, sessionId, sceneId));
  ipcMain.handle('delete-scene-campaign',  (_e, campaignId, sessionId, sceneId) => { campaignLib.deleteScene(campaignId, sessionId, sceneId); });
  ipcMain.handle('rename-scene-campaign',  (_e, campaignId, sessionId, sceneId, newName) => campaignLib.renameScene(campaignId, sessionId, sceneId, newName));

  // ── File dialogs ───────────────────────────────────────────────────────────

  ipcMain.handle('save-scene-dialog', async (event, scene) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title:       'Save Scene',
      defaultPath: 'scene.json',
      filters:     [{ name: 'Scene JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return false;
    try { fs.writeFileSync(filePath, JSON.stringify(scene, null, 2), 'utf8'); return true; }
    catch (_) { return false; }
  });

  ipcMain.handle('load-scene-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title:      'Load Scene',
      properties: ['openFile'],
      filters:    [{ name: 'Scene JSON', extensions: ['json'] }],
    });
    if (canceled || !filePaths.length) return null;
    try { return JSON.parse(fs.readFileSync(filePaths[0], 'utf8')); }
    catch (_) { return null; }
  });
}

module.exports = { registerSceneHandlers };
