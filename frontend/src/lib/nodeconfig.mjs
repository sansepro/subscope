const same=(a,b)=>String(a||'').toLowerCase()===String(b||'').toLowerCase();
// Preserve full transport and TLS data, narrowing multi-server outbounds to the selected node.
export function nodeToConfig(node){
 if(!node)return '';
 if(node.sourceLink)return node.sourceLink;
 if(node.sourceConfig){
  let obj;
  try{obj=JSON.parse(node.sourceConfig)}catch{obj=null}
  if(obj && typeof obj==='object' && !Array.isArray(obj)){
  const settings=obj.settings;
  if(settings && typeof settings==='object'){
   if(Array.isArray(settings.vnext)){
    const matches=settings.vnext.filter(v=>same(v.address,node.address)&&Number(v.port)===Number(node.port));
    if(matches.length)settings.vnext=matches.map(v=>({...v,users:Array.isArray(v.users)?(v.users.filter(u=>same(u.id||u.password,node.userId)).length?v.users.filter(u=>same(u.id||u.password,node.userId)):v.users):v.users}));
   }
   if(Array.isArray(settings.servers)){
    const matches=settings.servers.filter(s=>same(s.address||s.addr,node.address)&&Number(s.port)===Number(node.port)&&(!node.userId||same(s.password||s.auth,node.userId)));
    if(matches.length)settings.servers=matches;
   }
  }
  return JSON.stringify(obj,null,2);
  }
 }
 const data={protocol:node.protocol,tag:node.tag||'',settings:{address:node.address,port:node.port},streamSettings:{network:node.network,security:node.security}};
 return JSON.stringify(data,null,2);
}
export function nodeConfigFormat(node){return node?.sourceLink?'URI':'JSON'}
