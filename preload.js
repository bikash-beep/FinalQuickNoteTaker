const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getNotes: () => ipcRenderer.invoke('get-notes'),
  saveNotes: (notes) => ipcRenderer.invoke('save-notes', notes),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  confirmNewNote: () => ipcRenderer.invoke('confirm-new-note'),
  saveAs: (content) => ipcRenderer.invoke('save-as', content),
  openFile: () => ipcRenderer.invoke('open-file'),
  exportPDF: (html) => ipcRenderer.invoke('export-pdf', html),
  printNote: (html) => ipcRenderer.invoke('print-note', html),

  onMenuNewNote: (callback) => ipcRenderer.on('menu-new-note', callback),
  onMenuOpenFile: (callback) => ipcRenderer.on('menu-open-file', callback),
  onMenuSave: (callback) => ipcRenderer.on('menu-save', callback),
  onMenuSaveAs: (callback) => ipcRenderer.on('menu-save-as', callback),
  onMenuFavoriteNotes: (callback) => ipcRenderer.on('menu-favorite-notes', callback)
});