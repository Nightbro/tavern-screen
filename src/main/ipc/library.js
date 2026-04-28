// IPC handlers for the map library: root folder selection, projects, and map file operations.

// Registers all map library IPC channels on ipcMain.
function registerLibraryHandlers(ipcMain, { lib, campaignLib, manager, dialog, BrowserWindow }) {
  ipcMain.handle('get-library-root', () => lib.getRootFolder());

  ipcMain.handle('select-root-folder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title:      'Select Maps Root Folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (canceled) return null;
    lib.setRootFolder(filePaths[0]);
    campaignLib.setRootFolder(filePaths[0]);
    return filePaths[0];
  });

  ipcMain.handle('scan-library',    ()                           => lib.scan());
  ipcMain.handle('create-project',  (_e, name)                  => lib.createProject(name));
  ipcMain.handle('rename-project',  (_e, oldId, newName)        => lib.renameProject(oldId, newName));
  ipcMain.handle('delete-project',  (_e, projectId)             => { lib.deleteProject(projectId); });

  ipcMain.handle('open-map-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title:      'Add Images',
      properties: ['openFile', 'multiSelections'],
      filters:    [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
    });
    return canceled ? [] : filePaths;
  });

  ipcMain.handle('open-asset-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title:      'Add Asset',
      properties: ['openFile', 'multiSelections'],
      filters:    [
        { name: 'All supported', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'pdf'] },
        { name: 'Images',        extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'] },
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
