import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {parseBusRoute,validateBusRoutes} from './bus-routes.mjs';
import {buildCalendar} from './build-calendar.mjs';
import {compareBusStop} from './bus-stop-comparison.mjs';
const root=new URL('../',import.meta.url),collectedAt=new Date().toISOString(),cached=process.argv.includes('--cached');
const manifest=JSON.parse(await readFile(new URL('data/bus-route-sources.json',root),'utf8')),lines=JSON.parse(await readFile(new URL('data/bus.json',root),'utf8')).lines,timetables=JSON.parse(await readFile(new URL('data/bus-timetables.json',root),'utf8')).lines;
let previous={routes:[]};try{previous=JSON.parse(await readFile(new URL('data/bus-routes.json',root),'utf8'))}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(new URL('research/bus-map/',root),{recursive:true});
const responses=new Map();async function get(id,full=false){const file=(full?'':'master-')+id+'.json',key=id+':'+full;if(responses.has(key))return responses.get(key);let data;
  if(cached)data=JSON.parse(await readFile(new URL('research/bus-map/'+file,root),'utf8'));
  else{const response=await fetch('https://api.openstreetmap.org/api/0.6/relation/'+id+(full?'/full.json':'.json'),{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'VeronaLocal/0.3 (+https://github.com/Madelirium/verona-app)'}});if(!response.ok)throw Error('OSM HTTP '+response.status);data=await response.json();await writeFile(new URL('research/bus-map/'+file,root),JSON.stringify(data));await new Promise(resolve=>setTimeout(resolve,500));}
  responses.set(key,data);return data;
}
const routes=[],report={checkedAt:collectedAt,sourceUrl:manifest.sourceUrl,googleComparison:'Non eseguito. Collegamenti Google Maps per consultazione manuale.',lines:[],errors:[]};
for(const line of lines){const group=manifest.groups.find(group=>group.number===line.number);if(!group){report.lines.push({lineId:line.id,status:'not-listed',routes:0});continue;}
  const table=timetables.find(table=>table.lineId===line.id);let ids=group.routeIds;
  try{const master=(await get(group.masterId)).elements.find(e=>e.type==='relation'&&e.id===group.masterId);if(master?.tags?.route_master==='bus'&&master.tags.ref===line.number&&master.tags.operator==='ATV')ids=master.members.filter(m=>m.type==='relation').map(m=>m.ref);else report.errors.push({lineId:line.id,relationId:group.masterId,error:'Gruppo wiki incoerente; verificate singolarmente le relazioni elencate'});}catch(error){report.errors.push({lineId:line.id,relationId:group.masterId,error:error.message});}
  let imported=0,retained=0;
  for(const id of new Set(ids)){try{const data=await get(id,true);routes.push(parseBusRoute(data.elements,id,{collectedAt,number:line.number,lineId:line.id,timetableBlocks:table?.blocks||[],timetableDirections:[...new Set((table?.blocks||[]).map(b=>b.direction))],allowUnmatchedDirection:true}));imported++;}catch(error){report.errors.push({lineId:line.id,relationId:id,error:error.message});const old=previous.routes.find(r=>r.lineId===line.id&&r.id===String(id));if(old){routes.push(old);retained++;}}}
  report.lines.push({lineId:line.id,status:imported?'ok':retained?'retained':'unavailable',routes:imported+retained,retained});
}
if(!routes.length)throw Error('Nessun percorso valido: catalogo precedente conservato');
const output={collectedAt,source:'OpenStreetMap',license:'ODbL',licenseUrl:'https://www.openstreetmap.org/copyright',scope:'Tracciati OSM delle linee ATV disponibili. Nessuna certificazione di percorsi attuali o deviazioni. Confronto Google non automatico.',routes};validateBusRoutes(output);
const comparison={checkedAt:collectedAt,method:'Nomi esatti e ordine nella direzione; somiglianze solo proposte da verificare. Nessun dato Google importato.',rows:[]};
for(const route of routes){const blocks=timetables.find(table=>table.lineId===route.lineId)?.blocks||[];for(const stop of route.stops){stop.comparison=compareBusStop(route,stop,blocks);comparison.rows.push({lineId:route.lineId,routeId:route.id,routeLabel:route.label,timetableDirection:route.timetableDirection,osmId:stop.id,osmName:stop.name,lat:stop.lat,lon:stop.lon,osmSourceUrl:stop.sourceUrl,...stop.comparison});}}
report.comparisonCounts=comparison.rows.reduce((counts,row)=>{counts[row.status]=(counts[row.status]||0)+1;return counts;},{});
await writeFile(new URL('data/bus-stop-comparison.json',root),JSON.stringify(comparison)+'\n');
await writeFile(new URL('data/bus-routes.json.tmp',root),JSON.stringify(output)+'\n');await rename(new URL('data/bus-routes.json.tmp',root),new URL('data/bus-routes.json',root));
await writeFile(new URL('data/bus-route-import-report.json',root),JSON.stringify(report,null,2)+'\n');
await buildCalendar();console.log(JSON.stringify({routes:routes.length,lines:new Set(routes.map(r=>r.lineId)).size,errors:report.errors},null,2));
