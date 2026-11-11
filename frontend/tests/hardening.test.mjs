import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('standalone modal.html is a second build entry',()=>{
 assert.ok(existsSync(new URL('../modal.html',import.meta.url)));
 assert.match(read('vite.config.js'),/modal\.html/);
 assert.match(read('src/main.js'),/mount\(App/);
 assert.match(read('src/modal.js'),/mount\(NodeWindow/);
 assert.match(read('../service.go'),/URL:\s*"\/modal\.html\?id=/);
});
test('no implementation labels in UI',()=>{
 for(const p of ['src/App.svelte','src/components/History.svelte','src/components/Settings.svelte','src/components/Compare.svelte','src/components/NodeWindow.svelte']){
   const text=read(p);
   assert.doesNotMatch(text,/(?:NATIVE HTTP|HAPP HEADERS|LOCAL STORAGE|WAILS · SVELTE|HTTP \/ GO|HISTORY \/ STORAGE)/);
 }
 assert.match(read('src/App.svelte'),/>\s*НАСТРОЙКИ\s*</);
});
test('clipboard preserves original config even if stored JSON is corrupt',async()=>{
 const {nodeToConfig}=await import('../src/lib/nodeconfig.mjs');
 const node={address:'one.test',port:443,protocol:'vless',network:'tcp',security:'reality',sourceConfig:'{bad',fingerprint:'test'};
 assert.doesNotThrow(()=>nodeToConfig(node));
 assert.equal(JSON.parse(nodeToConfig(node)).settings.address,'one.test');
});
test('csv neutralizes spreadsheet formula injection',async()=>{
 const {csvCell}=await import('../src/lib/export.mjs');
 for(const value of ['=1+1','+SUM(A1)','-1+3','@cmd','\t=1+1','\r=1+1']){
  assert.ok(csvCell(value).startsWith("'" ) || csvCell(value).startsWith('"\''));
 }
 assert.equal(csvCell('abc'),'abc');
});
test('overlay scrollbars auto-hide with separate horizontal and vertical rails',()=>{
 assert.match(read('src/lib/overlayScrollbars.mjs'),/pointerdown/);
 assert.match(read('src/lib/overlayScrollbars.mjs'),/scrollLeft/);
 assert.match(read('src/lib/overlayScrollbars.mjs'),/scrollTop/);
 assert.match(read('src/style.css'),/scrollbar-width:none/);
 assert.match(read('src/modal.js'),/overlayScrollbars/);
});
test('select and context menu use measured viewport clamping',()=>{
 assert.match(read('src/components/CustomSelect.svelte'),/getBoundingClientRect\(\)/);
 assert.match(read('src/components/CustomSelect.svelte'),/visualViewport/);
 assert.match(read('src/components/ContextMenu.svelte'),/getBoundingClientRect\(\)/);
});
test('chart scales for responsive size and uses per-card clip-safe geometry',()=>{
 assert.match(read('src/components/AnalyticsCharts.svelte'),/preserveAspectRatio="xMidYMid meet"/);
 assert.match(read('src/components/AnalyticsCharts.svelte'),/class="spark-root"/);
 assert.match(read('src/style.css'),/\.graph-grid/);
});
test('registry copy action keeps fixed dimensions and does not trigger row activation',()=>{
 const registry=read('src/components/Registry.svelte');
 assert.match(registry,/e\?\.stopPropagation\(\)/);
 assert.match(registry,/class="reg-config"/);
 assert.match(read('src/style.css'),/\.reg-config button\{width:33px!important/);
});
test('native node payload keeps only selected DNS/GEO data',()=>{
 const registry=read('src/components/Registry.svelte');
 assert.match(registry,/selectedIntel=/);
 assert.match(registry,/intel:selectedIntel/);
 assert.match(read('../service.go'),/delete\(n\.nodeData, id\)/);
});
