import test from 'node:test';
import assert from 'node:assert/strict';
import {enrichNodes,emptyIntel} from '../src/lib/enrich.mjs';
import {parseSubscription,analyze} from '../src/lib/core.mjs';
test('domain resolves to IP, ASN, country, prefix',async()=>{
 const links='vless://11111111-1111-4111-8111-111111111111@node.example.net:443?security=tls&sni=node.example.net&type=tcp#A';
 const report=analyze(parseSubscription(links));
 const events=[];
 const mock={dns:async host=>({host,ips:['1.1.1.1']}),json:async url=>url.includes('stat.ripe.net')?JSON.stringify({data:{prefix:'1.1.1.0/24',asns:[13335]}}):JSON.stringify({success:true,country:'United States',region:'Virginia',city:'Ashburn',connection:{asn:13335,org:'Cloudflare'}})};
 const intel=await enrichNodes(report.nodes,mock,event=>events.push(event.stage),()=>false,emptyIntel());
 assert.deepEqual(intel.hosts['node.example.net'].ips,['1.1.1.1']);
 assert.equal(intel.ips['1.1.1.1'].asn,'AS13335');
 assert.equal(intel.ips['1.1.1.1'].prefix,'1.1.1.0/24');
 assert.equal(intel.ips['1.1.1.1'].city,'Ashburn');
 assert.ok(events.includes('DNS')&&events.includes('GEO / BGP'));
});
