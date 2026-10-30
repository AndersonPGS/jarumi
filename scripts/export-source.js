const fs=require('fs');const path=require('path');const {root,files}=require('./source-files');
const target=path.join(root,'exports','jarumi-source-'+new Date().toISOString().replace(/[:.]/g,'-'));
for(const name of files()) {const dest=path.join(target,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,name),dest);}
console.log('Clean source tree (no old Git history): '+target);
console.log('Review licenses and contents before git init / publication.');
