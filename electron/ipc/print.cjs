const { ipcMain, BrowserWindow } = require('electron');
const renderer = require('../print/render.cjs');

function registerPrintIPC() {
  ipcMain.handle('print:listPrinters', async () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return [];
    const printers = await win.webContents.getPrintersAsync();
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: !!p.isDefault,
      status: p.status
    }));
  });

  ipcMain.handle('print:toPDF', async (_e, payload) => renderer.toPDF(payload));
  ipcMain.handle('print:direct', async (_e, payload) => renderer.direct(payload));
}

module.exports = { registerPrintIPC };
