import test from 'node:test';
import assert from 'node:assert/strict';
import {themeList,accentList,loadAppearance,saveAppearance,applyTheme} from '../src/lib/themes.mjs';
import {buildLineChart} from '../src/lib/charts.mjs';

const storage=()=>({map:new Map(),getItem(k){return this.map.get(k)||null},setItem(k,v){this.map.set(k,v)}});

test('exactly two color modes; accents independent of mode',()=>{
 assert.deepEqual(themeList.map(x=>x.id),['dark','light']);
 assert.ok(accentList.length>=8);
 assert.equal(accentList.length,new Set(accentList.map(x=>x.id)).size);
 for(const a of accentList){assert.match(a.dark,/^#[0-9a-fA-F]{6}$/);assert.match(a.light,/^#[0-9a-fA-F]{6}$/)}
});
test('appearance persists mode and accent',()=>{
 const db=storage();saveAppearance({mode:'light',accent:'cyan'},db);
 assert.deepEqual(loadAppearance(db),{mode:'light',accent:'cyan'});
});
test('legacy theme maps to an accent',()=>{
 const db=storage();db.setItem('subscope.desktop.theme','forest');
 assert.deepEqual(loadAppearance(db),{mode:'dark',accent:'emerald'});
});
test('invalid appearance defaults safely',()=>{
 const db=storage();db.setItem('subscope.desktop.appearance','{"mode":"anything","accent":"garbage"}');
 assert.deepEqual(loadAppearance(db),{mode:'dark',accent:'violet'});
});
test('applyTheme sets same semantic tokens in dark and light',()=>{
 const props=new Map();const element={dataset:{},style:{setProperty:(k,v)=>props.set(k,v)}};
 applyTheme('light','blue',element);
 assert.equal(element.dataset.mode,'light');assert.equal(element.dataset.accent,'blue');
 assert.equal(props.get('--bg'),'#f4f6fa');assert.equal(props.get('--accent'),'#245aaa');
 assert.match(props.get('--white'),/^#/);assert.match(props.get('--muted'),/^#/);
});
test('line chart is bounded and has a smooth path',()=>{
 const chart=buildLineChart([2,8,3,16,1],{width:600,height:190});
 assert.equal(chart.points.length,5);
 assert.ok(chart.path.startsWith('M '));assert.ok(chart.path.includes(' C '));
 assert.ok(chart.area.endsWith(' Z'));
 assert.ok(chart.points.every(p=>p.x>=0&&p.x<=600&&p.y>=0&&p.y<=190));
 assert.ok(!/NaN|Infinity/.test(chart.path+chart.area));
});
test('single-value and empty line charts are valid',()=>{
 const single=buildLineChart([4]);const empty=buildLineChart([]);
 assert.equal(single.points.length,1);assert.ok(!single.path.includes('NaN'));
 assert.equal(empty.points.length,0);assert.equal(empty.path,'');
});
