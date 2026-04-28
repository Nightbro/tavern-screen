// IPC handlers for display selection, settings updates, and screen preview.

// Registers all display-related IPC channels on ipcMain.
function registerDisplayHandlers(ipcMain, { manager, config }) {
  ipcMain.handle('get-displays',  ()        => manager.getDisplays());
  ipcMain.on('select-display',    (_e, id)  => manager.selectDisplay(id));
  ipcMain.on('close-screen',      ()        => manager.closeScreen());

  ipcMain.on('update-settings', (_e, patch) => {
    manager.updateSettings(patch);
    config.set('settings', manager.getSettings());
  });

  ipcMain.on('request-preview', () => manager.capturePreview());
}

module.exports = { registerDisplayHandlers };
