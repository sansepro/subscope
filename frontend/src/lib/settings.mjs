const KEY='subscope.desktop.svelte.settings';
export const defaults={appVersion:'',deviceLocale:'',deviceOs:'',deviceModel:'',userAgent:'',hwid:'',extraHeaders:''};
const from=(a)=>a[Math.floor(Math.random()*a.length)];
const hex=(size)=>{const values=new Uint8Array(size);if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(values);else for(let i=0;i<size;i++)values[i]=Math.floor(Math.random()*256);return Array.from(values,x=>x.toString(16).padStart(2,'0')).join('')};
export function generateHWID(){return 'y'+hex(6)}
export function generateAutoHeaders(){
 const appVersion=`19.${from([13,15,17,19,21])}.${from([11,13,17,19,21])}`;
 const deviceOs='Windows';
 return {appVersion,deviceLocale:from(['RU','ru-RU','en-US','EN']),deviceOs,deviceModel:from(['Xui_x86_64','Xui_amd64','Windows_x86_64']),userAgent:`Happ/${appVersion}/Windows/${from([2604171131603,2606171231603,2608171131603,2610171131603])}`,hwid:generateHWID(),extraHeaders:''};
}
export function normalizeSettings(raw={}){return Object.fromEntries(Object.keys(defaults).map(key=>[key,typeof raw?.[key]==='string'?raw[key]:defaults[key]]));}
export function createHeaders(raw={},options={}){
 const user=normalizeSettings(raw), auto=generateAutoHeaders();
 const v=Object.fromEntries(Object.keys(defaults).map(key=>[key,user[key].trim()||auto[key]]));
 if(options?.hwid!==undefined && String(options.hwid).trim())v.hwid=String(options.hwid).trim();
 const headers={'X-App-Version':v.appVersion,'X-Device-Locale':v.deviceLocale,'X-Device-Os':v.deviceOs,'X-Device-Model':v.deviceModel,'User-Agent':user.userAgent.trim()||`Happ/${v.appVersion}/${v.deviceOs}/${from([2604171131603,2606171231603,2608171131603])}`,'X-Hwid':v.hwid};
 for(const line of v.extraHeaders.split(/\r?\n/)){
  const i=line.indexOf(':');if(i<1)continue;const key=line.slice(0,i).trim(),value=line.slice(i+1).trim();
  if(/^[a-z0-9!#$%&'*+.^_`|~-]+$/i.test(key)&&!/[\r\n]/.test(value))headers[key]=value;
 }
 // Keep session-specific HWID stronger than a value in EXTRA HEADERS.
 if(options?.hwid && String(options.hwid).trim())headers['X-Hwid']=String(options.hwid).trim();
 return headers;
}
export function loadSettings(storage=globalThis.localStorage){
 try{
  const raw=JSON.parse(storage.getItem(KEY)||'{}');
  const legacy={appVersion:'19.19.19',deviceLocale:'RU',deviceOs:'Windows',deviceModel:'Xui_x86_64',userAgent:'Happ/19.19.19/Windows/2604171131603',hwid:'y1fr92390d934',extraHeaders:''};
  if(Object.keys(legacy).every(k=>raw[k]===legacy[k]))return normalizeSettings();
  return normalizeSettings(raw);
 }catch{return normalizeSettings()}
}
export function saveSettings(settings,storage=globalThis.localStorage){try{storage.setItem(KEY,JSON.stringify(normalizeSettings(settings)));return true}catch{return false}}
export {KEY as settingsKey};
