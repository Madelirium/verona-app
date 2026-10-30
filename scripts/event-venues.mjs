import {text} from './parsers.mjs';
import {addressConflict,coordinateDistance,disableUncertainLocation,VENUE_COORDINATE_REVIEW_METERS} from './event-location-quality.mjs';

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
export async function attachComuneVenues(events,load,{onError=()=>{},onIssue=()=>{},checkedAt}={}){
  const inspectVenue=event=>event.source==='Comune di Verona'&&!event.mapDisabled&&Array.isArray(event.venueIds)&&event.venueIds.length===1&&Number.isSafeInteger(event.venueIds[0])&&event.venueIds[0]>0;
  const venues=new Map();
  for(const id of new Set(events.filter(inspectVenue).map(event=>event.venueIds[0]))){
    try{venues.set(id,parseComuneVenue(await load(id),id));}
    catch(error){onError(id,error);venues.set(id,null);}
  }
  return events.map(event=>{
    const venue=inspectVenue(event)?venues.get(event.venueIds[0]):null;
    if(!venue)return event;
    const evidence=event.locationEvidence||{},narrative=evidence.narrativeAddresses||[];
    let conflict=null;
    if(addressConflict(evidence.address,venue.address))conflict=['linked-address-conflict','indirizzo dichiarato e sede ufficiale collegata non coincidono.'];
    else if(narrative.length===1&&addressConflict(narrative[0],venue.address))conflict=['linked-narrative-conflict','la sede descritta nel programma non coincide con la sede ufficiale collegata.'];
    else if(validPoint(event.coordinates)&&coordinateDistance(event.coordinates,venue.coordinates)>VENUE_COORDINATE_REVIEW_METERS)conflict=['linked-coordinate-conflict','il punto dell’evento dista oltre '+VENUE_COORDINATE_REVIEW_METERS+' metri da quello della sede ufficiale collegata.'];
    if(conflict){onIssue({code:conflict[0],sourceId:event.sourceEventId});return disableUncertainLocation({...event,locationEvidence:{...evidence,linkedVenue:{name:venue.name,address:venue.address,sourceUrl:venue.coordinates.sourceUrl}}},...conflict);}
    if(validPoint(event.coordinates))return event;
    return {...event,location:[venue.name,venue.address].filter(Boolean).join(' · '),coordinates:{...venue.coordinates,...checkedAt?{checkedAt}:{}}};
  });
}
