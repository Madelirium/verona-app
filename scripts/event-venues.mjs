import {text} from './parsers.mjs';

function validPoint(point){return Number.isFinite(point?.lat)&&Number.isFinite(point?.lon)&&point.lat>=44.5&&point.lat<=46.3&&point.lon>=10&&point.lon<=12;}

export function parseComuneVenue(resource,id){
  if(resource?.metadata?.id!==id||resource.metadata.classIdentifier!=='place')throw Error('Identità sede inattesa');
  const data=resource.data?.['ita-IT'],address=data?.has_address;
  const point={lat:Number(address?.latitude),lon:Number(address?.longitude)};
  if(!data?.name||!validPoint(point))return null;
  let sourceUrl='https://www.comune.verona.it/api/opendata/v2/content/read/'+id;
  try{
    const alias=new URL(resource.extradata?.['ita-IT']?.urlAlias||sourceUrl,'https://www.comune.verona.it');
    if(alias.origin==='https://www.comune.verona.it'&&!alias.username&&!alias.password)sourceUrl=alias.href;
  }catch{}
  return {name:text(data.name),address:text(address.address||''),coordinates:{...point,source:'Comune di Verona',sourceUrl,precision:'venue',venueId:id}};
}

// Resolve only a single explicitly linked venue. No name matching or geocoding.
export async function attachComuneVenues(events,load,{onError=()=>{},checkedAt}={}){
  const needsVenue=event=>event.source==='Comune di Verona'&&!event.mapDisabled&&!validPoint(event.coordinates)&&Array.isArray(event.venueIds)&&event.venueIds.length===1&&Number.isSafeInteger(event.venueIds[0])&&event.venueIds[0]>0;
  const venues=new Map();
  for(const id of new Set(events.filter(needsVenue).map(event=>event.venueIds[0]))){
    try{venues.set(id,parseComuneVenue(await load(id),id));}
    catch(error){onError(id,error);venues.set(id,null);}
  }
  return events.map(event=>{
    const venue=needsVenue(event)?venues.get(event.venueIds[0]):null;
    if(!venue)return event;
    return {...event,location:[venue.name,venue.address].filter(Boolean).join(' · '),coordinates:{...venue.coordinates,...checkedAt?{checkedAt}:{}}};
  });
}
