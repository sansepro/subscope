<script>
 import {GitCompareArrows,FileInput,Globe2,X,ArrowRight,Layers,RotateCw,FileJson2,FileSpreadsheet,ArrowUpRight,Database,ShieldAlert,Network} from 'lucide-svelte';
 import {parseSubscription,analyze,compareReports,rescore,safeNetworkTarget,exportSanitized} from '../lib/core.mjs';
 import {createHeaders,generateHWID} from '../lib/settings.mjs';
 import {enrichNodes,emptyIntel} from '../lib/enrich.mjs';
 import {auditSignals} from '../lib/forensics.mjs';
 import {native} from '../lib/native.mjs';
 import {toCSV,csvCell} from '../lib/export.mjs';
 import CustomSelect from './CustomSelect.svelte';
 export let settings;
 let intel=emptyIntel();
 export let onInspect=()=>{};
 let modeA='url',modeB='url', inputA='',inputB='', fileA='',fileB='',hwidA='',hwidB='';
 let busy=false,error='',result=null,progress='',generation=0;
 let activeDetails='shared';
 const fmt=v=>Number(v||0).toLocaleString('ru-RU');
 const pct=v=>Math.round(100*Math.max(0,Math.min(1,Number(v||0))));
 const modeOptions=[{value:'url',label:'URL'},{value:'file',label:'ФАЙЛ'},{value:'text',label:'ТЕКСТ'}];
 const detailTabs=[['shared','ОБЩИЕ'],['onlyA','ТОЛЬКО A'],['onlyB','ТОЛЬКО B']];
 const bar=(v)=>Math.max(0,Math.min(100,Number(v)||0));
 function randomize(slot){if(slot==='A')hwidA=generateHWID();else hwidB=generateHWID()}
 async function chooseFile(event,slot){const file=event.currentTarget.files?.[0];if(!file)return;const contents=await file.text();if(slot==='A'){inputA=contents;fileA=file.name}else{inputB=contents;fileB=file.name}}
 async function reportFor(src,mode,hwid){let text=src.trim();if(mode==='url'){
  const safe=safeNetworkTarget(text);if(!safe.ok)throw Error(safe.error);
  const res=await native.subscription(safe.url,createHeaders(settings,{hwid}));text=res.text;
 }
 const p=parseSubscription(text),r=analyze(p);if(!r.nodes.length)throw Error((p.warnings||[]).join(' · ')||'НЕТ УЗЛОВ');return r;}
 async function compare(){
  const job=++generation;busy=true;error='';progress='HTTP / PARSE';result=null;
  try{
   if(!inputA.trim()||!inputB.trim())throw Error('ПОДПИСКИ A / B');
   const [a,b]=await Promise.all([reportFor(inputA,modeA,hwidA),reportFor(inputB,modeB,hwidB)]);
   if(job!==generation)return;
   const initial=compareReports(a,b,intel||emptyIntel());result=initial;progress='DNS / GEO / BGP';
   const combined=await enrichNodes([...a.nodes,...b.nodes],native,p=>{if(job===generation)progress=`${p.stage} · ${p.done}/${p.total}`},()=>job!==generation,intel||emptyIntel());
   if(job!==generation)return;
   intel=combined;rescore(a,intel);rescore(b,intel);result=compareReports(a,b,intel);progress='ГОТОВО';
  }catch(e){if(job===generation){error=e.message||String(e);progress='ERROR'}}finally{if(job===generation)busy=false}
 }
 function inspect(side,node){onInspect(side==='B'?result.b:result.a,intel,node?{kind:'search',value:node.address}:{kind:'all'},side)}
 function download(kind='json'){
  if(!result)return;
  let text;
  if(kind==='json'){const {a,b,overlap,similarity,shared,onlyA,onlyB,commonDomains,sharedAsns,sharedBgpPrefixes}=result;
   text=JSON.stringify({similarity,overlap,counts:{a:a.nodes.length,b:b.nodes.length,shared:shared.length,onlyA:onlyA.length,onlyB:onlyB.length},risk:{a:auditSignals(a,intel).score,b:auditSignals(b,intel).score},commonDomains,sharedAsns,sharedBgpPrefixes},null,2);
  }else{
   const rows=[['ТИП','АДРЕС','ПОРТ','ПРОТОКОЛ','ROOT','SNI','ТРАНСПОРТ','ЗАЩИТА'],...result.shared.map(n=>['ОБЩИЕ',n.address,n.port,n.protocol,n.identity,n.sni,n.network,n.security]),...result.onlyA.map(n=>['A',n.address,n.port,n.protocol,n.identity,n.sni,n.network,n.security]),...result.onlyB.map(n=>['B',n.address,n.port,n.protocol,n.identity,n.sni,n.network,n.security])];
   text='\uFEFF'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n')+'\r\n';
  }
  const blob=new Blob([text],{type:kind==='json'?'application/json':'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='subscope-compare.'+kind;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 $: metrics=result?[
  {label:'ТОЧНЫЕ УЗЛЫ',value:pct(result.overlap.nodeJaccard),count:result.overlap.nodes},
  {label:'АДРЕСА',value:pct(result.overlap.addressJaccard),count:result.overlap.addresses},
  {label:'КЛЮЧИ',value:pct(result.overlap.credJaccard),count:result.overlap.creds},
  {label:'АДРЕС + КЛЮЧ',value:pct(result.overlap.signatureMatches/Math.max(1,Math.min(result.a.nodes.length,result.b.nodes.length))),count:result.overlap.signatureMatches},
  {label:'ROOT + КЛЮЧ',value:pct(result.overlap.rootKeyJaccard),count:result.overlap.rootKeyMatches},
  {label:'ТРАНСПОРТ / TLS',value:pct(result.overlap.transportJaccard),count:result.overlap.transportMatches},
  {label:'IP / DNS',value:pct(result.overlap.ipJaccard),count:result.overlap.commonIps},
  {label:'ASN',value:pct(result.overlap.asnJaccard),count:result.overlap.commonAsns}
 ]:[];
 $: nodesToShow=result?(activeDetails==='shared'?result.shared:activeDetails==='onlyA'?result.onlyA:result.onlyB):[];
</script>
<div class="comparison-intro"><div class="section-eyebrow"><GitCompareArrows size={14}/> ПОДПИСКИ / A–B</div><div class="micro">DNS · IP · ROOT · ASN · KEY</div></div>
<div class="compare-inputs compare-grid">
 {#each ['A','B'] as slot}
  <section class="compare-source">
   <div class="compare-source-head"><strong>ИСТОЧНИК {slot}</strong><CustomSelect compact label={`Источник ${slot}`} value={slot==='A'?modeA:modeB} options={modeOptions} onChange={value=>{if(slot==='A'){modeA=value;inputA=''}else{modeB=value;inputB=''}}}/></div>
   {#if (slot==='A'?modeA:modeB)==='file'}
    <label class="file-drop compare-file"><FileInput size={18}/>{slot==='A'?(fileA||'ЗАГРУЗИТЬ ФАЙЛ'):(fileB||'ЗАГРУЗИТЬ ФАЙЛ')}<input type="file" accept=".json,.txt,.conf,.yaml,.yml,.base64,.b64" on:change={e=>chooseFile(e,slot)}/></label>
   {:else if (slot==='A'?modeA:modeB)==='text'}
    <textarea class="compare-text" value={slot==='A'?inputA:inputB} on:input={e=>slot==='A'?inputA=e.currentTarget.value:inputB=e.currentTarget.value} spellcheck="false" placeholder="JSON / BASE64 / URI"></textarea>
   {:else}
    <div class="source-url-line"><Globe2 size={14}/><input aria-label={`URL ${slot}`} value={slot==='A'?inputA:inputB} on:input={e=>slot==='A'?inputA=e.currentTarget.value:inputB=e.currentTarget.value} placeholder="https://subscription..." spellcheck="false" autocomplete="off"/></div>
    <div class="hwid-wrap"><span>X-HWID</span><input aria-label={`X-Hwid ${slot}`} value={slot==='A'?hwidA:hwidB} on:input={e=>slot==='A'?hwidA=e.currentTarget.value:hwidB=e.currentTarget.value} placeholder="AUTO / X-HWID" spellcheck="false" autocomplete="off"/><button title="Сгенерировать X-Hwid" on:click={()=>randomize(slot)}><RotateCw size={14}/></button></div>
   {/if}
   <div class="source-foot">{(slot==='A'?modeA:modeB).toUpperCase()} / {slot}</div>
  </section>
 {/each}
</div>
<div class="compare-actions"><button class="primary" disabled={busy} on:click={compare}>{#if busy}<span class="spinner"></span>{:else}<GitCompareArrows size={15}/>{/if} СРАВНИТЬ <ArrowRight size={13}/></button><span class="micro">{progress}</span></div>
{#if error}<div class="error-box">{error}</div>{/if}
{#if result}
 <div class="section-bar"><span class="section-title"><Layers size={14}/> РЕЗУЛЬТАТ A/B</span><span class="section-hint">{result.a.nodes.length} / {result.b.nodes.length}</span><button class="export-btn" on:click={()=>download('json')}><FileJson2 size={13}/> JSON</button><button class="export-btn" on:click={()=>download('csv')}><FileSpreadsheet size={13}/> CSV</button></div>
 <div class="compare-overview"><section class="compare-master-score"><span class="micro">ИНДЕКС СХОДСТВА</span><strong>{result.similarity.total}<small>/100</small></strong><div class="big-track"><div style={`width:${result.similarity.total}%`}></div></div><span class="micro">{result.similarity.level.toUpperCase()}</span></section>
  <section class="compare-side-stat"><span>ПОДПИСКА A</span><b>{result.a.nodes.length}</b><div><span>ИНДЕКС СМЕШЕНИЯ</span><strong>{auditSignals(result.a,intel).score}/100</strong></div><div><span>СОВПАДЕНИЕ</span><strong>{pct(result.overlap.containmentA)}%</strong></div><button on:click={()=>inspect('A')}><Database size={12}/> РЕЕСТР A <ArrowUpRight size={12}/></button></section>
  <section class="compare-side-stat"><span>ПОДПИСКА B</span><b>{result.b.nodes.length}</b><div><span>ИНДЕКС СМЕШЕНИЯ</span><strong>{auditSignals(result.b,intel).score}/100</strong></div><div><span>СОВПАДЕНИЕ</span><strong>{pct(result.overlap.containmentB)}%</strong></div><button on:click={()=>inspect('B')}><Database size={12}/> РЕЕСТР B <ArrowUpRight size={12}/></button></section>
 </div>
 <div class="section-title">МАТРИЦА СХОДСТВА <span class="section-hint">{metrics.length} МЕТРИК</span></div>
 <div class="compare-matrix">{#each metrics as item (item.label)}<div class="compare-matrix-item"><div><span>{item.label}</span><b>{item.value}% <small>· {item.count}</small></b></div><div class="small-track"><div style={`width:${bar(item.value)}%`}></div></div></div>{/each}</div>
 <div class="section-title"><ShieldAlert size={14}/> ПЕРЕСЕЧЕНИЯ <span class="section-hint">REALITY / SNI / DNS</span></div>
 <div class="intersection-grid compare-intersections">
  {#each [['ОБЩИЕ REALITY',result.sharedRealityKeys.length],['ОБЩИЕ ASN',result.overlap.commonAsns],['BGP PREFIX',result.overlap.commonBgpPrefixes],['ОБЩИЕ ROOT',result.overlap.domains],['КЛЮЧ / ДРУГОЙ АДРЕС',result.overlap.sameCredentialDiffEndpoint],['АДРЕС / ДРУГОЙ КЛЮЧ',result.overlap.sameEndpointDiffCredential],['ВАРИАНТЫ УЗЛОВ',result.overlap.variants],['ТОЧНЫЕ УЗЛЫ',result.overlap.nodes]] as item}<div class="intersection"><span>{item[0]}</span><b>{item[1]}</b></div>{/each}
 </div>
 <div class="section-title"><Network size={14}/> ОБЩИЕ ROOT / ASN / BGP</div>
 <div class="compare-common-strip"><span>ROOT</span><strong>{result.commonDomains.slice(0,8).join(' · ')||'—'}</strong><span>ASN</span><strong>{result.sharedAsns.slice(0,8).join(' · ')||'—'}</strong><span>BGP</span><strong>{result.sharedBgpPrefixes.slice(0,8).join(' · ')||'—'}</strong></div>
 <div class="section-title"><Layers size={14}/> УЗЛЫ</div>
 <div class="compare-detail-tabs">{#each detailTabs as [id,label]}<button class:active={activeDetails===id} on:click={()=>activeDetails=id}>{label} · {id==='shared'?result.shared.length:id==='onlyA'?result.onlyA.length:result.onlyB.length}</button>{/each}</div>
 <div class="compare-node-list">{#each nodesToShow.slice(0,120) as node (node.fingerprint)}<button class="compare-node" on:click={()=>inspect(activeDetails==='onlyB'?'B':'A',node)}><span><b>{node.address}</b><small>{node.protocol.toUpperCase()} · {node.network.toUpperCase()} · {node.identity}</small></span><ArrowUpRight size={14}/></button>{:else}<div class="empty-mini">—</div>{/each}</div>
{/if}
