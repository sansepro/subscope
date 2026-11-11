import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('registry has no redundant summary and uses adaptive row actions menu',()=>{
 const r=read('src/components/Registry.svelte'),css=read('src/style.css');
 assert.doesNotMatch(r,/class="registry-summary"/);
 assert.match(r,/Подробнее/);assert.match(r,/Копировать подключение/);
 assert.match(r,/on:contextmenu/);
 assert.match(css,/@container registry/);
 assert.doesNotMatch(css,/\.registry-list-head,\.node-entry\{[^}]*min-width:735px/);
});
test('node detail toolbar separates actions from metadata',()=>{
 const s=read('src/components/NodeWindow.svelte');
 assert.match(s,/node-dialog-actions/);assert.match(s,/node-dialog-tags/);
});
test('http settings use two column adaptive grid without full width user agent',()=>{
 const s=read('src/components/Settings.svelte'),css=read('src/style.css');
 assert.doesNotMatch(s,/class:wide=\{key==='userAgent'\}/);
 assert.match(css,/\.settings-grid\{[^}]*grid-template-columns:repeat\(2/);
 assert.match(css,/@media\s*\(max-width:5\d\dpx\)[\s\S]*?\.settings-grid\{grid-template-columns:minmax\(0,1fr\)/);
});
test('select scrollbar drag does not dismiss popup',()=>{
 const s=read('src/components/CustomSelect.svelte'),overlay=read('src/lib/overlayScrollbars.mjs');
 assert.match(overlay,/__scrollTarget/);
 assert.match(s,/scrollbarTarget/);
 assert.match(s,/closest.*smart-scrollbar/);
});
test('main window disables text selection but node window allows values',()=>{
 const css=read('src/style.css');
 assert.match(css,/body\{user-select:none/);
 assert.match(css,/\.node-window-body[^\n]*user-select:text/);
});
test('graphs expose smart tooltips and additional topology distributions',()=>{
 const s=read('src/components/AnalyticsCharts.svelte');
 assert.match(s,/chart-tooltip/);assert.match(s,/ТРАНСПОРТ/);assert.match(s,/ASN/);
 assert.match(s,/КЛЮЧИ \/ ROOT/);assert.match(s,/УЗЛЫ \/ ENDPOINT/);
});
test('popup coordinates clamp to viewable area',async()=>{
 const {placePopup}=await import('../src/lib/popups.mjs');
 assert.deepEqual(placePopup({x:999,y:999,width:180,height:150,vw:350,vh:250,padding:8}),{left:162,top:92});
 assert.deepEqual(placePopup({x:-90,y:-50,width:120,height:95,vw:350,vh:250,padding:8}),{left:8,top:8});
});
test('insights report uniqueness distributions',async()=>{
 const {buildInsights}=await import('../src/lib/insights.mjs');
 const nodes=[
  {fingerprint:'a',protocol:'vless',network:'tcp',security:'tls',address:'a.one.test',port:443,addressKind:'domain',identity:'one.test',userId:'key',sni:'s.one.test'},
  {fingerprint:'b',protocol:'vless',network:'tcp',security:'tls',address:'a.one.test',port:443,addressKind:'domain',identity:'one.test',userId:'key2',sni:'s.one.test'},
  {fingerprint:'c',protocol:'vless',network:'tcp',security:'reality',address:'b.two.test',port:443,addressKind:'domain',identity:'two.test',userId:'key',sni:'s.two.test'}
 ];
 const x=buildInsights({nodes,stats:{records:3}},{});
 assert.equal(x.summary.uniqueSni,2);
 assert.equal(x.summary.reusedEndpoints,1);
 assert.equal(x.summary.multiRootCredentials,1);
 assert.equal(x.groups.endpointReuse.reduce((n,x)=>n+x.count,0),2);
 assert.equal(x.groups.credentialSpread.reduce((n,x)=>n+x.count,0),2);
});

test('expanded uniqueness audit includes BGP, ASN, SNI, endpoint and shared path',async()=>{
 const {auditSignals}=await import('../src/lib/forensics.mjs');
 const node=(id,identity,address,path,publicKey)=>({fingerprint:id,identity,address,port:443,protocol:'vless',network:'ws',security:'reality',addressKind:'domain',userId:'one-key',sni:'private.'+identity,path,publicKey,dupCount:1});
 const report={nodes:[node('a','one.test','node.one.test','/private-stream','pk1'),node('b','two.test','node.two.test','/private-stream','pk2')]};
 const audit=auditSignals(report,{});
 assert.equal(audit.signals.find(s=>s.id==='shared_path_roots').count,2);
 for(const id of ['credential_cross_bgp','credential_cross_asn','endpoint_root_mix','credential_sni_spread','sni_reality_conflict'])assert.ok(audit.signals.some(s=>s.id===id),id);
 assert.ok(audit.signals.length>=24);
});
test('all desktop windows remove default webview gestures without breaking text field editing',()=>{
 const helper=read('src/lib/desktopBehavior.mjs');
 assert.match(helper,/dragstart/);assert.match(helper,/f12/);
 assert.match(read('src/main.js'),/installDesktopBehavior/);
 assert.match(read('src/modal.js'),/installDesktopBehavior/);
 assert.match(read('src/components/ContextMenu.svelte'),/scrollbarTarget/);
});
test('histogram navigation filters real nodes',async()=>{
 const {buildInsights,filterNode}=await import('../src/lib/insights.mjs');
 const n=(fingerprint,address,userId,identity)=>({fingerprint,address,userId,identity,port:443,protocol:'vless',network:'tcp',security:'tls',addressKind:'domain'});
 const nodes=[n('a','a.test','one','a.test'),n('b','a.test','two','a.test'),n('c','b.test','one','b.test')];
 const insights=buildInsights({nodes,stats:{records:3}},{});
 assert.equal(filterNode(nodes[0],{kind:'endpoint_reuse',value:'2'},insights,{}),true);
 assert.equal(filterNode(nodes[2],{kind:'endpoint_reuse',value:'2'},insights,{}),false);
 assert.equal(filterNode(nodes[2],{kind:'credential_spread',value:'2'},insights,{}),true);
 assert.equal(filterNode(nodes[1],{kind:'credential_spread',value:'2'},insights,{}),false);
});
test('node detail selection supports custom copy menu',()=>{
 const src=read('src/components/ContextMenu.svelte');
 assert.match(src,/window\.getSelection/);
 assert.match(src,/selectionText/);
 assert.match(src,/\.node-window-body/);
});
