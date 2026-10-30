import { sources, parseComune, parseFiere, romeDay, dedupe } from './parsers.mjs';
import {createHash} from 'node:crypto';
import {attachComuneImages} from './event-images.mjs';
import {attachComuneVenues} from './event-venues.mjs';
import {venueResourceRevision} from './event-editorial.mjs';
import {detectEventChanges} from './event-changes.mjs';

export function validateFrom(from) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !Number.isFinite(Date.parse(from)) || new Date(from).toISOString().slice(0,10) !== from) throw new Error('EVENTS_FROM non valida');
}

async function get(url) {
  for (let attempt=0; attempt<3; attempt++) {
    let retryAfter=0;
    try {
      const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'VeronaEvents/0.2 (+https://github.com/Madelirium/verona-app)'}});
      if (response.ok || response.status===404) return response;
      if(response.status===429){const value=response.headers.get('retry-after'),seconds=Number(value);retryAfter=value?(Number.isFinite(seconds)?seconds*1000:Date.parse(value)-Date.now()):0;if(retryAfter>30000)throw new Error('HTTP 429: la fonte richiede di riprovare più tardi: '+url);}
      if (response.status!==429 && response.status<500) throw new Error(`HTTP ${response.status}: ${url}`);
      if (attempt===2) throw new Error(`HTTP ${response.status}: ${url}`);
    } catch (error) { if (attempt===2 || /^HTTP 4/.test(error.message)) throw error; }
    await new Promise(resolve=>setTimeout(resolve,Math.max(1000*(attempt+1),Math.min(30000,retryAfter||0))));
  }
}

export async function readComuneCatalog({diagnostics={}}={}) {
  let url='https://www.comune.verona.it/api/opendata/v2/content/search/'+encodeURIComponent('classes [event] sort [time_interval=>asc] limit 100');
  const hits=[],seen=new Set();let total=null;
  while(url) {
    const next=new URL(url);next.protocol='https:';
    if(next.host!=='www.comune.verona.it'||!next.pathname.startsWith('/api/opendata/v2/content/search/')||seen.has(next.href)||seen.size>=30)throw new Error('Paginazione Comune inattesa');
    seen.add(next.href);
    const response=await get(next.href);if(!response.ok)throw new Error(`HTTP ${response.status}: ${next.href}`);
    const page=await response.json();
    if(!Array.isArray(page.searchHits)||!Number.isInteger(page.totalCount)||page.totalCount<0)throw new Error('Formato Comune inatteso');
    if(total!==null&&total!==page.totalCount)throw new Error('Catalogo Comune cambiato durante la raccolta: riprovare');
    total=page.totalCount;hits.push(...page.searchHits);url=page.nextPageQuery;
    if(!url&&hits.length!==total)throw new Error('Importazione Comune incompleta');
    if(url)await new Promise(resolve=>setTimeout(resolve,1000));
  }
  diagnostics.recordsRead=hits.length;diagnostics.pagesRead=seen.size;
  return hits;
}
export async function readComuneResource(id){
  if(!Number.isSafeInteger(id)||id<=0)throw Error('Identificativo risorsa Comune non valido');
  await new Promise(resolve=>setTimeout(resolve,1000));
  const response=await get('https://www.comune.verona.it/api/opendata/v2/content/read/'+id);
  if(!response.ok)throw Error('HTTP '+response.status);
  return response.json();
}
export async function readComuneDocument(source){
  const url=new URL(source);if(url.origin!=='https://www.comune.verona.it'||!/^\/(?:content|ocmultibinary)\/download\//.test(url.pathname)||url.username||url.password)throw Error('URL allegato non ammesso');
  await new Promise(r=>setTimeout(r,1000));const response=await get(url.href);if(!response.ok)throw Error('HTTP '+response.status);
  if(Number(response.headers.get('content-length'))>20*1024*1024)throw Error('Allegato oltre 20 MB');
  const body=new Uint8Array(await response.arrayBuffer());if(body.length>20*1024*1024)throw Error('Allegato oltre 20 MB');
  return {sha256:createHash('sha256').update(body).digest('hex')};
}
export async function loadComune({from,checkedAt,diagnostics={},verificationVenueIds=[],verificationDocuments=[]}) {
  const hits=await readComuneCatalog({diagnostics}),resources=new Map();
  const readResource=async id=>{if(!resources.has(id))resources.set(id,readComuneResource(id));return resources.get(id);};
  diagnostics.editorialVenues={};
  for(const id of verificationVenueIds){try{const resource=await readResource(id);diagnostics.editorialVenues[id]={checkedAt,revision:venueResourceRevision(resource)};}catch(error){diagnostics.editorialVenues[id]={checkedAt,error:error.message};}}
  diagnostics.editorialDocuments={};
  for(const source of verificationDocuments){try{diagnostics.editorialDocuments[source]={checkedAt,...await readComuneDocument(source)};}catch(error){diagnostics.editorialDocuments[source]={checkedAt,error:error.message};}}
  const issues=new Map(),onIssue=({code,sourceId})=>{if(!issues.has(code))issues.set(code,new Set());issues.get(code).add(sourceId);};
  let venueFailures=0,imageFailures=0;
  const parsed=parseComune(hits,{from,checkedAt,onIssue});
  const events=await attachComuneVenues(parsed,readResource,{checkedAt,onIssue,onError:(id,error)=>{venueFailures++;console.warn('Sede Comune '+id+' non disponibile: '+error.message);}});
  const enriched=await attachComuneImages(events,readResource,{onError:(id,error)=>{imageFailures++;console.warn('Immagine Comune '+id+' non disponibile: '+error.message);}});
  diagnostics.quality={issues:[...issues].map(([code,ids])=>({code,sourceRecords:ids.size,sourceIds:[...ids].filter(Boolean)})),venueFailures,imageFailures,
    sourceEvents:new Set(enriched.map(e=>e.sourceEventId)).size,withSummary:enriched.filter(e=>e.summary).length,withAccessNotes:enriched.filter(e=>e.accessNotes).length,navigationDisabled:enriched.filter(e=>e.mapDisabled).length};
  return enriched;
}

export async function loadFiere({from,checkedAt,diagnostics={}}) {
  const year=Number(from.slice(0,4)),events=[];
  diagnostics.years=[];
  for(const y of [year,year+1]) {
    const url=`https://www.veronafiere.it/calendario-fiere/calendario-italia-${y}/`,response=await get(url);
    if(y>year&&response.status===404){diagnostics.years.push({year:y,status:'not-published'});continue;}
    if(!response.ok)throw new Error(`HTTP ${response.status}: ${url}`);
    const imported=parseFiere(await response.text(),{year:y,from,checkedAt});events.push(...imported);diagnostics.years.push({year:y,status:'ok',count:imported.length});
  }
  return events;
}

export async function collectEvents({from=romeDay(),checkedAt=new Date().toISOString(),previous={events:[]},loaders={comune:loadComune,fiere:loadFiere}}={}) {
  validateFrom(from);
  const report={checkedAt,from,status:'ok',sources:[]},rows=[];
  for(const key of ['comune','fiere']) {
    const source=sources[key].name,old=previous.events.filter(e=>e.source===source);
    const lastSuccessAt=previous.importReport?.sources?.find(s=>s.source===source)?.lastSuccessAt||old.map(e=>e.checkedAt).filter(Boolean).sort().at(-1)||null;
    try {
      const diagnostics={};
      const loaded=await loaders[key]({from,checkedAt,diagnostics}),imported=dedupe(loaded);
      if(loaded.length!==imported.length)diagnostics.duplicateOccurrences=loaded.length-imported.length;
      if(!imported.length)throw new Error('Nessun evento futuro: controllare la fonte prima di sostituire i dati');
      const eligible=old.filter(e=>(e.endsAt.length===10?e.endsAt:romeDay(new Date(e.endsAt)))>=from);
      if(eligible.length>=20&&imported.length<eligible.length*.3)throw new Error('Calo superiore al 70%: raccolta da verificare prima della sostituzione');
      const oldIds=new Set(old.map(e=>e.id)),newIds=new Set(imported.map(e=>e.id));
      const visible=e=>JSON.stringify([e.title,e.startsAt,e.endsAt,e.location,e.summary,e.accessNotes,e.price,e.priceLabel,e.mapDisabled,e.coordinates?.lat,e.coordinates?.lon]);
      const prior=new Map(old.map(e=>[e.id,visible(e)]));
      rows.push(...imported);
      report.sources.push({source,status:'ok',count:imported.length,lastSuccessAt:checkedAt,added:imported.filter(e=>!oldIds.has(e.id)).length,updated:imported.filter(e=>prior.has(e.id)&&prior.get(e.id)!==visible(e)).length,removed:eligible.filter(e=>!newIds.has(e.id)).length,...Object.keys(diagnostics).length?{diagnostics}:{}});
    } catch(error) {
      rows.push(...old);report.sources.push({source,status:'error',error:error.message,retained:old.length,lastSuccessAt});
    }
  }
  const succeeded=report.sources.filter(s=>s.status==='ok').length;
  report.status=succeeded===2?'ok':succeeded?'partial':'error';
  const events=dedupe(rows).sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
  const changes=detectEventChanges(previous.events,events,{checkedAt,from,successfulSources:report.sources.filter(s=>s.status==='ok').map(s=>s.source)});
  const cutoff=Date.parse(checkedAt)-90*86400000;
  const changeHistory=[...(previous.changeHistory||[]).filter(c=>Date.parse(c.checkedAt)>=cutoff),...changes].slice(-2000);
  report.significantChanges={count:changes.length,time:changes.filter(c=>c.fields.includes('time')).length,location:changes.filter(c=>c.fields.includes('location')).length,notPresent:changes.filter(c=>c.kind==='not-present').length};
  return {updatedAt:succeeded?checkedAt:previous.updatedAt||null,events,importReport:report,changeHistory};
}
