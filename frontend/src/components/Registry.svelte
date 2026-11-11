<script>
 import {onMount,tick} from 'svelte';
 import {Search,ChevronLeft,ChevronRight,Server,X,RotateCcw,Copy,Check,Ellipsis,ExternalLink} from 'lucide-svelte';
 import {Clipboard} from '@wailsio/runtime';
 import CustomSelect from './CustomSelect.svelte';
 import {nodeToConfig} from '../lib/nodeconfig.mjs';
 import {native} from '../lib/native.mjs';
 import {auditSignals} from '../lib/forensics.mjs';
 import {findRelatedNodes,buildInsights,filterNode,ipsOf} from '../lib/insights.mjs';
 import {placePopup} from '../lib/popups.mjs';
 export let report=null;
 export let intel={ips:{},hosts:{}};
 export let pending=false;
 export let jump=null;
 export let onNavigate=()=>{};
 let search='',protocol='all',domain='all',page=1,limit=30,activeFilter=null,lastJump=0,openError='',copied='';
 let menuNode=null,menuEl=null,menuLeft=0,menuTop=0;
 const display=x=>String(x??'').trim()||'—';
 $: nodes=report?.nodes||[];
 $: insights=buildInsights(report,intel);
 $: audit=auditSignals(report,intel);
 $: protocols=[...new Set(nodes.map(n=>n.protocol))].sort();
 $: domains=[...new Set(nodes.map(n=>n.identity))].sort();
 $: if(jump?.serial && jump.serial!==lastJump){lastJump=jump.serial;activeFilter={kind:jump.kind,value:jump.value};search='';protocol='all';domain='all';page=1;closeMenu();}
 $: filtered=nodes.filter(n=>(protocol==='all'||n.protocol===protocol)&&(domain==='all'||n.identity===domain)&&(activeFilter?.kind==='audit'?(audit.flagByNode[n.fingerprint]||[]).includes(activeFilter.value):filterNode(n,activeFilter,insights,intel))&&(!search||filterNode(n,{kind:'search',value:search},insights,intel)));
 $: totalPages=Math.max(1,Math.ceil(filtered.length/limit));
 $: validPage=Math.min(page,totalPages);
 $: visible=filtered.slice((validPage-1)*limit,validPage*limit);
 async function openNode(node){closeMenu();openError='';try{
  const related=findRelatedNodes(node,nodes,insights).map(({sourceConfig,sourceLink,userId,...item})=>item);
  const flags=(audit.flagByNode[node.fingerprint]||[]).map(id=>audit.signals.find(s=>s.id===id)?.title||id);
  const nodeIps=ipsOf(node,intel);
  const selectedIntel={ips:Object.fromEntries(nodeIps.filter(ip=>intel.ips?.[ip]).map(ip=>[ip,intel.ips[ip]])),hosts:node.addressKind==='domain'?{[node.address.toLowerCase()]:intel.hosts?.[node.address.toLowerCase()]||{ips:nodeIps}}:{}};
  await native.openNode({node,intel:selectedIntel,flags,related});
 }catch(e){openError=e?.message||String(e)}}
 async function copyConfig(node,e){e?.stopPropagation();closeMenu();openError='';try{await Clipboard.SetText(nodeToConfig(node));copied=node.fingerprint;setTimeout(()=>{if(copied===node.fingerprint)copied=''},1600)}catch(err){openError=err?.message||'COPY ERROR'}}
 function closeMenu(){menuNode=null}
 async function openMenu(node,x,y){menuNode=node;menuLeft=x;menuTop=y;await tick();if(!menuEl||menuNode!==node)return;const r=menuEl.getBoundingClientRect();const vp=window.visualViewport;const p=placePopup({x,y,width:r.width,height:r.height,vw:vp?.width||window.innerWidth,vh:vp?.height||window.innerHeight});menuLeft=p.left;menuTop=p.top;}
 function triggerMenu(node,event){event.preventDefault();event.stopPropagation();const r=event.currentTarget.getBoundingClientRect();openMenu(node,r.right-182,r.bottom+5)}
 function rightClick(node,event){event.preventDefault();event.stopPropagation();openMenu(node,event.clientX,event.clientY)}
 onMount(()=>{
  const outside=e=>{if(menuNode && !e.target?.closest?.('.registry-popup,.reg-config'))closeMenu()};
  const closeOnScroll=e=>{if(menuNode&&!e.target?.closest?.('.registry-popup'))closeMenu()};
  const closeOnKey=e=>{if(e.key==='Escape')closeMenu()};
  document.addEventListener('pointerdown',outside,true);
  document.addEventListener('scroll',closeOnScroll,true);
  window.addEventListener('resize',closeMenu);
  document.addEventListener('keydown',closeOnKey,true);
  return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('scroll',closeOnScroll,true);window.removeEventListener('resize',closeMenu);document.removeEventListener('keydown',closeOnKey,true)};
 });
 function getIps(n){return ipsOf(n,intel)}
 function geo(n){const ips=getIps(n);return ips.map(ip=>intel?.ips?.[ip]).find(x=>x&&!x.error)||null}
 function busy(n){return pending&&(getIps(n).some(ip=>!intel?.ips?.[ip])||(n.addressKind==='domain'&&!intel?.hosts?.[n.address.toLowerCase()]));}
 function reset(){activeFilter=null;protocol='all';domain='all';search='';page=1;closeMenu()}
 const trim=(s,n=30)=>String(s||'').length>n?String(s).slice(0,n-1)+'…':String(s||'');
</script>
{#if report}
 {#if openError}<div class="error-box">{openError}</div>{/if}
 <div class="registry-controls">
  <div class="search-box"><Search size={15}/><input aria-label="Поиск узлов" placeholder="IP / HOST / SNI / ROOT" bind:value={search} on:input={()=>page=1}/></div>
  <CustomSelect label="Протокол" bind:value={protocol} options={[{value:'all',label:'ВСЕ ПРОТОКОЛЫ'},...protocols.map(p=>({value:p,label:p.toUpperCase()}))]} onChange={()=>page=1}/>
  <CustomSelect label="Домен" bind:value={domain} options={[{value:'all',label:'ВСЕ ROOT'},...domains.map(d=>({value:d,label:d}))]} onChange={()=>page=1}/>
  <button class="reset-btn" title="Сбросить фильтры" aria-label="Сбросить фильтры" on:click={reset}><RotateCcw size={15}/></button>
 </div>
 {#if activeFilter}<div class="registry-active"><button class="active-filter" on:click={()=>{activeFilter=null;page=1}}>{activeFilter.kind.toUpperCase()}: {activeFilter.value} <X size={12}/></button></div>{/if}
 <div class="registry-list">
  <div class="registry-list-head"><span>УЗЕЛ / ТРАНСПОРТ</span><span>ROOT / SNI</span><span>GEO / IP</span><span>ОПЕРАТОР / ASN</span><span>BGP</span><span>·</span></div>
  {#each visible as n (n.fingerprint)}
   {@const g=geo(n)}{@const ips=getIps(n)}{@const waiting=busy(n)}
   <div class="node-entry" role="button" tabindex="0" on:click={()=>openNode(n)} on:contextmenu={e=>rightClick(n,e)} on:keydown={e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openNode(n)}}} title="Подробнее">
    <div class="reg-host"><strong title={n.address}>{trim(n.address,60)}<em>:{n.port||'—'}</em></strong><span><b class="protocol-tag">{n.protocol.toUpperCase()}</b> {n.network.toUpperCase()} · {n.security.toUpperCase()}{#if n.dupCount>1} <span class="mini-repeat">×{n.dupCount}</span>{/if}</span></div>
    <div class="reg-root"><span class="reg-mobile-label">ROOT / SNI</span><span title={n.identity}>{trim(n.identity,44)}</span><small title={n.sni}>{trim(n.sni||'—',45)}</small></div>
    <div class="reg-geo"><span class="reg-mobile-label">GEO / IP</span>{#if waiting}<span class="cell-loading"><span class="spinner"></span> DNS / GEO</span>{:else}<span>{display(g?.country)}</span><small>{[g?.region,g?.city].filter(Boolean).join(' / ')||'—'}</small>{/if}<small class="reg-ip" title={ips.join(', ')}>{ips.slice(0,2).join(', ')||'DNS —'}{ips.length>2?` +${ips.length-2}`:''}</small></div>
    <div class="reg-asn"><span class="reg-mobile-label">ASN / ОПЕРАТОР</span>{#if waiting}<span class="cell-loading"><span class="spinner"></span> ASN</span>{:else}<span title={g?.org}>{trim(g?.org||'—',48)}</span><small>{display(g?.asn)}</small>{/if}</div>
    <div class="reg-prefix"><span class="reg-mobile-label">BGP</span><span>{waiting?'…':display(g?.prefix)}</span></div>
    <div class="reg-config"><button type="button" aria-label={`Действия: ${n.address}`} aria-haspopup="menu" aria-expanded={menuNode?.fingerprint===n.fingerprint} on:click={e=>triggerMenu(n,e)} title="Действия">{#if copied===n.fingerprint}<Check size={15}/>{:else}<Ellipsis size={16}/>{/if}</button></div>
   </div>
  {:else}<div class="empty-mini">НЕТ СОВПАДЕНИЙ</div>{/each}
 </div>
 <div class="pager"><span>{filtered.length?((validPage-1)*limit+1):0}–{(validPage-1)*limit+visible.length} / {filtered.length}</span><div><button aria-label="Назад" disabled={validPage<=1} on:click={()=>page=Math.max(1,validPage-1)}><ChevronLeft size={15}/></button><span>{validPage} / {totalPages}</span><button aria-label="Вперёд" disabled={validPage>=totalPages} on:click={()=>page=Math.min(totalPages,validPage+1)}><ChevronRight size={15}/></button></div></div>
 {#if menuNode}<div class="registry-popup" bind:this={menuEl} role="menu" style:left={`${menuLeft}px`} style:top={`${menuTop}px`}>
  <button role="menuitem" on:click|stopPropagation={()=>openNode(menuNode)}><ExternalLink size={14}/> Подробнее</button>
  <button role="menuitem" on:click|stopPropagation={e=>copyConfig(menuNode,e)}><Copy size={14}/> Копировать подключение</button>
 </div>{/if}
{:else}<div class="empty-state"><Server size={25}/><strong>РЕЕСТР ПУСТ</strong></div>{/if}
