/** Floating, automatically hidden scroll indicators for both axes. */
export function installOverlayScrollbars(doc=globalThis.document){
 if(!doc?.body)return ()=>{};
 const win=doc.defaultView||window;
 const make=(axis)=>{
  const rail=doc.createElement('div');rail.className=`smart-scrollbar smart-scrollbar-${axis}`;
  rail.setAttribute('role','scrollbar');rail.setAttribute('aria-orientation',axis==='y'?'vertical':'horizontal');rail.setAttribute('aria-label',axis==='y'?'Вертикальная прокрутка':'Горизонтальная прокрутка');
  const thumb=doc.createElement('div');thumb.className='smart-scrollbar-thumb';rail.appendChild(thumb);doc.body.appendChild(rail);
  return {rail,thumb};
 };
 const y=make('y'),x=make('x');
 let active=null,hideTimer=null,drag=null;
 const viewport=()=>({w:win.visualViewport?.width||win.innerWidth,h:win.visualViewport?.height||win.innerHeight});
 const metrics=(el,axis)=>{
  const rect=el.getBoundingClientRect(),vertical=axis==='y',max=vertical?el.scrollHeight-el.clientHeight:el.scrollWidth-el.clientWidth;
  const extent=vertical?rect.height:rect.width;
  const usable=Math.max(0,extent-10);
  const thumbSize=Math.min(usable,Math.max(25,usable*(vertical?el.clientHeight/el.scrollHeight:el.clientWidth/el.scrollWidth)));
  return {rect,max,usable,thumbSize};
 };
 const visible=(el,axis)=>el && (axis==='y'?el.scrollHeight>el.clientHeight+2:el.scrollWidth>el.clientWidth+2);
 const paint=()=>{
  if(!active?.isConnected){y.rail.classList.remove('visible');x.rail.classList.remove('visible');return;}
  const vp=viewport();
  y.rail.__scrollTarget=active;x.rail.__scrollTarget=active;
  for(const [axis,part] of [['y',y],['x',x]]){
   const m=metrics(active,axis);const r=m.rect;
   if(!visible(active,axis)||r.right<0||r.bottom<0||r.left>vp.w||r.top>vp.h||m.usable<26){part.rail.classList.remove('visible');continue;}
   const top=Math.max(3,r.top+5),left=Math.max(3,r.left+5);
   part.rail.classList.add('visible');
   if(axis==='y'){
    part.rail.style.top=`${top}px`;
    part.rail.style.left=`${Math.min(vp.w-11,r.right-10)}px`;
    part.rail.style.height=`${Math.max(10,Math.min(r.bottom-5,vp.h-3)-top)}px`;
    part.rail.style.width='6px';
   }else{
    part.rail.style.left=`${left}px`;
    part.rail.style.top=`${Math.min(vp.h-11,r.bottom-10)}px`;
    part.rail.style.width=`${Math.max(10,Math.min(r.right-5,vp.w-3)-left)}px`;
    part.rail.style.height='6px';
   }
   const trackLen=axis==='y'?part.rail.clientHeight:part.rail.clientWidth;
   const thumbLen=Math.min(trackLen,Math.max(24,trackLen*(axis==='y'?active.clientHeight/active.scrollHeight:active.clientWidth/active.scrollWidth)));
   const progress=m.max<=0?0:(axis==='y'?active.scrollTop:active.scrollLeft)/m.max;
   if(axis==='y'){part.thumb.style.height=`${thumbLen}px`;part.thumb.style.width='100%';part.thumb.style.transform=`translateY(${Math.max(0,trackLen-thumbLen)*Math.max(0,Math.min(1,progress))}px)`;}
   else{part.thumb.style.width=`${thumbLen}px`;part.thumb.style.height='100%';part.thumb.style.transform=`translateX(${Math.max(0,trackLen-thumbLen)*Math.max(0,Math.min(1,progress))}px)`;}
   part.rail.setAttribute('aria-valuemin','0');part.rail.setAttribute('aria-valuemax',String(Math.round(m.max)));
   part.rail.setAttribute('aria-valuenow',String(Math.round(axis==='y'?active.scrollTop:active.scrollLeft)));
  }
 };
 const hide=()=>{if(drag)return;y.rail.classList.remove('visible');x.rail.classList.remove('visible');};
 const schedule=()=>{win.clearTimeout(hideTimer);hideTimer=win.setTimeout(hide,1250)};
 const reveal=el=>{if(!el)return;active=el;y.rail.__scrollTarget=el;x.rail.__scrollTarget=el;win.requestAnimationFrame(paint);schedule()};
 const eligible=(el)=>{
  if(!(el instanceof win.HTMLElement))return false;
  const style=win.getComputedStyle(el);
  return ((/(auto|scroll|overlay)/.test(style.overflowY))&&visible(el,'y'))||((/(auto|scroll|overlay)/.test(style.overflowX))&&visible(el,'x'));
 };
 const ancestor=el=>{while(el && el!==doc.body){if(eligible(el))return el;el=el.parentElement;}return null};
 const onScroll=e=>{const el=e.target instanceof win.HTMLElement?e.target:doc.scrollingElement;if(el&&eligible(el))reveal(el)};
 const onWheel=e=>{const el=ancestor(e.target);if(el)reveal(el)};
 const onHover=e=>{const el=ancestor(e.target);if(el)reveal(el)};
 const onResize=()=>{if(active)paint()};
 for(const [axis,part] of [['y',y],['x',x]]){
  part.rail.addEventListener('pointerenter',()=>{win.clearTimeout(hideTimer);paint()});
  part.rail.addEventListener('pointerleave',schedule);
  part.rail.addEventListener('pointerdown',e=>{
   if(!active||!visible(active,axis))return;
   e.preventDefault();e.stopPropagation();
   const rect=part.rail.getBoundingClientRect();const m=metrics(active,axis);
   const trackLen=axis==='y'?rect.height:rect.width;
   const thumbLen=Math.min(trackLen,Math.max(24,trackLen*(axis==='y'?active.clientHeight/active.scrollHeight:active.clientWidth/active.scrollWidth)));
   const extent=Math.max(1,trackLen-thumbLen);
   const point=axis==='y'?e.clientY:e.clientX;
   const edge=axis==='y'?rect.top:rect.left;
   if(e.target!==part.thumb){const pos=Math.max(0,Math.min(extent,point-edge-thumbLen/2));if(axis==='y')active.scrollTop=m.max*pos/extent;else active.scrollLeft=m.max*pos/extent;}
   drag={axis,scrollTarget:active,start:point,offset:axis==='y'?active.scrollTop:active.scrollLeft,range:m.max,extent};
   part.rail.setPointerCapture?.(e.pointerId);paint();
  });
  part.rail.addEventListener('pointermove',e=>{
   if(!drag||drag.axis!==axis)return;
   const value=Math.max(0,Math.min(drag.range,drag.offset+((axis==='y'?e.clientY:e.clientX)-drag.start)*drag.range/drag.extent));
   if(axis==='y')drag.scrollTarget.scrollTop=value;else drag.scrollTarget.scrollLeft=value;
   paint();
  });
  part.rail.addEventListener('pointerup',()=>{drag=null;schedule()});
  part.rail.addEventListener('pointercancel',()=>{drag=null;schedule()});
 }
 doc.addEventListener('scroll',onScroll,true);doc.addEventListener('wheel',onWheel,{passive:true,capture:true});doc.addEventListener('pointermove',onHover,{passive:true,capture:true});win.addEventListener('resize',onResize);win.visualViewport?.addEventListener('resize',onResize);
 return ()=>{win.clearTimeout(hideTimer);doc.removeEventListener('scroll',onScroll,true);doc.removeEventListener('wheel',onWheel,true);doc.removeEventListener('pointermove',onHover,true);win.removeEventListener('resize',onResize);win.visualViewport?.removeEventListener('resize',onResize);y.rail.remove();x.rail.remove()};
}
