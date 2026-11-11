<script>
 import {onMount} from 'svelte';
 import {PieChart} from 'lucide-svelte';
 import {buildLineChart} from '../lib/charts.mjs';
 import {placePopup} from '../lib/popups.mjs';
 export let insights={groups:{}};
 export let audit={signals:[]};
 export let onNavigate=()=>{};
 const colors=['var(--chart-1)','var(--chart-2)','var(--chart-3)','var(--chart-4)','var(--chart-5)','var(--chart-6)','var(--chart-7)'];
 $: protocols=(insights.groups?.protocols||[]).slice(0,7);
 $: countries=(insights.groups?.countries||[]).slice(0,8);
 $: rootGroups=(insights.groups?.roots||[]).slice(0,12);
 $: active=(audit.signals||[]).filter(x=>x.count).sort((a,b)=>b.weight*b.count-a.weight*a.count).slice(0,8);
 $: total=protocols.reduce((a,b)=>a+b.count,0)||1;
 $: offsets=protocols.map((p,i)=>({label:p.name,n:p.count,color:colors[i%colors.length],start:protocols.slice(0,i).reduce((a,b)=>a+b.count,0)/total*100,size:p.count/total*100}));
 $: barCards=[
  {title:'ТРАНСПОРТ',kind:'network',data:(insights.groups?.transports||[]).slice(0,8),count:insights.groups?.transports?.length||0},
  {title:'ЗАЩИТА / TLS',kind:'security',data:(insights.groups?.securities||[]).slice(0,8),count:insights.groups?.securities?.length||0},
  {title:'ASN / ОПЕРАТОР',kind:'asn',data:(insights.groups?.asns||[]).slice(0,8),count:insights.groups?.asns?.length||0},
  {title:'КЛЮЧИ / ROOT',kind:'credential_spread',data:insights.groups?.credentialSpread||[],count:insights.summary?.keys||0},
  {title:'УЗЛЫ / ENDPOINT',kind:'endpoint_reuse',data:insights.groups?.endpointReuse||[],count:insights.summary?.endpoints||0},
  {title:'IP / ПОВТОРЫ',kind:'ip_sharing',data:insights.groups?.ipSharing||[],count:insights.summary?.resolvedIps||0}
 ].map(card=>({...card,max:Math.max(1,...card.data.map(x=>x.count)),sum:card.data.reduce((v,x)=>v+x.count,0)}));
 $: uniqueMetrics=[
  {title:'УНИКАЛЬНЫЕ SNI',value:insights.summary?.uniqueSni||0},
  {title:'REALITY PK',value:insights.summary?.uniqueRealityPK||0},
  {title:'ПОВТОРЫ ENDPOINT',value:insights.summary?.reusedEndpoints||0},
  {title:'КЛЮЧИ / CROSS ROOT',value:insights.summary?.multiRootCredentials||0},
  {title:'ENDPOINT / CROSS ROOT',value:insights.summary?.mixedRootEndpoints||0},
  {title:'DNS / IP',value:insights.summary?.resolvedIps||0}
 ];
 let chartPanel,chartWidth=500;const chartHeight=190;
 let tip=null;
 const percentage=(amount,sum)=>sum?`${Math.round(amount/sum*1000)/10}%`:'0%';
 function showTip(e,title,name,value,sum,note=''){
  const rect=e.currentTarget?.getBoundingClientRect?.();
  const x=Number.isFinite(e.clientX)?e.clientX:(rect?.left||0)+Math.min(40,(rect?.width||0)/2);
  const y=Number.isFinite(e.clientY)?e.clientY:(rect?.top||0)+6;
  const vp=window.visualViewport;
  const pos=placePopup({x:x+14,y:y+14,width:218,height:100,vw:vp?.width||window.innerWidth,vh:vp?.height||window.innerHeight,padding:9});
  tip={...pos,title,name,value,share:percentage(value,sum),note};
 }
 function hideTip(){tip=null}
 onMount(()=>{if(!chartPanel)return;const measure=()=>{chartWidth=Math.max(180,Math.round(chartPanel.getBoundingClientRect().width-30))};measure();const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(measure):null;observer?.observe(chartPanel);window.addEventListener('resize',measure);return()=>{observer?.disconnect();window.removeEventListener('resize',measure)}});
 $: series=buildLineChart(rootGroups.map(x=>x.count),{width:chartWidth,height:chartHeight,left:34,right:12,bottom:28});
</script>
<div class="section-title"><PieChart size={15}/> ГРАФИКИ <span class="section-hint">{4+barCards.length+1}</span></div>
<div class="graph-grid">
 <section class="graph-card">
  <div class="panel-headline">ПРОТОКОЛЫ <span>{protocols.length}</span></div>
  <div class="donut-row"><svg viewBox="0 0 120 120" class="donut" role="img" aria-label="Распределение протоколов"><circle cx="60" cy="60" r="45" fill="none" stroke="var(--border)" stroke-width="14"/>
  {#each offsets as p}
   <circle cx="60" cy="60" r="45" fill="none" stroke={p.color} stroke-width="14" stroke-dasharray={`${p.size*2.827} ${282.743-p.size*2.827}`} stroke-dashoffset={-p.start*2.827} transform="rotate(-90 60 60)" on:mousemove={e=>showTip(e,'ПРОТОКОЛ',p.label,p.n,total)} on:mouseleave={hideTip}/>
  {/each}
  <text x="60" y="60" fill="var(--white)" text-anchor="middle" dominant-baseline="middle" font-size="17" font-weight="600">{total}</text></svg>
  <div class="donut-legend">{#each offsets as p}<button on:click={()=>onNavigate({kind:'protocol',value:p.label})} on:mouseenter={e=>showTip(e,'ПРОТОКОЛ',p.label,p.n,total)} on:mousemove={e=>showTip(e,'ПРОТОКОЛ',p.label,p.n,total)} on:focus={e=>showTip(e,'ПРОТОКОЛ',p.label,p.n,total)} on:mouseleave={hideTip} on:blur={hideTip}><i style:background={p.color}></i><span>{p.label.toUpperCase()}</span><b>{p.n}</b></button>{/each}</div></div>
 </section>
 <section class="graph-card"><div class="panel-headline">СТРАНЫ / GEO <span>{countries.length}</span></div><div class="chart-bars">
 {#each countries as c}<button on:click={()=>onNavigate({kind:'country',value:c.value})} on:mousemove={e=>showTip(e,'GEO',c.name,c.count,countries.reduce((sum,v)=>sum+v.count,0))} on:focus={e=>showTip(e,'GEO',c.name,c.count,countries.reduce((sum,v)=>sum+v.count,0))} on:mouseleave={hideTip} on:blur={hideTip}><span>{c.name}</span><div><i style:width={`${100*c.count/Math.max(1,countries[0]?.count)}%`}></i></div><b>{c.count}</b></button>{:else}<div class="empty-mini">—</div>{/each}
 </div></section>
 <section class="graph-card"><div class="panel-headline">СИГНАЛЫ / ВЕС <span>{active.length}</span></div><div class="chart-bars">
 {#each active as s}<button on:click={()=>onNavigate({kind:'audit',value:s.id})} on:mousemove={e=>showTip(e,'СИГНАЛ',s.title,s.count,insights.summary?.nodes||0,`ВЕС ${s.weight}`)} on:focus={e=>showTip(e,'СИГНАЛ',s.title,s.count,insights.summary?.nodes||0,`ВЕС ${s.weight}`)} on:mouseleave={hideTip} on:blur={hideTip}><span>{s.title}</span><div><i class="risk-bar" style:width={`${100*s.weight/20}%`}></i></div><b>{s.count}</b></button>{:else}<div class="empty-mini">—</div>{/each}
 </div></section>
 <section class="graph-card chart-root-panel" bind:this={chartPanel}><div class="panel-headline">ROOT / УЗЛЫ <span>{rootGroups.length}</span></div>
 {#if rootGroups.length}
 <svg class="spark-root" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Количество узлов по доменам">
  <defs><linearGradient id="rootAreaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".24"/><stop offset="1" stop-color="var(--accent)" stop-opacity=".015"/></linearGradient></defs>
  {#each series.lines as line}<line x1="34" x2={chartWidth-12} y1={line.y} y2={line.y} stroke="var(--chart-grid)" stroke-width="1" stroke-dasharray="3 7"/><text x="26" y={line.y+4} fill="var(--muted)" font-size="11" font-family="var(--mono)" text-anchor="end">{line.value}</text>{/each}
  <path d={series.area} fill="url(#rootAreaFill)"/><path d={series.path} fill="none" stroke="var(--accent)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
  {#each series.points as p,i}<circle cx={p.x} cy={p.y} r="4.5" class="chart-point" fill="var(--panel)" stroke="var(--accent)" stroke-width="2" on:mousemove={e=>showTip(e,'ROOT',rootGroups[i]?.name||'—',p.value,insights.summary?.nodes||0,`${rootGroups[i]?.hosts||0} HOST · ${rootGroups[i]?.keys||0} KEYS`)} on:mouseleave={hideTip} on:click={()=>onNavigate({kind:'identity',value:rootGroups[i]?.name})}/>{/each}
 </svg>
 <div class="spark-labels"><span>{rootGroups[0]?.name||'—'}</span><span>{rootGroups.length} ROOT</span><span>{rootGroups.at(-1)?.name||'—'}</span></div>
 {:else}<div class="empty-mini">—</div>{/if}
 </section>
 {#each barCards as card (card.title)}
 <section class="graph-card"><div class="panel-headline">{card.title} <span>{card.count}</span></div><div class="chart-bars">
 {#each card.data as item (item.value)}<button on:click={()=>onNavigate({kind:card.kind,value:item.value})} on:mousemove={e=>showTip(e,card.title,item.name,item.count,card.sum)} on:focus={e=>showTip(e,card.title,item.name,item.count,card.sum)} on:mouseleave={hideTip} on:blur={hideTip} aria-label={`${card.title}: ${item.name}, ${item.count}`}><span>{item.name}</span><div><i style:width={`${100*item.count/card.max}%`}></i></div><b>{item.count}</b></button>{:else}<div class="empty-mini">—</div>{/each}
 </div></section>
 {/each}
 <section class="graph-card"><div class="panel-headline">УНИКАЛЬНОСТЬ <span>{uniqueMetrics.length}</span></div><div class="chart-bars chart-uniqueness">
 {#each uniqueMetrics as item}<button on:click={()=>onNavigate({kind:'all'})} on:mousemove={e=>showTip(e,'УНИКАЛЬНОСТЬ',item.title,item.value,insights.summary?.nodes||0)} on:focus={e=>showTip(e,'УНИКАЛЬНОСТЬ',item.title,item.value,insights.summary?.nodes||0)} on:mouseleave={hideTip} on:blur={hideTip}><span>{item.title}</span><div><i style:width={`${100*Math.min(1,item.value/Math.max(1,insights.summary?.nodes||1))}%`}></i></div><b>{item.value}</b></button>{/each}
 </div></section>
</div>
{#if tip}<div class="chart-tooltip" role="status" style:left={`${tip.left}px`} style:top={`${tip.top}px`}>
 <span>{tip.title}</span><strong>{tip.name}</strong><div><b>{tip.value}</b><small>{tip.share}</small></div>{#if tip.note}<small>{tip.note}</small>{/if}
</div>{/if}
