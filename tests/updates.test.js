const {test}=require('node:test');const assert=require('node:assert/strict');
const {createUpdateService,isNewer}=require('../update-service');
const repo='https://github.com/AndersonPGS/jarumi';
function release(version='1.0.4') {return {tag_name:'v'+version,draft:false,prerelease:false,assets:['Setup','Portable'].map(kind=>({name:`Jarumi-${version}-${kind}-x64.exe`,state:'uploaded',browser_download_url:`${repo}/releases/download/v${version}/Jarumi-${version}-${kind}-x64.exe`}))};}
function response(data,status=200){return {status,ok:status===200,text:async()=>JSON.stringify(data)};}
test('stable semantic version ordering, including multi-digit components',()=>{
 for(const [a,b] of [['1.0.10','1.0.9'],['2.0.0','1.99.99'],['1.10.0','1.9.0']])assert.equal(isNewer(a,b),true);
 for(const a of ['1.0.3','1.0.2','v1.0.3-beta','bad'])assert.equal(isNewer(a,'1.0.3'),false);
});
for(const portable of [false,true])test(`update download chooses ${portable?'Portable':'Setup'} from fixed repository`,async()=>{
 let opened;const service=createUpdateService({version:'1.0.3',portable,platform:'win32',arch:'x64',fetchImpl:async(url,options)=>{assert.equal(url,'https://api.github.com/repos/AndersonPGS/jarumi/releases/latest');assert.ok(options.signal);assert.equal(options.redirect,'error');return response(release());},openExternal:async url=>{opened=url;}});
 const r=await service.check();assert.equal(r.status,'available');assert.equal(r.latestVersion,'1.0.4');assert.ok(r.downloadUrl.includes(portable?'Portable':'Setup'));assert.equal((await service.open()).success,true);assert.equal(opened,r.downloadUrl);
});
test('equal/newer installed version does not offer an update',async()=>{
 for(const v of ['1.0.3','1.0.2']){const s=createUpdateService({version:'1.0.3',fetchImpl:async()=>response(release(v))});assert.equal((await s.check()).status,'current');assert.equal((await s.open()).success,false);}
});
test('offline, timeout, rate limiting, malformed data and missing release are recoverable',async()=>{
 for(const fetchImpl of [async()=>{throw Error('offline');},async()=>{throw new DOMException('timeout','TimeoutError');},async()=>response({},403),async()=>({ok:true,status:200,text:async()=>'{bad'})]){
  const s=createUpdateService({version:'1.0.3',fetchImpl});assert.equal((await s.check()).status,'error');
 }
 assert.equal((await createUpdateService({version:'1.0.3',fetchImpl:async()=>response({},404)}).check()).status,'unavailable');
});
test('draft and prerelease versions are not offered',async()=>{
 for(const field of ['draft','prerelease']){const data=release();data[field]=true;assert.equal((await createUpdateService({version:'1.0.3',fetchImpl:async()=>response(data)}).check()).status,'unavailable');}
});
test('untrusted or absent asset URL falls back to canonical release page',async()=>{
 for(const assets of [[],[{name:'Jarumi-1.0.4-Setup-x64.exe',state:'uploaded',browser_download_url:'https://evil.invalid/file.exe'}]]){
  let url;const data=release();data.assets=assets;data.html_url='https://evil.invalid';const s=createUpdateService({version:'1.0.3',platform:'win32',arch:'x64',fetchImpl:async()=>response(data),openExternal:async value=>{url=value;}});
  assert.equal((await s.check()).downloadUrl,null);await s.open();assert.equal(url,repo+'/releases/tag/v1.0.4');
 }
});
test('concurrent checks share one request and a later retry can succeed',async()=>{
 let calls=0,complete;const wait=new Promise(r=>complete=r);const s=createUpdateService({version:'1.0.3',fetchImpl:async()=>{calls++;await wait;return response(release());}});
 const a=s.check(),b=s.check();complete();assert.equal((await a).status,'available');await b;assert.equal(calls,1);
 await s.check();assert.equal(calls,2);
});
test('unsupported OS or architecture uses canonical release rather than wrong executable',async()=>{
 for(const options of [{platform:'darwin',arch:'x64'},{platform:'win32',arch:'arm64'}])assert.equal((await createUpdateService({version:'1.0.3',...options,fetchImpl:async()=>response(release())}).check()).downloadUrl,null);
});
