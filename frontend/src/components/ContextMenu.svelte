<script>
 import {onMount,onDestroy,tick} from 'svelte';
 import {Clipboard} from '@wailsio/runtime';
 import {Copy,ClipboardPaste,Scissors,ScanText} from 'lucide-svelte';
 import {scrollbarTarget} from '../lib/popups.mjs';
 let shown=false,left=0,top=0,menu,target=null,selectionText='',selectionStart=0,selectionEnd=0;
 const editable=el=>el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && ['text','search','url','tel','password'].includes(el.type));
 const viewport=()=>({w:window.visualViewport?.width||window.innerWidth,h:window.visualViewport?.height||window.innerHeight});
 function dismiss(){shown=false;target=null;selectionText=''}
 async function rightClick(e){
  const el=e.target?.closest?.('input,textarea');
  const isEditable=el&&editable(el)&&!el.disabled;
  const value=!isEditable&&e.target?.closest?.('.node-window-body')?String(window.getSelection?.()?.toString()||''):'';
  e.preventDefault();
  if(!isEditable&&!value.trim()){dismiss();return}
  target=isEditable?el:null;selectionText=isEditable?'':value;
  if(isEditable){selectionStart=el.selectionStart||0;selectionEnd=el.selectionEnd||0;}
  left=e.clientX;top=e.clientY;shown=true;await tick();
  if(!shown||!menu)return;
  const size=menu.getBoundingClientRect();const {w,h}=viewport();
  left=Math.max(6,Math.min(e.clientX,w-size.width-6));
  top=Math.max(6,Math.min(e.clientY,h-size.height-6));
 }
 function scrollClose(e){if(shown && !menu?.contains(e?.target) && scrollbarTarget(e?.target)!==menu)dismiss()}
 function keyClose(e){if(e.key==='Escape')dismiss()}
 function outside(e){if(shown&&!e.target?.closest?.('.input-context')&&scrollbarTarget(e.target)!==menu)dismiss()}
 async function command(action){const el=target;if(!el){if(action==='copy'&&selectionText){try{await Clipboard.SetText(selectionText)}catch{}dismiss()}return;}shown=false;el.focus();el.setSelectionRange(selectionStart,selectionEnd);
  try{
   if(action==='select'){el.select();return}
   if(action==='copy'){await Clipboard.SetText(el.value.slice(selectionStart,selectionEnd));return}
   if(action==='cut'){if(el.readOnly)return;await Clipboard.SetText(el.value.slice(selectionStart,selectionEnd));el.setRangeText('');el.dispatchEvent(new Event('input',{bubbles:true}));return}
   if(action==='paste'){if(el.readOnly)return;const text=await Clipboard.Text();el.setRangeText(text,el.selectionStart,el.selectionEnd,'end');el.dispatchEvent(new Event('input',{bubbles:true}));return}
  }catch(e){console.warn('CLIPBOARD',e?.message)}finally{target=null;selectionText=''}
 }
 onMount(()=>{document.addEventListener('contextmenu',rightClick,true);document.addEventListener('scroll',scrollClose,true);document.addEventListener('wheel',scrollClose,true);window.addEventListener('resize',scrollClose,true);document.addEventListener('keydown',keyClose,true);document.addEventListener('pointerdown',outside,true)});
 onDestroy(()=>{document.removeEventListener('contextmenu',rightClick,true);document.removeEventListener('scroll',scrollClose,true);document.removeEventListener('wheel',scrollClose,true);window.removeEventListener('resize',scrollClose,true);document.removeEventListener('keydown',keyClose,true);document.removeEventListener('pointerdown',outside,true)});
</script>
{#if shown}<div class="input-context" bind:this={menu} style:left={`${left}px`} style:top={`${top}px`} role="menu">
 <button role="menuitem" on:pointerdown|preventDefault={()=>{}} on:click={()=>command('copy')}><Copy size={13}/> КОПИРОВАТЬ</button>
 {#if target}<button role="menuitem" on:pointerdown|preventDefault={()=>{}} on:click={()=>command('paste')}><ClipboardPaste size={13}/> ВСТАВИТЬ</button>
 <button role="menuitem" on:pointerdown|preventDefault={()=>{}} on:click={()=>command('cut')}><Scissors size={13}/> ВЫРЕЗАТЬ</button>
 <div class="context-rule"></div><button role="menuitem" on:pointerdown|preventDefault={()=>{}} on:click={()=>command('select')}><ScanText size={13}/> ВЫДЕЛИТЬ ВСЁ</button>{/if}
</div>{/if}
