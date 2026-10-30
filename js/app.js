// Persistent Unified Storage: Disk-backed (Electron) + localStorage fallback
const Storage = {
  cache: {},
  async init() {
    if (window.j2mePiP?.loadAllSettings) {
      try {
        const diskSettings = await window.j2mePiP.loadAllSettings();
        if (diskSettings && typeof diskSettings === 'object') {
          for (const [k, v] of Object.entries(diskSettings)) {
            this.cache[k] = v;
            try {
              localStorage.setItem(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
            } catch (e) {}
          }
        }
      } catch (e) {
        console.warn('Error loading disk settings:', e);
      }
    }
  },

  get(key, defaultVal = null) {
    try {
      const local = localStorage.getItem(key);
      if (local !== null && local !== '') return local;
    } catch (e) {}
    if (this.cache[key] !== undefined && this.cache[key] !== null) {
      return typeof this.cache[key] === 'object' ? JSON.stringify(this.cache[key]) : String(this.cache[key]);
    }
    return defaultVal;
  },

  set(key, val) {
    this.cache[key] = val;
    const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
    try {
      localStorage.setItem(key, strVal);
    } catch (e) {}

    if (window.j2mePiP?.saveSetting) {
      window.j2mePiP.saveSetting(key, val).catch(() => {});
    }
  }
};

// Main Application Controller: Navigation, PiP Coordinator, Audio, Shortcuts, Keymap HUD, Toasts
const App = {
  isPiP: false,
  isPaused: false,
  currentSpeed: 1.0,
  volume: 0.8,
  isMuted: false,
  isKeymapHUDOpen: false,
  isKeymapPersistent: false,
  hasAutoLaunched: false,
  currentView: 'library',

  async init() {
    await this.ensureHealthyIndexedDB();
    await Storage.init();
    I18n.init();
    JarumiUI.init();
    this.loadAudioSettings();
    this.setupWindowControls();
    this.setupNavigation();
    this.setupAudioControls();
    this.setupPiPControls();
    this.setupEmulatorControls();
    this.setupTextInputDialog();
    this.setupKeymapHUD();
    this.setupShortcuts();
    this.setupFocusManagement();

    // Initialize submodules
    await Library.init();
    Controls.init();
    Video.init();
    Saves.init();

    // Listen for PiP events from Electron
    if (window.j2mePiP?.onPiPChanged) {
      window.j2mePiP.onPiPChanged((state) => {
        this.updatePiPState(state.isPiP);
      });
    }

    // Handle messages coming from player iframe
    window.addEventListener('message', (e) => {
      const msg = e.data;
      if (!msg) return;

      if (msg.type === 'toggle-pip') {
        this.togglePiP();
      } else if (msg.type === 'player-ready') {
        this.syncVolumeToIframe();
        Controls.syncWithPlayer();
      } else if (msg.type === 'toggle-pip-menu') {
        this.togglePiPFloatingMenu();
      } else if (msg.type === 'screenshot-ready' && msg.dataUrl) {
        this.handleScreenshotReady(msg.dataUrl);
      } else if (msg.type === 'canvas-resized') {
        const hudRes = document.getElementById('hud-resolution');
        if (hudRes && msg.width && msg.height) {
          hudRes.textContent = `${msg.width}x${msg.height}`;
        }
        if (msg.width && msg.height) {
          Video.setNativeResolution(msg.width, msg.height);
        }
      } else if (msg.type === 'global-keydown') {
        this.handleGlobalKeyDown(msg.key, msg.code);
      } else if (msg.type === 'global-keyup') {
        this.handleGlobalKeyUp(msg.key, msg.code);
      }
    });

    // Auto-launch last played game fallback timer
    setTimeout(() => {
      if (!this.hasAutoLaunched) {
        this.autoLaunchGame();
      }
    }, 600);
  },

  ensureHealthyIndexedDB() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('j2me_asyncStorage_v1');
        req.onsuccess = (e) => {
          const db = e.target.result;
          if (db.version > 0 && !db.objectStoreNames.contains('fs4')) {
            console.warn('Repairing corrupted empty j2me_asyncStorage_v1 database...');
            db.close();
            const del = indexedDB.deleteDatabase('j2me_asyncStorage_v1');
            del.onsuccess = () => resolve();
            del.onerror = () => resolve();
          } else {
            db.close();
            resolve();
          }
        };
        req.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  },

  loadAudioSettings() {
    try {
      const savedVol = Storage.get('j2me_volume');
      this.volume = savedVol !== null ? parseFloat(savedVol) : 0.8;
      this.isMuted = Storage.get('j2me_muted') === 'true';
    } catch (e) {
      this.volume = 0.8;
      this.isMuted = false;
    }
    this.updateAudioUI();
  },

  autoLaunchGame() {
    if (this.hasAutoLaunched) return;
    if (Library.games.length === 0 || Library.currentGame) return;

    const autoOpen = Storage.get('j2me_auto_open_last') === 'true';
    const lastPlayed = Storage.get('j2me_last_played');

    if (autoOpen && lastPlayed) {
      const game = Library.games.find(g => g.filename === lastPlayed);
      if (game) {
        this.hasAutoLaunched = true;
        Library.playGame(game);
        return;
      }
    }

    // Fallback: Bounce Tales or first game if auto-open is enabled
    if (autoOpen && Library.games.length > 0) {
      const bounce = Library.games.find(g => g.filename.toLowerCase().includes('bounce')) || Library.games[0];
      if (bounce) {
        this.hasAutoLaunched = true;
        Library.playGame(bounce);
      }
    }
  },

  setupWindowControls() {
    const btnMin = document.getElementById('win-btn-min');
    const btnMax = document.getElementById('win-btn-max');
    const btnClose = document.getElementById('win-btn-close');

    if (btnMin) btnMin.addEventListener('click', () => window.j2mePiP?.minimize());
    if (btnMax) btnMax.addEventListener('click', () => window.j2mePiP?.maximize());
    if (btnClose) btnClose.addEventListener('click', () => window.j2mePiP?.close());
  },

  setupNavigation() {
    const header=document.getElementById('titlebar');
    this.headerAnchor=document.createComment('status-bar-home');header.before(this.headerAnchor);
    for(const [id,cls,label] of [['game-status-toggle','game-status-open','barra de status'],['game-task-toggle','game-task-open','barra de ações']]){
      document.getElementById(id).addEventListener('click',()=>{
        const open=document.body.classList.toggle(cls);
        if(cls==='game-task-open')document.documentElement.style.setProperty('--game-task-height',document.getElementById('game-taskbar').offsetHeight+'px');
        const button=document.getElementById(id);button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',(open?'Recolher ':'Mostrar ')+label);
      });
    }

    document.getElementById('btn-home')?.addEventListener('click', () => this.switchTab('library'));
    document.getElementById('btn-back-settings')?.addEventListener('click', () => this.switchTab('settings'));
    document.getElementById('launcher-resume')?.addEventListener('click', () => this.switchTab('player'));
    document.getElementById('launcher-settings')?.addEventListener('click', () => this.switchTab('settings'));
    document.getElementById('launcher-import')?.addEventListener('click', () => document.getElementById('btn-import-jar')?.click());
    document.getElementById('settings-open-folder')?.addEventListener('click', () => document.getElementById('btn-open-folder')?.click());
    document.querySelectorAll('[data-open-view]').forEach(button => button.addEventListener('click', () => this.switchTab(button.dataset.openView)));
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const targetView = tab.getAttribute('data-view');
        this.switchTab(targetView);
      });
    });
  },

  /* ----------------------------------------------------------
     FOCUS & CLICK MANAGEMENT
     Prevents buttons from trapping keyboard focus and ensures
     clicking anywhere on the screen immediately refocuses the game.
     ---------------------------------------------------------- */
  setupFocusManagement() {
    const focusGame = () => {
      const isInput = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
      if (isInput) return;

      const iframe = document.getElementById('game-iframe');
      if (iframe) {
        iframe.focus();
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.postMessage({ type: 'focus-canvas' }, '*');
        } catch (err) {}
      }
    };

    // 1. Click on viewport, letterbox, or player section immediately refocuses the game
    document.getElementById('game-viewport-container')?.addEventListener('pointerdown', focusGame);
    document.getElementById('game-frame-wrap')?.addEventListener('pointerdown', focusGame);
    document.getElementById('view-player')?.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('button, input, textarea, select, .pip-floating-bar, .player-bottom-dock, .modal-dialog, #text-input-dialog')) {
        focusGame();
      }
    });

    // 2. Automatically blur any UI button on release and return focus to the game
    document.addEventListener('mouseup', (e) => {
      const btn = e.target.closest('button, .nav-tab, .pip-pill-btn, .action-btn, .hud-btn');
      if (btn) {
        setTimeout(() => {
          btn.blur();
          if (this.currentView === 'player' || this.isPiP) {
            focusGame();
          }
        }, 15);
      }
    });
  },

  switchTab(viewName) {
    if(this.currentView !== viewName){
      document.body.classList.remove('game-status-open','game-task-open');
      for(const [id,label] of [['game-status-toggle','barra de status'],['game-task-toggle','barra de ações']]){const b=document.getElementById(id);b?.setAttribute('aria-expanded','false');b?.setAttribute('aria-label','Mostrar '+label);}
    }
    const header=document.getElementById('titlebar');
    if(viewName==='player')document.getElementById('view-player').prepend(header);
    else if(this.headerAnchor)this.headerAnchor.after(header);
    this.currentView = viewName;
    document.body.dataset.view = viewName;
    if (typeof Video !== 'undefined') Video.updatePhoneOrientation();
    document.getElementById('launcher-resume')?.classList.toggle('hidden', !Library.currentGame);
    const titles = {languages:'IDIOMA', themes: 'APARÊNCIA', library: 'INÍCIO', settings: 'AJUSTES', player: 'JOGANDO', controls: 'CONTROLES', video: 'TELA E ÁUDIO', saves: 'PROGRESSO'};
    document.getElementById('screen-title').textContent = titles[viewName] || 'J2ME';
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-view') === viewName);
    });

    document.querySelectorAll('.view-panel').forEach(p => {
      p.classList.toggle('active', p.id === `view-${viewName}`);
    });

    // If switching to player, give focus to iframe
    if (viewName === 'player') {
      setTimeout(() => {
        document.getElementById('game-iframe')?.focus();
      }, 100);
    } else if (viewName === 'saves') {
      if (typeof Saves !== 'undefined' && Saves.refreshStoresList) {
        Saves.refreshStoresList();
      }
    }
  },

  /* ----------------------------------------------------------
     AUDIO & VOLUME CONTROLLER
     ---------------------------------------------------------- */
  setupAudioControls() {
    const titleSlider = document.getElementById('volume-slider');
    const dockSlider = document.getElementById('dock-volume-slider');
    const pipSlider = document.getElementById('pip-floating-volume');

    const titleMute = document.getElementById('btn-volume-mute');
    const dockMute = document.getElementById('dock-btn-mute');
    const pipMute = document.getElementById('pip-btn-mute');

    // Update UI elements to current settings
    this.updateAudioUI();

    const onSliderChange = (e) => {
      const val = parseFloat(e.target.value);
      this.setVolume(val);
    };

    if (titleSlider) titleSlider.addEventListener('input', onSliderChange);
    if (dockSlider) dockSlider.addEventListener('input', onSliderChange);
    if (pipSlider) pipSlider.addEventListener('input', onSliderChange);

    const onMuteClick = () => {
      this.toggleMute();
    };

    if (titleMute) titleMute.addEventListener('click', onMuteClick);
    if (dockMute) dockMute.addEventListener('click', onMuteClick);
    if (pipMute) pipMute.addEventListener('click', onMuteClick);
  },

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.volume > 0 && this.isMuted) {
      this.isMuted = false;
    }
    Storage.set('j2me_volume', this.volume);
    Storage.set('j2me_muted', this.isMuted);

    this.updateAudioUI();
    this.syncVolumeToIframe();
  },

  toggleMute() {
    this.isMuted = !this.isMuted;
    Storage.set('j2me_muted', this.isMuted);

    this.updateAudioUI();
    this.syncVolumeToIframe();
    this.showToast(this.isMuted ? '🔇 Áudio Mutado' : `🔊 Volume: ${Math.round(this.volume * 100)}%`);
  },

  updateAudioUI() {
    const titleSlider = document.getElementById('volume-slider');
    const dockSlider = document.getElementById('dock-volume-slider');
    const pipSlider = document.getElementById('pip-floating-volume');
    const badge = document.getElementById('volume-badge');

    const effectiveVal = this.isMuted ? 0 : this.volume;
    if (titleSlider) titleSlider.value = effectiveVal;
    if (dockSlider) dockSlider.value = effectiveVal;
    if (pipSlider) pipSlider.value = effectiveVal;

    if (badge) {
      badge.textContent = this.isMuted ? 'Mudo' : `${Math.round(this.volume * 100)}%`;
    }

    const muteIcon = this.isMuted ? '🔇' : (this.volume < 0.4 ? '🔉' : '🔊');
    ['btn-volume-mute', 'dock-btn-mute', 'pip-btn-mute'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = muteIcon;
    });
  },

  syncVolumeToIframe() {
    const iframe = document.getElementById('game-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'set-volume',
        volume: this.volume,
        muted: this.isMuted
      }, '*');

      try {
        if (typeof iframe.contentWindow.setEmulatorVolume === 'function') {
          iframe.contentWindow.setEmulatorVolume(this.volume, this.isMuted);
        }
      } catch (e) {}
    }
  },

  /* ----------------------------------------------------------
     PIP (PICTURE-IN-PICTURE) CONTROLS
     ---------------------------------------------------------- */
  setupPiPControls() {
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape') {
        document.getElementById('pip-floating-bar')?.classList.remove('active');
        document.getElementById('pip-menu-toggle-btn')?.setAttribute('aria-expanded','false');
      }
    });
    const btnPiP = document.getElementById('btn-toggle-pip');
    if (btnPiP) {
      btnPiP.addEventListener('click', () => this.togglePiP());
    }

    const btnRestore = document.getElementById('pip-btn-restore');
    if (btnRestore) {
      btnRestore.addEventListener('click', () => this.togglePiP());
    }

    const btnClosePiP = document.getElementById('pip-btn-close');
    if (btnClosePiP) {
      btnClosePiP.addEventListener('click', () => window.j2mePiP?.close());
    }

    const btnCollapsePiP = document.getElementById('pip-btn-collapse');
    if (btnCollapsePiP) {
      btnCollapsePiP.addEventListener('click', () => {
        const floatingBar = document.getElementById('pip-floating-bar');
        if (floatingBar) floatingBar.classList.remove('active');
        document.getElementById('pip-menu-toggle-btn')?.setAttribute('aria-expanded','false');
      });
    }

    const btnTypePiP = document.getElementById('pip-btn-type');
    if (btnTypePiP) {
      btnTypePiP.addEventListener('click', () => {
        document.getElementById('pip-floating-bar')?.classList.remove('active');
        document.getElementById('pip-menu-toggle-btn')?.setAttribute('aria-expanded','false');
        this.showTextDialog();
      });
    }

    // Always-visible mini indicator pill toggle
    const pipTogglePill = document.getElementById('pip-menu-toggle-btn');
    if (pipTogglePill) {
      pipTogglePill.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePiPFloatingMenu();
      });
    }

    // Right-click inside view-player in PiP mode toggles menu
    const viewPlayer = document.getElementById('view-player');
    if (viewPlayer) {
      viewPlayer.addEventListener('contextmenu', (e) => {
        if (this.isPiP) {
          e.preventDefault();
          this.togglePiPFloatingMenu();
        }
      });
    }

    // Opacity sliders
    const slider = document.getElementById('pip-opacity-slider');
    const floatSlider = document.getElementById('pip-floating-opacity');

    const handleOpacityChange = (val) => {
      if (slider) slider.value = val;
      if (floatSlider) floatSlider.value = val;
      if (window.j2mePiP?.setOpacity) {
        window.j2mePiP.setOpacity(val);
      }
    };

    if (slider) {
      slider.addEventListener('input', (e) => handleOpacityChange(parseFloat(e.target.value)));
    }
    if (floatSlider) {
      floatSlider.addEventListener('input', (e) => handleOpacityChange(parseFloat(e.target.value)));
    }

    // Corner snaps
    document.querySelectorAll('.corner-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const corner = btn.getAttribute('data-corner');
        if (window.j2mePiP?.snapCorner) {
          window.j2mePiP.snapCorner(corner);
          this.showToast(`Janela fixada no ${btn.title}`);
        }
      });
    });

    // PiP Size Buttons
    document.querySelectorAll('.btn-pip-size').forEach(btn => {
      btn.addEventListener('click', () => {
        const sizeName = btn.getAttribute('data-size');
        if (window.j2mePiP?.setPiPSize) {
          window.j2mePiP.setPiPSize(sizeName);
        }
      });
    });
  },

  togglePiPFloatingMenu() {
    const floatingBar = document.getElementById('pip-floating-bar');
    if (floatingBar) {
      const open = floatingBar.classList.toggle('active');
      document.getElementById('pip-menu-toggle-btn')?.setAttribute('aria-expanded',String(open));
    }
  },

  async togglePiP() {
    if (window.j2mePiP?.togglePiP) {
      const active = await window.j2mePiP.togglePiP();
      this.updatePiPState(active);
    } else {
      // In web browser without Electron
      this.isPiP = !this.isPiP;
      this.updatePiPState(this.isPiP);
      this.showToast(this.isPiP ? 'Modo Janela Flutuante ativado (Web)' : 'Janela normal restaurada');
    }
  },

  updatePiPState(isPiPActive) {
    this.isPiP = isPiPActive;
    const btnPiP = document.getElementById('btn-toggle-pip');
    const floatingBar = document.getElementById('pip-floating-bar');

    if (floatingBar) {
      floatingBar.classList.remove('active');
      document.getElementById('pip-menu-toggle-btn')?.setAttribute('aria-expanded','false');
    }

    if (this.isPiP) {
      document.body.classList.add('pip-mode');
      this.switchTab('player');
      if (btnPiP) {
        btnPiP.classList.add('active');
        btnPiP.innerHTML = JarumiUI.icon('pip');
      }
      Video.updateViewportFit();

    } else {
      document.body.classList.remove('pip-mode');
      if (btnPiP) {
        btnPiP.classList.remove('active');
        btnPiP.innerHTML = JarumiUI.icon('pip');
      }
      setTimeout(() => {
        Video.updateViewportFit();
      }, 50);
    }
  },

  /* ----------------------------------------------------------
     KEYMAP GUIDE HUD OVERLAY
     ---------------------------------------------------------- */
  setupKeymapHUD() {
    const btnShow = document.getElementById('btn-show-keymap-guide');
    const btnPiPKeymap = document.getElementById('pip-btn-keymap');
    const btnClose = document.getElementById('btn-close-keymap-hud');
    const overlay = document.getElementById('keymap-hud-overlay');

    if (btnShow) {
      btnShow.addEventListener('click', () => this.toggleKeymapHUD(true));
    }
    if (btnPiPKeymap) {
      btnPiPKeymap.addEventListener('click', () => this.toggleKeymapHUD(true));
    }
    if (btnClose) {
      btnClose.addEventListener('click', () => this.hideKeymapHUD());
    }
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.hideKeymapHUD();
      });
    }
  },

  showKeymapHUD(persistent = false) {
    const overlay = document.getElementById('keymap-hud-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      this.isKeymapHUDOpen = true;
      this.isKeymapPersistent = persistent;
    }
  },

  hideKeymapHUD() {
    const overlay = document.getElementById('keymap-hud-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      this.isKeymapHUDOpen = false;
      this.isKeymapPersistent = false;
    }
  },

  toggleKeymapHUD(persistent = false) {
    if (this.isKeymapHUDOpen) {
      this.hideKeymapHUD();
    } else {
      this.showKeymapHUD(persistent);
    }
  },

  setupEmulatorControls() {
    // Toggle keypad drawer
    const btnKeypad = document.getElementById('btn-toggle-keypad-drawer');
    const keypadDrawer = document.getElementById('keypad-drawer');
    if (btnKeypad && keypadDrawer) {
      btnKeypad.addEventListener('click', () => {
        keypadDrawer.classList.toggle('open');
        btnKeypad.classList.toggle('active', keypadDrawer.classList.contains('open'));
        btnKeypad.setAttribute('aria-expanded', String(keypadDrawer.classList.contains('open')));
        window.dispatchEvent(new Event('resize'));
      });
    }

    // Screenshot
    const btnScreenshot = document.getElementById('btn-screenshot');
    if (btnScreenshot) {
      btnScreenshot.addEventListener('click', () => this.takeScreenshot());
    }

    // Speed multiplier
    const btnSpeed = document.getElementById('btn-speed');
    if (btnSpeed) {
      btnSpeed.addEventListener('click', () => {
        const speeds = [1.0, 1.5, 2.0, 3.0];
        const nextIdx = (speeds.indexOf(this.currentSpeed) + 1) % speeds.length;
        this.currentSpeed = speeds[nextIdx];
        btnSpeed.textContent = `⚡ ${this.currentSpeed}x`;
        this.showToast(`Velocidade: ${this.currentSpeed}x`);
      });
    }

    // Pause / Resume
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => {
        this.isPaused = !this.isPaused;
        const icon = btnPause.querySelector('.btn-icon');
        const label = btnPause.querySelector('.btn-label');
        if (icon) icon.textContent = this.isPaused ? '▶' : '⏸';
        if (label) label.textContent = this.isPaused ? 'CONTINUAR' : 'PAUSAR';
        btnPause.classList.toggle('active', this.isPaused);
        this.showToast(this.isPaused ? 'Emulador Pausado' : 'Emulador Retomado');
      });
    }

    // Quick Save button on HUD
    const btnQuickSave = document.getElementById('btn-hud-quicksave');
    if (btnQuickSave) {
      btnQuickSave.addEventListener('click', () => Saves.triggerQuickSave());
    }

    // Quick Load button on HUD
    const btnQuickLoad = document.getElementById('btn-hud-quickload');
    if (btnQuickLoad) {
      btnQuickLoad.addEventListener('click', () => Saves.triggerQuickLoad());
    }

    // Show Text/Name Input Dialog button on HUD dock
    const btnShowTypeDialog = document.getElementById('btn-show-type-dialog');
    if (btnShowTypeDialog) {
      btnShowTypeDialog.addEventListener('click', () => this.showTextDialog());
    }

    // Toggle dropdown for more dock options (Speed, Screenshot, Rotate)
    const btnMore = document.getElementById('btn-dock-more');
    const moreMenu = document.getElementById('dock-more-menu');
    if (btnMore && moreMenu) {
      btnMore.addEventListener('click', (e) => {
        e.stopPropagation();
        moreMenu.classList.toggle('hidden');
      });
      document.addEventListener('click', () => {
        moreMenu.classList.add('hidden');
      });
    }

    // PiP chip button on dock
    const btnDockPiP = document.getElementById('btn-dock-pip');
    if (btnDockPiP) {
      btnDockPiP.addEventListener('click', () => this.togglePiP());
    }
  },

  /* ----------------------------------------------------------
     TEXT / NAME INPUT DIALOG (DUAL T9 + DIRECT)
     ---------------------------------------------------------- */
  setupTextInputDialog() {
    const dialog = document.getElementById('text-input-dialog');
    const btnClose = document.getElementById('btn-close-text-dialog');
    const btnSubmit = document.getElementById('btn-submit-game-text');
    const btnSubmitT9 = document.getElementById('btn-submit-game-t9');
    const input = document.getElementById('input-game-text');

    if (btnClose) {
      btnClose.addEventListener('click', () => this.hideTextDialog());
    }
    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => this.submitGameText());
    }
    if (btnSubmitT9) {
      btnSubmitT9.addEventListener('click', () => this.submitGameT9());
    }
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.submitGameT9(); // Default enter sends T9
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.hideTextDialog();
        }
      });
    }
    if (dialog) {
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
          this.hideTextDialog();
        }
      });
    }

    // Interactive T9 Modal Keypad clicks
    document.querySelectorAll('.modal-t9-grid .t9-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const iframe = document.getElementById('game-iframe');
        const key = btn.getAttribute('data-key');
        const action = btn.getAttribute('data-action');

        if (key && iframe && iframe.contentWindow) {
          const keyCode = parseInt(key, 10);
          iframe.contentWindow.postMessage({ type: 'key-press', code: keyCode }, '*');
          setTimeout(() => {
            iframe.contentWindow.postMessage({ type: 'key-release', code: keyCode }, '*');
          }, 60);

          const d = btn.querySelector('.t9-d')?.textContent;
          if (d && input && !isNaN(d)) {
            input.value += d;
          }
        } else if (action === 'clear' && iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'key-press', code: -8 }, '*');
          setTimeout(() => {
            iframe.contentWindow.postMessage({ type: 'key-release', code: -8 }, '*');
          }, 60);
          if (input) input.value = input.value.slice(0, -1);
        } else if (action === 'next' && iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'key-press', code: -4 }, '*');
          setTimeout(() => {
            iframe.contentWindow.postMessage({ type: 'key-release', code: -4 }, '*');
          }, 60);
        }
      });
    });
  },

  showTextDialog() {
    const dialog = document.getElementById('text-input-dialog');
    const input = document.getElementById('input-game-text');
    if (dialog) {
      dialog.classList.remove('hidden');
      if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 80);
      }
    }
  },

  hideTextDialog() {
    const dialog = document.getElementById('text-input-dialog');
    if (dialog) {
      dialog.classList.add('hidden');
    }
    // Refocus emulator iframe
    setTimeout(() => {
      document.getElementById('game-iframe')?.focus();
    }, 50);
  },

  // Converts string to mobile phone T9 multi-tap sequence
  generateT9Sequence(text) {
    const T9_MAP = {
      'a': { code: 50, taps: 1 }, 'b': { code: 50, taps: 2 }, 'c': { code: 50, taps: 3 }, '2': { code: 50, taps: 4 },
      'd': { code: 51, taps: 1 }, 'e': { code: 51, taps: 2 }, 'f': { code: 51, taps: 3 }, '3': { code: 51, taps: 4 },
      'g': { code: 52, taps: 1 }, 'h': { code: 52, taps: 2 }, 'i': { code: 52, taps: 3 }, '4': { code: 52, taps: 4 },
      'j': { code: 53, taps: 1 }, 'k': { code: 53, taps: 2 }, 'l': { code: 53, taps: 3 }, '5': { code: 53, taps: 4 },
      'm': { code: 54, taps: 1 }, 'n': { code: 54, taps: 2 }, 'o': { code: 54, taps: 3 }, '6': { code: 54, taps: 4 },
      'p': { code: 55, taps: 1 }, 'q': { code: 55, taps: 2 }, 'r': { code: 55, taps: 3 }, 's': { code: 55, taps: 4 }, '7': { code: 55, taps: 5 },
      't': { code: 56, taps: 1 }, 'u': { code: 56, taps: 2 }, 'v': { code: 56, taps: 3 }, '8': { code: 56, taps: 4 },
      'w': { code: 57, taps: 1 }, 'x': { code: 57, taps: 2 }, 'y': { code: 57, taps: 3 }, 'z': { code: 57, taps: 4 }, '9': { code: 57, taps: 5 },
      ' ': { code: 48, taps: 1 }, '0': { code: 48, taps: 2 },
      '.': { code: 49, taps: 1 }, ',': { code: 49, taps: 2 }, "'": { code: 49, taps: 3 }, '?': { code: 49, taps: 4 }, '!': { code: 49, taps: 5 }, '-': { code: 49, taps: 6 }, '1': { code: 49, taps: 7 }
    };

    const steps = [];
    let lastCode = null;

    for (const char of text.toLowerCase()) {
      const entry = T9_MAP[char];
      if (entry) {
        if (lastCode === entry.code) {
          // If two letters share the same physical key, advance cursor first
          steps.push({ code: -4, wait: 200 });
        }
        for (let t = 0; t < entry.taps; t++) {
          steps.push({ code: entry.code, wait: 85 });
        }
        steps.push({ code: -4, wait: 280 }); // Advance to next position
        lastCode = entry.code;
      } else {
        steps.push({ code: char.charCodeAt(0), wait: 120 });
        lastCode = null;
      }
    }

    return steps;
  },

  submitGameT9() {
    const input = document.getElementById('input-game-text');
    if (!input) return;
    const text = input.value.trim();
    if (!text) {
      this.hideTextDialog();
      return;
    }

    const steps = this.generateT9Sequence(text);
    const iframe = document.getElementById('game-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'type-t9-sequence',
        steps
      }, '*');
      iframe.contentWindow.postMessage({
        type: 'type-string',
        text
      }, '*');

      this.showToast(`🚀 Auto T9 digitando "${text}"...`);
    }

    this.hideTextDialog();
  },

  submitGameText() {
    const input = document.getElementById('input-game-text');
    if (!input) return;
    const text = input.value.trim();
    if (!text) {
      this.hideTextDialog();
      return;
    }

    const iframe = document.getElementById('game-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'type-string',
        text: text
      }, '*');
      this.showToast(`🔤 Enviando "${text}" ao jogo...`);
    }

    this.hideTextDialog();
  },

  setupShortcuts() {
    window.addEventListener('keydown', (e) => {
      this.handleGlobalKeyDown(e.key, e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.handleGlobalKeyUp(e.key, e.code);
    });
  },

  handleGlobalKeyDown(key, code) {
    const textDialog = document.getElementById('text-input-dialog');
    if (textDialog && !textDialog.classList.contains('hidden')) {
      if (key === 'Escape') {
        this.hideTextDialog();
      }
      return; // Do not trigger shortcuts while typing text
    }

    // Do not trigger game shortcuts if an input/textarea in the app is focused
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      return;
    }

    // Hold Tab or H to show Keymap HUD
    if (key === 'Tab' || key === 'h' || key === 'H') {
      if (!this.isKeymapHUDOpen) {
        this.showKeymapHUD(false);
      }
    }

    // Escape closes HUD or PiP menu
    if (key === 'Escape') {
      if (this.isKeymapHUDOpen) {
        this.hideKeymapHUD();
      }
      const floatingBar = document.getElementById('pip-floating-bar');
      if (floatingBar && floatingBar.classList.contains('active')) {
        floatingBar.classList.remove('active');
      }
    }

    // M key toggles PiP menu in PiP mode
    if ((key === 'm' || key === 'M') && this.isPiP) {
      this.togglePiPFloatingMenu();
    }

    // Global F10 for PiP
    if (key === 'F10') {
      this.togglePiP();
    }

    // F12 for Screenshot
    if (key === 'F12') {
      this.takeScreenshot();
    }

    // F5 Quick Save / F8 Quick Load
    if (key === 'F5') {
      Saves.triggerQuickSave();
    }
    if (key === 'F8') {
      Saves.triggerQuickLoad();
    }
  },

  handleGlobalKeyUp(key, code) {
    // Releasing Tab or H hides Keymap HUD unless opened via button (persistent)
    if ((key === 'Tab' || key === 'h' || key === 'H') && !this.isKeymapPersistent) {
      this.hideKeymapHUD();
    }
  },

  takeScreenshot() {
    const iframe = document.getElementById('game-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'request-screenshot' }, '*');
    }
  },

  async handleScreenshotReady(dataUrl) {
    if (window.j2mePiP?.saveScreenshot) {
      const res = await window.j2mePiP.saveScreenshot(dataUrl);
      if (res.success) {
        this.showToast(`📸 Captura salva em: ${res.filename}`);
      }
    } else {
      // Fallback download in web browser
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `j2me_screenshot_${Date.now()}.png`;
      a.click();
      this.showToast('📸 Screenshot baixado!');
    }
  },

  showToast(text, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = I18n.t(text);
    toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
