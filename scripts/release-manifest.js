const fs=require('fs');const crypto=require('crypto');const {version}=require('../package.json');
const tag=process.env.GITHUB_REF_NAME;
if(tag && process.env.GITHUB_REF_TYPE==='tag' && tag!=='v'+version)throw Error('Tag and package version must match');
if(process.argv.includes('--verify'))process.exit(0);
const files=[`Jarumi-${version}-Setup-x64.exe`,`Jarumi-${version}-Portable-x64.exe`];
const sums=files.map(name=>`${crypto.createHash('sha256').update(fs.readFileSync('dist/'+name)).digest('hex')}  ${name}`);
fs.writeFileSync('dist/SHA256SUMS.txt',sums.join('\n')+'\n');
console.log(sums.join('\n'));
