import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults,createHeaders,generateHWID,normalizeSettings} from '../src/lib/settings.mjs';
import {nodeToConfig} from '../src/lib/nodeconfig.mjs';
import {parseSubscription,analyze,compareReports} from '../src/lib/core.mjs';
const read=f=>readFileSync(new URL(f,import.meta.url),'utf8');

test('auto headers do not save generated defaults and always emit all Happ headers',()=>{
  const opts=normalizeSettings({});
  assert.equal(opts.hwid,'');assert.equal(opts.userAgent,'');
  const a=createHeaders(opts),b=createHeaders(opts);
  for(const h of ['X-App-Version','X-Device-Locale','X-Device-Os','X-Device-Model','User-Agent','X-Hwid'])assert.ok(a[h]);
  assert.notEqual(a['X-Hwid'],b['X-Hwid']);
  assert.equal(opts.hwid,'');
});
test('independent HWID overrides for main and A/B and saved manual overrides',()=>{
 const a=generateHWID(),b=generateHWID();assert.notEqual(a,b);
 const common={hwid:'saved-123',deviceLocale:'RU'};
 assert.equal(createHeaders(common)['X-Hwid'],'saved-123');
 assert.equal(createHeaders(common,{hwid:a})['X-Hwid'],a);
 assert.equal(createHeaders(common,{hwid:b})['X-Hwid'],b);
 assert.equal(createHeaders(common)['X-Device-Locale'],'RU');
});
test('copy URI verbatim and preserve Xray JSON full configuration',()=>{
 const link='vless://11111111-1111-4111-8111-111111111111@edge.example.org:443?security=reality&sni=www.example.com&pbk=xxx&type=grpc#hello';
 const a=analyze(parseSubscription(link));assert.equal(nodeToConfig(a.nodes[0]),link);
 const outbound={tag:'test',protocol:'vless',settings:{vnext:[{address:'proxy.example.net',port:443,users:[{id:'11111111-1111-4111-8111-111111111111'}]}]},streamSettings:{network:'xhttp',security:'tls',xhttpSettings:{path:'/foo',extra:{xmux:{maxConnections:5}}}}};
 const b=analyze(parseSubscription(JSON.stringify({outbounds:[outbound]})));
 const copied=JSON.parse(nodeToConfig(b.nodes[0]));assert.equal(copied.streamSettings.xhttpSettings.extra.xmux.maxConnections,5);
});
test('comparison can be launched from analysis mode with individual URLs',()=>{
 const app=read('../src/App.svelte');const c=read('../src/components/Compare.svelte');
 assert.doesNotMatch(app,/tab==='compare'/);
 assert.match(app,/analysisMode/);
 assert.match(c,/hwidA/);assert.match(c,/hwidB/);
 assert.match(c,/onInspect/);
});
test('all UI selects are custom and registry supports config copy',()=>{
 const reg=read('../src/components/Registry.svelte');
 assert.match(reg,/nodeToConfig/);assert.match(reg,/Копировать подключение/);
 assert.doesNotMatch(reg,/<select\b/);
 assert.match(reg,/CustomSelect/);
 const css=read('../src/style.css');assert.match(css,/\.custom-select/);
});
test('original outbound copied as one selected server and credential',()=>{
 const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 const ob={protocol:'vless',settings:{vnext:[{address:'a.example.org',port:443,users:[{id},{id:other}]},{address:'b.example.org',port:444,users:[{id}]}]},streamSettings:{network:'xhttp',security:'tls',xhttpSettings:{extra:{xmux:{maxConnections:3}}}}};
 const rep=analyze(parseSubscription(JSON.stringify({outbounds:[ob]})));
 const node=rep.nodes.find(n=>n.address==='a.example.org'&&n.userId===id);
 const config=JSON.parse(nodeToConfig(node));
 assert.equal(config.settings.vnext.length,1);assert.equal(config.settings.vnext[0].users.length,1);
 assert.equal(config.streamSettings.xhttpSettings.extra.xmux.maxConnections,3);
});
test('legacy untouched HTTP preset converts to AUTO without replacing custom settings',async()=>{
 const {loadSettings}=await import('../src/lib/settings.mjs');
 const db={getItem:()=>JSON.stringify({appVersion:'19.19.19',deviceLocale:'RU',deviceOs:'Windows',deviceModel:'Xui_x86_64',userAgent:'Happ/19.19.19/Windows/2604171131603',hwid:'y1fr92390d934',extraHeaders:''})};
 assert.equal(loadSettings(db).hwid,'');
 const db2={getItem:()=>JSON.stringify({hwid:'my-personal-hwid'})};
 assert.equal(loadSettings(db2).hwid,'my-personal-hwid');
});
