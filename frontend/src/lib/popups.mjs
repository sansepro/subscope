/** Keep floating controls inside the visible viewport. */
export function placePopup({x=0,y=0,width=0,height=0,vw=0,vh=0,padding=8}={}){
 const left=Math.max(padding,Math.min(Number(x)||0,Math.max(padding,vw-width-padding)));
 const top=Math.max(padding,Math.min(Number(y)||0,Math.max(padding,vh-height-padding)));
 return {left,top};
}
/** Scroll rail is a child of the logical scroll surface even though it is mounted in body. */
export function scrollbarTarget(target){return target?.closest?.('.smart-scrollbar')?.__scrollTarget||null;}
