import {readFile,writeFile,rename} from 'node:fs/promises';
import {busSources,busFeed,decodeAtv,parseBusLines,parseBusUpdates} from './bus.mjs';
import {buildCalendar} from './build-calendar.mjs';
const root=new URL('../',import.meta.url),checkedAt=new Date().toISOString();
let old={lines:[],alerts:[]};try{old=JSON.parse(await readFile(new URL('data/bus.json',root),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const data={updatedAt:checkedAt,lines:[],alerts:[],sources:[],scope:'Schede urbane feriali, serali e festive di Verona. Orari nei PDF ufficiali; nessun dato di arrivo in tempo reale.',extraurbanUrl:'https://www.atv.verona.it/orari_linee_bus_extraurbani',portalUrl:'https://www.mycicero.it/atv-vr/TPWebPortal/it/timetable/stops'};
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'VeronaLocalPrototype/0.1 (local development)'}});if(!r.ok)throw Error(`HTTP ${r.status}: ${url}`);return decodeAtv(new Uint8Array(await r.arrayBuffer()),r.headers.get('content-type')||'');}
for(const s of busSources){try{const rows=parseBusLines(await get(s.url),s,checkedAt);data.lines.push(...rows);data.sources.push({key:s.key,status:'ok',count:rows.length});}catch(e){const retained=old.lines.filter(l=>l.service===s.key);data.lines.push(...retained);data.sources.push({key:s.key,status:'error',error:e.message,retained:retained.length});process.exitCode=1;}}
try{data.updates=parseBusUpdates(await get(busFeed),checkedAt);data.alerts=data.updates.filter(i=>i.serviceAlert);data.sources.push({key:'rss',status:'ok',count:data.updates.length,alerts:data.alerts.length});}catch(e){data.updates=old.updates||old.alerts;data.alerts=old.alerts;data.sources.push({key:'rss',status:'error',error:e.message,retained:data.updates.length});process.exitCode=1;}
data.lines.sort((a,b)=>a.number.localeCompare(b.number,'it',{numeric:true})||a.service.localeCompare(b.service));
await writeFile(new URL('data/bus.json.tmp',root),JSON.stringify(data,null,2)+'\n');await rename(new URL('data/bus.json.tmp',root),new URL('data/bus.json',root));
await writeFile(new URL('data/bus-import-report.json',root),JSON.stringify({checkedAt,sources:data.sources},null,2)+'\n');
await buildCalendar();console.log(JSON.stringify(data.sources,null,2));
