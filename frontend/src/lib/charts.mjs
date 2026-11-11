/** Monotone piecewise cubic interpolation: preserves peaks without control-point overshoot. */
export function buildLineChart(values,{width=600,height=190,top=17,right=22,bottom=30,left=38}={}){
 const data=Array.isArray(values)?values.map(Number).map(n=>Number.isFinite(n)?Math.max(0,n):0):[];
 const W=Math.max(120,width),H=Math.max(90,height),innerW=Math.max(1,W-left-right),innerH=Math.max(1,H-top-bottom);
 const max=Math.max(1,...data),baseline=H-bottom;
 const points=data.map((v,i)=>({x: data.length===1?left+innerW/2:left+innerW*i/(data.length-1), y: baseline-v/max*innerH, value:v}));
 if(!points.length)return {points:[],path:'',area:'',max,baseline,lines:[]};
 const f=n=>Number(n.toFixed(2));
 let path=`M ${f(points[0].x)} ${f(points[0].y)}`;
 if(points.length>1){
  const delta=points.slice(1).map((p,i)=>(p.y-points[i].y)/(p.x-points[i].x));
  const slopes=points.map((_,i)=>{
   if(i===0)return delta[0];
   if(i===points.length-1)return delta.at(-1);
   const a=delta[i-1],b=delta[i];
   if(!a||!b||Math.sign(a)!==Math.sign(b))return 0;
   return Math.sign(a)*Math.min(Math.abs(a),Math.abs(b),0.5*(Math.abs(a)+Math.abs(b)));
  });
  for(let i=0;i<points.length-1;i++){
   const p=points[i],q=points[i+1],dx=q.x-p.x;
   const c1y=p.y+slopes[i]*dx/3,c2y=q.y-slopes[i+1]*dx/3;
   const lo=Math.min(p.y,q.y),hi=Math.max(p.y,q.y);
   path+=` C ${f(p.x+dx/3)} ${f(Math.min(hi,Math.max(lo,c1y)))} ${f(q.x-dx/3)} ${f(Math.min(hi,Math.max(lo,c2y)))} ${f(q.x)} ${f(q.y)}`;
  }
 }
 const area=`${path} L ${f(points.at(-1).x)} ${f(baseline)} L ${f(points[0].x)} ${f(baseline)} Z`;
 const lines=[0,0.25,0.5,0.75,1].map(t=>({y:f(baseline-t*innerH),value:Math.round(t*max)}));
 return {points,path,area,max,baseline,lines};
}
