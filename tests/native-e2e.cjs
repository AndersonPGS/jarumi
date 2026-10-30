// Runs the real main process + preload + renderer. Only OS dialogs are replaced.
const {app,BrowserWindow,dialog}=require('electron');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jarumi-native-e2e-'));
app.setPath('appData',tmp);app.setPath('userData',path.join(tmp,'initial-profile'));
process.env.JARUMI_DATA_DIR=path.join(tmp,'data');
const target=path.resolve(process.argv[2]||'.');
const JSZip=require(path.resolve('node_modules/jszip'));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let calls=[],answer={canceled:true,filePaths:[]},failure,dialogError;
const watchdog=setTimeout(()=>{console.error('Native E2E timeout');app.exit(1);},30000);
dialog.showOpenDialog=async(_window,options)=>{calls.push(options);if(dialogError)throw dialogError;return answer;};
dialog.showSaveDialog=async(_window,options)=>{calls.push(options);return {canceled:false,filePath:path.join(tmp,'backup.json')};};
process.on('unhandledRejection',e=>{failure=e;});
require(path.join(target,'main.js'));
app.whenReady().then(async()=>{
 let win;
 for(let i=0;i<100;i++){win=BrowserWindow.getAllWindows()[0];if(win&&!win.webContents.isLoading()&&await win.webContents.executeJavaScript('typeof Library!=="undefined" && !!document.getElementById("btn-import-jar")').catch(()=>false))break;await pause(100);}
 assert.ok(win,'real window created');
 const run=s=>win.webContents.executeJavaScript(s);
 await pause(500);
 assert.equal(await run('!!window.j2mePiP?.isElectron'),true,'real preload bridge');
 for(const locale of ['pt-BR','en','es']){
  await run(`Storage.set('jarumi_language',${JSON.stringify(locale)});document.getElementById('btn-import-jar').click();`);
  await pause(250);
  if(failure)throw failure;
  assert.equal(calls.length,['pt-BR','en','es'].indexOf(locale)+1,'UI click invokes native picker');
  assert.ok(calls.at(-1).filters.some(f=>f.extensions.includes('jar')),'JAR filter');
 }
 assert.equal(await run('Library.games.length'),0,'cancel keeps library empty');
 dialogError=Error('Simulated OS dialog failure');
 await run('window.e2eToasts=[];const originalToast=App.showToast.bind(App);App.showToast=text=>{window.e2eToasts.push(text);originalToast(text);};document.getElementById("btn-import-jar").click()');
 await pause(250);dialogError=null;
 assert.ok(await run('window.e2eToasts.some(t=>t.includes("Não foi possível"))'),'dialog failures are visible, not silent');
 const fixture=path.join(tmp,'fixture.jar');const jar=new JSZip();jar.file('META-INF/MANIFEST.MF','MIDlet-Name: Native test\nMIDlet-1: Native test,,test.Main\n');fs.writeFileSync(fixture,await jar.generateAsync({type:'nodebuffer'}));
 answer={canceled:false,filePaths:[fixture]};
 await run('document.getElementById("btn-import-jar").click()');await pause(600);if(failure)throw failure;
 assert.ok(fs.existsSync(path.join(process.env.JARUMI_DATA_DIR,'games','fixture.jar')),'import copied into writable data dir');
 assert.equal(await run('Library.games.some(g=>g.filename==="fixture.jar")'),true,'launcher updated');
 assert.equal(await run('GameSetup.dialog.open'),true,'import opens first-run setup');
 await run('GameSetup.cancel()');
 const exported=await run('window.j2mePiP.exportSaveData(JSON.stringify({fixture:true}))');assert.equal(exported.success,true,'native backup dialog');
 assert.equal(JSON.parse(fs.readFileSync(path.join(tmp,'backup.json'),'utf8')).fixture,true,'backup content');
 answer={canceled:false,filePaths:[path.join(tmp,'backup.json')]};
 const importedBackup=await run('window.j2mePiP.importSaveData()');assert.equal(importedBackup.data.fixture,true,'backup import roundtrip');
 fs.writeFileSync(path.join(tmp,'invalid.json'),'not json');answer={canceled:false,filePaths:[path.join(tmp,'invalid.json')]};
 assert.equal((await run('window.j2mePiP.importSaveData()')).success,false,'invalid backup handled');
 answer={canceled:true,filePaths:[]};assert.equal((await run('window.j2mePiP.importSaveData()')).success,false,'backup cancellation handled');
 await run('window.j2mePiP.saveSetting("e2e", "persisted")');
 assert.equal(await run('(async()=> (await window.j2mePiP.loadAllSettings()).e2e)()'),'persisted','settings IPC roundtrip');
 await run('window.j2mePiP.togglePiP()');await run('window.j2mePiP.togglePiP()');
 console.log('NATIVE E2E PASS: actual main/preload, Add game click, picker in 3 languages, cancel, import, launcher, first-run setup, backup, settings and PiP');
 clearTimeout(watchdog);app.exit(0);
}).catch(e=>{console.error(e);app.exit(1)});
