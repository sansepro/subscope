import { registrable, isCamouflage } from './core.mjs';

const asArray = x => Array.isArray(x) ? x : [];
const uniq = x => [...new Set(x.filter(Boolean))];
const low = s => String(s ?? '').trim().toLowerCase();
const rootOf = n => (n.identity && n.identity !== 'ip') ? n.identity : 'IP / DIRECT';
const endpointOf = n => `${low(n.address)}:${n.port||''}/${low(n.protocol)}`;
const group = (items, key, label = key) => {
 const map = new Map();
 for(const item of items){const k=String(key(item)||'—');if(!map.has(k))map.set(k,{name:String(label(item)||k),value:k,count:0});map.get(k).count++;}
 return [...map.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
};
export function ipsOf(node,intel={}) {
 if(!node)return [];
 if(node.addressKind==='domain') return uniq(asArray(intel?.hosts?.[low(node.address)]?.ips));
 return node.address?[node.address]:[];
}
export function buildInsights(report,intel={}) {
 const nodes=asArray(report?.nodes);
 const byCred=new Map(),byEndpoint=new Map(),byReality=new Map(),byIp=new Map(),byRoot=new Map();
 const ipsByFingerprint={}, nodeFlags={};
 for(const n of nodes){
  const iplist=ipsOf(n,intel);ipsByFingerprint[n.fingerprint]=iplist;
  const root=rootOf(n);if(!byRoot.has(root))byRoot.set(root,[]);byRoot.get(root).push(n);
  if(n.userId){if(!byCred.has(n.userId))byCred.set(n.userId,[]);byCred.get(n.userId).push(n);}
  if(n.publicKey){if(!byReality.has(n.publicKey))byReality.set(n.publicKey,[]);byReality.get(n.publicKey).push(n);}
  const end=endpointOf(n);if(!byEndpoint.has(end))byEndpoint.set(end,[]);byEndpoint.get(end).push(n);
  for(const ip of iplist){if(!byIp.has(ip))byIp.set(ip,[]);byIp.get(ip).push(n);}
 }
 const flagDefs=[
  ['duplicate','ПОВТОРЫ'],['direct_ip','ПРЯМЫЕ IP'],['cross_root_key','КЛЮЧ / РАЗНЫЕ ROOT'],
  ['shared_ip','ОБЩИЙ IP'],['multi_user_endpoint','РАЗНЫЕ КЛЮЧИ / УЗЕЛ'],
  ['reality_reuse','REALITY / РАЗНЫЕ ROOT'],['sni_mismatch','РАЗНЫЕ ROOT / SNI'],['dns_failed','DNS ERROR']
 ];
 const flags=Object.fromEntries(flagDefs.map(([id,title])=>[id,{id,title,count:0,nodes:[]}]));
 for(const n of nodes){
  const root=rootOf(n),targets=ipsByFingerprint[n.fingerprint];
  const peerCred=byCred.get(n.userId)||[];
  const peerEndpoint=byEndpoint.get(endpointOf(n))||[];
  const peerReality=byReality.get(n.publicKey)||[];
  const active=[];
  if((n.dupCount||1)>1)active.push('duplicate');
  if(n.addressKind!=='domain')active.push('direct_ip');
  if(n.userId && new Set(peerCred.map(rootOf)).size>1)active.push('cross_root_key');
  if(targets.some(ip=>new Set((byIp.get(ip)||[]).map(x=>low(x.address))).size>1))active.push('shared_ip');
  if(new Set(peerEndpoint.map(x=>x.userId).filter(Boolean)).size>1)active.push('multi_user_endpoint');
  if(n.publicKey && new Set(peerReality.map(rootOf)).size>1)active.push('reality_reuse');
  if(n.addressKind==='domain'&&n.sni&&!isCamouflage(n.sni)&&registrable(n.address)!==registrable(n.sni))active.push('sni_mismatch');
  if(n.addressKind==='domain' && intel?.hosts?.[low(n.address)]?.error)active.push('dns_failed');
  nodeFlags[n.fingerprint]=active;
  for(const id of active){flags[id].count++;flags[id].nodes.push(n.fingerprint);}
 }
 const geoRecords=[];
 for(const n of nodes){
  const dedup=new Set();
  for(const ip of ipsByFingerprint[n.fingerprint]){
   const r=intel?.ips?.[ip];if(!r||r.error)continue;
   const k=[r.asn,r.country,r.prefix].join('|');if(dedup.has(k))continue;dedup.add(k);
   geoRecords.push({node:n,ip,asn:r.asn||'',country:r.countryCode||r.country||'',prefix:r.prefix||'',org:r.org||'',city:r.city||''});
  }
 }
 const countries=group(geoRecords.filter(x=>x.country),x=>x.country);
 const asns=group(geoRecords.filter(x=>x.asn),x=>x.asn, x=>x.asn+(x.org?' · '+x.org:''));
 const prefixes=group(geoRecords.filter(x=>x.prefix),x=>x.prefix);
 const cities=group(geoRecords.filter(x=>x.city),x=>x.city);
 const roots=[...byRoot.entries()].map(([name,list])=>({
  name,count:list.length,
  hosts:new Set(list.map(n=>low(n.address))).size,
  keys:new Set(list.map(n=>n.userId).filter(Boolean)).size,
  ips:new Set(list.flatMap(n=>ipsByFingerprint[n.fingerprint])).size,
  asns:new Set(list.flatMap(n=>ipsByFingerprint[n.fingerprint].map(ip=>intel?.ips?.[ip]?.asn)).filter(Boolean)).size,
  protocols:new Set(list.map(n=>n.protocol)).size
 })).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
 const credentialSpread=[...byCred.values()].map(entries=>new Set(entries.map(rootOf)).size);
 const bucket=(values,label)=>[
  {name:'1 '+label,value:'1',count:values.filter(x=>x===1).length},
  {name:'2 '+label,value:'2',count:values.filter(x=>x===2).length},
  {name:'3+ '+label,value:'3+',count:values.filter(x=>x>=3).length}
 ];
 const endpointReuse=bucket([...byEndpoint.values()].map(xs=>xs.length),'NODE');
 const credentialBuckets=bucket(credentialSpread,'ROOT');
 const ipSharing=bucket([...byIp.values()].map(xs=>xs.length),'NODE');
 const nodeMultiplicity=Object.fromEntries(nodes.map(n=>[n.fingerprint,{
  endpoint:(byEndpoint.get(endpointOf(n))||[]).length,
  credentials:n.userId?new Set((byCred.get(n.userId)||[]).map(rootOf)).size:0,
  ip:(ipsByFingerprint[n.fingerprint]||[]).map(ip=>(byIp.get(ip)||[]).length)
 }]));
 const allPublicIps=uniq(Object.values(ipsByFingerprint).flat());
 const checkedIps=allPublicIps.filter(ip=>intel?.ips?.[ip]&&!intel.ips[ip].error);
 const allCredentials=new Set(nodes.map(n=>n.userId).filter(Boolean));
 const allPrefixes=new Set(geoRecords.map(x=>x.prefix).filter(Boolean));
 return {
  summary:{
   nodes:nodes.length,records:report?.stats?.records||0,duplicates:report?.stats?.duplicateRecords||0,
   hosts:new Set(nodes.map(n=>low(n.address))).size,
   uniqueSni:new Set(nodes.map(n=>low(n.sni)).filter(Boolean)).size,
   uniqueRealityPK:new Set(nodes.map(n=>low(n.publicKey)).filter(Boolean)).size,
   reusedEndpoints:[...byEndpoint.values()].filter(x=>x.length>1).length,
   multiRootCredentials:credentialSpread.filter(x=>x>1).length,
   mixedRootEndpoints:[...byEndpoint.values()].filter(x=>new Set(x.map(rootOf)).size>1).length,
   endpoints:byEndpoint.size,keys:allCredentials.size,
   roots:roots.filter(r=>r.name!=='IP / DIRECT').length,
   directIps:new Set(nodes.filter(n=>n.addressKind!=='domain').map(n=>low(n.address))).size,
   resolvedIps:allPublicIps.length,checkedIps:checkedIps.length,
   asns:new Set(geoRecords.map(x=>x.asn).filter(Boolean)).size,
   countries:new Set(geoRecords.map(x=>x.country).filter(Boolean)).size,
   prefixes:allPrefixes.size,
   crossRootKeys:[...byCred.values()].filter(items=>new Set(items.map(rootOf)).size>1).length,
   multiRootIps:[...byIp.values()].filter(items=>new Set(items.map(rootOf)).size>1).length,
   geoCoverage:allPublicIps.length?Math.round(100*checkedIps.length/allPublicIps.length):0
  },
  groups:{
   protocols:group(nodes,x=>x.protocol),
   transports:group(nodes,x=>x.network),
   securities:group(nodes,x=>x.security),
   countries,asns,prefixes,cities,roots,
   endpointReuse,credentialSpread:credentialBuckets,ipSharing
  },flags,nodeFlags,ipsByFingerprint,nodeMultiplicity
 };
}
const matchBucket=(count,bucket)=>count>0 && (bucket==='3+'?count>=3:Number(bucket)===count);
export function filterNode(node,filter,insights,intel={}) {
 if(!node)return false;
 if(!filter||filter.kind==='all')return true;
 const v=String(filter.value||'');
 switch(filter.kind){
  case 'flag':return (insights?.nodeFlags?.[node.fingerprint]||[]).includes(v);
  case 'protocol':return node.protocol===v;
  case 'network':return node.network===v;
  case 'security':return node.security===v;
  case 'identity':return node.identity===v || (v==='IP / DIRECT' && node.identity==='ip');
  case 'address':return low(node.address)===low(v);
  case 'country':return ipsOf(node,intel).some(ip=>(intel?.ips?.[ip]?.countryCode||intel?.ips?.[ip]?.country||'')===v);
  case 'asn':return ipsOf(node,intel).some(ip=>intel?.ips?.[ip]?.asn===v);
  case 'prefix':return ipsOf(node,intel).some(ip=>intel?.ips?.[ip]?.prefix===v);
  case 'ip':return ipsOf(node,intel).includes(v);
  case 'endpoint_reuse':return matchBucket(insights?.nodeMultiplicity?.[node.fingerprint]?.endpoint,v);
  case 'credential_spread':return matchBucket(insights?.nodeMultiplicity?.[node.fingerprint]?.credentials,v);
  case 'ip_sharing':return (insights?.nodeMultiplicity?.[node.fingerprint]?.ip||[]).some(n=>matchBucket(n,v));
  case 'search':return [node.address,node.sni,node.tag,node.protocol,node.identity,node.host,node.port].some(x=>low(x).includes(low(v)));
  default:return true;
 }
}
export function findRelatedNodes(node,allNodes,insights) {
 if(!node)return [];
 const nodeIps=new Set(insights?.ipsByFingerprint?.[node.fingerprint]||[]);
 return asArray(allNodes).filter(n=>n.fingerprint!==node.fingerprint).map(n=>{
  const sameKey=!!node.userId&&node.userId===n.userId;
  const sameAddress=low(node.address)===low(n.address);
  const sameIp=(insights?.ipsByFingerprint?.[n.fingerprint]||[]).some(ip=>nodeIps.has(ip));
  const sameRoot=node.identity===n.identity;
  const score=(sameKey?8:0)+(sameAddress?5:0)+(sameIp?3:0)+(sameRoot?1:0);
  return {node:n,score};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.node.address.localeCompare(b.node.address)).slice(0,12).map(x=>x.node);
}
