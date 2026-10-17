import { readFile, writeFile } from 'node:fs/promises';
import {districtCatalog,districtMatches,explicitDistricts} from './districts.mjs';
const root = new URL('../',import.meta.url);
export async function buildCalendar() {
  const [template,logic,json,editorialJson] = await Promise.all(['public/calendar.template.html','public/calendar.js','data/events.json','data/editorial.json'].map(p=>readFile(new URL(p,root),'utf8')));
  const data=JSON.parse(json);
  if(!Array.isArray(data.events))throw new Error('Catalogo eventi non valido');
  try{data.news=JSON.parse(await readFile(new URL('data/news.json',root),'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw error;data.news={items:[],sources:[]};}
  try{data.bus=JSON.parse(await readFile(new URL('data/bus.json',root),'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw error;data.bus={lines:[],alerts:[],sources:[]};}
  try{data.places=JSON.parse(await readFile(new URL('data/places.json',root),'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw error;data.places={items:[]};}
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
  data.news.items=data.news.items.map(i=>{const value=`${i.title} ${i.summary}`,zone=explicitDistricts(value)[0];return {...i,area:zone?`Circoscrizione ${zone}`:null,districtMatches:districtMatches(value)};});
  const safe=JSON.stringify(data).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026');
  const [mapCss,mapJs]=await Promise.all(['public/vendor/leaflet.css','public/vendor/leaflet.js'].map(p=>readFile(new URL(p,root),'utf8').catch(e=>{if(e.code!=='ENOENT')throw e;return '';})));
  const assets=mapJs?`<style>${mapCss}</style><script>${mapJs.replaceAll('</script','<\\/script')}</script>`:'';
  const html=template.replace('__MAP_ASSETS__',()=>assets).replace('__EVENT_DATA__',()=>safe).replace('__CALENDAR_LOGIC__',()=>logic);
  await writeFile(new URL('public/index.html',root),html);
  return data.events.length;
}
if(process.argv[1] && new URL('file:///'+process.argv[1].replaceAll('\\','/')).pathname.endsWith('/scripts/build-calendar.mjs'))console.log(`Calendario pronto: ${await buildCalendar()} appuntamenti incorporati.`);
