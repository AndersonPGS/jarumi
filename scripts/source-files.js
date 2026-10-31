const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const trees = ['js','css','assets','bld','config','libs','polyfill','style','locales','scripts','tests','docs','.github','LICENSES'];
const singles = ['.gitignore','.gitattributes','package.json','package-lock.json','main.js','preload.js','server.js','update-service.js','paths.js','index.html','player.html','icon.ico','icon.png','README.md','CONTRIBUTING.md','SECURITY.md','THIRD_PARTY_NOTICES.md','java/classes.jar','java/classesold.jar'];
function files() {
  const result = singles.filter(f=>fs.existsSync(path.join(root,f)));
  const walk = dir => { for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})) {
    if(entry.isSymbolicLink()) throw Error('Symlink requires review: '+dir+'/'+entry.name);
    const name=dir+'/'+entry.name;
    if(entry.isDirectory()) walk(name); else result.push(name);
  }};
  for(const tree of trees) if(fs.existsSync(path.join(root,tree))) walk(tree);
  return result.sort();
}
module.exports={root,files};
