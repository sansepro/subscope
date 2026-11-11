const DB='subscope-history';const STORE='checks';const MAX=30;
export function prepareHistoryRecord({sourceMode,sourceUrl='',sourceName='',body,report,intel={ips:{},hosts:{}},audit}){
 return {id:`${Date.now()}-${Math.random().toString(36).slice(2,10)}`,createdAt:new Date().toISOString(),sourceMode,sourceUrl,sourceName,body,kind:report?.sourceKind||'',records:report?.stats?.records||0,nodes:report?.nodes?.length||0,score:audit?.score??report?.score?.total??0,intel,checkedIPs:Object.keys(intel?.ips||{}).length};
}
export function historyLabel(r){if(r.sourceMode==='url'){try{return new URL(r.sourceUrl).host}catch{return 'URL'}}return r.sourceMode==='file'?(r.sourceName||'ФАЙЛ'):'ТЕКСТ'}
function openDb(){return new Promise((resolve,reject)=>{if(!globalThis.indexedDB){reject(Error('INDEXEDDB UNAVAILABLE'));return;}const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);})}
async function txDo(mode,action){const db=await openDb();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode);const store=tx.objectStore(STORE);const req=action(store);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.onerror=()=>reject(tx.error)})}finally{db.close();}}
export async function listHistory(){const rows=await txDo('readonly',s=>s.getAll());return rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}
export async function loadHistory(id){return txDo('readonly',s=>s.get(id))}
export async function deleteHistory(id){return txDo('readwrite',s=>s.delete(id))}
export async function clearHistory(){return txDo('readwrite',s=>s.clear())}
export async function saveHistory(record){await txDo('readwrite',s=>s.put(record));const rows=await listHistory();if(rows.length>MAX)for(const r of rows.slice(MAX))await deleteHistory(r.id);return record}
