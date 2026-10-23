import {romeDayBounds} from './bus-stop-extraction.mjs';
import {digest} from './bus-bot-storage.mjs';

const localDate=instant=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(instant));
export function dateFromMomo(value){
  const match=/^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(value??'');
  const n=match?Number(match[1]):NaN;
  return Number.isFinite(n)&&Math.abs(n)<=8640000000000000?new Date(n).toISOString():null;
}
function metres(a,b){
  const rad=Math.PI/180,dlat=(a.lat-b.lat)*rad,dlon=(a.lon-b.lon)*rad;
  return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2)));
}
export function expandTrip(entry,line){
  if(entry.key!==digest(entry.identity))throw new Error('Identità snapshot non integra');
  if(digest(entry.data)!==entry.dataHash)throw new Error('Snapshot corsa non integro');
  const object=entry.data?.Oggetto;
  if(String(object?.Linea?.Codice)!==line)return null;
  if(entry.data.Tipo!==0||entry.data.StatusCode!==200||!Array.isArray(object.Fermate)||object.Fermate.length<2)throw new Error('Dettaglio corsa incompleto');
  const payload=entry.identity?.payload;
  const dayInstant=dateFromMomo(payload?.Giorno);
  if(!dayInstant||(object.Corsa?.ID_Corsa??object.Corsa?.Codice)!==payload.IdCorsa)throw new Error('Identità corsa discordante');
  const serviceDate=localDate(dayInstant),tripId=payload.IdCorsa;
  const bounds=romeDayBounds(serviceDate);
  const last=object.Fermate.at(-1).Localita;
  let previous=-Infinity;
  const rows=object.Fermate.map((row,index)=>{
    const kind=index===object.Fermate.length-1?'arrival':index===0?'departure':'passage';
    const instant=dateFromMomo(kind==='arrival'?row.OrarioProgrammato:row.OrarioPartenzaProgrammato);
    const code=String(row.Localita?.Codice??'');
    if(!/^\d+$/.test(code)||!instant||!row.Localita?.Descrizione)throw new Error('Fermata o orario programmato mancanti');
    if(Date.parse(instant)<bounds.start||Date.parse(instant)>=bounds.end+86400000)throw new Error('Orario fuori dal giorno di servizio');
    if(Date.parse(instant)<previous)throw new Error('Sequenza temporale non coerente');previous=Date.parse(instant);
    const coordinates=row.Localita.Coordinate;
    if(!Number.isFinite(coordinates?.Lat)||!Number.isFinite(coordinates?.Lng))throw new Error('Coordinate ufficiali mancanti');
    return {stopCode:code,name:row.Localita.Descrizione,lat:coordinates.Lat,lon:coordinates.Lng,sequence:index+1,kind,instant,civilDate:localDate(instant),time:new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(instant))};
  });
  return {line,serviceDate,tripId,originCode:rows[0].stopCode,destinationCode:String(last.Codice),destination:last.Descrizione,collectedAt:entry.collectedAt,sourceHash:entry.dataHash,complete:false,stops:rows};
}

export function buildLinePlan({catalog,entries,line='24',from='2026-10-19',days=7}){
  romeDayBounds(from);
  if(!/^\d+$/.test(line)||!Number.isInteger(days)||days<1||days>7)throw new Error('Linea o intervallo non valido');
  const routes=catalog.routes.filter(r=>String(r.number)===line);
  if(!routes.length)throw new Error('Linea non presente nel catalogo delle mappe');
  const stops=new Map(),trips=new Map();
  function item(code){if(!stops.has(code))stops.set(code,{code,osm:[],official:[]});return stops.get(code);}
  for(const route of routes)for(const stop of route.stops){
    const code=String(stop.ref??'');if(!/^\d+$/.test(code))throw new Error('Fermata OSM priva di codice numerico');
    const target=item(code);if(!target.osm.some(s=>s.id===stop.id))target.osm.push({id:stop.id,name:stop.name,lat:stop.lat,lon:stop.lon,sourceUrl:stop.sourceUrl});
  }
  const requestedDates=Array.from({length:days},(_,i)=>new Date(Date.parse(from)+i*86400000).toISOString().slice(0,10));
  for(const entry of entries){
    const trip=expandTrip(entry,line);if(!trip||!requestedDates.includes(trip.serviceDate))continue;
    const key=trip.serviceDate+'|'+trip.tripId;
    if(trips.has(key)&&trips.get(key).sourceHash!==trip.sourceHash)throw new Error('Due snapshot discordanti per la stessa corsa');
    trips.set(key,trip);
    for(const stop of trip.stops){const target=item(stop.stopCode);if(!target.official.some(s=>s.name===stop.name&&s.lat===stop.lat&&s.lon===stop.lon))target.official.push({name:stop.name,lat:stop.lat,lon:stop.lon,observedDate:trip.serviceDate});}
  }
  const inventory=[...stops.values()].map(stop=>{
    const distances=stop.osm.flatMap(osm=>stop.official.map(official=>metres(osm,official)));
    const distance=distances.length?Math.round(Math.min(...distances)):null;
    return {...stop,match:!stop.official.length?'osm-only':!stop.osm.length?'official-only':stop.official.length>1||stop.osm.length>1?'review-identity':distance<=150?'code-and-position':'review-position',distanceMetres:distance};
  }).sort((a,b)=>a.code.localeCompare(b.code,'en',{numeric:true}));
  const ordered=[...inventory].sort((a,b)=>Number(['1974','1973'].includes(b.code))-Number(['1974','1973'].includes(a.code))||a.code.localeCompare(b.code,'en',{numeric:true}));
  // First observe both known directions on every date, then other stops.
  const anchors=ordered.filter(s=>['1974','1973'].includes(s.code));
  const others=ordered.filter(s=>!['1974','1973'].includes(s.code));
  const jobs=[...requestedDates.flatMap(date=>anchors.map(s=>({stopCode:s.code,date}))),...requestedDates.flatMap(date=>others.map(s=>({stopCode:s.code,date})))];
  return {schemaVersion:1,createdAt:new Date().toISOString(),line,from,dates:requestedDates,complete:false,scope:'Unione delle fermate OSM e delle corse ufficiali osservate; nessuna certificazione dell’intera rete o stagione.',routes:routes.map(r=>({id:r.id,from:r.from,to:r.to,stopCodes:r.stops.map(s=>String(s.ref)),sourceUrl:r.sourceUrl})),stops:inventory,knownTrips:[...trips.values()],jobs,summary:{routeVariants:routes.length,osmStops:inventory.filter(s=>s.osm.length).length,officialStops:inventory.filter(s=>s.official.length).length,candidateStops:inventory.length,knownTrips:trips.size,stopDays:jobs.length,osmOnly:inventory.filter(s=>s.match==='osm-only').map(s=>s.code),officialOnly:inventory.filter(s=>s.match==='official-only').map(s=>s.code),review:inventory.filter(s=>s.match.startsWith('review')).map(s=>s.code)}};
}
