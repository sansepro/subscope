import {isPublicIp} from './core.mjs';
export const emptyIntel=()=>({ips:{},hosts:{}});
export async function enrichNodes(nodes,network,onProgress=()=>{},stop=()=>false,cache=emptyIntel()){
  const data={ips:{...cache.ips},hosts:{...cache.hosts}};
  const hosts=[...new Set(nodes.filter(n=>n.addressKind==='domain').map(n=>n.address.toLowerCase()))];
  const pendingHosts=hosts.filter(host=>!data.hosts[host]).slice(0,200);
  let done=0;
  await parallel(pendingHosts,6,async host=>{
    if(stop())return;
    try{data.hosts[host]=await network.dns(host)}catch{data.hosts[host]={host,ips:[],error:'DNS ERROR'}}
    done++;onProgress({stage:'DNS',done,total:pendingHosts.length,data});
  });
  if(stop())return data;
  const ips=[...new Set(nodes.flatMap(n=>n.addressKind==='domain'?(data.hosts[n.address.toLowerCase()]?.ips||[]):[n.address]).filter(isPublicIp))];
  const pendingIps=ips.filter(ip=>!data.ips[ip]).slice(0,280);
  done=0;
  await parallel(pendingIps,4,async ip=>{
    if(stop())return;
    try{data.ips[ip]=await lookupIp(ip,network)}catch{data.ips[ip]={ip,error:'GEO ERROR'}}
    done++;onProgress({stage:'GEO / BGP',done,total:pendingIps.length,data});
  });
  return data;
}
async function parallel(items,workers,func){let next=0;await Promise.all(Array.from({length:Math.min(items.length,workers)},async()=>{while(next<items.length){let item=items[next++];await func(item);}}));}
async function lookupIp(ip,network){
  const [geo,ripe]=await Promise.allSettled([
    network.json(`https://ipwho.is/${encodeURIComponent(ip)}`),
    network.json(`https://stat.ripe.net/data/network-info/data.json?resource=${encodeURIComponent(ip)}`)
  ]);
  let g=null,r={};
  if(geo.status==='fulfilled'){try{const o=JSON.parse(geo.value);if(o.success!==false)g=o}catch{}}
  if(ripe.status==='fulfilled'){try{r=JSON.parse(ripe.value).data||{}}catch{}}
  const asn=g?.connection?.asn||r.asns?.[0];
  const out={ip,asn:asn?'AS'+String(asn).replace(/^AS/i,''):'',prefix:r.prefix||'',org:g?.connection?.org||g?.connection?.isp||'',country:g?.country||'',countryCode:g?.country_code||'',region:g?.region||'',city:g?.city||'',error:null};
  if(!out.asn&&!out.prefix&&!g)out.error='GEO / BGP ERROR';
  return out;
}
