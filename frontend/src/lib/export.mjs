import {ipsOf} from './insights.mjs';
export function csvCell(value){let text=String(value??'');if(/^[\s\u0000-\u001f]*[=+\-@]/.test(text))text="'"+text;return /[;"\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;}
export function toCSV(report,intel={ips:{},hosts:{}},audit=null){
 const rows=[['АДРЕС','ПОРТ','ПРОТОКОЛ','ТРАНСПОРТ','ЗАЩИТА','ROOT','SNI','HOST','PATH','FLOW','IP','СТРАНА','РЕГИОН','ГОРОД','ОПЕРАТОР','ASN','BGP PREFIX','ПОВТОРЫ','СИГНАЛЫ']];
 for(const n of report?.nodes||[]){const ipList=ipsOf(n,intel);const best=ipList.map(ip=>intel.ips?.[ip]).find(x=>x&&!x.error)||{};rows.push([n.address,n.port,n.protocol,n.network,n.security,n.identity,n.sni,n.host,n.path,n.flow,ipList.join(', '),best.country,best.region,best.city,best.org,best.asn,best.prefix,n.dupCount||1,(audit?.flagByNode?.[n.fingerprint]||[]).join(', ')]);}
 return '\uFEFF'+rows.map(c=>c.map(csvCell).join(';')).join('\r\n')+'\r\n';
}
