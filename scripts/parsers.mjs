import { createHash } from 'node:crypto';

export const sources = {
  comune: { name: 'Comune di Verona', url: 'https://www.comune.verona.it/Vivere-il-comune/Eventi', license: 'CC BY 4.0 salvo eccezioni e contenuti di terzi', licenseUrl: 'https://www.comune.verona.it/Note-legali' },
  fiere: { name: 'Veronafiere', url: 'https://www.veronafiere.it/', license: 'Riutilizzo da verificare prima della pubblicazione', licenseUrl: 'https://www.veronafiere.it/copyright-disclaimer/' }
};
export function text(value = '') {
  const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’', ndash: '–', egrave: 'è', agrave: 'à', ograve: 'ò', ugrave: 'ù', igrave: 'ì' };
  return String(value).replace(/<[^>]*>/g, ' ').replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, key) => {
    if (key.startsWith('#')) { const n = key[1] === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1)); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; }
    return entities[key] ?? m;
  }).replace(/\s+/g, ' ').trim();
}
export function romeDay(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function validDate(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function base(source, key, title, url, checkedAt) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('La fonte deve usare HTTPS');
  return { id: `${source}-${createHash('sha256').update(String(key)).digest('hex').slice(0, 20)}`, title: text(title), source: sources[source].name, sourceUrl: url, checkedAt, timezone: 'Europe/Rome', price: null, image: null, publicationStatus: 'draft', reviewReasons: [], license: sources[source].license, licenseUrl: sources[source].licenseUrl };
}
export function comuneAccess(data){
  const free=data.is_accessible_for_free===1||data.is_accessible_for_free==='1'||data.is_accessible_for_free===true,notes=text(data.cost_notes||'');
  return {price:free?0:null,...free?{priceLabel:'Ingresso gratuito'}:notes?{priceLabel:'Costi e condizioni indicati dalla fonte'}:{},...notes?{accessNotes:notes}:{} };
}
export function parseComune(hits, { from, checkedAt }) {
  const result = [];
  for (const hit of hits) {
    const d = hit.data?.['ita-IT'];
    if (!d?.event_title) continue;
    const t = d.time_interval ?? {};
    // Gli eventi espliciti includono le modifiche alle singole ricorrenze.
    const occurrences = t.events?.length ? t.events : t.recurrences?.length ? t.recurrences : [{ start: t.input?.startDateTime, end: t.input?.endDateTime }];
    const alias = hit.extradata?.['ita-IT']?.urlAlias;
    const url = new URL(alias || `/openpa/object/${hit.metadata.id}`, 'https://www.comune.verona.it').href;
    if (new URL(url).hostname !== 'www.comune.verona.it') throw new Error('URL Comune inatteso');
    for (const o of occurrences) {
      if (!validDate(o.start) || !validDate(o.end) || Date.parse(o.end) < Date.parse(o.start)) continue;
      if (romeDay(new Date(o.end)) < from) continue;
      const e = base('comune', `${hit.metadata.id}:${o.start}`, d.event_title, url, checkedAt);
      Object.assign(e,comuneAccess(d));
      const imageId=d.image?.[0]?.classIdentifier==='image'?d.image[0].id:null;
      if(Number.isSafeInteger(imageId)&&imageId>0)e.imageId=imageId;
      e.startsAt = o.start; e.endsAt = o.end; e.datePrecision = 'datetime';
      e.category = d.has_public_event_typology ?? [];
      const venues=Array.isArray(d.takes_place_in)?d.takes_place_in:[];
      e.location = venues.map(p => p?.name?.['ita-IT']).filter(Boolean).join(' · ') || null;
      if(venues.length&&venues.every(p=>p?.classIdentifier==='place'&&Number.isSafeInteger(p.id)&&p.id>0))e.venueIds=[...new Set(venues.map(p=>p.id))];
      const lat=Number(d.geo?.latitude),lon=Number(d.geo?.longitude);
      if(Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=44.5&&lat<=46.3&&lon>=10&&lon<=12){
        e.coordinates={lat,lon,source:'Comune di Verona',precision:'source'};
        if(!e.location)e.location=text(d.geo?.address||'')||null;
      }
      e.area = 'Verona'; e.areaConfirmed = false;
      e.reviewReasons = ['Verificare luogo, orari e accesso sulla scheda originale'];
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
