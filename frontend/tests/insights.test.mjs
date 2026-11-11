import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSubscription, analyze } from '../src/lib/core.mjs';
import { buildInsights, filterNode, findRelatedNodes } from '../src/lib/insights.mjs';

const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const link=(id,host,extra='')=>`vless://${id}@${host}:443?type=ws&security=tls&sni=${host}&path=%2Fedge${extra}#node`;
const result=analyze(parseSubscription([
 link(a,'a.alpha.example'),
 link(a,'a.alpha.example'),
 link(a,'b.beta.example'),
 link(b,'b.beta.example'),
 link(b,'104.21.20.23'),
].join('\n')));
const intel={ips:{'104.21.20.23':{ip:'104.21.20.23',asn:'AS13335',org:'Cloudflare',country:'US',region:'Virginia',city:'Ashburn',prefix:'104.21.0.0/16'},'1.2.3.4':{ip:'1.2.3.4',asn:'AS123',org:'NetOne',country:'DE',region:'Hesse',city:'Frankfurt',prefix:'1.2.3.0/24'}},hosts:{'a.alpha.example':{ips:['1.2.3.4']},'b.beta.example':{ips:['1.2.3.4']}}};

test('analytics indexes cross-domain credentials and duplicate records',()=>{
 const out=buildInsights(result,intel);
 assert.equal(out.summary.nodes,4);
 assert.equal(out.summary.duplicates,1);
 assert.ok(out.summary.crossRootKeys>=1);
 assert.equal(out.summary.countries,2);
 assert.equal(out.summary.asns,2);
 assert.ok(out.flags.cross_root_key.count>=2);
 assert.equal(out.groups.protocols.find(x=>x.name==='vless').count,4);
});
test('navigation filters resolve node membership',()=>{
 const out=buildInsights(result,intel);
 const n=result.nodes.find(n=>n.address==='a.alpha.example');
 assert.ok(filterNode(n,{kind:'protocol',value:'vless'},out,intel));
 assert.ok(filterNode(n,{kind:'identity',value:n.identity},out,intel));
 assert.ok(filterNode(n,{kind:'country',value:'DE'},out,intel));
 assert.ok(filterNode(n,{kind:'asn',value:'AS123'},out,intel));
 assert.ok(filterNode(n,{kind:'flag',value:'duplicate'},out,intel));
 assert.ok(!filterNode(n,{kind:'country',value:'US'},out,intel));
});
test('node related records and all DNS targets are indexed',()=>{
 const out=buildInsights(result,intel);
 const target=result.nodes.find(n=>n.address==='b.beta.example'&&n.userId===a);
 assert.deepEqual(out.ipsByFingerprint[target.fingerprint],['1.2.3.4']);
 const related=findRelatedNodes(target,result.nodes,out);
 assert.ok(related.some(x=>x.address==='a.alpha.example'));
 assert.ok(related.every(x=>x.fingerprint!==target.fingerprint));
});
test('empty analytics remains stable',()=>{
 const out=buildInsights(null,{ips:{},hosts:{}});
 assert.equal(out.summary.nodes,0);
 assert.deepEqual(out.groups.protocols,[]);
});
