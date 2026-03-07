/**
 * CS2 Clutch Mode — Electron Preload Script
 * 
 * Exposes a minimal API to the overlay renderer process
 * for click-through toggle and Electron-specific features.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  toggleClickThrough: () => ipcRenderer.invoke('toggle-click-through'),
  getClickThrough: () => ipcRenderer.invoke('get-click-through'),
  hotspotEnter: () => ipcRenderer.send('hotspot-enter'),
  hotspotLeave: () => ipcRenderer.send('hotspot-leave'),
  onFlashBorder: (callback) => ipcRenderer.on('flash-border', callback),
  showOverlay: () => ipcRenderer.invoke('show-overlay'),
  isElectron: true,
});
