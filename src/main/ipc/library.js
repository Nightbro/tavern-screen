// IPC handlers for the map library: root folder selection, projects, and map file operations.

// Registers all map library IPC channels on ipcMain.
function registerLibraryHandlers(ipcMain, { lib, campaignLib, manager, dialog, BrowserWindow }) {
  ipcMain.handle('get-library-root', () => campaignLib.getRootFolder());

  ipcMain.handle('scan-library',    ()                           => lib.scan());
  ipcMain.handle('create-project',  (_e, name)                  => lib.createProject(name));
  ipcMain.handle('rename-project',  (_e, oldId, newName)        => lib.renameProject(oldId, newName));
  ipcMain.handle('delete-project',  (_e, projectId)             => { lib.deleteProject(projectId); });

  ipcMain.handle('open-map-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title:      'Add Images or Video',
      properties: ['openFile', 'multiSelections'],
      filters:    [
        { name: 'All media', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'mp4', 'webm'] },
        { name: 'Images',    extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] },
        { name: 'Video',     extensions: ['mp4', 'webm'] },
      ],
    });
    return canceled ? [] : filePaths;
  });

  ipcMain.handle('open-asset-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title:      'Add Asset',
      properties: ['openFile', 'multiSelections'],
      filters:    [
        { name: 'All supported', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'pdf', 'mp4', 'webm'] },
        { name: 'Images',        extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'] },
        { name: 'Video',         extensions: ['mp4', 'webm'] },
        { name: 'Documents',     extensions: ['pdf'] },
      ],
    });
    return canceled ? [] : filePaths;
  });

  ipcMain.handle('copy-files', (_e, filePaths, projectId) => lib.copyFiles(filePaths, projectId ?? null));
  ipcMain.handle('move-map',   (_e, mapId, toProjectId)   => lib.moveMap(mapId, toProjectId ?? null));

  ipcMain.on('delete-map', (_e, mapId) => {
    lib.deleteMap(mapId);
    manager.setActiveMap(null);
  });
}

module.exports = { registerLibraryHandlers };
