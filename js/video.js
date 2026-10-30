// Video & Resolution Manager: Fluid Aspect-Ratio Scaling, Presets, Shaders, Rotation
const Video = {
  currentResolution: '240x320',
  currentScale: 'fit',
  currentFilter: 'pixelated',
  currentShader: 'none',
  currentRotation: 0,
  cleanView: false,
  aspectRatio: 240 / 320,
  nativeWidth: 240,
  nativeHeight: 320,
  hasNativeResolution: false,

  init() {
    this.loadSettings();
    this.setupEvents();
    this.applySettings();
  },

  loadSettings() {
    try {
      this.currentResolution = Storage.get('j2me_res') || '240x320';
      this.currentScale = Storage.get('j2me_scale') || 'fit';
      this.currentFilter = Storage.get('j2me_filter') || 'pixelated';
      this.currentShader = Storage.get('j2me_shader') || 'none';
      this.cleanView = Storage.get('j2me_clean_view') === 'true';
    } catch (e) {
      console.warn('Failed to load video settings:', e);
    }
  },

  saveSettings() {
    try {
      Storage.set('j2me_res', this.currentResolution);
      Storage.set('j2me_scale', this.currentScale);
      Storage.set('j2me_filter', this.currentFilter);
      Storage.set('j2me_shader', this.currentShader);
      Storage.set('j2me_clean_view', this.cleanView);
    } catch (e) {
      console.warn('Failed to save video settings:', e);
    }
  },

  setupEvents() {
    const selRes = document.getElementById('select-resolution');
    if (selRes) {
      selRes.value = this.currentResolution;
      selRes.addEventListener('change', (e) => {
        if (Library.currentGame) {
          GameSetup.open(Library.currentGame);
          document.getElementById('game-screen-choice').value = e.target.value;
          GameSetup.hint();
          e.target.value = GameSetup.read(Library.currentGame)?.resolution || this.currentResolution;
          return;
        }
        this.currentResolution = e.target.value;
        this.hasNativeResolution = false;
        this.saveSettings();
        this.applySettings();
        if (Library.currentGame) {
          Library.playGame(Library.currentGame);
        }
      });
    }

    const selScale = document.getElementById('select-scale');
    if (selScale) {
      selScale.value = this.currentScale;
      selScale.addEventListener('change', (e) => {
        this.currentScale = e.target.value;
        this.saveSettings();
        this.applySettings();
      });
    }

    const selShader = document.getElementById('select-shader');
    if (selShader) {
      selShader.value = this.currentShader;
      selShader.addEventListener('change', (e) => {
        this.currentShader = e.target.value;
        this.saveSettings();
        this.applySettings();
      });
    }

    const selFilter = document.getElementById('select-filter');
    if (selFilter) {
      selFilter.value = this.currentFilter;
      selFilter.addEventListener('change', (e) => {
        this.currentFilter = e.target.value;
        this.saveSettings();
        this.applySettings();
      });
    }

    const chkClean = document.getElementById('toggle-clean-view');
    if (chkClean) {
      chkClean.checked = this.cleanView;
      chkClean.addEventListener('change', (e) => {
        this.cleanView = e.target.checked;
        this.saveSettings();
        this.applySettings();
      });
    }

    // Quick rotate button
    const btnRotate = document.getElementById('btn-rotate-screen');
    if (btnRotate) {
      btnRotate.addEventListener('click', () => {
        this.currentRotation = (this.currentRotation + 90) % 360;
        this.applySettings();
        App.showToast(`Tela rotacionada: ${this.currentRotation}°`);
      });
    }

    // Responsive container auto-fit observer
    const container = document.getElementById('game-viewport-container');
    if (container && window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        this.updateViewportFit();
      });
      ro.observe(container);
    }
    window.addEventListener('resize', () => {
      this.updateViewportFit();
    });
  },

  setNativeResolution(w, h) {
    if (!w || !h || w <= 0 || h <= 0) return;
    this.nativeWidth = w;
    this.nativeHeight = h;
    this.hasNativeResolution = true;

    let finalW = w;
    let finalH = h;
    if (this.currentRotation === 90 || this.currentRotation === 270) {
      finalW = h;
      finalH = w;
    }

    this.aspectRatio = finalW / finalH;
    document.documentElement.style.setProperty('--game-ratio', `${finalW} / ${finalH}`);
    const info=document.getElementById('resolution-info');if(info)info.textContent=`Tela emulada: ${finalW} × ${finalH}`;
    this.updatePhoneOrientation();

    if (window.j2mePiP?.updateAspect) {
      window.j2mePiP.updateAspect(finalW, finalH);
    }

    this.updateViewportFit();

    const resBadge = document.getElementById('hud-resolution');
    if (resBadge) {
      resBadge.textContent = `${finalW}x${finalH}`;
    }
  },

  applySettings() {
    let w = 240;
    let h = 320;

    if (this.hasNativeResolution) {
      w = this.nativeWidth;
      h = this.nativeHeight;
    } else if (this.currentResolution !== 'auto') {
      const parts = this.currentResolution.split('x').map(Number);
      if (parts[0] && parts[1]) {
        w = parts[0];
        h = parts[1];
      }
    } else if (this.nativeWidth && this.nativeHeight) {
      w = this.nativeWidth;
      h = this.nativeHeight;
    }

    let finalW = w;
    let finalH = h;
    if (this.currentRotation === 90 || this.currentRotation === 270) {
      finalW = h;
      finalH = w;
    }

    this.aspectRatio = finalW / finalH;
    document.documentElement.style.setProperty('--game-ratio', `${finalW} / ${finalH}`);
    const info=document.getElementById('resolution-info');if(info)info.textContent=`Tela emulada: ${finalW} × ${finalH}`;
    this.updatePhoneOrientation();

    if (window.j2mePiP?.updateAspect) {
      window.j2mePiP.updateAspect(finalW, finalH);
    }

    this.updateViewportFit();

    // Update HUD indicator
    const resBadge = document.getElementById('hud-resolution');
    if (resBadge) {
      resBadge.textContent = `${finalW}x${finalH}`;
    }

    // Pass shaders and rotation to player iframe
    const iframe = document.getElementById('game-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'set-filter',
        filter: this.currentFilter,
        shader: this.currentShader
      }, '*');

      iframe.contentWindow.postMessage({
        type: 'set-rotation',
        rotation: this.currentRotation
      }, '*');
    }
  },

  updatePhoneOrientation() {
    const landscape = this.aspectRatio > 1 && document.body.dataset.view === 'player';
    document.body.classList.toggle('game-landscape', landscape);
    window.j2mePiP?.setPhoneOrientation?.(landscape ? 'landscape' : 'portrait');
  },

  updateViewportFit() {
    const container = document.getElementById('game-viewport-container');
    const frameWrap = document.getElementById('game-frame-wrap');
    if (!container || !frameWrap) return;

    // In PiP mode, CSS sets 100vw and 100vh with aspect-ratio enforced by Electron window
    if (document.body.classList.contains('pip-mode')) {
      frameWrap.style.width = '';
      frameWrap.style.height = '';
      return;
    }

    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    if (!containerW || !containerH) return;

    const ratio = this.aspectRatio || (240 / 320);
    if (document.body.dataset.view === 'player' && window.j2mePiP?.fitPhoneScreen) {
      clearTimeout(this.fitTimer);
      this.fitTimer=setTimeout(()=>{
        if(document.body.dataset.view==='player' && !document.body.classList.contains('pip-mode'))window.j2mePiP.fitPhoneScreen({ratio,chrome:innerHeight-container.clientHeight,sides:innerWidth-container.clientWidth});
      },100);
    }

    // Maximize viewport fit without any overflow or wasted empty space
    let targetW = containerW;
    let targetH = Math.round(targetW / ratio);

    if (targetH > containerH) {
      targetH = containerH;
      targetW = Math.round(targetH * ratio);
    }

    frameWrap.style.width = `${targetW}px`;
    frameWrap.style.height = `${targetH}px`;
  }
};
