const {app,BrowserWindow}=require('electron');const path=require('path'),fs=require('fs'),os=require('os'),assert=require('assert/strict');
const root=path.resolve('.');const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jarumi-pip-'));process.env.JARUMI_DATA_DIR=tmp;app.setPath('userData',path.join(tmp,'profile'));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 const {server,port}=await require(path.join(root,'server.js')).startServer(0);
 const w=new BrowserWindow({width:360,height:480,frame:false,show:true,webPreferences:{partition:'pip-drag'}});
 await w.loadURL(`http://127.0.0.1:${port}/index.html`);await pause(1000);
 const run=s=>w.webContents.executeJavaScript(s);
 await run("App.updatePiPState(true);document.getElementById('pip-floating-bar').classList.add('active');App.setVolume(0.5)");await pause(200);
 for(const width of [360,240,160]){
  w.setSize(width,480);await pause(120);
  const box=await run(`(()=>{const e=document.getElementById('pip-floating-volume'),r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,visible:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e}})()`);
  console.log('PiP slider geometry',width,box);assert.ok(box.w>=60,'volume slider has usable width');assert.ok(box.visible,'slider is not covered');
  const y=Math.round(box.y+box.h/2),x=ratio=>Math.round(box.x+10+(box.w-20)*ratio);
  w.focus();w.webContents.focus();w.webContents.sendInputEvent({type:'mouseMove',x:x(.2),y});await pause(100);
  w.webContents.sendInputEvent({type:'mouseDown',x:x(.2),y,button:'left',clickCount:1});
  for(const t of [.3,.5,.7,.85]){w.webContents.sendInputEvent({type:'mouseMove',x:x(t),y,modifiers:['leftButtonDown']});await pause(30);}
  w.webContents.sendInputEvent({type:'mouseUp',x:x(.85),y,button:'left',clickCount:1});await pause(100);
  console.log('Volume after drag',await run('App.volume'));
  assert.ok(await run('App.volume>=0.75'),'real mouse drag changes volume');
  await run("document.getElementById('pip-floating-volume').focus()");w.webContents.sendInputEvent({type:'keyDown',keyCode:'Home'});w.webContents.sendInputEvent({type:'keyUp',keyCode:'Home'});await pause(60);assert.equal(await run('App.volume'),0,'keyboard slider control');
 }
 w.setSize(400,820);await run("App.updatePiPState(false);App.switchTab('video')");await pause(200);
 if(process.argv.includes('--capture'))fs.writeFileSync(path.join(root,'docs/screenshots/window-settings.png'),(await w.webContents.capturePage()).toPNG());
 w.setSize(240,400);await run("App.updatePiPState(true);document.getElementById('pip-floating-bar').classList.add('active')");await pause(200);
 if(process.argv.includes('--capture'))fs.writeFileSync(path.join(root,'docs/screenshots/pip-controls.png'),(await w.webContents.capturePage()).toPNG());
 console.log('PIP POINTER + KEYBOARD PASS (160, 240, 360 px)');w.destroy();server.closeAllConnections();server.close();app.exit(0);
}).catch(e=>{console.error(e);app.exit(1)});
