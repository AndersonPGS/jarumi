const REPOSITORY = 'https://github.com/AndersonPGS/jarumi';
const ENDPOINT = 'https://api.github.com/repos/AndersonPGS/jarumi/releases/latest';
function parseVersion(text) {
  const match = /^v?(\d{1,8})\.(\d{1,8})\.(\d{1,8})$/.exec(String(text));
  return match ? match.slice(1).map(Number) : null;
}
function isNewer(candidate, current) {
  const a=parseVersion(candidate),b=parseVersion(current);
  if(!a||!b)return false;
  for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}
  return false;
}
function createUpdateService({version,portable=false,packaged=false,platform=process.platform,arch=process.arch,fetchImpl=globalThis.fetch,openExternal,now=Date.now}) {
  if(!parseVersion(version))throw Error('Invalid installed version');
  const info={currentVersion:version,portable,packaged};
  let pending=null,last=null;
  async function check() {
    if(pending)return pending;
    pending=(async()=>{
      const base={...info,checkedAt:now()};
      try {
        const response=await fetchImpl(ENDPOINT,{headers:{Accept:'application/vnd.github+json','User-Agent':'Jarumi/'+version,'X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(10000),redirect:'error'});
        if(response.status===404)return last={...base,status:'unavailable'};
        if(!response.ok)throw Error('HTTP '+response.status);
        const text=await response.text();
        if(text.length>1024*1024)throw Error('Release response too large');
        const release=JSON.parse(text);
        if(release.draft||release.prerelease||!parseVersion(release.tag_name))return last={...base,status:'unavailable'};
        const latestVersion=parseVersion(release.tag_name).join('.');
        const releaseUrl=REPOSITORY+'/releases/tag/'+encodeURIComponent(release.tag_name);
        const name=`Jarumi-${latestVersion}-${portable?'Portable':'Setup'}-x64.exe`;
        const expected=REPOSITORY+'/releases/download/'+encodeURIComponent(release.tag_name)+'/'+name;
        const asset=platform==='win32'&&arch==='x64'&&Array.isArray(release.assets)&&release.assets.find(a=>a.name===name&&a.browser_download_url===expected&&a.state==='uploaded');
        return last={...base,status:isNewer(latestVersion,version)?'available':'current',latestVersion,releaseUrl,downloadUrl:asset?expected:null};
      }catch{return last={...base,status:'error'};}
    })();
    try{return await pending;}finally{pending=null;}
  }
  async function open() {
    // No URL or executable path is accepted from the renderer.
    const result=last?.status==='available'?last:await check();
    if(result.status!=='available')return {success:false};
    try{await openExternal(result.downloadUrl||result.releaseUrl);return {success:true};}catch{return {success:false};}
  }
  return {info,check,open};
}
module.exports={createUpdateService,isNewer,parseVersion};
