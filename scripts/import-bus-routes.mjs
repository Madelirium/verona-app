import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {parseBusRoute,validateBusRoutes} from './bus-routes.mjs';
import {buildCalendar} from './build-calendar.mjs';

const root=new URL('../',import.meta.url),collectedAt=new Date().toISOString(),cached=process.argv.includes('--cached');
const timetable=JSON.parse(await readFile(new URL('data/bus-timetables.json',root),'utf8')).lines.find(line=>line.lineId==='atv-urban-11');
const timetableDirections=[...new Set(timetable.blocks.map(block=>block.direction))];
await mkdir(new URL('research/bus-map/',root),{recursive:true});
async function get(path,file){
  if(cached)return JSON.parse(await readFile(new URL('research/bus-map/'+file,root),'utf8'));
  const response=await fetch('https://api.openstreetmap.org/api/0.6/'+path,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'VeronaLocal/0.2 (+https://github.com/Madelirium/verona-app)'}});
  if(!response.ok)throw Error('OSM HTTP '+response.status);
  const data=await response.json();await writeFile(new URL('research/bus-map/'+file,root),JSON.stringify(data));return data;
}
const master=(await get('relation/11344302.json','line11-master.json')).elements.find(element=>element.type==='relation'&&element.id===11344302);
if(master?.tags?.route_master!=='bus'||master.tags.ref!=='11'||master.tags.operator!=='ATV')throw Error('Gruppo percorsi inatteso');
const routes=[];
for(const member of master.members){
  if(member.type!=='relation')throw Error('Variante inattesa');
  const data=await get('relation/'+member.ref+'/full.json',member.ref+'.json');
  routes.push(parseBusRoute(data.elements,member.ref,{collectedAt,timetableDirections}));
  if(!cached)await new Promise(resolve=>setTimeout(resolve,700));
}
const output={collectedAt,source:'OpenStreetMap',license:'ODbL',licenseUrl:'https://www.openstreetmap.org/copyright',scope:'Prima prova: varianti OSM della linea urbana feriale 11. Non certifica deviazioni o percorsi ATV attuali.',routes};
validateBusRoutes(output);
await writeFile(new URL('data/bus-routes.json.tmp',root),JSON.stringify(output)+'\n');await rename(new URL('data/bus-routes.json.tmp',root),new URL('data/bus-routes.json',root));
await buildCalendar();console.log(`Mappa linea 11: ${routes.length} varianti importate.`);
