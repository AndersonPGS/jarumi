const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');const path=require('path');const crypto=require('crypto');
const root=path.resolve(__dirname,'..');
test('local fonts have immutable provenance, intact files and OFL notices',()=>{
 const manifest=require('../assets/fonts/PROVENANCE.json');
 assert.match(manifest.commit,/^[a-f0-9]{40}$/);
 for(const entry of manifest.files){
  const file=path.resolve(root,entry.path);assert.ok(file.startsWith(path.join(root,'assets','fonts')+path.sep));
  const content=fs.readFileSync(file);assert.equal(crypto.createHash('sha256').update(content).digest('hex'),entry.sha256,entry.path);
  assert.ok(entry.source.includes('/'+manifest.commit+'/'),'upstream pinned to commit');
 }
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.ok(html.includes('css/fonts.css'));assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(html));
 for(const family of ['vt323','pressstart2p','silkscreen','spacemono']){
  assert.match(fs.readFileSync(path.join(root,'assets/fonts',family,'OFL.txt'),'utf8'),/SIL OPEN FONT LICENSE/i);
 }
});
