// IPC handlers for campaigns, sessions, notes, HUDs, and active map.

// Registers all campaign-related IPC channels on ipcMain.
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

  // ── HUD Groups (named snapshots, global across all campaigns) ────────────

  ipcMain.handle('save-hud-group',   (_e, group)        => campaignLib.saveHudGroup(group));
  ipcMain.handle('list-hud-groups',  ()                 => campaignLib.listHudGroups());
  ipcMain.handle('load-hud-group',   (_e, id)           => {
    const group = campaignLib.loadHudGroup(id);
    if (group?.huds) manager.setHuds(group.huds);
    return group;
  });
  ipcMain.handle('delete-hud-group', (_e, id)           => { campaignLib.deleteHudGroup(id); });
  ipcMain.handle('rename-hud-group', (_e, id, newName)  => campaignLib.renameHudGroup(id, newName));
}

module.exports = { registerCampaignHandlers };
