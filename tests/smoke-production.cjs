const {app,BrowserWindow}=require('electron');const fs=require('fs');const os=require('os');const path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jarumi-smoke-'));process.env.JARUMI_DATA_DIR=tmp;app.setPath('userData',path.join(tmp,'profile'));
app.whenReady().then(async()=>{
 const archive=path.resolve('dist/win-unpacked/resources/app.asar');
 const {startServer}=require(path.join(archive,'server.js'));const {server,port}=await startServer(0);
 const w=new BrowserWindow({show:false,width:400,height:820,webPreferences:{partition:'production-smoke'}});
 await w.loadURL('http://127.0.0.1:'+port+'/index.html');await new Promise(r=>setTimeout(r,1800));
 console.log(await w.webContents.executeJavaScript(`(()=>{
 if(Library.games.length!==0)throw Error('Packaged library not empty');
 if(!document.querySelector('#game-screen-setup'))throw Error('Setup init failed');
 const g={filename:'fixture.jar',title:'Fixture'};Library.playGame(g);
 if(!GameSetup.dialog.open)throw Error('First-run setup missing');GameSetup.cancel();
 App.switchTab('video');Video.setNativeResolution(320,240);App.switchTab('player');Video.updatePhoneOrientation();
 if(!document.body.classList.contains('game-landscape'))throw Error('Landscape');
 Video.setNativeResolution(240,320);if(document.body.classList.contains('game-landscape'))throw Error('Portrait');
 return 'PACKAGED UI PASS: empty library, first-run setup, portrait/landscape';})()`));
 for(const name of ['games','node_modules/electron','settings.json','test-responsive.js'])if(fs.existsSync(path.join(archive,name)))throw Error('Unexpected packaged file: '+name);
 if(!fs.existsSync(path.join(archive,'java/classes.jar')))throw Error('Missing runtime');
 console.log('PACKAGED CONTENTS PASS');
 if(process.argv[2]) {
   fs.mkdirSync(path.join(tmp,'games'),{recursive:true});
   fs.copyFileSync(path.resolve(process.argv[2]),path.join(tmp,'games','smoke.jar'));
   await w.webContents.executeJavaScript(`Storage.set('jarumi_screen:smoke.jar',JSON.stringify({mode:'240x320',resolution:'240x320'}));Library.playGame({filename:'smoke.jar',title:'Smoke'});`);
   let rendered=false;
   for(let i=0;i<30;i++) {await new Promise(r=>setTimeout(r,500));rendered=await w.webContents.executeJavaScript(`(()=>{try{const c=document.getElementById('game-iframe').contentDocument.querySelector('canvas');if(!c||!c.width||!c.height)return false;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=4;i<d.length;i+=4)if(d[i]!==d[0]||d[i+1]!==d[1]||d[i+2]!==d[2])return true;return false;}catch{return false;}})()`);if(rendered)break;}
   if(!rendered)throw Error('Game did not render in packaged runtime');console.log('PACKAGED GAME RENDER PASS (local test JAR, not distributed)');
 }
 w.destroy();server.closeAllConnections();server.close();app.quit();
}).catch(e=>{console.error(e);app.exit(1)});
app.on('will-quit',()=>{try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}});
