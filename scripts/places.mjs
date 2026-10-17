import {text} from './parsers.mjs';
export const placesBounds=[45.425,10.975,45.455,11.02];
export function placeCategory(t){
  if(['cafe','bar','pub','ice_cream'].includes(t.amenity))return 'Bar e caffè';
  if(['restaurant','fast_food','food_court'].includes(t.amenity))return 'Ristoranti';
  if(t.amenity==='pharmacy')return 'Farmacie';
  if(t.shop)return 'Negozi';
  if(t.craft)return 'Artigiani';
  if(['fitness_centre','sports_centre'].includes(t.leisure))return 'Sport';
  return 'Servizi';
}
export function safeWebsite(value){try{if(!value)return null;const u=new URL(/^https?:\/\//i.test(value)?value:`https://${value}`);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&u.hostname.includes('.')?u.href:null;}catch{return null;}}
export function normalizePlaces(response,checkedAt){
  if(!Array.isArray(response.elements)||response.remark)throw Error('Risposta OpenStreetMap incompleta');
  const items=[];
  for(const e of response.elements){
    const t=e.tags||{},lat=e.lat??e.center?.lat,lon=e.lon??e.center?.lon;
    if(!t.name||!['node','way','relation'].includes(e.type)||!Number.isFinite(lat)||!Number.isFinite(lon))continue;
    if(lat<placesBounds[0]||lat>placesBounds[2]||lon<placesBounds[1]||lon>placesBounds[3])continue;
    if(t.disused==='yes'||t.abandoned==='yes'||t.shop==='vacant')continue;
    items.push({id:`osm-${e.type}-${e.id}`,name:text(t.name),category:placeCategory(t),lat,lon,address:[t['addr:street'],t['addr:housenumber'],t['addr:city']].filter(Boolean).map(text).join(', ')||null,website:safeWebsite(t.website||t['contact:website']),phone:/^[+\d ()/;.-]+$/.test(t.phone||t['contact:phone']||'')?(t.phone||t['contact:phone']):null,openingHours:text(t.opening_hours||'')||null,wheelchair:['yes','no','limited'].includes(t.wheelchair)?t.wheelchair:null,source:'OpenStreetMap',sourceUrl:`https://www.openstreetmap.org/${e.type}/${e.id}`,checkedAt});
  }
  const unique=new Map();
  for(const p of items){const key=`${p.name.toLowerCase()}:${p.category}:${p.lat.toFixed(5)}:${p.lon.toFixed(5)}`;if(!unique.has(key))unique.set(key,p);}
  return [...unique.values()].sort((a,b)=>a.name.localeCompare(b.name,'it'));
}
