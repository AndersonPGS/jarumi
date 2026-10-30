const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('j2mePiP', {
  isElectron: true,
  openCuponizze: () => ipcRenderer.invoke('open-cuponizze'),

  // Window & PiP control
  togglePiP: (options) => ipcRenderer.invoke('pip-toggle', options),
  setOpacity: (opacity) => ipcRenderer.invoke('pip-set-opacity', opacity),
  snapCorner: (corner) => ipcRenderer.invoke('pip-snap', corner),
  setPiPSize: (sizeName) => ipcRenderer.invoke('pip-set-size', sizeName),
  updateAspect: (width, height) => ipcRenderer.invoke('pip-update-aspect', { width, height }),
  setPhoneOrientation: (orientation) => ipcRenderer.invoke('phone-orientation', orientation),
  fitPhoneScreen: (geometry) => ipcRenderer.invoke('phone-fit-screen', geometry),
  getWindowState: () => ipcRenderer.invoke('pip-get-state'),

  // Window control buttons
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),

  // File system & Native dialogs
  pickJarFile: () => ipcRenderer.invoke('dialog-pick-jar'),
  exportSaveData: (jsonData) => ipcRenderer.invoke('dialog-export-save', jsonData),
  importSaveData: () => ipcRenderer.invoke('dialog-import-save'),
  openGamesFolder: () => ipcRenderer.invoke('open-games-folder'),
  saveScreenshot: (base64Data) => ipcRenderer.invoke('save-screenshot', base64Data),

  // Persistent Settings API (Disk-backed)
  loadAllSettings: () => ipcRenderer.invoke('settings-get-all'),
  saveSetting: (key, value) => ipcRenderer.invoke('settings-set', key, value),
  saveSettings: (settingsObj) => ipcRenderer.invoke('settings-set-many', settingsObj),

  // Event listeners
  onPiPChanged: (callback) => {
    ipcRenderer.on('pip-changed', (_event, state) => callback(state));
  },
  onGamesUpdated: (callback) => {
    ipcRenderer.on('games-updated', (_event, games) => callback(games));
  }
});
