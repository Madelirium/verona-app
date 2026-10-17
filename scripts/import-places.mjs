import {readFile,writeFile,rename} from 'node:fs/promises';
import {placesBounds,normalizePlaces} from './places.mjs';
import {buildCalendar} from './build-calendar.mjs';
const root=new URL('../',import.meta.url),checkedAt=new Date().toISOString(),bbox=placesBounds.join(',');
const query=`[out:json][timeout:30];(node["name"]["shop"](${bbox});node["name"]["craft"](${bbox});node["name"]["amenity"~"^(cafe|bar|pub|ice_cream|restaurant|fast_food|pharmacy|bank|post_office)$"](${bbox});node["name"]["leisure"~"^(fitness_centre|sports_centre)$"](${bbox}););out body;`;
let previous=null;try{previous=JSON.parse(await readFile(new URL('data/places.json',root),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
try{
  const r=await fetch('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(query),{headers:{'User-Agent':'VeronaLocalApp/0.1 (local prototype; OpenStreetMap activity directory)'},signal:AbortSignal.timeout(55000)});
  if(!r.ok)throw Error(`Overpass HTTP ${r.status}: ${(await r.text()).slice(0,500)}`);
  const items=normalizePlaces(await r.json(),checkedAt);if(!items.length)throw Error('Nessuna attività estratta');
  const data={updatedAt:checkedAt,status:'ok',scope:'Prima raccolta: centro e zone limitrofe di Verona. Non è un elenco completo o verificato delle attività della città o provincia.',bounds:placesBounds,source:'OpenStreetMap contributors',license:'ODbL 1.0',licenseUrl:'https://www.openstreetmap.org/copyright',tileUrl:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',items};
  await writeFile(new URL('data/places.json.tmp',root),JSON.stringify(data,null,2)+'\n');await rename(new URL('data/places.json.tmp',root),new URL('data/places.json',root));
  console.log(`Attività importate: ${items.length}`);
}catch(e){if(previous){await writeFile(new URL('data/places.json',root),JSON.stringify({...previous,status:'error',lastAttemptAt:checkedAt,error:e.message},null,2)+'\n');}console.error(e.message);process.exitCode=1;}
await buildCalendar();
