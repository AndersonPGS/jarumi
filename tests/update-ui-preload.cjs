const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('j2mePiP',{
 getUpdateInfo:()=>ipcRenderer.invoke('fixture-update-info'),
 checkUpdates:()=>ipcRenderer.invoke('fixture-update-check'),
 openUpdate:()=>ipcRenderer.invoke('fixture-update-open'),
 loadAllSettings:()=>ipcRenderer.invoke('fixture-update-settings')
});
