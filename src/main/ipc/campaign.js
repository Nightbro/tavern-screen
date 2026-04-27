function registerCampaignHandlers(ipcMain, { campaignLib, manager }) {
  ipcMain.handle('scan-campaigns',   ()                                  => campaignLib.scan());
  ipcMain.handle('create-campaign',  (_e, name)                         => campaignLib.createCampaign(name));
  ipcMain.handle('rename-campaign',  (_e, oldId, newName)               => campaignLib.renameCampaign(oldId, newName));
  ipcMain.handle('delete-campaign',  (_e, id)                           => { campaignLib.deleteCampaign(id); });
  ipcMain.handle('create-session',   (_e, campaignId, name)             => campaignLib.createSession(campaignId, name));
  ipcMain.handle('rename-session',   (_e, campaignId, oldId, newName)   => campaignLib.renameSession(campaignId, oldId, newName));
  ipcMain.handle('delete-session',   (_e, campaignId, id)               => { campaignLib.deleteSession(campaignId, id); });

  ipcMain.handle('read-campaign-notes',  (_e, campaignId)                      => campaignLib.readCampaignNotes(campaignId));
  ipcMain.handle('write-campaign-notes', (_e, campaignId, content)              => { campaignLib.writeCampaignNotes(campaignId, content); });
  ipcMain.handle('read-notes',           (_e, campaignId, sessionId)            => campaignLib.readNotes(campaignId, sessionId));
  ipcMain.handle('write-notes',          (_e, campaignId, sessionId, content)   => { campaignLib.writeNotes(campaignId, sessionId, content); });

  ipcMain.on('set-active-map', (_e, map) => manager.setActiveMap(map ?? null));

  // ── HUD live state ─────────────────────────────────────────────────────────

  ipcMain.handle('save-huds-campaign', (_e, campaignId, sessionId) => {
    campaignLib.saveHuds(campaignId, sessionId, manager.getHuds());
  });

  ipcMain.handle('load-huds-campaign', (_e, campaignId, sessionId) => {
    const huds = campaignLib.loadHuds(campaignId, sessionId);
    manager.setHuds(huds);
    return huds;
  });

  // ── HUD configs (named snapshots) ─────────────────────────────────────────

  ipcMain.handle('save-hud-config',   (_e, campaignId, sessionId, config) =>
    campaignLib.saveHudConfig(campaignId, sessionId, config)
  );
  ipcMain.handle('list-hud-configs',  (_e, campaignId, sessionId) =>
    campaignLib.listHudConfigs(campaignId, sessionId)
  );
  ipcMain.handle('load-hud-config',   (_e, campaignId, sessionId, configId) => {
    const config = campaignLib.loadHudConfig(campaignId, sessionId, configId);
    if (config?.huds) {
      manager.setHuds(config.huds);
      campaignLib.saveHuds(campaignId, sessionId, config.huds);
    }
    return config;
  });
  ipcMain.handle('delete-hud-config', (_e, campaignId, sessionId, configId) => {
    campaignLib.deleteHudConfig(campaignId, sessionId, configId);
  });
  ipcMain.handle('rename-hud-config', (_e, campaignId, sessionId, configId, newName) =>
    campaignLib.renameHudConfig(campaignId, sessionId, configId, newName)
  );
}

module.exports = { registerCampaignHandlers };
