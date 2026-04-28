// IPC handlers for assets (global and campaign-scoped).

// Registers all asset-related IPC channels on ipcMain.
function registerAssetHandlers(ipcMain, { campaignLib }) {
  ipcMain.handle('list-asset-types',  ()                                      => campaignLib.listAssetTypes());
  ipcMain.handle('add-asset-type',    (_e, typeName)                          => campaignLib.addAssetType(typeName));
  ipcMain.handle('remove-asset-type', (_e, typeName)                          => campaignLib.removeAssetType(typeName));

  ipcMain.handle('list-assets',   (_e, campaignId)                            => campaignLib.listAssets(campaignId ?? null));
  ipcMain.handle('create-asset',  (_e, name, type, filePath, campaignId)      => campaignLib.createAsset(name, type, filePath, campaignId ?? null));
  ipcMain.handle('update-asset',  (_e, id, patch, campaignId)                 => campaignLib.updateAsset(id, patch, campaignId ?? null));
  ipcMain.handle('delete-asset',  (_e, id, campaignId)                        => { campaignLib.deleteAsset(id, campaignId ?? null); });
  ipcMain.handle('move-asset',    (_e, id, fromCampaignId, toCampaignId)      => campaignLib.moveAsset(id, fromCampaignId ?? null, toCampaignId ?? null));
}

module.exports = { registerAssetHandlers };
