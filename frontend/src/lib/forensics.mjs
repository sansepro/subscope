import {registrable,isCamouflage} from './core.mjs';
import {ipsOf} from './insights.mjs';
const low=s=>String(s??'').trim().toLowerCase();
const unique=list=>new Set(list.filter(Boolean));
const root=n=>n.identity&&n.identity!=='ip'?n.identity:'IP / DIRECT';
const entry=n=>`${low(n.address)}:${n.port||0}`;
const pair=n=>`${low(n.address)}:${n.port||0}:${low(n.protocol)}`;
function mapBy(nodes,key){const result=new Map();for(const node of nodes){const v=key(node);if(!v)continue;for(const k of Array.isArray(v)?v:[v]){if(!k)continue;if(!result.has(k))result.set(k,[]);result.get(k).push(node)}}return result}
export function auditSignals(report,intel={ips:{},hosts:{}}){
 const nodes=report?.nodes||[];const ips=new Map(nodes.map(n=>[n.fingerprint,ipsOf(n,intel)]));
 const byRoot=mapBy(nodes,root),byCred=mapBy(nodes,n=>n.userId),byEnd=mapBy(nodes,entry),byProtocolEnd=mapBy(nodes,pair),byPk=mapBy(nodes,n=>n.publicKey),bySni=mapBy(nodes,n=>low(n.sni)),byHost=mapBy(nodes,n=>low(n.host)),byIp=mapBy(nodes,n=>ips.get(n.fingerprint)),byAsn=mapBy(nodes,n=>ips.get(n.fingerprint).map(ip=>intel.ips?.[ip]?.asn).filter(Boolean)),byPrefix=mapBy(nodes,n=>ips.get(n.fingerprint).map(ip=>intel.ips?.[ip]?.prefix).filter(Boolean)),
 byPath=mapBy(nodes,n=>n.path&&n.path.length>3&&n.path!=='/'?low(n.path):null),
 byEndpointSni=mapBy(nodes,n=>`${entry(n)}|${low(n.sni)}`);
 const countRoots=group=>unique(group.map(root)).size;
 const configurations=n=>unique([n.network,n.security,n.sni,n.publicKey,n.path].map(low)).size;
 const defs=[
  ['credential_roots','КЛЮЧ / РАЗНЫЕ ROOT',18,n=>n.userId && countRoots(byCred.get(n.userId)||[])>1],
  ['endpoint_credentials','РАЗНЫЕ КЛЮЧИ / УЗЕЛ',16,n=>unique((byEnd.get(entry(n))||[]).map(x=>x.userId)).size>1],
  ['endpoint_protocols','ПРОТОКОЛЫ / ОДИН АДРЕС',6,n=>unique((byEnd.get(entry(n))||[]).map(x=>x.protocol)).size>1],
  ['key_many_servers','КЛЮЧ / 5+ АДРЕСОВ',9,n=>n.userId&&unique((byCred.get(n.userId)||[]).map(entry)).size>=5],
  ['cross_root_reality','REALITY PK / РАЗНЫЕ ROOT',11,n=>n.publicKey&&countRoots(byPk.get(n.publicKey)||[])>1],
  ['sni_root_conflict','SNI / ДРУГОЙ ROOT',7,n=>n.addressKind==='domain'&&n.sni&&!isCamouflage(n.sni)&&registrable(n.address)!==registrable(n.sni)],
  ['shared_ip_roots','IP / РАЗНЫЕ ROOT',11,n=>ips.get(n.fingerprint).some(ip=>countRoots(byIp.get(ip)||[])>1)],
  ['shared_asn_roots','ASN / РАЗНЫЕ ROOT',3,n=>ips.get(n.fingerprint).some(ip=>{const a=intel.ips?.[ip]?.asn;return a && countRoots(byAsn.get(a)||[])>1})],
  ['shared_bgp_roots','BGP / РАЗНЫЕ ROOT',5,n=>ips.get(n.fingerprint).some(ip=>{const p=intel.ips?.[ip]?.prefix;return p&&countRoots(byPrefix.get(p)||[])>1})],
  ['shared_host_roots','HOST / РАЗНЫЕ ROOT',5,n=>n.host&&!isCamouflage(n.host)&&countRoots(byHost.get(low(n.host))||[])>1],
  ['shared_sni_roots','SNI / РАЗНЫЕ ROOT',4,n=>n.sni&&!isCamouflage(n.sni)&&countRoots(bySni.get(low(n.sni))||[])>1],
  ['duplicate_configs','ДУБЛИКАТЫ КОНФИГУРАЦИЙ',4,n=>(n.dupCount||1)>1],
  ['direct_ip','ПРЯМЫЕ IP',3,n=>n.addressKind!=='domain'],
  ['missing_sni','TLS / БЕЗ SNI',3,n=>/tls|reality/.test(low(n.security))&&!n.sni],
  ['credential_transport_split','КЛЮЧ / РАЗНЫЙ ТРАНСПОРТ',6,n=>n.userId && unique((byCred.get(n.userId)||[]).map(x=>low(x.network))).size>1],
  ['key_protocol_split','КЛЮЧ / РАЗНЫЕ ПРОТОКОЛЫ',7,n=>n.userId && unique((byCred.get(n.userId)||[]).map(x=>low(x.protocol))).size>1],
  ['dns_failure','DNS / ОШИБКА',2,n=>n.addressKind==='domain'&&!!intel.hosts?.[low(n.address)]?.error],
  ['geography_split','КЛЮЧ / РАЗНЫЕ СТРАНЫ',8,n=>n.userId&&unique((byCred.get(n.userId)||[]).flatMap(x=>ips.get(x.fingerprint).map(ip=>intel.ips?.[ip]?.countryCode||intel.ips?.[ip]?.country))).size>=3],
  ['endpoint_root_mix','ENDPOINT / РАЗНЫЕ ROOT',8,n=>countRoots(byProtocolEnd.get(pair(n))||[])>1],
  ['credential_sni_spread','КЛЮЧ / РАЗНЫЕ SNI',5,n=>n.userId && unique((byCred.get(n.userId)||[]).map(x=>low(x.sni)).filter(x=>x&&!isCamouflage(x))).size>=3],
  ['credential_cross_bgp','КЛЮЧ / 3+ BGP',6,n=>n.userId && unique((byCred.get(n.userId)||[]).flatMap(x=>ips.get(x.fingerprint).map(ip=>intel.ips?.[ip]?.prefix))).size>=3],
  ['credential_cross_asn','КЛЮЧ / 4+ ASN',6,n=>n.userId && unique((byCred.get(n.userId)||[]).flatMap(x=>ips.get(x.fingerprint).map(ip=>intel.ips?.[ip]?.asn))).size>=4],
  ['sni_reality_conflict','REALITY PK / SNI CONFLICT',8,n=>n.sni && unique((byEndpointSni.get(`${entry(n)}|${low(n.sni)}`)||[]).map(x=>x.publicKey)).size>1],
  ['shared_path_roots','PATH / РАЗНЫЕ ROOT',4,n=>n.path && n.path.length>3 && countRoots(byPath.get(low(n.path))||[])>1],
  ['sni_credentials','SNI / 3+ КЛЮЧЕЙ',5,n=>n.sni&&!isCamouflage(n.sni)&&unique((bySni.get(low(n.sni))||[]).map(x=>x.userId)).size>=3],
  ['host_multi_asn','HOST / 3+ ASN',3,n=>n.addressKind==='domain' && unique(ips.get(n.fingerprint).map(ip=>intel.ips?.[ip]?.asn)).size>=3],
 ];
 const signals=defs.map(([id,title,weight,predicate])=>{const hits=nodes.filter(n=>!!predicate(n));return {id,title,weight,count:hits.length,share:nodes.length?hits.length/nodes.length:0,nodes:hits.map(n=>n.fingerprint)}});
 const count=s=>signals.find(x=>x.id===s)?.count||0;
 const signalsScore=signals.reduce((sum,s)=>sum+(s.count? s.weight * Math.min(1,0.35 + s.share*2):0),0);
 const weightTotal=signals.reduce((sum,s)=>sum+s.weight,0);
 // Cross-root signals are correlated. One repeated domain is not sufficient for a high score.
 const corroborated=['credential_roots','endpoint_credentials','cross_root_reality','shared_ip_roots','key_protocol_split'].filter(id=>count(id)>0).length;
 const rootDiversity=unique(nodes.map(root)).size;
 const adjusted=signalsScore*(rootDiversity<=1?0.70:1)*(corroborated===0?0.65:corroborated===1?0.82:1);
 const score=Math.max(0,Math.min(100,Math.round((adjusted/Math.max(1,weightTotal))*145)));
 const severe=signals.filter(s=>s.weight>=8&&s.count>0).length;
 return {score,severe,corroborated,signals,flagByNode:Object.fromEntries(nodes.map(n=>[n.fingerprint,signals.filter(s=>s.nodes.includes(n.fingerprint)).map(s=>s.id)])),summary:{rootDiversity,signals:signals.filter(s=>s.count).length,independentKeys:byCred.size, endpoints:byEnd.size, profiles:unique(nodes.flatMap(n=>n.profiles||[])).size, directHosts:unique(nodes.filter(n=>n.addressKind!=='domain').map(n=>n.address)).size}};
}
