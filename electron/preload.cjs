const { contextBridge, ipcRenderer } = require('electron');

// Explicit allowlist. No generic invoke() escape hatch.
contextBridge.exposeInMainWorld('api', {
  print: {
    listPrinters: () => ipcRenderer.invoke('print:listPrinters'),
    toPDF: (payload) => ipcRenderer.invoke('print:toPDF', payload),
    direct: (payload) => ipcRenderer.invoke('print:direct', payload)
  },
  templates: {
    list: () => ipcRenderer.invoke('templates:list'),
    load: (id) => ipcRenderer.invoke('templates:load', id),
    save: (tpl) => ipcRenderer.invoke('templates:save', tpl),
    remove: (id) => ipcRenderer.invoke('templates:remove', id),
    duplicate: (id) => ipcRenderer.invoke('templates:duplicate', id)
  },
  app: {
    version: () => ipcRenderer.invoke('app:version'),
    openFile: (opts) => ipcRenderer.invoke('app:openFile', opts || {}),
    openUserData: () => ipcRenderer.invoke('app:openUserData')
  }
});
