/** Restrict WebView chrome shortcuts while retaining field editing and modal selection. */
export function installDesktopBehavior(doc=globalThis.document){
 if(!doc)return ()=>{};
 const drag=e=>{if(!e.target?.closest?.('input,textarea,[contenteditable="true"]'))e.preventDefault()};
 const shortcut=e=>{
  const key=String(e.key||'').toLowerCase();
  if(['f5','f12'].includes(key) || ((e.ctrlKey||e.metaKey)&&('r p s u o'.split(' ').includes(key) || (e.shiftKey&&['i','j','c'].includes(key))))){
   e.preventDefault();e.stopPropagation();
  }
 };
 doc.addEventListener('dragstart',drag,true);
 doc.addEventListener('keydown',shortcut,true);
 return()=>{doc.removeEventListener('dragstart',drag,true);doc.removeEventListener('keydown',shortcut,true)};
}
