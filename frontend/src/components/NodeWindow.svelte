<script>
 import {onMount} from 'svelte';
 import {Clipboard} from '@wailsio/runtime';
 import {X,Copy,RadioTower,Server,Network,ShieldAlert} from 'lucide-svelte';
 import {native} from '../lib/native.mjs';
 import {ipsOf} from '../lib/insights.mjs';
 import {applyTheme,loadAppearance} from '../lib/themes.mjs';
 import ContextMenu from './ContextMenu.svelte';
 import {nodeToConfig,nodeConfigFormat} from '../lib/nodeconfig.mjs';
 let node=null, intel={ips:{},hosts:{}},flags=[], related=[],error='',copied='';
 const id=new URLSearchParams(location.search).get('id')||'';
 $: ips=node?ipsOf(node,intel):[];
 const str=v=>String(v??'').trim()||'—';
 async function copy(text){try{await Clipboard.SetText(String(text));copied='OK'}catch{copied='ОШИБКА'}setTimeout(()=>copied='',1400)}
 async function close(){try{await native.clearNodeData(id)}catch{}native.close()}
 onMount(()=>{
  function syncAppearance(event){if(event && event.key && event.key!=='subscope.desktop.appearance')return;const appearance=loadAppearance();applyTheme(appearance.mode,appearance.accent)}
  syncAppearance();window.addEventListener('storage',syncAppearance);
  (async()=>{try{const raw=await native.nodeData(id);const payload=JSON.parse(raw);node=payload.node;intel=payload.intel||intel;flags=payload.flags||[];related=payload.related||[];}catch(e){error=e.message||String(e)}})();
  return ()=>window.removeEventListener('storage',syncAppearance);
 });
</script>
<div class="node-window">
 <header class="titlebar node-window-bar"><div class="titlebrand"><RadioTower size={15}/><strong>SUBSCOPE</strong><span class="titlecontext">NODE</span></div><div class="window-controls"><button class="window-control close" title="Закрыть" aria-label="Закрыть" on:click={close}><X size={17}/></button></div></header>
 {#if error}<div class="error-box">{error}</div>{:else if !node}<div class="empty-state"><span class="spinner"></span><strong>ЗАГРУЗКА</strong></div>{:else}
 <div class="node-window-body"><div class="page-head compact"><div><span class="micro">УЗЕЛ / ДЕТАЛИ</span><h1>{str(node.tag||node.address)}</h1></div><span class="protocol-tag">{node.protocol.toUpperCase()}</span></div>
 <div class="node-dialog-toolbar"><div class="node-dialog-actions"><button class="modal-copy" on:click={()=>copy(nodeToConfig(node))} title="Копировать конфигурацию"><Copy size={13}/> {nodeConfigFormat(node)}</button><button class="modal-copy" on:click={()=>copy(`${node.address}:${node.port||''}`)} title="Копировать адрес"><Copy size={13}/> АДРЕС</button></div><div class="node-dialog-tags"><span class="mini-chip">{str(node.network).toUpperCase()}</span><span class="mini-chip">{str(node.security).toUpperCase()}</span><span class="mini-chip">×{node.dupCount||1}</span></div><span class="copy-notice" aria-live="polite">{copied}</span></div>
 <div class="modal-section-head"><Server size={14}/> КОНФИГУРАЦИЯ</div><div class="node-detail-grid">{#each [['АДРЕС',node.address],['ПОРТ',node.port],['ROOT',node.identity],['SNI',node.sni],['HOST',node.host],['PATH',node.path],['FLOW',node.flow],['ALPN',node.alpn],['CLIENT FP',node.clientFp],['REALITY PK',node.publicKey],['SHORT ID',node.shortId],['ФРАГМЕНТАЦИЯ',node.fragment?'YES':'NO']] as f}<div class="node-field"><span>{f[0]}</span><b>{str(f[1])}</b></div>{/each}</div>
 <div class="modal-section-head"><Network size={14}/> IP / GEO / ASN / BGP <span class="section-hint">{ips.length}</span></div>
 {#each ips as ip}{@const g=intel.ips?.[ip]||{}}<div class="node-ip-record"><div class="node-ip-heading"><b>{ip}</b><button class="modal-copy" title="Копировать" on:click={()=>copy(ip)}><Copy size={12}/></button></div><div class="node-ip-grid">{#each [['СТРАНА',g.country],['РЕГИОН',g.region],['ГОРОД',g.city],['ОПЕРАТОР',g.org],['ASN',g.asn],['BGP PREFIX',g.prefix]] as f}<span>{f[0]} <b>{str(f[1])}</b></span>{/each}</div></div>{:else}<div class="empty-mini">DNS —</div>{/each}
 {#if flags.length}<div class="modal-section-head"><ShieldAlert size={14}/> СИГНАЛЫ <span class="section-hint">{flags.length}</span></div><div class="modal-flags">{#each flags as f}<span class="mini-chip">{f}</span>{/each}</div>{/if}
 {#if related.length}<div class="modal-section-head">СВЯЗАННЫЕ УЗЛЫ <span class="section-hint">{related.length}</span></div><div class="related-list">{#each related as r}<div class="node-related"><span>{r.address}:{r.port}</span><small>{r.protocol?.toUpperCase()} · {r.identity}</small></div>{/each}</div>{/if}
 </div>{/if}
 <div class="resize-handle top"></div><div class="resize-handle bottom"></div><div class="resize-handle left"></div><div class="resize-handle right"></div><div class="resize-handle top-left"></div><div class="resize-handle top-right"></div><div class="resize-handle bottom-left"></div><div class="resize-handle bottom-right"></div>
 <ContextMenu/>
</div>
