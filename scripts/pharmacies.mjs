import {createHash} from 'node:crypto';
import {newsDeadlineInstant} from './news-timing.mjs';
export function pharmacyPhone(value){const digits=String(value||'').replace(/[^\d+]/g,'').replace(/^\+39|^0039/,'');return /^0\d{5,11}$/.test(digits)?digits:null;}
export function pharmacyPeriods(data,instant){const now=Date.parse(instant);return Number.isFinite(now)?(data.periods||[]).filter(period=>Date.parse(period.startsAt)<=now&&now<Date.parse(period.endsAt)):[];}
export function parsePharmacyPdf(extracted,sourceUrl,checkedAt){
  const url=new URL(sourceUrl);if(url.origin!=='https://www.ordinefarmacisti.vr.it'||!url.pathname.endsWith('.pdf'))throw Error('Fonte turni inattesa');
  const range=extracted.text.match(/DALLE\s+ORE\s+(\d{1,2})[,:.](\d{2})\s+DEL\s+(\d{2})\/(\d{2})\/(20\d{2})\s+ALLE\s+ORE\s+(\d{1,2})[,:.](\d{2})\s+DEL\s+(\d{2})\/(\d{2})\/(20\d{2})/i);
  if(!range)throw Error('Periodo turno non riconosciuto');
  const instant=(offset)=>newsDeadlineInstant({day:range[offset+4]+'-'+range[offset+3]+'-'+range[offset+2],time:range[offset].padStart(2,'0')+':'+range[offset+1]});
  const startsAt=instant(1),endsAt=instant(6);if(!startsAt||!endsAt||Date.parse(endsAt)<=Date.parse(startsAt)||Date.parse(endsAt)-Date.parse(startsAt)>4*86400000)throw Error('Periodo turno non valido');
  const fileDates=[...decodeURIComponent(url.pathname).matchAll(/(\d{2})\.(\d{2})\.(20\d{2})/g)].map(match=>match[3]+'-'+match[2]+'-'+match[1]);
  if(fileDates.length!==2||fileDates[0]!==range[5]+'-'+range[4]+'-'+range[3]||fileDates[1]!==range[10]+'-'+range[9]+'-'+range[8])throw Error('Periodo PDF diverso dal nome del documento');
  const clean=value=>String(value||'').replace(/\s+/g,' ').trim(),items=[];let recognized=false;
  for(const table of extracted.tables||[]){
    const header=table.findIndex(row=>row.some(cell=>clean(cell)==='NOME FARMACIA')&&row.some(cell=>clean(cell)==='INDIRIZZO'));
    if(header<0)continue;recognized=true;const columns=table[header].map(clean),nameIndex=columns.indexOf('NOME FARMACIA'),addressIndex=columns.indexOf('INDIRIZZO'),cityIndex=columns.indexOf("CITTA'"),localityIndex=columns.indexOf("LOCALITA'"),phoneIndex=columns.findIndex(cell=>cell==='NUMERO TELEFONICO');
    if([nameIndex,addressIndex,localityIndex,phoneIndex].some(index=>index<0))throw Error('Colonne turni inattese');
    for(const row of table.slice(header+1)){
      if(row.every(cell=>!clean(cell)))continue;
      const name=clean(row[nameIndex]),address=clean(row[addressIndex]),city=clean(row[cityIndex>=0?cityIndex:localityIndex]).replace('SOMMACAMPA GNA','SOMMACAMPAGNA'),locality=cityIndex>=0?clean(row[localityIndex]):'',phone=pharmacyPhone(row[phoneIndex]);
      if(!name||!address||!city||!phone)throw Error('Riga turno incompleta');
      const id='pharmacy-'+createHash('sha256').update(phone+'|'+address.toLowerCase()).digest('hex').slice(0,16);
      if(items.some(item=>item.id===id))throw Error('Farmacia duplicata nel turno');
      items.push({id,name,address,city,locality,phone,scope:/^VERONA(?:\s*-|$)/i.test(city)?'city':'province',serviceMode:'unspecified',position:null,checkedAt});
    }
  }
  if(!recognized||items.length<3||items.length>80)throw Error('Tabella turni non riconosciuta o incompleta');
  const printedPhones=[...extracted.text.matchAll(/\b0\d{2,3}[ /]\d{5,8}\b/g)].map(match=>pharmacyPhone(match[0]));
  if(new Set(printedPhones).size!==items.length||printedPhones.some(phone=>!items.some(item=>item.phone===phone)))throw Error('Righe PDF e tabella non corrispondono');
  return {id:'turno-'+startsAt,startsAt,endsAt,sourceUrl,checkedAt,items};
}
export function attachPharmacyPositions(periods,osm,checkedAt){
  const nodes=(osm.elements||[]).map(item=>({...item,lat:item.lat??item.center?.lat,lon:item.lon??item.center?.lon})).filter(item=>item.tags?.amenity==='pharmacy'&&Number.isFinite(item.lat)&&Number.isFinite(item.lon));
  const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const addressKey=(street,civic)=>normalized(street).replace(/^c so /,'corso ')+'|'+normalized(civic).replaceAll(' ','');
  for(const period of periods)for(const item of period.items){let matches=nodes.filter(node=>(node.tags.phone||node.tags['contact:phone']||'').split(';').some(phone=>pharmacyPhone(phone)===item.phone)),method='unique-phone';
    if(!matches.length){const address=item.address.match(/^(.*?)\s+(?:N\.\s*)?(\d+\s*\/?\s*[A-Z]?)$/i),city=normalized(item.city.split(/\s*[-–]\s*/)[0]);
      if(address){const key=addressKey(address[1],address[2]);matches=nodes.filter(node=>addressKey(node.tags['addr:street'],node.tags['addr:housenumber'])===key&&normalized(node.tags['addr:city'])===city);method='unique-address-city';}
    }
    if(matches.length===1){const node=matches[0];item.position={lat:node.lat,lon:node.lon,source:'OpenStreetMap contributors',sourceUrl:'https://www.openstreetmap.org/'+node.type+'/'+node.id,match:method,checkedAt};}
  }
  return periods;
}
export function validatePharmacies(data){
  if(!Array.isArray(data.periods)||!data.periods.length)throw Error('Nessun periodo farmacie');
  const sorted=[...data.periods].sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
  for(let index=0;index<sorted.length;index++){const period=sorted[index];
    if(!Number.isFinite(Date.parse(period.startsAt))||!Number.isFinite(Date.parse(period.endsAt))||Date.parse(period.endsAt)<=Date.parse(period.startsAt)||!period.items.length||new URL(period.sourceUrl).origin!=='https://www.ordinefarmacisti.vr.it')throw Error('Periodo farmacie non valido');
    if(index&&Date.parse(period.startsAt)<Date.parse(sorted[index-1].endsAt))throw Error('Turni sovrapposti');
    for(const item of period.items){if(!item.id||!item.name||!item.address||!item.city||!pharmacyPhone(item.phone)||!['city','province'].includes(item.scope)||item.serviceMode!=='unspecified')throw Error('Farmacia non valida');if(item.position&&(!Number.isFinite(item.position.lat)||!Number.isFinite(item.position.lon)||item.position.lat<45||item.position.lat>46||item.position.lon<10.4||item.position.lon>11.7))throw Error('Posizione farmacia non valida');}
  }
}
