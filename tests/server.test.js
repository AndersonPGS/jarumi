const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const os=require('os');const path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jarumi-test-'));process.env.JARUMI_DATA_DIR=tmp;
const {startServer}=require('../server');const JSZip=require('jszip');
test('isolated library, imports, runtime resources and private file protection',async t=>{
 const {server,port}=await startServer(0);t.after(()=>{server.closeAllConnections();server.close();fs.rmSync(tmp,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+port;const get=async p=>{const r=await fetch(base+p);const body=await r.arrayBuffer();return new Response(body,{status:r.status,headers:r.headers});};
 assert.deepEqual((await (await get('/api/games')).json()).games,[]);
 for(const file of ['/index.html','/player.html','/js/game-setup.js','/bld/main-all.js','/java/classes.jar']) assert.equal((await get(file)).status,200,file);
 for(const file of ['/.git/HEAD','/package.json','/main.js','/settings.json','/games/test.txt','/assets/%2e%2e%5cmain.js'])assert.equal((await get(file)).status,403,file);
 assert.equal((await get('/%FF')).status,400);
 assert.equal((await fetch(base+'/api/upload?filename=bad.jar',{method:'POST',headers:{Origin:'https://example.com'},body:'x'})).status,403);
 assert.equal((await fetch(base+'/api/upload?filename=bad.txt',{method:'POST',body:'x'})).status,400);
 const jar=new JSZip();jar.file('META-INF/MANIFEST.MF','MIDlet-Name: Test fixture\nNokia-MIDlet-Original-Display-Size: 320,240\n');
 const bytes=await jar.generateAsync({type:'nodebuffer'});
 const response=await fetch(base+'/api/upload?filename=fixture.jar',{method:'POST',body:bytes});assert.equal(response.status,200);
 const games=(await (await get('/api/games')).json()).games;assert.equal(games.length,1);assert.equal(games[0].screenResolution,'320x240');
 assert.equal((await get('/games/fixture.jar')).status,200);assert.ok(fs.existsSync(path.join(tmp,'games','fixture.jar')));
});
