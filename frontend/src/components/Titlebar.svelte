<script>
 import {Minus,Square,X,RadioTower} from 'lucide-svelte';
 import { native } from '../lib/native.mjs';
</script>
<header class="titlebar" on:dblclick={(e)=>{if(!e.target.closest('button'))native.maximise()}}>
 <div class="titlebrand"><span class="titlelogo"><RadioTower size={15} strokeWidth={2}/></span><strong>SUBSCOPE</strong><span class="titlecontext">NETWORK INSPECTOR</span></div>
 <div class="window-controls">
  <button class="window-control" title="Свернуть" aria-label="Свернуть" on:click={()=>native.minimise()}><Minus size={15}/></button>
  <button class="window-control" title="Развернуть" aria-label="Развернуть" on:click={()=>native.maximise()}><Square size={12}/></button>
  <button class="window-control close" title="Закрыть" aria-label="Закрыть" on:click={()=>native.close()}><X size={16}/></button>
 </div>
</header>
