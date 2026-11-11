<script>
 import {Activity,Network,Layers3,Server,ArrowUpRight,ShieldAlert} from 'lucide-svelte';
 import {buildInsights} from '../lib/insights.mjs';
 import {auditSignals} from '../lib/forensics.mjs';
 import AnalyticsCharts from './AnalyticsCharts.svelte';
 export let report=null;
 export let intel={ips:{},hosts:{}};
 export let pending=false;
 export let onNavigate=()=>{};
 $: insights=buildInsights(report,intel);
 $: summary=insights.summary;
 $: audit=auditSignals(report,intel);
 $: factors=audit.signals.filter(s=>s.count).map(s=>({id:s.id,title:s.title,value:Math.round(Math.min(100,s.weight*Math.min(1,0.35+s.share*2)*4))})).sort((a,b)=>b.value-a.value).slice(0,9);
 $: score=audit.score||0;
 const n=v=>Number(v||0).toLocaleString('ru-RU');
 const pct=v=>Math.max(0,Math.min(100,Math.round(v||0)));
 const all=()=>onNavigate({kind:'all'});
 const groups=[
  {title:'ПРОТОКОЛЫ',key:'protocols',kind:'protocol',limit:9},
  {title:'ТРАНСПОРТ',key:'transports',kind:'network',limit:9},
  {title:'БЕЗОПАСНОСТЬ',key:'securities',kind:'security',limit:8},
  {title:'СТРАНЫ',key:'countries',kind:'country',limit:9},
  {title:'ASN / ОПЕРАТОР',key:'asns',kind:'asn',limit:9},
  {title:'BGP PREFIX',key:'prefixes',kind:'prefix',limit:9},
 ];
</script>
{#if report}
 <div class="analysis-topline"><span class="micro"><span class="accent-square"></span> NETWORK / PROVENANCE / BGP</span><button class="inline-nav" on:click={all}>В РЕЕСТР <ArrowUpRight size={14}/></button></div>
 <div class="insight-metrics">
  {#each [
    {label:'ЗАПИСИ',value:summary.records},
    {label:'УЗЛЫ',value:summary.nodes},
    {label:'ПОВТОРЫ',value:summary.duplicates,filter:{kind:'flag',value:'duplicate'}},
    {label:'АДРЕСА',value:summary.hosts},
    {label:'IP / DIRECT',value:summary.directIps,filter:{kind:'flag',value:'direct_ip'}},
    {label:'ROOT',value:summary.roots},
    {label:'КЛЮЧИ',value:summary.keys},
    {label:'КЛЮЧИ / CROSS ROOT',value:summary.crossRootKeys,filter:{kind:'flag',value:'cross_root_key'}},
    {label:'IP / DNS',value:summary.resolvedIps},
    {label:'ASN',value:summary.asns},
    {label:'СТРАНЫ',value:summary.countries},
    {label:'BGP PREFIX',value:summary.prefixes}
   ] as item (item.label)}
   <button class="insight-metric" on:click={()=>onNavigate(item.filter||{kind:'all'})}><span>{item.label}</span><strong>{n(item.value)}</strong><ArrowUpRight size={12}/></button>
  {/each}
 </div>
 <div class="score-dashboard">
  <div class="score-focus"><div class="section-eyebrow"><Activity size={13}/> ИНДЕКС СМЕШЕНИЯ</div><div class="score-mainvalue"><strong>{score}</strong><span>/100</span></div><div class="score-state">{score>=65?'ВЫСОКИЙ':score>=35?'СРЕДНИЙ':score>0?'НИЗКИЙ':'МИНИМАЛЬНЫЙ'}</div><div class="big-track"><div style={`width:${score}%`}></div></div><div class="score-bottom"><span>{summary.roots} ROOT</span><span>{summary.crossRootKeys} CROSS KEY</span><span>{summary.multiRootIps} CROSS IP</span></div></div>
  <div class="score-breakdown"><div class="panel-headline">ФАКТОРЫ <span>{factors.length}</span></div>
   {#each factors as f (f.id)}<div class="score-factor"><div><span>{f.title.toUpperCase()}</span><b>{f.value}<small>/100</small></b></div><div class="small-track"><div style={`width:${pct(f.value)}%`}></div></div></div>{/each}
  </div>
 </div>
 <AnalyticsCharts {insights} {audit} {onNavigate}/>
 <div class="section-title insight-section-heading"><ShieldAlert size={15}/> ИНДИКАТОРЫ <span class="section-hint">{Object.values(insights.flags).filter(x=>x.count).length} / {Object.keys(insights.flags).length}</span></div>
 <div class="signal-grid">
  {#each Object.values(insights.flags) as flag (flag.id)}<button class={flag.count>0?'signal-cell signal-on':'signal-cell'} on:click={()=>onNavigate({kind:'flag',value:flag.id})}><span>{flag.title}</span><div><strong>{n(flag.count)}</strong><small>{summary.nodes?Math.round(flag.count*100/summary.nodes):0}%</small><ArrowUpRight size={13}/></div></button>{/each}
 </div>
 <div class="section-title insight-section-heading"><ShieldAlert size={15}/> ФОРЕНЗИКА <span class="section-hint">{audit.summary.signals} / {audit.signals.length}</span></div>
 <div class="forensic-grid">{#each audit.signals as item (item.id)}<button class:signal-on={item.count>0} on:click={()=>onNavigate({kind:'audit',value:item.id})}><span>{item.title}</span><div><b>{item.count}</b><small>W {item.weight}</small><ArrowUpRight size={12}/></div></button>{/each}</div>
 <div class="section-title insight-section-heading"><Network size={15}/> ТРАФИК / ТОПОЛОГИЯ <span class="section-hint">{summary.checkedIps} / {summary.resolvedIps} IP</span></div>
 <div class="coverage-strip"><div><strong>{summary.geoCoverage}%</strong><span>GEO / ASN COVERAGE</span></div><div class="coverage-bar"><div style={`width:${summary.geoCoverage}%`}></div></div>{#if pending}<span class="spinner"></span>{/if}</div>
 <div class="insight-charts">
  {#each groups as g (g.key)}
   <section class="dist-panel"><div class="panel-headline">{g.title}<span>{insights.groups[g.key].length}</span></div>
    {#each insights.groups[g.key].slice(0,g.limit) as item (item.value)}
     <button class="dist-row" title={item.name} on:click={()=>onNavigate({kind:g.kind,value:item.value})}><div class="dist-line"><span>{item.name}</span><b>{n(item.count)}</b><ArrowUpRight size={11}/></div><div class="dist-track"><div style={`width:${Math.max(3,100*item.count/(insights.groups[g.key][0]?.count||1))}%`}></div></div></button>
    {:else}<div class="empty-mini">{pending?'ЗАГРУЗКА':'—'}</div>{/each}
   </section>
  {/each}
 </div>
 <div class="section-title insight-section-heading"><Layers3 size={15}/> ДОМЕННЫЕ ГРУППЫ <span class="section-hint">{insights.groups.roots.length} ROOT</span></div>
 <div class="root-table"><div class="root-header"><span>ROOT</span><span>NODES</span><span>HOST</span><span>KEY</span><span>IP</span><span>ASN</span></div>
  {#each insights.groups.roots.slice(0,32) as root (root.name)}<button class="root-row" on:click={()=>onNavigate({kind:'identity',value:root.name})}><span title={root.name}>{root.name}</span><b>{n(root.count)}</b><span>{n(root.hosts)}</span><span>{n(root.keys)}</span><span>{n(root.ips)}</span><span>{n(root.asns)} <ArrowUpRight size={12}/></span></button>{/each}
  {#if insights.groups.roots.length>32}<button class="root-more" on:click={all}>+ {insights.groups.roots.length-32} ROOT <ArrowUpRight size={13}/></button>{/if}
 </div>
{:else}
 <div class="empty-state"><Server size={26} strokeWidth={1.4}/><strong>НЕТ ДАННЫХ</strong><span>JSON · BASE64 · VLESS · VMESS · SS · TROJAN · HYSTERIA2</span></div>
{/if}
