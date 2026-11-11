<script>
 import {onMount,tick} from 'svelte';
 import {ChevronDown,Check} from 'lucide-svelte';
 import {scrollbarTarget} from '../lib/popups.mjs';
 export let label='';export let value='all';export let options=[];export let onChange=()=>{};export let compact=false;
 let open=false,root,list,focusIndex=0,left=0,top=0,width=168,height=240;
 $: selected=options.find(option=>String(option.value)===String(value))||options[0];
 const viewport=()=>({w:window.visualViewport?.width||window.innerWidth,h:window.visualViewport?.height||window.innerHeight});
 function place(){if(!root||!list)return;
  const anchor=root.querySelector('.custom-select-trigger')?.getBoundingClientRect()||root.getBoundingClientRect();
  const {w,h}=viewport(),gap=5,pad=8;
  width=Math.max(0,Math.min(w-pad*2,Math.max(anchor.width,168)));
  left=Math.max(pad,Math.min(anchor.left,w-pad-width));
  const above=Math.max(0,anchor.top-pad-gap),below=Math.max(0,h-anchor.bottom-pad-gap);
  const wanted=Math.min(260,options.length*36+8);
  const down=below>=Math.min(wanted,130)||below>=above;
  height=Math.max(36,Math.min(wanted,down?below:above));
  top=down?Math.min(h-pad-height,anchor.bottom+gap):Math.max(pad,anchor.top-height-gap);
 }
 function close(){open=false}
 function choose(item){if(!item)return;value=item.value;onChange(value);close();root?.querySelector('button')?.focus()}
 async function toggle(){open=!open;if(open){focusIndex=Math.max(0,options.findIndex(x=>String(x.value)===String(value)));await tick();place();await tick();list?.querySelectorAll('[role="option"]')?.[focusIndex]?.focus();}}
 function keydown(e){if(!open&&['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();toggle();return;}
  if(e.key==='Escape'){close();root?.querySelector('button')?.focus();return;}
  if(!open||!options.length)return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();focusIndex=(focusIndex+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;list?.querySelectorAll('[role="option"]')?.[focusIndex]?.focus();}
  if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(options[focusIndex])}
  if(e.key==='Home'||e.key==='End'){e.preventDefault();focusIndex=e.key==='Home'?0:options.length-1;list?.querySelectorAll('[role="option"]')?.[focusIndex]?.focus();}
 }
 onMount(()=>{const outside=e=>{const rail=e.target?.closest?.('.smart-scrollbar');if(rail && root?.contains(scrollbarTarget(e.target)))return;if(!root?.contains(e.target))close()};const scroll=e=>{if(open && !root?.contains(e.target) && !list?.contains(e.target))close()};const resize=()=>{if(open)place()};document.addEventListener('pointerdown',outside,true);document.addEventListener('scroll',scroll,true);window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize)}});
</script>
<div class:compact class:expanded={open} class="custom-select" bind:this={root} on:keydown={keydown}>
 <button class="custom-select-trigger" aria-label={label} aria-expanded={open} aria-haspopup="listbox" on:click={toggle}><span>{selected?.label||'—'}</span><ChevronDown size={13}/></button>
 {#if open}<div class="custom-select-list" role="listbox" aria-label={label} bind:this={list} style:left={`${left}px`} style:top={`${top}px`} style:width={`${width}px`} style:max-height={`${height}px`}>
  {#each options as item,i (item.value)}<button class:chosen={value===item.value} role="option" aria-selected={value===item.value} tabindex={i===focusIndex?0:-1} on:mouseenter={()=>focusIndex=i} on:click={()=>choose(item)}><span>{item.label}</span>{#if value===item.value}<Check size={12}/>{/if}</button>{/each}
 </div>{/if}
</div>
