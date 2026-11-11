const STORE='subscope.desktop.appearance';
const LEGACY='subscope.desktop.theme';
export const themeList=[
 {id:'dark',name:'ТЁМНАЯ',bg:'#0b0d13',panel:'#151923',panel2:'#202632',white:'#eef1fa',muted:'#98a5b8',faint:'#708096',border:'#303949',border2:'#475469',hover:'#28303f',dangerBg:'#37232c',dangerText:'#ffb2c6'},
 {id:'light',name:'СВЕТЛАЯ',bg:'#f4f6fa',panel:'#ffffff',panel2:'#eaf0f6',white:'#202b3b',muted:'#5b6b83',faint:'#75849b',border:'#d3dce8',border2:'#b7c4d6',hover:'#e4ebf4',dangerBg:'#fce9ed',dangerText:'#992944'}
];
export const accentList=[
 {id:'violet',name:'VIOLET',dark:'#aaa3f9',light:'#6547c8'},
 {id:'blue',name:'BLUE',dark:'#83b2f5',light:'#245aaa'},
 {id:'cyan',name:'CYAN',dark:'#6ad0df',light:'#087889'},
 {id:'teal',name:'TEAL',dark:'#74c8b7',light:'#087769'},
 {id:'emerald',name:'EMERALD',dark:'#8dcea5',light:'#237044'},
 {id:'amber',name:'AMBER',dark:'#e6c077',light:'#91620b'},
 {id:'orange',name:'ORANGE',dark:'#ecad84',light:'#a54d1c'},
 {id:'rose',name:'ROSE',dark:'#ec98ad',light:'#a52e55'},
 {id:'orchid',name:'ORCHID',dark:'#ca9bef',light:'#7d399f'},
 {id:'stone',name:'STONE',dark:'#c3cbd6',light:'#526274'}
];
const oldAccents={nocturne:'violet',graphite:'stone',midnight:'blue',aubergine:'orchid',oxide:'orange',arctic:'cyan',carbon:'stone',orchid:'orchid',ruby:'rose',steel:'blue',sand:'amber',cobalt:'blue',forest:'emerald',ember:'orange'};
export function themeById(id){return themeList.find(t=>t.id===id)||themeList[0]}
export function accentById(id){return accentList.find(a=>a.id===id)||accentList[0]}
export function normalizeAppearance(value={}){
 return {mode:themeById(value?.mode).id,accent:accentById(value?.accent).id};
}
export function loadAppearance(storage=globalThis.localStorage){
 try{
  const saved=storage?.getItem(STORE);
  if(saved)return normalizeAppearance(JSON.parse(saved));
  const legacy=storage?.getItem(LEGACY);
  return {mode:'dark',accent:oldAccents[legacy]||'violet'};
 }catch{return {mode:'dark',accent:'violet'}}
}
export function saveAppearance(value,storage=globalThis.localStorage){
 const normalized=normalizeAppearance(value);
 try{storage?.setItem(STORE,JSON.stringify(normalized));return true}catch{return false}
}
export function applyTheme(mode='dark',accent='violet',element=globalThis.document?.documentElement){
 const t=themeById(mode),a=accentById(accent);const color=a[t.id];
 if(element){
  element.dataset.mode=t.id;element.dataset.accent=a.id;
  for(const [k,v] of Object.entries({bg:t.bg,panel:t.panel,panel2:t.panel2,white:t.white,muted:t.muted,faint:t.faint,border:t.border,border2:t.border2,hover:t.hover,dangerBg:t.dangerBg,dangerText:t.dangerText,accent:color}))element.style.setProperty('--'+k,v);
 }
 return {mode:t.id,accent:a.id};
}
