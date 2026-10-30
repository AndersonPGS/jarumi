// Original pixel icons and device themes. Game pixels are never recolored.
const JarumiUI = {
  icons: {
    pip: 'M1 2h14v12H1z M3 4v8h10V4z M8 8h4v3H8z',
    wifi: 'M1 3h14v2H1z M3 6h10v2H3z M5 9h6v2H5z M7 12h2v2H7z',
    pause: 'M3 2h4v12H3z M9 2h4v12H9z',
    text: 'M1 2h14v3H9v10H6V5H1z',
    help: 'M4 1h8v2h2v5h-2v2H9v1H6V8h3V7h2V4H5v2H2V3h2z M6 13h3v3H6z',
    keyboard: 'M1 3h14v10H1z M3 5v2h2V5z M7 5v2h2V5z M11 5v2h2V5z M3 9v2h2V9z M6 9v2h7V9z',
    load: 'M1 4h5V2h4v2h5v10H1z M6 5v3H4l4 4 4-4h-2V5z',
    settings: 'M6 1h4v2h2v2h3v6h-3v2h-2v2H6v-2H4v-2H1V5h3V3h2z M6 6v4h4V6z',
    add: 'M6 2h4v4h4v4h-4v4H6v-4H2V6h4z',
    home: 'M7 1h2v2h2v2h2v2h2v2h-2v6H9v-4H7v4H3V9H1V7h2V5h2V3h2z',
    play: 'M4 2h2v2h3v2h3v2h2v1h-2v2H9v2H6v2H4z',
    controls: 'M2 4h12v2h1v7h-4v-2H5v2H1V6h1z M4 6v2H2v1h2v2h1V9h2V8H5V6z M10 7v2h2V7z',
    screen: 'M1 2h14v10H9v2h3v1H4v-1h3v-2H1z M3 4v6h10V4z',
    save: 'M2 1h10v2h2v12H2z M5 2v4h6V2z M5 9v5h6V9z',
    folder: 'M1 3h5l2 2h7v9H1z M2 7v6h12V7z',
    palette: 'M4 1h8v1h2v2h1v6h-2v2h-3v3H5v-1H3v-2H1V5h1V3h2z M4 4v2h2V4z M9 3v2h2V3z M11 7v2h2V7z M3 9v2h2V9z',
    search: 'M2 1h7v1h2v8H9v1H7v1h2v2h2v2h-3v-2H6v-2H2v-2H1V3h1z M3 3v6h6V3z'
  },
  icon(name) { return `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="${this.icons[name] || this.icons.screen}"/></svg>`; },
  init() {
    document.getElementById('launcher-cuponizze')?.addEventListener('click',()=>{
      if(window.j2mePiP?.openCuponizze)window.j2mePiP.openCuponizze().catch(()=>App.showToast('Não foi possível abrir a Cuponizze.'));
      else window.open('https://cuponizze.com/','_blank','noopener,noreferrer');
    });
    const targets = {'launcher-settings':'settings','launcher-import':'add','launcher-resume':'play','btn-home':'home'};
    for (const [id,icon] of Object.entries(targets)) {
      const el=document.getElementById(id); if (!el) continue;
      const slot=el.querySelector('.launcher-icon');
      if(slot) slot.innerHTML=this.icon(icon); else el.innerHTML=this.icon(icon);
    }
    for (const [view,icon] of Object.entries({controls:'controls',video:'screen',saves:'save',themes:'palette'})) {
      const el=document.querySelector(`[data-open-view="${view}"] > span`); if(el) el.innerHTML=this.icon(icon);
    }
    const folder=document.querySelector('#settings-open-folder > span'); if(folder) folder.innerHTML=this.icon('folder');
    const search=document.querySelector('.search-icon');if(search)search.innerHTML=this.icon('search');
    const more=document.getElementById('btn-dock-more');if(more){more.innerHTML=this.icon('settings');more.setAttribute('aria-label','Mais opções do jogo');}
    for(const [id,label] of Object.entries({'btn-hud-quicksave':'SALVAR','btn-hud-quickload':'CARREGAR'})){
      const button=document.getElementById(id);if(button)button.textContent=label;
    }
    const dockIcons={'btn-pause':['pause','Pausar ou retomar'],'btn-show-type-dialog':['text','Digitar texto'],'btn-show-keymap-guide':['help','Guia de teclas'],'btn-toggle-keypad-drawer':['keyboard','Mostrar ou ocultar teclado'],'btn-hud-quicksave':['save','Salvar progresso (F5)'],'btn-hud-quickload':['load','Carregar progresso (F8)'],'btn-dock-more':['settings','Mais opções']};
    for(const [id,[icon,label]] of Object.entries(dockIcons)){
      const button=document.getElementById(id);if(!button)continue;
      button.innerHTML=this.icon(icon);button.setAttribute('aria-label',label);button.title=label;
    }
    const pause=document.getElementById('btn-pause');
    pause?.addEventListener('click',()=>{
      pause.innerHTML=this.icon(App.isPaused?'play':'pause');
      pause.setAttribute('aria-label',App.isPaused?'Retomar jogo':'Pausar jogo');pause.title=pause.getAttribute('aria-label');pause.setAttribute('aria-pressed',String(App.isPaused));
    });
    const theme=Storage.get('jarumi_theme') || Storage.get('pocket_theme','classic'); this.setTheme(theme,false);
    document.querySelectorAll('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>this.setTheme(button.dataset.themeChoice)));
    const clock=()=>{document.getElementById('jarumi-clock').textContent=new Date().toLocaleTimeString(I18n.locale,{hour:'2-digit',minute:'2-digit'});};
    clock();setInterval(clock,30000);window.addEventListener('jarumi-language-changed',clock);
    const pip=document.getElementById('btn-toggle-pip');pip.innerHTML=this.icon('pip');pip.setAttribute('aria-label','Alternar PiP (F10)');pip.title='Alternar PiP (F10)';
    this.setupDeviceStatus();
    const grid=document.getElementById('games-grid');
    new MutationObserver(()=>{const count=document.getElementById('launcher-total');if(count)count.textContent=`${Library.games.length} JOGOS`;}).observe(grid,{childList:true});
    document.querySelector('.phone-keypad').addEventListener('pointerdown',e=>{
      const button=e.target.closest('button[data-code]');
      if(!button||document.body.dataset.view==='player')return;
      e.preventDefault();e.stopPropagation();
      this.navigate(Number(button.dataset.code));
    },true);
  },
  setupDeviceStatus() {
    const network=document.getElementById('network-status');
    const updateNetwork=()=>{
      const online=navigator.onLine;
      network.innerHTML='<span class="signal-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';network.classList.toggle('offline',!online);
      const type=navigator.connection?.type;
      const label=!online?'Sem conexão':type==='wifi'?'Wi-Fi conectado':'Conectado à rede';
      network.setAttribute('aria-label',label);network.title=label;
    };
    updateNetwork();window.addEventListener('online',updateNetwork);window.addEventListener('offline',updateNetwork);navigator.connection?.addEventListener('change',updateNetwork);
    navigator.getBattery?.().then(battery=>{
      const el=document.getElementById('battery-status');
      const update=()=>{const percent=Math.round(battery.level*100);el.hidden=false;el.querySelector('.battery-fill').style.width=`${percent}%`;el.classList.toggle('charging',battery.charging);const label=`Bateria: ${percent}%${battery.charging?' · Carregando ou conectado à energia':''}`;el.title=label;el.setAttribute('aria-label',label);};
      update();battery.addEventListener('levelchange',update);battery.addEventListener('chargingchange',update);
    }).catch(()=>{});
  },
  navigate(code) {
    const view=document.body.dataset.view;
    if(code===-7 || code===-11) {App.switchTab(['controls','video','saves','themes','languages'].includes(view)?'settings':'library');return;}
    const panel=document.querySelector('.view-panel.active');
    const buttons=[...panel.querySelectorAll('.launcher-app:not(.hidden), .launcher-game-open, .settings-link, .theme-choice')].filter(b=>b.getClientRects().length);
    if(!buttons.length)return;
    let index=buttons.indexOf(document.activeElement);
    const columns=view==='library'?3:1;
    if(code===-5||code===53||code===-6){if(index<0)index=0;buttons[index].click();return;}
    const delta=({'-1':-columns,'-2':columns,'-3':-1,'-4':1,50:-columns,56:columns,52:-1,54:1})[code];
    if(delta!==undefined){index=index<0?0:Math.max(0,Math.min(buttons.length-1,index+delta));buttons[index].focus();buttons[index].scrollIntoView({block:'nearest'});}
  },
  setTheme(theme,save=true) {
    if(!['classic','dark','ice','amber','pocket'].includes(theme))theme='classic';
    document.body.dataset.theme=theme;
    document.querySelectorAll('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeChoice===theme)));
    if(save)Storage.set('jarumi_theme',theme);
  }
};
