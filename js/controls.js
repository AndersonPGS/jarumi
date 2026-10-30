// Controls Manager: Key remapping, tactile on-screen keypad, and Gamepad API loop
const Controls = {
  // Mobile actions to J2ME Keycodes
  ACTIONS: [
    { id: 'UP', label: 'Cima (Up)', code: -1, defaultKey: 'ArrowUp', altKey: 'KeyW' },
    { id: 'DOWN', label: 'Baixo (Down)', code: -2, defaultKey: 'ArrowDown', altKey: 'KeyS' },
    { id: 'LEFT', label: 'Esquerda (Left)', code: -3, defaultKey: 'ArrowLeft', altKey: 'KeyA' },
    { id: 'RIGHT', label: 'Direita (Right)', code: -4, defaultKey: 'ArrowRight', altKey: 'KeyD' },
    { id: 'FIRE', label: 'OK / Centro / Fogo', code: -5, defaultKey: 'Enter', altKey: 'Space' },
    { id: 'SOFT_LEFT', label: 'SoftKey Esquerda (Menu)', code: -6, defaultKey: 'KeyQ', altKey: 'KeyZ' },
    { id: 'SOFT_RIGHT', label: 'SoftKey Direita (Voltar)', code: -7, defaultKey: 'KeyE', altKey: 'KeyX' },
    { id: 'NUM1', label: 'Tecla 1', code: 49, defaultKey: 'Digit1', altKey: 'Numpad1' },
    { id: 'NUM2', label: 'Tecla 2', code: 50, defaultKey: 'Digit2', altKey: 'Numpad2' },
    { id: 'NUM3', label: 'Tecla 3', code: 51, defaultKey: 'Digit3', altKey: 'Numpad3' },
    { id: 'NUM4', label: 'Tecla 4', code: 52, defaultKey: 'Digit4', altKey: 'Numpad4' },
    { id: 'NUM5', label: 'Tecla 5 (Centro)', code: 53, defaultKey: 'Digit5', altKey: 'Numpad5' },
    { id: 'NUM6', label: 'Tecla 6', code: 54, defaultKey: 'Digit6', altKey: 'Numpad6' },
    { id: 'NUM7', label: 'Tecla 7', code: 55, defaultKey: 'Digit7', altKey: 'Numpad7' },
    { id: 'NUM8', label: 'Tecla 8', code: 56, defaultKey: 'Digit8', altKey: 'Numpad8' },
    { id: 'NUM9', label: 'Tecla 9', code: 57, defaultKey: 'Digit9', altKey: 'Numpad9' },
    { id: 'STAR', label: 'Tecla * (Asterisco)', code: 42, defaultKey: 'NumpadMultiply', altKey: 'Minus' },
    { id: 'NUM0', label: 'Tecla 0', code: 48, defaultKey: 'Digit0', altKey: 'Numpad0' },
    { id: 'POUND', label: 'Tecla # (Cerquilha)', code: 35, defaultKey: 'NumpadDecimal', altKey: 'Equal' },
    { id: 'CALL', label: 'Chamar (Call)', code: -10, defaultKey: 'KeyC', altKey: '' },
    { id: 'END', label: 'Desligar (End)', code: -11, defaultKey: 'Escape', altKey: '' }
  ],

  customBindings: {},
  listeningActionId: null,
  gamepadIndex: null,
  gamepadButtonsState: {},

  init() {
    this.loadBindings();
    this.setupKeypadClicks();
    this.setupKeyboardTracking();
    this.setupGamepad();
    this.renderConfigGrid();
  },

  loadBindings() {
    try {
      const saved = Storage.get('j2me_key_bindings');
      if (saved) {
        this.customBindings = typeof saved === 'string' ? JSON.parse(saved) : saved;
      }
    } catch (e) {
      console.warn('Failed to load bindings:', e);
    }
  },

  saveBindings() {
    try {
      Storage.set('j2me_key_bindings', this.customBindings);
      this.syncWithPlayer();
    } catch (e) {
      console.warn('Failed to save bindings:', e);
    }
  },

  syncWithPlayer() {
    const iframe = document.getElementById('game-iframe');
    if (!iframe || !iframe.contentWindow) return;

    // Build keymap dictionary { [code]: j2meCode }
    const keymap = {};
    for (const action of this.ACTIONS) {
      const boundKey = this.customBindings[action.id] || action.defaultKey;
      if (boundKey) keymap[boundKey] = action.code;
      if (action.altKey) keymap[action.altKey] = action.code;
    }

    iframe.contentWindow.postMessage({ type: 'update-keymap', keymap }, '*');
  },

  // Direct bridge to send J2ME key codes to the player iframe
  sendToGame(code, isDown) {
    const iframe = document.getElementById('game-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: isDown ? 'key-press' : 'key-release',
        code: code
      }, '*');
    }
  },

  getActionForKey(keyCode) {
    return this.ACTIONS.find(a => {
      const bound = this.customBindings[a.id] || a.defaultKey;
      return bound === keyCode || a.altKey === keyCode;
    });
  },

  // Interactive on-screen keypad clicks
  setupKeypadClicks() {
    const keypad = document.querySelector('.phone-keypad');
    if (!keypad) return;

    keypad.querySelectorAll('button').forEach(btn => {
      const code = parseInt(btn.getAttribute('data-code'), 10);
      if (isNaN(code)) return;

      btn.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        btn.classList.add('pressed');
        this.sendToGame(code, true);
      });
      const release = () => {
        if (!btn.classList.contains('pressed')) return;
        btn.classList.remove('pressed');
        this.sendToGame(code, false);
      };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
    });
  },

  // Highlight on-screen keypad button when physical key is pressed,
  // and seamlessly forward game keys to the iframe when UI elements or window are focused
  setupKeyboardTracking() {
    window.addEventListener('keydown', (e) => {
      // If currently listening to rebind a key
      if (this.listeningActionId) {
        e.preventDefault();
        this.customBindings[this.listeningActionId] = e.code;
        this.listeningActionId = null;
        this.saveBindings();
        this.renderConfigGrid();
        App.showToast(`Tecla configurada: ${e.code}`);
        return;
      }

      this.highlightKey(e.code, true);

      // If active in Player view or PiP, and not typing in an input field:
      if (typeof App !== 'undefined' && (App.currentView === 'player' || App.isPiP)) {
        const isInput = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
        if (!isInput) {
          const action = this.getActionForKey(e.code);
          if (action) {
            e.preventDefault();
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
              document.activeElement.blur();
            }
            this.sendToGame(action.code, true);
            const iframe = document.getElementById('game-iframe');
            if (iframe && document.activeElement !== iframe) {
              iframe.focus();
            }
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.highlightKey(e.code, false);

      if (typeof App !== 'undefined' && (App.currentView === 'player' || App.isPiP)) {
        const isInput = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
        if (!isInput) {
          const action = this.getActionForKey(e.code);
          if (action) {
            e.preventDefault();
            this.sendToGame(action.code, false);
          }
        }
      }
    });
  },

  highlightKey(keyCode, isPressed) {
    // Find matching action
    const action = this.ACTIONS.find(a => {
      const bound = this.customBindings[a.id] || a.defaultKey;
      return bound === keyCode || a.altKey === keyCode;
    });

    if (!action) return;

    const btn = document.querySelector(`.phone-keypad button[data-code="${action.code}"]`);
    if (btn) {
      if (isPressed) btn.classList.add('pressed');
      else btn.classList.remove('pressed');
    }
  },

  // HTML5 Gamepad API loop
  setupGamepad() {
    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
      App.showToast(`🎮 Controle Conectado: ${e.gamepad.id.slice(0, 24)}...`);
      this.startGamepadLoop();
    });

    window.addEventListener('gamepaddisconnected', () => {
      this.gamepadIndex = null;
      App.showToast('Controle Desconectado');
    });
  },

  startGamepadLoop() {
    const sendToGame = (code, isDown) => {
      const iframe = document.getElementById('game-iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: isDown ? 'key-press' : 'key-release',
          code: code
        }, '*');
      }
    };

    const poll = () => {
      if (this.gamepadIndex === null) return;

      const gamepads = navigator.getGamepads();
      const gp = gamepads[this.gamepadIndex];
      if (!gp) return;

      // Standard Gamepad Mapping
      // 12: Up, 13: Down, 14: Left, 15: Right
      // 0: A (Fire/OK), 1: B (RSK), 2: X (LSK), 3: Y (1)
      // 4: LB (LSK), 5: RB (RSK), 9: Start (OK)
      const mappings = [
        { btnIndex: 12, code: -1 }, // D-pad Up
        { btnIndex: 13, code: -2 }, // D-pad Down
        { btnIndex: 14, code: -3 }, // D-pad Left
        { btnIndex: 15, code: -4 }, // D-pad Right
        { btnIndex: 0, code: -5 },  // Button A -> Fire
        { btnIndex: 1, code: -7 },  // Button B -> RSK
        { btnIndex: 2, code: -6 },  // Button X -> LSK
        { btnIndex: 3, code: 49 },  // Button Y -> 1
        { btnIndex: 4, code: -6 },  // LB -> LSK
        { btnIndex: 5, code: -7 },  // RB -> RSK
        { btnIndex: 9, code: -5 }   // Start -> Fire
      ];

      // Also check left analog stick
      const deadzone = 0.45;
      const stickUp = gp.axes[1] < -deadzone;
      const stickDown = gp.axes[1] > deadzone;
      const stickLeft = gp.axes[0] < -deadzone;
      const stickRight = gp.axes[0] > deadzone;

      const checkStick = (key, isPressed, code) => {
        const wasPressed = this.gamepadButtonsState[key] || false;
        if (isPressed !== wasPressed) {
          this.gamepadButtonsState[key] = isPressed;
          sendToGame(code, isPressed);
        }
      };

      checkStick('axis-up', stickUp, -1);
      checkStick('axis-down', stickDown, -2);
      checkStick('axis-left', stickLeft, -3);
      checkStick('axis-right', stickRight, -4);

      for (const m of mappings) {
        const isPressed = gp.buttons[m.btnIndex]?.pressed || false;
        const wasPressed = this.gamepadButtonsState[m.btnIndex] || false;

        if (isPressed !== wasPressed) {
          this.gamepadButtonsState[m.btnIndex] = isPressed;
          sendToGame(m.code, isPressed);

          // Keypad visual feedback
          const btn = document.querySelector(`.phone-keypad button[data-code="${m.code}"]`);
          if (btn) {
            if (isPressed) btn.classList.add('pressed');
            else btn.classList.remove('pressed');
          }
        }
      }

      requestAnimationFrame(poll);
    };

    requestAnimationFrame(poll);
  },

  // Render configuration grid in Settings tab
  renderConfigGrid() {
    const grid = document.getElementById('controls-config-grid');
    if (!grid) return;

    grid.innerHTML = this.ACTIONS.map(action => {
      const current = this.customBindings[action.id] || action.defaultKey;
      const isListening = this.listeningActionId === action.id;
      return `
        <div class="control-item">
          <span class="control-label">${action.label}</span>
          <button class="control-key-btn ${isListening ? 'listening' : ''}" 
                  onclick="Controls.startListening('${action.id}')">
            ${isListening ? 'Pressione tecla...' : current.replace('Key', '').replace('Digit', '')}
          </button>
        </div>
      `;
    }).join('');
  },

  startListening(actionId) {
    this.listeningActionId = actionId;
    this.renderConfigGrid();
  },

  resetDefaults() {
    this.customBindings = {};
    this.saveBindings();
    this.renderConfigGrid();
    App.showToast('Controles restaurados para o padrão.');
  }
};
