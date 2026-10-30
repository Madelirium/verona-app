import { createHash } from 'node:crypto';
import {eventSourceRevision} from './event-editorial.mjs';
import {text,publicEventText,comuneDetails} from './event-text.mjs';
import {narrativeVenueAddresses,addressConflict,disableUncertainLocation,variableVenueProgramme} from './event-location-quality.mjs';
export {text} from './event-text.mjs';

export const sources = {
  comune: { name: 'Comune di Verona', url: 'https://www.comune.verona.it/Vivere-il-comune/Eventi', license: 'CC BY 4.0 salvo eccezioni e contenuti di terzi', licenseUrl: 'https://www.comune.verona.it/Note-legali' },
  fiere: { name: 'Veronafiere', url: 'https://www.veronafiere.it/', license: 'Riutilizzo da verificare prima della pubblicazione', licenseUrl: 'https://www.veronafiere.it/copyright-disclaimer/' }
};
export function romeDay(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function validDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)||!Number.isFinite(Date.parse(value)))return false;
  const day=value.slice(0,10);return new Date(day).toISOString().slice(0,10)===day;
}
function base(source, key, title, url, checkedAt) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('La fonte deve usare HTTPS');
  return { id: `${source}-${createHash('sha256').update(String(key)).digest('hex').slice(0, 20)}`, title: text(title), source: sources[source].name, sourceUrl: url, checkedAt, timezone: 'Europe/Rome', price: null, image: null, publicationStatus: 'draft', reviewReasons: [], license: sources[source].license, licenseUrl: sources[source].licenseUrl };
}
export function comuneAccess(data){
  const free=data.is_accessible_for_free===1||data.is_accessible_for_free==='1'||data.is_accessible_for_free===true,notes=publicEventText(data.cost_notes,600);
  return {price:free?0:null,...free?{priceLabel:'Ingresso gratuito'}:notes?{priceLabel:'Costi e condizioni indicati dalla fonte'}:{},...notes?{accessNotes:notes}:{} };
}
export function parseComune(hits, { from, checkedAt, onIssue=()=>{} }) {
  const result = [];
  for (const hit of hits) {
    const d = hit.data?.['ita-IT'];
    if (!d?.event_title) continue;
    const t = d.time_interval ?? {};
    // Gli eventi espliciti includono le modifiche alle singole ricorrenze.
    const occurrences = Array.isArray(t.events) ? t.events : Array.isArray(t.recurrences) ? t.recurrences : [{ start: t.input?.startDateTime, end: t.input?.endDateTime }];
    const alias = hit.extradata?.['ita-IT']?.urlAlias;
    const url = new URL(alias || `/openpa/object/${hit.metadata.id}`, 'https://www.comune.verona.it').href;
    if (new URL(url).hostname !== 'www.comune.verona.it') throw new Error('URL Comune inatteso');
    const sourceRevision=eventSourceRevision(hit);
    for (const o of occurrences) {
      if (!o || !validDate(o.start) || !validDate(o.end) || Date.parse(o.end) < Date.parse(o.start)) {onIssue({code:'invalid-occurrence',sourceId:hit.metadata.id});continue;}
      if (romeDay(new Date(o.end)) < from) continue;
      let e = base('comune', `${hit.metadata.id}:${o.start}`, d.event_title, url, checkedAt);
      Object.assign(e,comuneAccess(d),comuneDetails(d));
      e.sourceEventId=hit.metadata.id;
      e.sourceRevision=sourceRevision;
      if(typeof o.id==='string'&&/^[A-Za-z0-9:_-]{1,100}$/.test(o.id))e.sourceOccurrenceId=o.id;
      if(validDate(hit.metadata.modified))e.sourceModifiedAt=hit.metadata.modified;
      const imageId=d.image?.[0]?.classIdentifier==='image'?d.image[0].id:null;
      if(Number.isSafeInteger(imageId)&&imageId>0)e.imageId=imageId;
      e.startsAt = o.start; e.endsAt = o.end; e.datePrecision = o.start.length===10?'date':'datetime';
      e.category = Array.isArray(d.has_public_event_typology)?d.has_public_event_typology.filter(v=>typeof v==='string').map(v=>publicEventText(v,100)):[];
      const venues=Array.isArray(d.takes_place_in)?d.takes_place_in:[];
      e.location = venues.map(p => p?.name?.['ita-IT']).filter(Boolean).map(v=>publicEventText(v,180)).join(' · ') || publicEventText(d.geo?.address,300) || null;
      if(venues.length&&venues.every(p=>p?.classIdentifier==='place'&&Number.isSafeInteger(p.id)&&p.id>0))e.venueIds=[...new Set(venues.map(p=>p.id))];
      const lat=Number(d.geo?.latitude),lon=Number(d.geo?.longitude);
      if(Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=44.5&&lat<=46.3&&lon>=10&&lon<=12){
        e.coordinates={lat,lon,source:'Comune di Verona',precision:'source'};
        if(!e.location)e.location=text(d.geo?.address||'')||null;
      }
      e.area = 'Verona'; e.areaConfirmed = false;
      e.reviewReasons = ['Verificare luogo, orari e accesso sulla scheda originale'];
      e.locationEvidence={address:publicEventText(d.geo?.address,300),narrativeAddresses:narrativeVenueAddresses(d.description)};
      if(venues.length>1)e=disableUncertainLocation(e,'multiple-linked-venues','la fonte collega più luoghi senza assegnarli alla singola data.');
      const narrative=e.locationEvidence.narrativeAddresses;
      if(narrative.length===1&&addressConflict(e.locationEvidence.address,narrative[0]))e=disableUncertainLocation(e,'narrative-address-conflict','indirizzo dell’evento e descrizione non coincidono.');
      if(narrative.length>1||variableVenueProgramme(d.description,d.geo?.address))e=disableUncertainLocation(e,'multiple-programme-venues','il programma indica luoghi diversi; il punto generico non identifica la sede del giorno.');
      const recurrenceDay=t.input?.recurrencePattern?.match(/(?:^|;)BYDAY=(MO|TU|WE|TH|FR|SA|SU)(?:;|$)/)?.[1];
      if(recurrenceDay&&new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Rome',weekday:'short'}).format(new Date(o.start)).slice(0,2).toUpperCase()!==recurrenceDay){
        e.dateIssues=['recurrence-weekday-exception'];
        const warning='Data da verificare: questa ricorrenza differisce dal giorno settimanale della regola della fonte; potrebbe essere una modifica. Non è stata spostata automaticamente.';
        e.reviewReasons.push(warning);e.accessNotes=[e.accessNotes,warning].filter(Boolean).join(' ');
      }
      for(const code of [...(e.locationIssues||[]),...(e.dateIssues||[]),...(e.contentIssues||[])])onIssue({code,sourceId:hit.metadata.id});
      result.push(e);
    }
  }
  return result;
}
const months = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
export function parseFiere(html, { year, from, checkedAt }) {
  const chunks = html.split(/<div\b[^>]*class="\s*calendario__event\s[^\"]*"[^>]*>/i).slice(1);
  if (!chunks.length) throw new Error('Struttura calendario Veronafiere non riconosciuta');
  const result = [];
  for (const c of chunks) {
    const title = c.match(/<h4\b[^>]*class="calendario__event__title"[^>]*>([\s\S]*?)<\/h4>/i)?.[1];
    const url = c.match(/class="calendario__event__detail__link"\s+href="([^"]+)"/i)?.[1];
    const rawDate = text(c.match(/<span\b[^>]*class="calendario__event__dates"[^>]*>([\s\S]*?)<\/span>/i)?.[1]);
    const cross = rawDate.match(/^(\d{1,2})\s*([a-zà]+)\s*[-–]\s*(\d{1,2})\s*([a-zà]+)$/i);
    const m = cross ? [cross[0], cross[1], cross[3], cross[2]] : rawDate.match(/^(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s*([a-zà]+)$/i);
    if (!title || !url || !m) throw new Error(`Scheda Veronafiere incompleta: ${text(title)}; data=${rawDate}; url=${url}`);
    const month = months.indexOf(m[3].toLowerCase()) + 1;
    if (!month) throw new Error('Mese non riconosciuto');
    const endMonth = cross ? months.indexOf(cross[4].toLowerCase()) + 1 : month;
    if (!endMonth) throw new Error('Mese finale non riconosciuto');
    const iso = (day, mo) => `${year}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const start = iso(m[1], month), end = iso(m[2] || m[1], endMonth);
    if (!validDate(start) || !validDate(end) || end < start || new Date(start).toISOString().slice(0,10) !== start || new Date(end).toISOString().slice(0,10) !== end) throw new Error('Date Veronafiere non valide');
    if (end < from) continue;
    if (new URL(url).hostname !== 'www.veronafiere.it') throw new Error('URL Veronafiere inatteso');
    const e = base('fiere', `${url}:${start}`, title, text(url), checkedAt);
    e.startsAt = start; e.endsAt = end; e.datePrecision = 'date';
    e.category = ['Fiera']; e.location = null; e.area = null; e.areaConfirmed = false;
    e.reviewReasons = ['Confermare che si svolga a Verona o provincia', 'Verificare orari e accesso', 'Verificare condizioni di riutilizzo'];
    result.push(e);
  }
  return result;
}
export function dedupe(events) { return [...new Map(events.map(e => [e.id, e])).values()]; }
