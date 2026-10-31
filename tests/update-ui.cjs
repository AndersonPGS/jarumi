const {app,BrowserWindow,ipcMain}=require('electron');const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jarumi-update-ui-'));app.setPath('userData',tmp);process.env.JARUMI_DATA_DIR=tmp;
app.on('window-all-closed',()=>{});
const cases=new Map(),pause=ms=>new Promise(r=>setTimeout(r,ms));
ipcMain.handle('fixture-update-info',()=>({currentVersion:'1.0.3',packaged:true,portable:true}));
ipcMain.handle('fixture-update-settings',e=>({jarumi_check_updates:cases.get(e.sender.id).auto?'true':'false',jarumi_language:'pt-BR'}));
ipcMain.handle('fixture-update-check',e=>{const c=cases.get(e.sender.id);c.calls++;return {status:c.status,currentVersion:'1.0.3',latestVersion:'1.0.4',checkedAt:Date.now(),downloadUrl:'fixture-only'};});
ipcMain.handle('fixture-update-open',e=>{cases.get(e.sender.id).opened++;return {success:true};});
const watchdog=setTimeout(()=>{console.error('Update UI timeout');app.exit(1);},30000);
app.whenReady().then(async()=>{
 const {server,port}=await require('../server').startServer(0);
 for(const config of [{auto:true,status:'available'},{auto:true,status:'current'},{auto:false,status:'error'}]){
  const state={...config,calls:0,opened:0};
  const w=new BrowserWindow({show:false,width:400,height:820,webPreferences:{partition:'updates-'+config.status,preload:path.join(__dirname,'update-ui-preload.cjs')}});cases.set(w.webContents.id,state);
  const run=s=>w.webContents.executeJavaScript(s);
  await w.loadURL(`http://127.0.0.1:${port}/index.html`);await pause(2800);
  assert.equal(state.calls,config.auto?1:0,'startup preference determines request');
  assert.equal(await run('document.getElementById("update-notice").hidden'),config.status!=='available','only new version opens notice');
  if(config.status==='available'){
   await run('document.getElementById("btn-view-update").click()');await pause(80);assert.equal(await run('App.currentView'),'updates');
   assert.equal(await run('document.getElementById("btn-download-update").hidden'),false);
   await run('document.getElementById("btn-download-update").click()');await pause(50);assert.equal(state.opened,1);
   if(process.argv.includes('--capture')){w.showInactive();await pause(250);fs.writeFileSync(path.join(os.tmpdir(),'jarumi-update-screen.png'),(await w.webContents.capturePage()).toPNG());console.log('Screenshot',path.join(os.tmpdir(),'jarumi-update-screen.png'));}
  }
  await run('document.getElementById("btn-check-updates").click()');await pause(100);
  assert.equal(state.calls,config.auto?2:1,'manual check works even with startup disabled');
  assert.equal(await run('document.getElementById("btn-check-updates").disabled'),false,'button recovers after check');
  if(config.status==='error')assert.equal(await run('document.getElementById("btn-download-update").hidden'),true);
  w.destroy();
 }
 server.closeAllConnections();server.close();clearTimeout(watchdog);console.log('UPDATE UI PASS: startup notice, current version, disabled startup, manual retry, error and download button');app.exit(0);
}).catch(e=>{console.error(e);app.exit(1)});
