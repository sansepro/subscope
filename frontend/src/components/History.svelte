<script>
 import {onMount} from 'svelte';
 import {RotateCcw,Eye,Trash2,CalendarClock} from 'lucide-svelte';
 import {listHistory,deleteHistory,clearHistory,historyLabel} from '../lib/history.mjs';
 export let onOpen=()=>{};export let onRecheck=()=>{};
 let rows=[],error='',loading=true;
 async function refresh(){loading=true;error='';try{rows=await listHistory()}catch(e){error=e?.message||String(e)}finally{loading=false}}
 async function remove(id){await deleteHistory(id);await refresh()}
 async function clear(){await clearHistory();await refresh()}
 const date=s=>new Date(s).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
 onMount(refresh);
</script>
<div class="page-head compact"><div><span class="micro"><span class="accent-square"></span> ИСТОРИЯ / ПРОВЕРКИ</span><h1>История проверок<span class="heading-dot">.</span></h1></div><button class="soft" on:click={refresh}><RotateCcw size={14}/> ОБНОВИТЬ</button></div>
<div class="history-top"><span>{rows.length} ЗАПИСЕЙ</span><button class="soft" disabled={!rows.length} on:click={clear}><Trash2 size={13}/> ОЧИСТИТЬ</button></div>
{#if error}<div class="error-box">{error}</div>{/if}
{#if loading}<div class="empty-state"><span class="spinner"></span><strong>ЗАГРУЗКА</strong></div>{:else if !rows.length}<div class="empty-state"><CalendarClock size={26}/><strong>НЕТ ПРОВЕРОК</strong></div>{:else}
<div class="history-list">
 {#each rows as entry (entry.id)}
  <div class="history-row"><div class="history-primary"><strong>{historyLabel(entry)}</strong><span>{date(entry.createdAt)} · {entry.sourceMode.toUpperCase()} · {entry.kind||'XRAY'}</span></div>
   <div class="history-numbers"><b>{entry.nodes}<small> NODES</small></b><b>{entry.score}<small>/100</small></b></div>
   <div class="history-actions"><button title="Открыть" on:click={()=>onOpen(entry)}><Eye size={14}/></button><button title="Перепроверить" on:click={()=>onRecheck(entry)}><RotateCcw size={14}/></button><button title="Удалить" on:click={()=>remove(entry.id)}><Trash2 size={14}/></button></div>
  </div>
 {/each}
</div>
{/if}
