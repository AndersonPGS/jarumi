// Library Manager: Auto-scans, renders game cards, handles upload & import, recents shelf, auto-launch
const Library = {
  games: [],
  currentGame: null,
  recentGames: [],
  favorites: [],
  listFilter: 'all',
  searchText: '',
  autoOpenLast: true,

  async init() {
    GameSetup.init();
    this.loadSettings();
    this.setupEvents();
    await this.refreshGames();

    // Listen for real-time folder updates from Electron watcher
    if (window.j2mePiP?.onGamesUpdated) {
      window.j2mePiP.onGamesUpdated((updatedGames) => {
        this.games = updatedGames;
        this.render();
        this.renderRecents();
        App.showToast(`Biblioteca atualizada: ${updatedGames.length} jogos`);
      });
    }
  },

  loadSettings() {
    try { const stored = JSON.parse(Storage.get('j2me_favorites') || '[]'); this.favorites = Array.isArray(stored) ? stored.filter(x=>typeof x==='string') : []; } catch { this.favorites=[]; }

    try {
      const recentsVal = Storage.get('j2me_recent_games');
      this.recentGames = recentsVal ? (typeof recentsVal === 'string' ? JSON.parse(recentsVal) : recentsVal) : [];
      this.autoOpenLast = Storage.get('j2me_auto_open_last') === 'true';
      const chkAuto = document.getElementById('chk-auto-open-last');
      if (chkAuto) chkAuto.checked = this.autoOpenLast;
    } catch (e) {
      this.recentGames = [];
      this.autoOpenLast = true;
    }
  },

  setupEvents() {
    // Search input
    const searchInput = document.getElementById('search-games');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.render(e.target.value);
      });
    }

    // Auto-open checkbox
    const chkAuto = document.getElementById('chk-auto-open-last');
    if (chkAuto) {
      chkAuto.addEventListener('change', (e) => {
        this.autoOpenLast = e.target.checked;
        Storage.set('j2me_auto_open_last', this.autoOpenLast);
        App.showToast(this.autoOpenLast ? 'Auto-abrir ativado' : 'Auto-abrir desativado');
      });
    }

    // Clear recents button
    const btnClearRecents = document.getElementById('btn-clear-recent');
    if (btnClearRecents) {
      btnClearRecents.addEventListener('click', () => {
        this.recentGames = [];
        Storage.set('j2me_recent_games', []);
        this.renderRecents();
        App.showToast('Histórico de recentes limpo.');
      });
    }

    // Import button
    const btnImport = document.getElementById('btn-import-jar');
    if (btnImport) {
      btnImport.addEventListener('click', () => this.importJarDialog());
    }

    // Open games folder button
    const btnOpenFolder = document.getElementById('btn-open-folder');
    if (btnOpenFolder) {
      btnOpenFolder.addEventListener('click', () => {
        if (window.j2mePiP?.openGamesFolder) {
          window.j2mePiP.openGamesFolder();
        } else {
          App.showToast('Abra a pasta "games" no diretório do projeto');
        }
      });
    }

    // Drag and Drop Zone
    const dropzone = document.getElementById('dropzone');
    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
          this.handleDroppedFiles(e.dataTransfer.files);
        }
      });

      dropzone.addEventListener('click', () => this.importJarDialog());
    }
  },

  async refreshGames() {
    try {
      const res = await fetch('/api/games');
      const data = await res.json();
      if (data.success) {
        this.games = data.games;
        this.render();
        this.renderRecents();
        const badge = document.getElementById('tab-library-badge');
        if (badge) badge.textContent = this.games.length;

        // Auto-launch last played game immediately once library data is ready
        if (typeof App !== 'undefined' && !App.hasAutoLaunched) {
          App.autoLaunchGame();
        }
      }
    } catch (err) {
      console.error('Failed to load games:', err);
    }
  },

  renderRecents() {
    const sec = document.getElementById('recent-games-section');
    const strip = document.getElementById('recent-games-strip');
    if (!sec || !strip) return;

    if (!this.recentGames || this.recentGames.length === 0) {
      sec.classList.add('hidden');
      return;
    }

    // Map recent items to game objects
    const recentList = this.recentGames
      .map(filename => this.games.find(g => g.filename === filename))
      .filter(Boolean);

    if (recentList.length === 0) {
      sec.classList.add('hidden');
      return;
    }

    sec.classList.remove('hidden');
    strip.innerHTML = recentList.map(game => `
      <div class="recent-game-card" onclick="Library.playByFilename('${game.filename}')" title="Clique para jogar ${game.title}">
        ${game.iconUrl ? `<img src="${game.iconUrl}" class="recent-card-icon" alt="icon">` : `<div class="recent-card-icon">🎮</div>`}
        <div class="recent-card-info">
          <div class="recent-card-title">${game.title}</div>
          <div class="recent-card-time">▶ Jogar agora</div>
        </div>
      </div>
    `).join('');
  },

  recordPlayed(filename) {
    Storage.set('j2me_last_played', filename);

    // Prepend to recentGames and deduplicate
    this.recentGames = [filename, ...this.recentGames.filter(f => f !== filename)].slice(0, 10);
    Storage.set('j2me_recent_games', this.recentGames);

    this.renderRecents();
  },

  async importJarDialog() {
    if (window.j2mePiP?.pickJarFile) {
      let res;
      try { res = await window.j2mePiP.pickJarFile(); }
      catch (error) { console.error("Native import failed:", error); App.showToast("Não foi possível abrir a importação. Tente novamente."); return; }
      if (res.success && res.allGames) {
        this.games = res.allGames;
        this.render();
        this.renderRecents();
        App.showToast(`Importado com sucesso! (${res.imported.length} jogos)`);
        if (res.imported.length === 1) {
          this.playGame(res.imported[0]);
        }
      }
    } else {
      // Fallback input file for web
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.jar';
      input.onchange = (e) => {
        if (e.target.files.length) {
          this.handleDroppedFiles(e.target.files);
        }
      };
      input.click();
    }
  },

  async handleDroppedFiles(fileList) {
    let importedCount = 0;
    for (const file of fileList) {
      if (!file.name.toLowerCase().endsWith('.jar')) continue;
      try {
        const res = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
          method: 'POST',
          body: file
        });
        const data = await res.json();
        if (data.success) importedCount++;
      } catch (err) {
        console.error('Upload error:', err);
      }
    }

    if (importedCount > 0) {
      await this.refreshGames();
      App.showToast(`${importedCount} jogo(s) adicionado(s) com sucesso!`);
    }
  },

  toggleFavorite(filename) {
    this.favorites=this.favorites.includes(filename)?this.favorites.filter(f=>f!==filename):[...this.favorites,filename];
    Storage.set('j2me_favorites',this.favorites);
    this.render();
  },

  closeGameMenu() {
    document.getElementById('game-context-menu')?.remove();
    if(this.menuCleanup){this.menuCleanup();this.menuCleanup=null;}
  },

  openGameMenu(game, anchor, x, y) {
    this.closeGameMenu();
    const menu=document.createElement('div');menu.id='game-context-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label',game.title);
    const action=document.createElement('button');action.type='button';action.setAttribute('role','menuitem');action.textContent=this.favorites.includes(game.filename)?'Remover dos favoritos':'Adicionar aos favoritos';
    action.addEventListener('click',()=>{this.toggleFavorite(game.filename);this.closeGameMenu();const target=[...document.querySelectorAll('.game-card')].find(c=>c.dataset.filename===game.filename);target?.querySelector('button').focus();});
    const screen=document.createElement("button");screen.type="button";screen.setAttribute("role","menuitem");screen.textContent="Configurar tela do jogo";screen.onclick=()=>{this.closeGameMenu();GameSetup.open(game);};
    menu.append(action,screen);document.body.append(menu);
    const rect=menu.getBoundingClientRect();menu.style.left=Math.max(4,Math.min(x,innerWidth-rect.width-4))+'px';menu.style.top=Math.max(4,Math.min(y,innerHeight-rect.height-4))+'px';action.focus();
    const outside=e=>{if(!menu.contains(e.target))this.closeGameMenu();};
    const escape=e=>{if(e.key==='Escape'){e.preventDefault();this.closeGameMenu();anchor.focus();}};
    const scroll=()=>this.closeGameMenu();
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);document.getElementById('view-library').addEventListener('scroll',scroll);
    this.menuCleanup=()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);document.getElementById('view-library').removeEventListener('scroll',scroll);};
  },

  createLauncherCard(game) {
    const card=document.createElement('div');card.className='game-card';card.dataset.filename=game.filename;
    const play=document.createElement('button');play.className='launcher-game-open';play.type='button';play.setAttribute('aria-label','Jogar '+game.title);play.setAttribute('aria-haspopup','menu');
    const icon=document.createElement('div');icon.className='game-card-icon';
    if(game.iconUrl){const img=document.createElement('img');img.src=game.iconUrl;img.alt='';icon.append(img);}else{const fallback=document.createElement('span');fallback.className='fallback-icon';icon.append(fallback);}
    const title=document.createElement('span');title.className='game-card-title';title.textContent=game.title;title.title=game.title;
    play.append(icon,title);play.addEventListener('click',()=>{this.closeGameMenu();this.playGame(game);});
    play.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();const r=play.getBoundingClientRect();this.openGameMenu(game,play,e.clientX||r.left,e.clientY||r.bottom);});
    play.addEventListener('keydown',e=>{if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const r=play.getBoundingClientRect();this.openGameMenu(game,play,r.left,r.bottom);}});
    card.append(play);return card;
  },

  render(filterText) {
    this.closeGameMenu();
    if(typeof filterText==='string')this.searchText=filterText;
    const grid=document.getElementById('games-grid');if(!grid)return;
    const query=this.searchText.toLowerCase().trim();
    const matches=game=>[game.title,game.vendor,game.filename].some(v=>String(v||'').toLowerCase().includes(query));
    const all=this.games.filter(matches);
    const favorites=this.favorites.map(f=>this.games.find(g=>g.filename===f)).filter(Boolean).filter(matches);
    const recent=this.recentGames.map(f=>this.games.find(g=>g.filename===f)).filter(Boolean).filter(matches);
    grid.replaceChildren();
    const section=(id,label,games)=>{
      if(!games.length)return;
      const group=document.createElement('section');group.className='launcher-section';group.dataset.section=id;
      const heading=document.createElement('h3');heading.textContent=label;
      const list=document.createElement('div');list.className='launcher-section-grid';games.forEach(game=>list.append(this.createLauncherCard(game)));
      group.append(heading,list);grid.append(group);
    };
    section('favorites','Favoritos',favorites);section('recent','Jogados recentemente',recent);section('all',query?'Resultados':'Todos os jogos',all);
    if(!all.length){const empty=document.createElement('p');empty.className='launcher-empty';empty.textContent=query?'Nenhum jogo encontrado.':'Adicione um arquivo .jar para começar.';grid.append(empty);}
  },

  playByFilename(filename) {
    const game = this.games.find(g => g.filename === filename);
    if (game) this.playGame(game);
  },

  playGame(game, previewResolution) {
    const profile = GameSetup.read(game);
    if (!previewResolution && !profile) { GameSetup.open(game); return; }
    const gameResolution = previewResolution || profile.resolution;
    const resolutionSelect = document.getElementById("select-resolution");
    if (resolutionSelect) resolutionSelect.value = gameResolution;
    this.currentGame = game;
    this.recordPlayed(game.filename);
    this.render();

    // Update status indicators in titlebar
    const pill = document.getElementById('active-game-pill');
    const titleText = document.getElementById('active-game-title');
    if (pill && titleText) {
      pill.classList.remove('hidden');
      titleText.textContent = game.title;
    }

    // Build player URL
    let url = `player.html?jars=games/${encodeURIComponent(game.filename)}`;
    if (game.mainClass) {
      url += `&midletClassName=${encodeURIComponent(game.mainClass)}`;
    }

    // Pass canvas resolution preset
    const currentRes = gameResolution;
    if (currentRes && currentRes !== 'auto') {
      url += `&canvasSize=size-${currentRes}`;
    }

    const iframe = document.getElementById('game-iframe');
    if (iframe) {
      Video.hasNativeResolution = false;
      [Video.nativeWidth, Video.nativeHeight] = gameResolution.split("x").map(Number);
      Video.setNativeResolution(Video.nativeWidth, Video.nativeHeight);
      iframe.onload = () => {
        App.syncVolumeToIframe();
        Controls.syncWithPlayer();
        Video.applySettings();
      };
      iframe.src = url;
    }

    // Switch to player tab
    App.switchTab('player');
    App.showToast(`Carregando "${game.title}"...`);

    // Focus iframe for immediate keyboard play and sync volume
    setTimeout(() => {
      iframe?.focus();
      App.syncVolumeToIframe();
      Controls.syncWithPlayer();
    }, 400);

    setTimeout(() => {
      App.syncVolumeToIframe();
    }, 1200);
  }
};
