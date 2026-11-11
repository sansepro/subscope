<script>
 import {onMount} from 'svelte';
 import {Activity,Database,GitCompareArrows,Settings2,ArrowUpFromLine,Link2,Clipboard,ArrowRight,Download,FileJson2,History as HistoryIcon,FileSpreadsheet,RotateCw} from 'lucide-svelte';
 import Titlebar from './components/Titlebar.svelte';
 import Analysis from './components/Analysis.svelte';
 import Registry from './components/Registry.svelte';
 import Compare from './components/Compare.svelte';
 import Settings from './components/Settings.svelte';
 import History from './components/History.svelte';
 import ContextMenu from './components/ContextMenu.svelte';
 import {parseSubscription,analyze,rescore,safeNetworkTarget,exportSanitized} from './lib/core.mjs';
 import {emptyIntel,enrichNodes} from './lib/enrich.mjs';
 import {defaults,loadSettings,createHeaders,generateHWID} from './lib/settings.mjs';
 import {native} from './lib/native.mjs';
 import {auditSignals} from './lib/forensics.mjs';
 import {toCSV} from './lib/export.mjs';
 import {applyTheme,loadAppearance} from './lib/themes.mjs';
 import {prepareHistoryRecord,saveHistory} from './lib/history.mjs';
 let jump=null,jumpId=0;
 let tab='analysis',analysisMode='single',sourceMode='url',input='',sourceUrl='',sourceHwid='',selectedFile='',report=null,intel=emptyIntel(),registryLabel='';
 let error='',busy=false,geoBusy=false,progress='',stageCount='',job=0,settings={...defaults},theme='dark',accent='violet';
 function goRegistry(filter={kind:'all'}){jump={...filter,serial:++jumpId};tab='registry';}
 function inspectComparison(sideReport,sideIntel,filter,side){report=sideReport;intel=sideIntel;registryLabel=side;goRegistry(filter)}
 onMount(()=>{settings=loadSettings();const appearance=loadAppearance();theme=appearance.mode;accent=appearance.accent;applyTheme(theme,accent)});
 async function selectFile(event){const file=event.currentTarget.files?.[0];if(!file)return;selectedFile=file.name;input=await file.text()}
 async function runSingle(override=null){const entry=override?.id?override:null,mode=entry?.sourceMode||sourceMode,url=entry?.sourceUrl||sourceUrl,id=++job;
  error='';progress='ПАРСИНГ';stageCount='';busy=true;geoBusy=false;registryLabel='';
  try{let body=entry?.body||input.trim();
   if(mode==='url'){
    const valid=safeNetworkTarget(url);if(!valid.ok)throw Error(valid.error);
    progress='HTTP GET';const res=await native.subscription(valid.url,createHeaders(settings,{hwid:sourceHwid}));body=res.text;
   }
   if(!body)throw Error('НЕТ ДАННЫХ');
   const parsed=parseSubscription(body),result=analyze(parsed);if(!result.nodes.length)throw Error((parsed.warnings||[]).join(' · ')||'УЗЛЫ НЕ НАЙДЕНЫ');
   if(id!==job)return;report=result;tab='analysis';busy=false;geoBusy=true;progress='DNS / GEO / BGP';intel=emptyIntel();
   const enriched=await enrichNodes(result.nodes,native,p=>{if(id===job){intel={ips:{...p.data.ips},hosts:{...p.data.hosts}};rescore(result,intel);report={...result};progress=p.stage;stageCount=`${p.done}/${p.total}`}},()=>id!==job,intel);
   if(id!==job)return;intel={ips:{...enriched.ips},hosts:{...enriched.hosts}};rescore(result,intel);report={...result};progress='ГОТОВО';stageCount='';
   try{await saveHistory(prepareHistoryRecord({sourceMode:mode,sourceUrl:url,sourceName:entry?.sourceName||selectedFile,body,report:result,intel,audit:auditSignals(result,intel)}))}catch(e){console.warn('HISTORY',e?.message)}
  }catch(e){if(id===job){error=e?.message||String(e);progress='ERROR'}}finally{if(id===job){busy=false;geoBusy=false}}
 }
 function downloadReport(kind='json'){
  if(!report)return;const audit=auditSignals(report,intel),safe=exportSanitized(report,intel);safe.risk.index=audit.score;safe.audit={score:audit.score,summary:audit.summary,signals:audit.signals.map(({id,title,weight,count,share})=>({id,title,weight,count,share}))};
  const text=kind==='csv'?toCSV(report,intel,audit):JSON.stringify(safe,null,2),blob=new Blob([text],{type:kind==='csv'?'text/csv;charset=utf-8':'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='subscope-report.'+kind;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
 }
 function openSnapshot(record){++job;busy=false;geoBusy=false;error='';progress='ИСТОРИЯ';stageCount='';analysisMode='single';try{const parsed=parseSubscription(record.body),next=analyze(parsed);if(!next.nodes.length)throw Error('НЕТ УЗЛОВ');intel=record.intel||emptyIntel();rescore(next,intel);report=next;tab='analysis'}catch(e){error=e.message||String(e)}}
 function recheck(record){sourceMode=record.sourceMode;sourceUrl=record.sourceUrl||'';input=record.body||'';selectedFile='HISTORY';analysisMode='single';tab='analysis';runSingle(record)}
</script>
<div class="frame">
 <Titlebar/>
 <div class="app-nav" role="tablist" aria-label="Разделы">
  <button role="tab" aria-selected={tab==='analysis'} class:current={tab==='analysis'} on:click={()=>tab='analysis'}><Activity size={15}/> АНАЛИЗ</button>
  <button role="tab" aria-selected={tab==='registry'} class:current={tab==='registry'} on:click={()=>tab='registry'}><Database size={15}/> РЕЕСТР <span class="nav-count">{report?.nodes?.length||0}</span></button>
  <button role="tab" aria-selected={tab==='history'} class:current={tab==='history'} on:click={()=>tab='history'}><HistoryIcon size={15}/> ИСТОРИЯ</button>
  <button role="tab" aria-selected={tab==='settings'} class:current={tab==='settings'} on:click={()=>tab='settings'}><Settings2 size={15}/> НАСТРОЙКИ</button>
 </div>
 <main class="work-area">
  {#if tab==='analysis'}
   <div class="page-head"><div><span class="micro"><span class="accent-square"></span> XRAY / АНАЛИЗ</span><h1>Анализ подписок<span class="heading-dot">.</span></h1></div><span class="status-pill"><span class:online={!!report} class="status-dot"></span>{busy||geoBusy?'ПРОВЕРКА':report?'ЗАГРУЖЕНО':'ОЖИДАНИЕ'}</span></div>
   <div class="analysis-mode-switch" role="group" aria-label="Режим анализа"><button class:active={analysisMode==='single'} on:click={()=>analysisMode='single'}><Activity size={15}/> ОДНА ПОДПИСКА</button><button class:active={analysisMode==='compare'} on:click={()=>analysisMode='compare'}><GitCompareArrows size={15}/> СРАВНЕНИЕ A/B</button></div>
   {#if analysisMode==='single'}
    <section class="source-panel">
     <div class="source-header"><span>ИСТОЧНИК</span><span>01 / ВХОД</span></div>
     <div class="source-tabs"><button class:active={sourceMode==='url'} on:click={()=>sourceMode='url'}><Link2 size={14}/> URL</button><button class:active={sourceMode==='file'} on:click={()=>sourceMode='file'}><FileJson2 size={14}/> ФАЙЛ</button><button class:active={sourceMode==='text'} on:click={()=>sourceMode='text'}><Clipboard size={14}/> ТЕКСТ</button></div>
     {#if sourceMode==='url'}
      <div class="input-line"><Link2 size={15}/><input bind:value={sourceUrl} spellcheck="false" autocomplete="off" placeholder="https://domain.tld/subscription/..." aria-label="Ссылка подписки"/></div>
      <div class="hwid-wrap single-hwid"><span>X-HWID</span><input bind:value={sourceHwid} placeholder="AUTO / X-HWID" aria-label="X-Hwid подписки" spellcheck="false" autocomplete="off"/><button aria-label="Сгенерировать X-Hwid" title="ГЕНЕРАЦИЯ X-HWID" on:click={()=>sourceHwid=generateHWID()}><RotateCw size={15}/></button></div>

     {:else if sourceMode==='file'}
      <label class="file-drop"><ArrowUpFromLine size={20} strokeWidth={1.6}/><strong>{selectedFile||'ВЫБРАТЬ ФАЙЛ'}</strong><span>JSON · TXT · BASE64 · YAML</span><input type="file" accept=".json,.txt,.conf,.yaml,.yml,.base64,.b64" on:change={selectFile}/></label>
     {:else}<textarea class="input-text" bind:value={input} spellcheck="false" placeholder="JSON · BASE64 · URI"></textarea>{/if}
     <div class="source-bottom"><span>{sourceMode==='url'?'URL':sourceMode==='file'?(selectedFile||'ФАЙЛ'):'ТЕКСТ'}</span><button class="primary" disabled={busy||geoBusy} on:click={()=>runSingle()}>{#if busy||geoBusy}<span class="spinner"></span>{:else}<Activity size={14}/>{/if} АНАЛИЗИРОВАТЬ <ArrowRight size={14}/></button></div>
    </section>
    {#if error}<div class="error-box">{error}</div>{/if}
    <div class="section-bar"><span class="section-title"><Activity size={15}/> РЕЗУЛЬТАТ</span><span class="micro progress-status">{#if busy||geoBusy}<span class="spinner"></span>{/if}{progress} {stageCount}</span>{#if report}<button class="export-btn" on:click={()=>downloadReport('json')}><Download size={13}/> JSON</button><button class="export-btn" on:click={()=>downloadReport('csv')}><FileSpreadsheet size={13}/> CSV</button>{/if}</div>
    <Analysis {report} {intel} pending={geoBusy} onNavigate={goRegistry}/>
   {:else}
    <Compare {settings} onInspect={inspectComparison}/>
   {/if}
  {:else if tab==='registry'}
   <div class="page-head compact"><div><span class="micro"><span class="accent-square"></span> NODES / GEO / ROUTING</span><h1>Реестр узлов<span class="heading-dot">.</span></h1></div><span class="status-pill">{registryLabel?registryLabel+' / ':''}{report?.nodes?.length||0} NODES</span></div>
   <Registry {report} {intel} pending={geoBusy} {jump} onNavigate={goRegistry}/>
  {:else if tab==='history'}
   <History onOpen={openSnapshot} onRecheck={recheck}/>
  {:else}
   <Settings bind:settings bind:theme bind:accent/>
  {/if}
 </main>
 <footer class="statusbar"><span><span class="foot-led"></span> SUBSCOPE</span><span class="statusbar-right">DNS · GEO · BGP</span></footer>
 <ContextMenu/>
 <div class="resize-handle top" aria-hidden="true"></div><div class="resize-handle bottom" aria-hidden="true"></div><div class="resize-handle left" aria-hidden="true"></div><div class="resize-handle right" aria-hidden="true"></div><div class="resize-handle top-left" aria-hidden="true"></div><div class="resize-handle top-right" aria-hidden="true"></div><div class="resize-handle bottom-left" aria-hidden="true"></div><div class="resize-handle bottom-right" aria-hidden="true"></div>
</div>
