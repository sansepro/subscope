import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSubscription,analyze} from '../src/lib/core.mjs';
import {auditSignals} from '../src/lib/forensics.mjs';
import {toCSV, csvCell} from '../src/lib/export.mjs';
import {themeList, themeById, accentList} from '../src/lib/themes.mjs';
import {prepareHistoryRecord,historyLabel} from '../src/lib/history.mjs';

const uuid='11111111-1111-4111-8111-111111111111';
const link=(host,user=uuid)=>`vless://${user}@${host}:443?security=reality&sni=cdn.example.com&pbk=abcdefg&type=tcp#n`;
const run=text=>analyze(parseSubscription(text));

test('risk analyzer finds shared endpoint with different credentials',()=>{
 const report=run([link('edge.alpha.test'),link('edge.alpha.test','22222222-2222-4222-8222-222222222222')].join('\n'));
 const a=auditSignals(report,{ips:{},hosts:{}});
 assert.ok(a.signals.find(s=>s.id==='endpoint_credentials').count>=2);
});
test('risk analyzer finds cross-root key and port diversity',()=>{
 const report=run([link('a.alpha.test'),link('b.beta.test')].join('\n'));
 const a=auditSignals(report,{ips:{},hosts:{}});
 assert.ok(a.signals.find(s=>s.id==='credential_roots').count>=2);
 assert.ok(a.score>=0&&a.score<=100);
});
test('risk analyzer does not flag a single ordinary node',()=>{
 const report=run(link('a.alpha.test'));
 const a=auditSignals(report,{ips:{},hosts:{}});
 assert.equal(a.signals.find(s=>s.id==='endpoint_credentials').count,0);
 assert.equal(a.signals.find(s=>s.id==='credential_roots').count,0);
});
test('CSV quotes semicolons, quotes and newlines with UTF8 BOM',()=>{
 assert.equal(csvCell('a;"b\n'), '"a;""b\n"');
 const csv=toCSV(run(link('a.alpha.test')),{ips:{},hosts:{}});
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('АДРЕС;'));assert.ok(csv.includes('a.alpha.test'));
});
test('two themes with independent accents',()=>{
 assert.deepEqual(themeList.map(t=>t.id),['dark','light']);
 assert.ok(accentList.length>=8);
 assert.equal(themeById('light').id,'light');
});
test('history records preserve snapshot and recheck source',()=>{
 const r=prepareHistoryRecord({sourceMode:'url',sourceUrl:'https://example.com/s/a?token=aa',body:'test',report:run(link('a.alpha.test')),intel:{ips:{},hosts:{}}});
 assert.equal(r.sourceMode,'url');assert.equal(r.sourceUrl,'https://example.com/s/a?token=aa');
 assert.equal(r.body,'test');assert.ok(r.id);assert.ok(historyLabel(r).includes('example.com'));
});
