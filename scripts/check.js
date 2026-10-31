const fs=require('fs');const path=require('path');const cp=require('child_process');const {root,files}=require('./source-files');
for(const name of files().filter(f=>(f.endsWith('.js')||f.endsWith('.cjs'))&&!f.startsWith('libs/'))) {
 const result=cp.spawnSync(process.execPath,['--check',path.join(root,name)],{encoding:'utf8'});
 if(result.status!==0){console.error(result.stderr);process.exit(1);}
}
const pkg=require('../package.json');const lock=require('../package-lock.json');
if(pkg.version!==lock.version)throw Error('Version mismatch');
for(const name of files())if(['games','node_modules','screenshots','dist'].includes(name.split('/')[0]))throw Error('Private file in source export: '+name);
cp.execFileSync(process.execPath,['scripts/build-locales.js'],{cwd:root,stdio:'inherit'});
console.log('Syntax, source allowlist, versions and locales OK');
