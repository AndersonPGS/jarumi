const Updates = {
  busy:false,info:null,result:null,dismissedVersion:null,
  async init() {
    this.status=document.getElementById('update-status');
    this.checkButton=document.getElementById('btn-check-updates');
    this.downloadButton=document.getElementById('btn-download-update');
    this.notice=document.getElementById('update-notice');
    this.toggle=document.getElementById('check-updates-startup');
    this.toggle.checked=Storage.get('jarumi_check_updates')!=='false';
    this.toggle.addEventListener('change',()=>Storage.set('jarumi_check_updates',this.toggle.checked));
    this.checkButton.addEventListener('click',()=>this.check(true));
    this.downloadButton.addEventListener('click',()=>this.download());
    document.getElementById('btn-view-update').addEventListener('click',async()=>{
      if(App.isPiP)await App.togglePiP();
      App.switchTab('updates');this.notice.hidden=true;
    });
    document.getElementById('btn-dismiss-update').addEventListener('click',()=>{this.dismissedVersion=this.result?.latestVersion;this.notice.hidden=true;});
    if(!window.j2mePiP?.getUpdateInfo){this.checkButton.disabled=true;this.toggle.disabled=true;this.status.textContent='A verificação está disponível no aplicativo desktop.';return;}
    try{
      this.info=await window.j2mePiP.getUpdateInfo();
      document.getElementById('installed-version').textContent=this.info.currentVersion;
      this.status.textContent='Verifique se há uma nova versão do Jarumi.';
      if(this.info.packaged)setTimeout(()=>{if(this.toggle.checked)this.check(false);},2000);
    }catch{this.status.textContent='Não foi possível verificar atualizações. Tente novamente.';}
  },
  async check(manual=true) {
    if(this.busy||!window.j2mePiP?.checkUpdates)return;
    this.busy=true;this.checkButton.disabled=true;this.status.textContent='Verificando atualizações…';
    try {
      const result=await window.j2mePiP.checkUpdates();this.result=result;
      this.downloadButton.hidden=result.status!=='available';
      if(result.status==='available'){
        this.status.textContent=`Jarumi ${result.latestVersion} está disponível.`;
        this.downloadButton.textContent=result.downloadUrl?'Baixar atualização':'Abrir página da versão';
        document.getElementById('update-download-note').textContent=result.downloadUrl?(this.info?.portable?'Baixe o novo Portable e substitua o arquivo após fechar o Jarumi.':'Feche o Jarumi e execute o novo instalador após baixar.'):'Consulte os downloads disponíveis na Release.';
        if(!manual&&this.dismissedVersion!==result.latestVersion){document.getElementById('update-notice-text').textContent=this.status.textContent;this.notice.hidden=false;}
      }else {
        this.notice.hidden=true;
        this.status.textContent=({current:'Você está usando a versão mais recente.',error:'Não foi possível verificar atualizações. Tente novamente.',unavailable:'Nenhuma versão está disponível para consulta.'})[result.status]||'Não foi possível verificar atualizações. Tente novamente.';
        document.getElementById('update-download-note').textContent='';
      }
      document.getElementById('update-last-check').textContent=`Última verificação: ${new Date(result.checkedAt).toLocaleString(I18n.locale)}`;
    }catch{this.status.textContent='Não foi possível verificar atualizações. Tente novamente.';this.downloadButton.hidden=true;}
    finally{this.busy=false;this.checkButton.disabled=false;}
  },
  async download(){
    this.downloadButton.disabled=true;
    try{const result=await window.j2mePiP.openUpdate();if(!result.success)App.showToast('Não foi possível abrir o download. Tente novamente.');}
    catch{App.showToast('Não foi possível abrir o download. Tente novamente.');}
    finally{this.downloadButton.disabled=false;}
  }
};
