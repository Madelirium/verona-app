import {text} from './parsers.mjs';
export const busSources=[
  {key:'urban',label:'Urbano feriale',url:'https://www.atv.verona.it/orari-urbani/dettaglio-percorsi-orari-pdf'},
  {key:'evening',label:'Serale',url:'https://www.atv.verona.it/urbano-verona-serale'},
  {key:'holiday',label:'Festivo',url:'https://www.atv.verona.it/urbano-verona-festivo'}
];
export const busFeed='https://www.atv.verona.it/flex/cm/pages/ServeFeed.php/L/IT/fmt/rss20/feed/pages%3A2';
export function atvUrl(value){const u=new URL(text(value),'https://www.atv.verona.it');if(u.origin!=='https://www.atv.verona.it')throw Error('Link ATV inatteso');return u.href;}
export function decodeAtv(bytes,contentType=''){
  const hint=new TextDecoder('windows-1252').decode(bytes.slice(0,1200));
  const charset=(contentType+' '+hint).match(/(?:charset|encoding)\s*=\s*["']?([\w-]+)/i)?.[1]||'utf-8';
  return new TextDecoder(charset).decode(bytes);
}
export function parseBusLines(html,source,checkedAt){
  const parts=[...html.matchAll(/<div\b[^>]*class=["'][^"']*\bviewPar\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)];
  const lines=[];
  for(let i=0;i<parts.length;i++){
    const part=parts[i],content=part[1];
    const rows=content.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|strong|span)>/gi,'$& ').split('\n').map(r=>text(r)).filter(Boolean);
    const heading=rows[0]?.match(/^LINEA\s+(\d+[A-Z]?)\b/i);if(!heading)continue;
    const number=heading[1].toUpperCase();
    const route=rows.slice(1).join('\n');
    if(!route)throw Error(`Percorso della linea ${number} non riconosciuto`);
    const tail=html.slice(part.index+part[0].length,parts[i+1]?.index??html.length);
    const attachment=[...tail.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].find(m=>/ServeAttachment\.php/.test(m[1])&&/orari[oi]?/i.test(text(m[2])));
    if(!attachment)throw Error(`Orario della linea ${number} mancante`);
    lines.push({id:`atv-${source.key}-${number}`,number,service:source.key,serviceLabel:source.label,route,source:'ATV Verona',sourceUrl:source.url,timetableUrl:atvUrl(attachment[1]),checkedAt,heading:rows[0],realtime:false});
  }
  if(!lines.length)throw Error(`Nessuna scheda riconosciuta: ${source.key}`);
  return [...new Map(lines.map(l=>[l.id,l])).values()];
}
export function alertLines(title){
  const prefix=title.match(/^LINE[AE]\s+([A-Z]{0,2}\d+[A-Z]?(?:\s*(?:[,/\-]|\be\b)\s*[A-Z]{0,2}\d+[A-Z]?)*)(?=\b)/i)?.[1];
  if(!prefix)return [];
  return [...new Set(prefix.toUpperCase().match(/[A-Z]{0,2}\d+[A-Z]?/g)||[])];
}
export function splitBusDirections(route){
  const result=[];let current=null;
  for(const row of route.split('\n').map(r=>r.trim()).filter(Boolean)){
    if(/^Direzione\b/i.test(row)){current={label:row,path:''};result.push(current);}
    else{if(!current){current={label:'Percorso indicato da ATV',path:''};result.push(current);}current.path+=(current.path?'\n':'')+row;}
  }
  return result;
}
export function parseBusUpdates(xml,checkedAt){
  if(!/<rss\b/i.test(xml)||!/<channel>/i.test(xml))throw Error('Feed ATV non riconosciuto');
  const results=[];
  for(const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)){
    const field=name=>text(m[1].match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`,'i'))?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1'));
    const title=field('title');
    const link=atvUrl(field('link')),published=field('pubDate');
    if(!title||!published||!Number.isFinite(Date.parse(published)))throw Error('Avviso ATV incompleto');
    results.push({id:link,title,sourceUrl:link,source:'ATV Verona',publishedAt:new Date(published).toISOString(),checkedAt,lines:alertLines(title),serviceAlert:/^LINE[AE]\s+\w*\d|deviazion|sciopero|sospension|modific.*(?:line|servizi)|fermat|variazion.*orar/i.test(title)});
  }
  return [...new Map(results.map(a=>[a.id,a])).values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
}
export function parseBusAlerts(xml,checkedAt){return parseBusUpdates(xml,checkedAt).filter(i=>i.serviceAlert);}
