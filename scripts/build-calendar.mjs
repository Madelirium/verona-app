import {eventBusIndex} from './event-bus-index.mjs';
import {validateOfficialLine} from './official-bus.mjs';
import {datasetStatus} from './data-status.mjs';
import {extractNewsTiming,newsDeadlineInstant,newsValidity,newsPastSeason} from './news-timing.mjs';
import {validateWasteData,validateWasteSelection,wasteUpcoming,normalizeWasteStreet,searchWasteStreets,resolveWasteAddress} from './waste.mjs';
import {validatePharmacies,pharmacyPeriods} from './pharmacies.mjs';
import {authConfig} from './auth-config.mjs';
import {loadEnvFile} from 'node:process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import {districtCatalog,districtMatches,explicitDistricts} from './districts.mjs';
import {splitBusDirections,alertLines} from './bus.mjs';
import {validateTimetables} from './timetables.mjs';
import {validateBusRoutes} from './bus-routes.mjs';
const root = new URL('../',import.meta.url);
export async function buildCalendar() {
  try { loadEnvFile(new URL('../.env',import.meta.url)); }
  catch(error) { if(error.code!=='ENOENT')throw error; }
  const [template,logic,json,editorialJson] = await Promise.all(['public/calendar.template.html','public/calendar.js','data/events.json','data/editorial.json'].map(p=>readFile(new URL(p,root),'utf8')));
  const data=JSON.parse(json);
  data.auth=authConfig();
  data.busOfficial=JSON.parse(await readFile(new URL('data/bus-official.json',root),'utf8'));
  data.busCategories=JSON.parse(await readFile(new URL('data/bus-categories.json',root),'utf8'));
  await mkdir(new URL('public/bus-official/',root),{recursive:true});
  const officialAssets=[];
  for(const line of data.busOfficial.lines){
    if(!/^[A-Za-z0-9]+$/.test(line.number))throw new Error('Codice linea non valido');
    const json=await readFile(new URL('data/bus-official/'+line.number+'.json',root),'utf8');
    const asset=JSON.parse(json);validateOfficialLine(asset,data.busOfficial,line.number);officialAssets.push(asset);
    await writeFile(new URL('public/bus-official/'+line.number+'.json',root),json);
  }
  data.busOfficial.stopIndexAsset='bus-official/stops.json';
  await writeFile(new URL('public/bus-official/stops.json',root),JSON.stringify(eventBusIndex(data.busOfficial,officialAssets)));
  data.briscolaApi=process.env.BRISCOLA_API_URL||'';
  if(!Array.isArray(data.events))throw new Error('Catalogo eventi non valido');
  try{data.news=JSON.parse(await readFile(new URL('data/news.json',root),'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw error;data.news={items:[],sources:[]};}
  try{data.bus=JSON.parse(await readFile(new URL('data/bus.json',root),'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw error;data.bus={lines:[],alerts:[],sources:[]};}
  data.bus.lines=data.bus.lines.map(line=>({...line,directions:splitBusDirections(line.route)}));
  for(const key of ['alerts','updates'])data.bus[key]=(data.bus[key]||[]).map(item=>({...item,lines:alertLines(item.title)}));
  try{data.busTimetables=JSON.parse(await readFile(new URL('data/bus-timetables.json',root),'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw error;data.busTimetables={lines:[],errors:[]};}
  if(data.busTimetables.lines.length){const manifest=JSON.parse(await readFile(new URL('data/bus-timetable-snapshots.json',root),'utf8'));validateTimetables(data.busTimetables,manifest);}
  try{data.busRoutes=JSON.parse(await readFile(new URL('data/bus-routes.json',root),'utf8'));validateBusRoutes(data.busRoutes);}
  catch(error){if(error.code!=='ENOENT')throw error;data.busRoutes={routes:[]};}
  if(data.busRoutes.routes.length){
    await mkdir(new URL('public/bus-routes/',root),{recursive:true});
    for(const lineId of new Set(data.busRoutes.routes.map(route=>route.lineId))){const routes=data.busRoutes.routes.filter(route=>route.lineId===lineId);await writeFile(new URL('public/bus-routes/'+lineId+'.json',root),JSON.stringify({routes}));}
    data.busRoutes={...data.busRoutes,assetBase:'bus-routes/',routes:data.busRoutes.routes.map(({segments,stops,...route})=>route)};
  }
  try{data.places=JSON.parse(await readFile(new URL('data/places.json',root),'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw error;data.places={items:[]};}
  try{data.parking=JSON.parse(await readFile(new URL('data/parking.json',root),'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw error;data.parking={items:[]};}
  data.waste=JSON.parse(await readFile(new URL('data/waste.json',root),'utf8'));
  const amia=JSON.parse(await readFile(new URL('data/waste-calendars.json',root),'utf8'));
  data.waste.zones.forEach(zone=>{zone.validFrom=data.waste.validFrom;});data.waste.zones.push(...amia.zones);data.waste.validFrom='2026-01-01';data.waste.calendarsCheckedOn=amia.checkedOn;validateWasteData(data.waste);
  data.pharmacies=JSON.parse(await readFile(new URL('data/pharmacies.json',root),'utf8'));validatePharmacies(data.pharmacies);
  const editorial=JSON.parse(editorialJson);
  data.events=data.events.map(e=>{
    const review=editorial[e.sourceUrl];
    if(!review)return e;
    const {locationsByDay,...fields}=review;
    const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(e.startsAt));
    if(locationsByDay&&!locationsByDay[day])return e;
    return {...e,...fields,...(locationsByDay?{location:locationsByDay[day]}:{}),area:'Verona',areaConfirmed:true};
  });
  data.districts=districtCatalog;
  data.events=data.events.map(e=>({...e,districtMatches:districtMatches(e.location||'')}));
  data.news.items=data.news.items.map(i=>{const value=`${i.title} ${i.summary}`,zone=explicitDistricts(value)[0];return {...i,timing:i.timing||extractNewsTiming(i),area:zone?`Circoscrizione ${zone}`:null,districtMatches:districtMatches(value)};});
  const safe=JSON.stringify(data).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026');
  const [mapCss,mapJs]=await Promise.all(['public/vendor/leaflet.css','public/vendor/leaflet.js'].map(p=>readFile(new URL(p,root),'utf8').catch(e=>{if(e.code!=='ENOENT')throw e;return '';})));
  const assets=mapJs?`<style>${mapCss}</style><script>${mapJs.replaceAll('</script','<\\/script')}</script>`:'';
  const officialLogic=await readFile(new URL('public/bus-official.js',root),'utf8');
  const eventBusLogic=await readFile(new URL('public/event-bus.js',root),'utf8');
  const parkingLogic=await readFile(new URL('public/parking.js',root),'utf8');
  const travelLogic=await readFile(new URL('public/event-travel.js',root),'utf8');
  const weatherLogic=await readFile(new URL('public/weather.js',root),'utf8');
  const exploreNeedsLogic=await readFile(new URL('public/explore-needs.js',root),'utf8');
  const newsLogic=await readFile(new URL('public/news-services.js',root),'utf8');
  const wasteLogic=await readFile(new URL('public/waste.js',root),'utf8');
  const districtLogic=await readFile(new URL('public/district-ui.js',root),'utf8');
  const pharmacyLogic=await readFile(new URL('public/pharmacies.js',root),'utf8');
  const networkLogic=await readFile(new URL('public/bus-network.js',root),'utf8');
  const catalogLogic=await readFile(new URL('public/bus-catalog.js',root),'utf8');
  const agendaLogic=await readFile(new URL('public/agenda.js',root),'utf8');
  const gamesLogic=await readFile(new URL('public/briscola.js',root),'utf8');
  const gamesCss=(await readFile(new URL('public/games.css',root),'utf8'))+'\n'+await readFile(new URL('public/bus-catalog.css',root),'utf8')+'\n'+await readFile(new URL('public/agenda.css',root),'utf8')+'\n'+await readFile(new URL('public/parking.css',root),'utf8')+'\n'+await readFile(new URL('public/waste.css',root),'utf8')+'\n'+await readFile(new URL('public/pharmacies.css',root),'utf8');
  const authLogic=await readFile(new URL('public/auth.js',root),'utf8');
  const rankedLogic=await readFile(new URL('public/ranked.js',root),'utf8');
  const html=template.replace('__GAMES_CSS__',()=>gamesCss).replace('__MAP_ASSETS__',()=>assets).replace('__EVENT_DATA__',()=>safe).replace('__CALENDAR_LOGIC__',()=>[datasetStatus,newsDeadlineInstant,newsValidity,newsPastSeason,validateWasteSelection,wasteUpcoming,normalizeWasteStreet,searchWasteStreets,resolveWasteAddress,pharmacyPeriods].map(fn=>fn.toString()).join('\n')+'\n'+logic+'\n'+newsLogic+'\n'+wasteLogic+'\n'+pharmacyLogic+'\n'+districtLogic+'\n'+officialLogic+'\n'+eventBusLogic+'\n'+parkingLogic+'\n'+travelLogic+'\n'+weatherLogic+'\n'+exploreNeedsLogic+'\n'+networkLogic+'\n'+catalogLogic+'\n'+agendaLogic+'\n'+authLogic+'\n'+gamesLogic+'\n'+rankedLogic);
  await writeFile(new URL('public/index.html',root),html);
  return data.events.length;
}
if(process.argv[1] && new URL('file:///'+process.argv[1].replaceAll('\\','/')).pathname.endsWith('/scripts/build-calendar.mjs'))console.log(`Calendario pronto: ${await buildCalendar()} appuntamenti incorporati.`);
