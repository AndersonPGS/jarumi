// Saves & RMS Manager: Auto-save, backup export/import, IndexedDB RecordStore extraction
const Saves = {
  DB_NAME: 'j2me_asyncStorage_v1',
  DB_VERSION: 4,
  STORE_NAME: 'fs4',

  autoSaveIntervalSec: 30,
  autoSaveTimer: null,
  lastSaveTime: null,

  init() {
    this.loadSettings();
    this.setupEvents();
    this.startAutoSave();
  },

  loadSettings() {
    try {
      this.autoSaveIntervalSec = parseInt(Storage.get('j2me_autosave_sec') || '30', 10);
    } catch (e) {
      console.warn('Failed to load save settings:', e);
    }
  },

  saveSettings() {
    try {
      Storage.set('j2me_autosave_sec', this.autoSaveIntervalSec);
    } catch (e) {
      console.warn('Failed to save save settings:', e);
    }
  },

  setupEvents() {
    const selInterval = document.getElementById('select-autosave-interval');
    if (selInterval) {
      selInterval.value = this.autoSaveIntervalSec.toString();
      selInterval.addEventListener('change', (e) => {
        this.autoSaveIntervalSec = parseInt(e.target.value, 10);
        this.saveSettings();
        this.startAutoSave();
        App.showToast(`Auto-save configurado para cada ${this.autoSaveIntervalSec}s`);
      });
    }

    const btnExport = document.getElementById('btn-export-saves');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportBackup());
    }

    const btnImport = document.getElementById('btn-import-saves');
    if (btnImport) {
      btnImport.addEventListener('click', () => this.importBackup());
    }

    const btnClear = document.getElementById('btn-clear-saves');
    if (btnClear) {
      btnClear.addEventListener('click', () => this.clearAllSaves());
    }

    // Keyboard shortcuts: F5 (Quick Save), F8 (Quick Load)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F5') {
        e.preventDefault();
        this.triggerQuickSave();
      } else if (e.key === 'F8') {
        e.preventDefault();
        this.triggerQuickLoad();
      }
    });
  },

  startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    if (this.autoSaveIntervalSec > 0) {
      this.autoSaveTimer = setInterval(() => {
        if (Library.currentGame) {
          this.performAutoSave();
        }
      }, this.autoSaveIntervalSec * 1000);
    }
  },

  async performAutoSave() {
    try {
      const dump = await this.dumpIndexedDB();
      const keys = Object.keys(dump);
      if (keys.length > 0) {
        Storage.set('j2me_latest_snapshot', {
          timestamp: Date.now(),
          game: Library.currentGame?.title || 'Game',
          data: dump
        });
        this.lastSaveTime = new Date();
        this.updateHudSaveStatus();
        this.refreshStoresList();
      }
    } catch (err) {
      console.warn('Auto-save error:', err);
    }
  },

  async triggerQuickSave() {
    await this.performAutoSave();
    App.showToast('💾 Quick Save realizado com sucesso! (F5)');
  },

  async triggerQuickLoad() {
    try {
      let saved = Storage.get('j2me_latest_snapshot');
      if (!saved) {
        App.showToast('Nenhum Quick Save encontrado.');
        return;
      }
      if (typeof saved === 'string') {
        saved = JSON.parse(saved);
      }
      await this.restoreIndexedDB(saved.data);
      App.showToast('📂 Quick Save carregado com sucesso! (F8)');
      // Reload game to reflect loaded save
      if (Library.currentGame) {
        Library.playGame(Library.currentGame);
      }
    } catch (err) {
      App.showToast('Erro ao carregar Quick Save');
      console.error(err);
    }
  },

  updateHudSaveStatus() {
    const el = document.getElementById('hud-autosave-status');
    if (el && this.lastSaveTime) {
      el.textContent = `Auto-saved ${this.lastSaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }
  },

  // Dump all records from IndexedDB 'j2me_asyncStorage_v1'
  dumpIndexedDB() {
    return new Promise((resolve) => {
      // First, signal active player iframe to flush in-memory changes to IndexedDB
      try {
        const iframe = document.getElementById('game-iframe');
        if (iframe && iframe.contentWindow) {
          if (typeof iframe.contentWindow.flushRMS === 'function') {
            iframe.contentWindow.flushRMS();
          } else {
            iframe.contentWindow.postMessage({ type: 'flush-save' }, '*');
          }
        }
      } catch (e) {}

      // Short delay to let IndexedDB transaction commit if any
      setTimeout(() => {
        const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'pathname' });
            store.createIndex('parentDir', 'parentDir', { unique: false });
          }
        };
        req.onerror = () => resolve({});
        req.onsuccess = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            return resolve({});
          }

          const tx = db.transaction(this.STORE_NAME, 'readonly');
          const store = tx.objectStore(this.STORE_NAME);
          const cursorReq = store.openCursor();
          const dump = {};
          const promises = [];

          cursorReq.onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (cursor) {
              const key = cursor.key;
              const val = cursor.value;

              if (val.isDir) {
                dump[key] = { ...val };
              } else if (val.data instanceof Blob) {
                const p = val.data.arrayBuffer().then((buf) => {
                  dump[key] = {
                    ...val,
                    data: Array.from(new Uint8Array(buf))
                  };
                }).catch(() => {
                  dump[key] = { ...val, data: [] };
                });
                promises.push(p);
              } else if (Array.isArray(val.data)) {
                dump[key] = { ...val };
              } else {
                dump[key] = { ...val };
              }

              cursor.continue();
            } else {
              Promise.all(promises)
                .then(() => resolve(dump))
                .catch(() => resolve(dump));
            }
          };

          cursorReq.onerror = () => resolve({});
        };
      }, 50);
    });
  },

  // Restore records into IndexedDB 'j2me_asyncStorage_v1'
  restoreIndexedDB(dump) {
    return new Promise((resolve) => {
      if (!dump || typeof dump !== 'object') return resolve();

      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'pathname' });
          store.createIndex('parentDir', 'parentDir', { unique: false });
        }
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) return resolve();

        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);

        for (const [key, val] of Object.entries(dump)) {
          const record = { ...val, pathname: key };
          if (!record.isDir && Array.isArray(record.data)) {
            record.data = new Blob([new Uint8Array(record.data)]);
          }
          store.put(record);
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      req.onerror = () => resolve();
    });
  },

  async exportBackup() {
    try {
      const dump = await this.dumpIndexedDB();
      const payload = JSON.stringify({
        app: 'Jarumi',
        exportDate: new Date().toISOString(),
        game: Library.currentGame?.title || 'All Games',
        records: dump
      }, null, 2);

      if (window.j2mePiP?.exportSaveData) {
        const res = await window.j2mePiP.exportSaveData(payload);
        if (res.success) {
          App.showToast(`Backup salvo em: ${res.filePath}`);
        }
      } else {
        // Fallback file download for web
        const blob = new Blob([payload], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `j2me_saves_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        App.showToast('Arquivo de backup baixado!');
      }
    } catch (err) {
      App.showToast('Erro ao exportar saves');
      console.error(err);
    }
  },

  async importBackup() {
    try {
      let data = null;
      if (window.j2mePiP?.importSaveData) {
        const res = await window.j2mePiP.importSaveData();
        if (res.success) data = res.data;
      } else {
        // Fallback for web
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        data = await new Promise((resolve) => {
          input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return resolve(null);
            const reader = new FileReader();
            reader.onload = () => {
              try { resolve(JSON.parse(reader.result)); } catch (err) { resolve(null); }
            };
            reader.readAsText(file);
          };
          input.click();
        });
      }

      if (data && data.records) {
        await this.restoreIndexedDB(data.records);
        App.showToast('Backup de saves restaurado com sucesso!');
        this.refreshStoresList();
        if (Library.currentGame) {
          Library.playGame(Library.currentGame);
        }
      }
    } catch (err) {
      App.showToast('Erro ao importar backup');
      console.error(err);
    }
  },

  async refreshStoresList() {
    const listEl = document.getElementById('rms-stores-list');
    if (!listEl) return;

    try {
      const dump = await this.dumpIndexedDB();
      const keys = Object.keys(dump).filter(k => k.includes('RecordStore') || k.startsWith('/'));

      if (keys.length === 0) {
        listEl.innerHTML = '<p style="color: var(--text-muted); font-size: 12px;">Nenhum save gravado ainda.</p>';
        return;
      }

      listEl.innerHTML = keys.map(k => {
        const sz = dump[k]?.size || (dump[k]?.data ? dump[k].data.length : 0);
        return `
          <div style="background: var(--bg-dark); border: 1px solid var(--border-color); padding: 8px 12px; border-radius: 6px; font-size: 11px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-family: monospace; color: var(--primary);">${k}</span>
            <span style="color: var(--text-muted);">${sz} bytes</span>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.warn(err);
    }
  },

  async clearAllSaves() {
    if (!confirm(I18n.t('Tem certeza que deseja apagar todos os saves do emulador?'))) return;
    try {
      indexedDB.deleteDatabase(this.DB_NAME);
      indexedDB.deleteDatabase('asyncStorage');
      Storage.set('j2me_latest_snapshot', '');
      App.showToast('Todos os saves foram apagados.');
      this.refreshStoresList();
    } catch (err) {
      App.showToast('Erro ao apagar saves');
    }
  }
};
