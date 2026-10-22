export function validateWasteSelection(data,selection){
  return Boolean(selection&&typeof selection==='object'&&selection.version===data.version&&typeof selection.confirmedAt==='string'&&Number.isFinite(Date.parse(selection.confirmedAt))&&data.zones.some(zone=>zone.id===selection.zoneId));
}
export function normalizeWasteStreet(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’`]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
export function searchWasteStreets(data,query){
  const words=normalizeWasteStreet(query).split(' ').filter(word=>!['via','viale','piazza','strada','contrada','corte','lungadige'].includes(word));
  if(words.join('').length<2)return [];
  const names=[...new Set((data.addressIndex?.entries||[]).map(entry=>entry.street))];
  return names.filter(name=>words.every(word=>normalizeWasteStreet(name).includes(word))).sort((a,b)=>a.localeCompare(b,'it'));
}
export function resolveWasteAddress(data,street,civic){
  const entries=(data.addressIndex?.entries||[]).filter(entry=>normalizeWasteStreet(entry.street)===normalizeWasteStreet(street));
  if(!entries.length)return {status:'not-covered'};
  if(!String(civic||'').trim())return {status:'missing-civic'};
  if(!/^[1-9]\d{0,5}$/.test(String(civic).trim()))return {status:'review',reason:'civic'};
  // The leaflet repeats some streets across zones without describing all exclusions.
  // A numeric range in one zone must not implicitly subtract addresses from another.
  if(new Set(entries.map(entry=>entry.zoneId)).size>1)return {status:'review',reason:'multiple-zones'};
  if(entries.some(entry=>entry.kind==='landmark'))return {status:'review',reason:'landmark'};
  const number=Number(civic),matches=entries.filter(entry=>entry.kind==='street'||(entry.kind==='range'&&number>=entry.from&&number<=entry.to));
  return matches.length?{status:'matched',zoneId:matches[0].zoneId}:{status:'not-covered'};
}
export function wasteUpcoming(data,zoneId,day,limit=6){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day||'')||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day||day<data.validFrom||day>data.validTo)return [];
  const zone=data.zones.find(zone=>zone.id===zoneId);if(!zone||!Number.isInteger(limit)||limit<1||limit>20)return [];
  if(zone.dates)return zone.dates.flatMap(entry=>{const exposureDay=new Date(Date.parse(entry.day+'T12:00:00Z')+zone.exposureDayOffset*86400000).toISOString().slice(0,10);return exposureDay>=day?entry.materials.map(material=>({day:exposureDay,material,collectionDay:entry.day,exposureTime:zone.exposureTime})):[];}).slice(0,limit);
  if(zone.validFrom&&day<zone.validFrom)return [];
  const result=[];
  for(let offset=0;offset<30&&result.length<limit;offset++){
    const date=new Date(Date.parse(day+'T12:00:00Z')+offset*86400000),key=date.toISOString().slice(0,10);if(key>data.validTo)break;
    for(const rule of zone.rules)if(rule.weekday===date.getUTCDay())result.push({day:key,material:rule.material});
  }
  return result.slice(0,limit);
}
export function validateWasteData(data){
  if(!data.version||!Array.isArray(data.zones)||!data.zones.length||new Set(data.zones.map(zone=>zone.id)).size!==data.zones.length)throw Error('Catalogo raccolta non valido');
  for(const field of ['validFrom','validTo','checkedOn'])if(!/^\d{4}-\d{2}-\d{2}$/.test(data[field]||'')||!Number.isFinite(Date.parse(data[field]))||new Date(data[field]).toISOString().slice(0,10)!==data[field])throw Error('Data raccolta non valida');
  if(data.validFrom>data.validTo)throw Error('Intervallo raccolta non valido');
  for(const zone of data.zones){
    if(!zone.name||!Array.isArray(zone.rules)||(!zone.rules.length&&!zone.dates))throw Error('Zona raccolta non valida');
    if(zone.dates){
      if(zone.dates.length!==365||![-1,0].includes(zone.exposureDayOffset)||!zone.exposureTime||new URL(zone.sourceUrl).hostname!=='www.amiavr.it')throw Error('Calendario AMIA incompleto');
      zone.dates.forEach((entry,index)=>{const expected=new Date(Date.parse('2026-01-01T12:00:00Z')+index*86400000).toISOString().slice(0,10);if(entry.day!==expected||!Array.isArray(entry.materials)||new Set(entry.materials).size!==entry.materials.length||entry.materials.some(material=>!['Carta','Plastica e metalli','Umido','Secco non riciclabile'].includes(material)))throw Error('Data o materiale AMIA non valido');});
    }
    for(const rule of zone.rules)if(!Number.isInteger(rule.weekday)||rule.weekday<0||rule.weekday>6||!['Carta','Plastica e metalli'].includes(rule.material))throw Error('Regola raccolta non valida');
  }
  for(const url of [data.sourceUrl,data.licenseUrl,...Object.values(data.links),...data.centers.map(center=>center.sourceUrl)])if(new URL(url).protocol!=='https:')throw Error('Fonte raccolta non valida');
  if(data.addressIndex){
    if(new URL(data.addressIndex.sourceUrl).protocol!=='https:'||!Array.isArray(data.addressIndex.entries)||!data.addressIndex.entries.length)throw Error('Indice vie non valido');
    const keys=new Set();
    for(const entry of data.addressIndex.entries){
      const key=normalizeWasteStreet(entry.street)+'|'+entry.zoneId;
      if(!entry.street||!data.zones.some(zone=>zone.id===entry.zoneId)||!['street','range','landmark'].includes(entry.kind)||keys.has(key))throw Error('Associazione via non valida');keys.add(key);
      if(entry.kind==='range'&&(!Number.isInteger(entry.from)||!Number.isInteger(entry.to)||entry.from<1||entry.to<entry.from))throw Error('Intervallo civici non valido');
      if(entry.kind!=='street'&&!entry.note)throw Error('Delimitazione via mancante');
    }
  }
}
