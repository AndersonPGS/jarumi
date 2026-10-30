// Resolution profiles are committed only after a user previews and confirms them.
const GameSetup = {
  pending: null,
  read(game) {
    try {
      const value = JSON.parse(Storage.get('jarumi_screen:' + game.filename) || 'null');
      return value && /^(128x128|128x160|176x208|176x220|240x320|320x240|240x400|360x640|640x360)$/.test(value.resolution) ? value : null;
    } catch { return null; }
  },
  guess(game) {
    return game.screenResolution || game.filename.match(/(?:^|\D)(128x128|128x160|176x208|176x220|240x320|320x240|240x400|360x640|640x360)(?:\D|$)/i)?.[1].toLowerCase() || null;
  },
  init() {
    if (this.dialog) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'game-screen-setup';
    dialog.innerHTML = `<form method="dialog"><h2>Configurar tela do jogo</h2><p class="setup-game-name"></p><p>Teste a tela antes de salvar. Alterar a resolução reinicia o jogo.</p><label for="game-screen-choice">Resolução / proporção</label><select id="game-screen-choice" class="select-custom"><option value="auto">Tentar detectar automaticamente</option>${['128x128','128x160','176x208','176x220','240x320','320x240','240x400','360x640','640x360'].map(r=>`<option value="${r}">${r.replace('x',' × ')} · ${I18n.t(Number(r.split('x')[0])>Number(r.split('x')[1])?'Horizontal':'Vertical')}</option>`).join('')}</select><p id="game-screen-hint"></p><div class="setup-actions"><button type="button" id="game-screen-cancel">Cancelar</button><button type="button" id="game-screen-test">Testar no jogo</button></div></form>`;
    document.getElementById('app-container').append(dialog);
    const bar=document.createElement('div');bar.id='game-screen-preview';bar.hidden=true;
    bar.innerHTML='<span>Confira se a imagem está correta.</span><button type="button" id="game-screen-adjust">Ajustar</button><button type="button" id="game-screen-confirm">Confirmar tela</button>';
    document.getElementById('view-player').append(bar);
    this.dialog=dialog;this.bar=bar;
    const choice=document.getElementById('game-screen-choice');
    choice.addEventListener('change',()=>this.hint());
    document.getElementById('game-screen-test').onclick=()=>this.test();
    document.getElementById('game-screen-adjust').onclick=()=>{bar.hidden=true;dialog.showModal();};
    document.getElementById('game-screen-confirm').onclick=()=>this.confirm();
    document.getElementById('game-screen-cancel').onclick=()=>this.cancel();
    dialog.addEventListener('cancel',e=>{e.preventDefault();this.cancel();});
    dialog.addEventListener('keydown',e=>e.stopPropagation());
    const edit=document.createElement('button');edit.type='button';edit.textContent='Configurar tela deste jogo';edit.className='btn-secondary';
    edit.onclick=()=>{if(Library.currentGame)this.open(Library.currentGame);};
    document.getElementById('resolution-info').after(edit);
  },
  hint() {
    const automatic=document.getElementById('game-screen-choice').value==='auto';
    const guessed=this.guess(this.pending.game);
    document.getElementById('game-screen-hint').textContent=automatic ? (guessed ? `Resolução sugerida: ${guessed}` : 'O arquivo não informa a resolução. O teste usará 240 × 320; ajuste se necessário.') : 'A escolha será salva apenas após a confirmação.';
  },
  open(game) {
    if(!this.dialog)this.init();
    this.bar.hidden=true;
    this.pending={game, previous:this.read(game), tested:false};
    this.dialog.querySelector('.setup-game-name').textContent=game.title;
    document.getElementById('game-screen-choice').value=this.pending.previous?.mode==='auto'?'auto':this.pending.previous?.resolution || 'auto';
    this.hint();if(!this.dialog.open)this.dialog.showModal();
  },
  test() {
    const mode=document.getElementById('game-screen-choice').value;
    Object.assign(this.pending,{mode,resolution:mode==='auto'?(this.guess(this.pending.game)||'240x320'):mode,tested:true});
    this.dialog.close();this.bar.hidden=false;
    Library.playGame(this.pending.game, this.pending.resolution);
  },
  confirm() {
    if(!this.pending?.tested)return;
    const {game,mode,resolution}=this.pending;
    Storage.set('jarumi_screen:'+game.filename,JSON.stringify({mode,resolution}));
    this.bar.hidden=true;this.pending=null;
    App.showToast('Tela salva para este jogo.');
  },
  cancel() {
    const pending=this.pending;this.dialog.close();this.bar.hidden=true;this.pending=null;
    if(pending?.tested){
      if(pending.previous)Library.playGame(pending.game);
      else {document.getElementById('game-iframe').src='about:blank';App.switchTab('library');}
    }
  }
};
