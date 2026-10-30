const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { startServer, scanGames, extractJarMetadata } = require('./server');

// Keep existing progress when upgrading from the previous application name.
app.setName('Jarumi');
const jarumiProfile = path.join(app.getPath('appData'), 'Jarumi');
const legacyProfile = path.join(app.getPath('appData'), 'J2ME PiP Emulator');
try {
  if (!fs.existsSync(jarumiProfile) && fs.existsSync(legacyProfile)) {
    const stagedProfile = jarumiProfile + '.migration';
    fs.cpSync(legacyProfile, stagedProfile, { recursive: true, filter: source => !['Cache','Code Cache','GPUCache','DawnGraphiteCache','DawnWebGPUCache','Crashpad','SingletonLock','SingletonCookie','SingletonSocket','lockfile'].includes(path.basename(source)) });
    fs.renameSync(stagedProfile, jarumiProfile);
  }
  app.setPath('userData', jarumiProfile);
} catch (error) {
  // Never strand existing saves if migration is interrupted or locked.
  if (fs.existsSync(legacyProfile)) app.setPath('userData', legacyProfile);
  console.warn('[Jarumi] Using existing profile after migration error:', error.message);
}


// Prevent background throttling so game loops, canvas rendering and timers never freeze
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

const { gamesDir: GAMES_DIR, screenshotsDir: SCREENSHOTS_DIR } = require('./paths');
let SETTINGS_FILE = null;

function getSettingsPath() {
  if (!SETTINGS_FILE) {
    try {
      SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
    } catch (e) {
      SETTINGS_FILE = path.join(__dirname, 'settings.json');
    }
  }
  return SETTINGS_FILE;
}

function loadSettingsFile() {
  try {
    const p = getSettingsPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (err) {
    console.warn('Failed to read settings file:', err);
  }
  return {};
}

function nativeText(source) {
  const saved = loadSettingsFile().jarumi_language;
  const locale = saved === 'es' ? 'es' : saved === 'en' ? 'en' : 'pt-BR';
  return require('./locales/' + locale + '.json')[source] || source;
}

function saveSettingsFile(settings) {
  try {
    const p = getSettingsPath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.warn('Failed to write settings file:', err);
  }
}

let mainWindow = null;
let serverInfo = null;
let isPiP = false;
let pipOpacity = 1.0;
let gameAspect = { width: 240, height: 320 };
let phoneOrientation = 'portrait';
let requestedPhoneOrientation = 'portrait';
const phoneSizes = { portrait: { width: 400, height: 820 }, landscape: { width: 640, height: 720 } };

let normalBounds = {
  width: 400,
  height: 820,
  x: undefined,
  y: undefined
};

let pipBounds = {
  width: 320,
  height: 426,
  x: undefined,
  y: undefined
};

// Calculate corner position based on current display's workArea
function getCornerPosition(corner, width, height) {
  const currentBounds = mainWindow.getBounds();
  const currentDisplay = screen.getDisplayMatching(currentBounds);
  const workArea = currentDisplay.workArea;
  const margin = 20;

  switch (corner) {
    case 'top-left':
      return { x: workArea.x + margin, y: workArea.y + margin };
    case 'top-right':
      return { x: workArea.x + workArea.width - width - margin, y: workArea.y + margin };
    case 'bottom-left':
      return { x: workArea.x + margin, y: workArea.y + workArea.height - height - margin };
    case 'bottom-right':
    default:
      return { x: workArea.x + workArea.width - width - margin, y: workArea.y + workArea.height - height - margin };
  }
}

function setPhoneOrientation(orientation) {
  if (orientation !== 'portrait' && orientation !== 'landscape') return false;
  requestedPhoneOrientation = orientation;
  if (!mainWindow || isPiP || phoneOrientation === orientation) return true;

  const current = mainWindow.getBounds();
  phoneSizes[phoneOrientation] = { width: current.width, height: current.height };
  const area = screen.getDisplayMatching(current).workArea;
  const desired = phoneSizes[orientation];
  const width = Math.min(desired.width, area.width);
  const height = Math.min(desired.height, area.height);
  const x = Math.max(area.x, Math.min(Math.round(current.x + (current.width - width) / 2), area.x + area.width - width));
  const y = Math.max(area.y, Math.min(Math.round(current.y + (current.height - height) / 2), area.y + area.height - height));
  phoneOrientation = orientation;
  mainWindow.setMinimumSize(orientation === 'landscape' ? 560 : 350, orientation === 'landscape' ? 580 : 600);
  mainWindow.setBounds({ x, y, width, height });
  normalBounds = mainWindow.getBounds();
  return true;
}

// Toggle between Normal Mode and Floating/PiP Mode
function togglePiP(options = {}) {
  if (!mainWindow) return;

  if (options && options.aspectWidth && options.aspectHeight) {
    gameAspect = { width: options.aspectWidth, height: options.aspectHeight };
  }

  isPiP = !isPiP;
  const ratio = (gameAspect.width && gameAspect.height) ? (gameAspect.width / gameAspect.height) : (240 / 320);

  if (isPiP) {
    // Save normal window bounds
    normalBounds = mainWindow.getBounds();

    // Calculate PiP dimensions strictly based on game aspect ratio
    const targetHeight = 440;
    const targetWidth = Math.round(targetHeight * ratio);
    pipBounds.width = Math.max(180, targetWidth);
    pipBounds.height = targetHeight;

    const pos = getCornerPosition('bottom-right', pipBounds.width, pipBounds.height);
    pipBounds.x = pos.x;
    pipBounds.y = pos.y;

    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setMinimumSize(160, Math.round(160 / ratio));
    mainWindow.setBounds(pipBounds, true);
    mainWindow.setOpacity(pipOpacity);

    // Lock aspect ratio during resize in PiP mode!
    mainWindow.setAspectRatio(ratio);
  } else {
    // Restore normal window
    pipBounds = mainWindow.getBounds();

    // Release aspect ratio constraint
    mainWindow.setAspectRatio(0);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setOpacity(1.0);
    mainWindow.setMinimumSize(phoneOrientation === 'landscape' ? 560 : 350, phoneOrientation === 'landscape' ? 580 : 600);
    mainWindow.setBounds(normalBounds, true);
    setPhoneOrientation(requestedPhoneOrientation);
  }

  mainWindow.webContents.send('pip-changed', {
    isPiP,
    opacity: pipOpacity,
    bounds: mainWindow.getBounds(),
    aspectRatio: ratio
  });

  return isPiP;
}

// Create the browser window
async function createWindow() {
  serverInfo = serverInfo || await startServer(8765);

  mainWindow = new BrowserWindow({
    width: normalBounds.width,
    height: normalBounds.height,
    minWidth: 350,
    minHeight: 600,
    title: 'Jarumi',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    },
    icon: path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png')
  });

  mainWindow.center();
  normalBounds = mainWindow.getBounds();

  const url = `http://127.0.0.1:${serverInfo.port}/index.html`;
  mainWindow.loadURL(url);

  // Setup F10 hotkey for instant PiP toggle
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F10') {
      event.preventDefault();
      togglePiP();
    }
  });

  mainWindow.on('resize', () => {
    if (!mainWindow) return;
    if (isPiP) {
      pipBounds = mainWindow.getBounds();
    } else {
      normalBounds = mainWindow.getBounds();
    }
  });

  mainWindow.on('move', () => {
    if (!mainWindow) return;
    if (isPiP) {
      pipBounds = mainWindow.getBounds();
    } else {
      normalBounds = mainWindow.getBounds();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  setupGamesFolderWatcher();
}

let watcherDebounce = null;
function setupGamesFolderWatcher() {
  if (!fs.existsSync(GAMES_DIR)) {
    fs.mkdirSync(GAMES_DIR, { recursive: true });
  }

  try {
    fs.watch(GAMES_DIR, (eventType, filename) => {
      if (!filename || !filename.toLowerCase().endsWith('.jar')) return;

      clearTimeout(watcherDebounce);
      watcherDebounce = setTimeout(async () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.log(`[Watcher] Change detected in games folder: ${filename}`);
          const games = await scanGames();
          mainWindow.webContents.send('games-updated', games);
        }
      }, 500);
    });
  } catch (err) {
    console.error('Failed to setup games folder watcher:', err);
  }
}

// Register IPC handlers
function registerIpcHandlers() {
  ipcMain.handle('open-cuponizze', () => shell.openExternal('https://cuponizze.com/')); 
  ipcMain.handle('phone-fit-screen', (_event, geometry) => {
    if (!mainWindow || isPiP || !geometry) return false;
    const {ratio, chrome, sides} = geometry;
    if (![ratio,chrome,sides].every(Number.isFinite) || ratio <= 0 || chrome < 0 || sides < 0) return false;
    const bounds=mainWindow.getBounds();
    const area=screen.getDisplayMatching(bounds).workArea;
    let width=Math.min(bounds.width,area.width);
    let height=Math.round((width-sides)/ratio+chrome);
    if(height>area.height){height=area.height;width=Math.round((height-chrome)*ratio+sides);}
    width=Math.max(240,Math.min(width,area.width));
    height=Math.max(320,Math.min(height,area.height));
    if(Math.abs(width-bounds.width)<2 && Math.abs(height-bounds.height)<2)return true;
    mainWindow.setMinimumSize(240,320);
    mainWindow.setBounds({width,height,x:Math.max(area.x,Math.min(bounds.x,area.x+area.width-width)),y:Math.max(area.y,Math.min(bounds.y,area.y+area.height-height))});
    normalBounds=mainWindow.getBounds();return true;
  });
  ipcMain.handle('phone-orientation', (_event, orientation) => setPhoneOrientation(orientation));
  ipcMain.handle('pip-toggle', (_event, options) => {
    return togglePiP(options);
  });

  ipcMain.handle('pip-update-aspect', (_event, { width, height }) => {
    if (width > 0 && height > 0) {
      gameAspect = { width, height };
      const ratio = width / height;
      if (mainWindow && isPiP) {
        mainWindow.setAspectRatio(ratio);
        const bounds = mainWindow.getBounds();
        const area = screen.getDisplayMatching(bounds).workArea;
        const newHeight = Math.max(1, Math.min(bounds.height, area.height, Math.floor(area.width / ratio)));
        const newWidth = Math.round(newHeight * ratio);
        const x = Math.max(area.x, Math.min(bounds.x, area.x + area.width - newWidth));
        const y = Math.max(area.y, Math.min(bounds.y, area.y + area.height - newHeight));
        mainWindow.setBounds({ x, y, width: newWidth, height: newHeight }, true);
        pipBounds = mainWindow.getBounds();
      }
    }
    return true;
  });

  ipcMain.handle('pip-set-opacity', (_event, opacity) => {
    pipOpacity = Math.max(0.3, Math.min(1.0, parseFloat(opacity) || 1.0));
    if (mainWindow && isPiP) {
      mainWindow.setOpacity(pipOpacity);
    }
    return pipOpacity;
  });

  ipcMain.handle('pip-snap', (_event, corner) => {
    if (!mainWindow) return false;
    const currentBounds = mainWindow.getBounds();
    const pos = getCornerPosition(corner, currentBounds.width, currentBounds.height);
    mainWindow.setBounds({
      x: pos.x,
      y: pos.y,
      width: currentBounds.width,
      height: currentBounds.height
    }, true);
    if (isPiP) {
      pipBounds = mainWindow.getBounds();
    }
    return true;
  });

  ipcMain.handle('pip-set-size', (_event, sizeName) => {
    if (!mainWindow) return false;
    const ratio = (gameAspect.width && gameAspect.height) ? (gameAspect.width / gameAspect.height) : (240 / 320);
    let height = 440;
    if (sizeName === 'small') height = 320;
    if (sizeName === 'medium') height = 440;
    if (sizeName === 'large') height = 580;
    const width = Math.round(height * ratio);

    const currentBounds = mainWindow.getBounds();
    mainWindow.setBounds({
      x: currentBounds.x,
      y: currentBounds.y,
      width,
      height
    }, true);
    if (isPiP) {
      pipBounds = mainWindow.getBounds();
    }
    return true;
  });

  ipcMain.handle('pip-get-state', () => {
    return {
      isPiP,
      opacity: pipOpacity,
      bounds: mainWindow ? mainWindow.getBounds() : null
    };
  });

  ipcMain.handle('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.handle('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('dialog-pick-jar', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: nativeText('Importar Jogo .JAR (J2ME)'),
      filters: [
        { name: nativeText('Jogos Java (J2ME)'), extensions: ['jar'] },
        { name: nativeText('Todos os arquivos'), extensions: ['*'] }
      ],
      properties: ['openFile', 'multiSelections']
    });

    if (result.canceled || !result.filePaths.length) {
      return { success: false, imported: [] };
    }

    const imported = [];
    for (const sourcePath of result.filePaths) {
      try {
        const filename = path.basename(sourcePath);
        const targetPath = path.join(GAMES_DIR, filename);
        fs.copyFileSync(sourcePath, targetPath);
        const buffer = fs.readFileSync(targetPath);
        const meta = await extractJarMetadata(filename, buffer);
        imported.push(meta);
      } catch (err) {
        console.error('Failed to import file:', sourcePath, err);
      }
    }

    const games = await scanGames();
    return { success: true, imported, allGames: games };
  });

  ipcMain.handle('open-games-folder', async () => {
    if (!fs.existsSync(GAMES_DIR)) {
      fs.mkdirSync(GAMES_DIR, { recursive: true });
    }
    await shell.openPath(GAMES_DIR);
    return true;
  });

  ipcMain.handle('dialog-export-save', async (_event, jsonData) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: nativeText('Exportar Backup de Saves J2ME (RMS)'),
      defaultPath: `j2me_saves_backup_${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: nativeText('Arquivo JSON'), extensions: ['json'] }]
    });

    if (result.canceled || !result.filePath) return { success: false };

    try {
      fs.writeFileSync(result.filePath, jsonData, 'utf-8');
      return { success: true, filePath: result.filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('dialog-import-save', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: nativeText('Importar Backup de Saves J2ME (RMS)'),
      filters: [{ name: nativeText('Arquivo JSON'), extensions: ['json'] }],
      properties: ['openFile']
    });

    if (result.canceled || !result.filePaths.length) return { success: false };

    try {
      const content = fs.readFileSync(result.filePaths[0], 'utf-8');
      return { success: true, data: JSON.parse(content) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('save-screenshot', async (_event, base64Data) => {
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }

    const filename = `screenshot_${Date.now()}.png`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);

    try {
      const data = base64Data.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
      return { success: true, filepath, filename };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Persistent Settings API
  ipcMain.handle('settings-get-all', () => {
    return loadSettingsFile();
  });

  ipcMain.handle('settings-set', (_event, key, value) => {
    const current = loadSettingsFile();
    current[key] = value;
    saveSettingsFile(current);
    return true;
  });

  ipcMain.handle('settings-set-many', (_event, obj) => {
    const current = loadSettingsFile();
    Object.assign(current, obj);
    saveSettingsFile(current);
    return true;
  });
}

const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } });
app.whenReady().then(() => {
  if (!primaryInstance) return;
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
