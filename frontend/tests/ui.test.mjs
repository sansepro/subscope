import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/App.svelte',import.meta.url),'utf8');
const node=readFileSync(new URL('../src/components/NodeWindow.svelte',import.meta.url),'utf8');
const charts=readFileSync(new URL('../src/components/AnalyticsCharts.svelte',import.meta.url),'utf8');
test('input presets have transparent fill across themes',()=>{
 assert.match(css,/\.settings-grid input,[\s\S]*?background:transparent!important/);
 assert.match(css,/\.accent-grid button\.active\{[^}]*background:transparent/);
});
test('scrollbar system also covers native node window',()=>{
 assert.match(css,/\*::-webkit-scrollbar-thumb/);
 assert.match(css,/\.work-area,\.registry-list,\.node-window-body/);
 assert.match(css,/\.node-window-body\{[^}]*scrollbar-color:/);
});
test('dark/light appearance applied both windows',()=>{
 assert.match(main,/loadAppearance\(\)/);
 assert.match(node,/loadAppearance\(\)/);
 assert.match(main,/bind:accent/);
});
test('root line chart uses bounded coordinates and preserved aspect ratio',()=>{
 assert.match(charts,/buildLineChart\(/);
 assert.match(charts,/preserveAspectRatio="xMidYMid meet"/);
 assert.match(charts,/series\.path/);
});
