import { sources, parseComune, parseFiere, romeDay, dedupe } from './parsers.mjs';
import {attachComuneImages} from './event-images.mjs';

export function validateFrom(from) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !Number.isFinite(Date.parse(from)) || new Date(from).toISOString().slice(0,10) !== from) throw new Error('EVENTS_FROM non valida');
}

async function get(url) {
  for (let attempt=0; attempt<3; attempt++) {
    try {
      const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'VeronaEvents/0.2 (+https://github.com/Madelirium/verona-app)'}});
      if (response.ok || response.status===404) return response;
      if (response.status!==429 && response.status<500) throw new Error(`HTTP ${response.status}: ${url}`);
      if (attempt===2) throw new Error(`HTTP ${response.status}: ${url}`);
    } catch (error) { if (attempt===2 || /^HTTP 4/.test(error.message)) throw error; }
    await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
  }
}

export async function loadComune({from,checkedAt}) {
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
  const events=parseComune(hits,{from,checkedAt});
  return attachComuneImages(events,async id=>{
    await new Promise(resolve=>setTimeout(resolve,150));
    const response=await get('https://www.comune.verona.it/api/opendata/v2/content/read/'+id);
    if(!response.ok)throw Error('HTTP '+response.status);
    return response.json();
  },{onError:(id,error)=>console.warn('Immagine Comune '+id+' non disponibile: '+error.message)});
}

export async function loadFiere({from,checkedAt}) {
  const year=Number(from.slice(0,4)),events=[];
  for(const y of [year,year+1]) {
    const url=`https://www.veronafiere.it/calendario-fiere/calendario-italia-${y}/`,response=await get(url);
    if(y>year&&response.status===404)continue;
    if(!response.ok)throw new Error(`HTTP ${response.status}: ${url}`);
    events.push(...parseFiere(await response.text(),{year:y,from,checkedAt}));
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
      const imported=dedupe(await loaders[key]({from,checkedAt}));
      if(!imported.length)throw new Error('Nessun evento futuro: controllare la fonte prima di sostituire i dati');
      const eligible=old.filter(e=>(e.endsAt.length===10?e.endsAt:romeDay(new Date(e.endsAt)))>=from);
      if(eligible.length>=20&&imported.length<eligible.length*.3)throw new Error('Calo superiore al 70%: raccolta da verificare prima della sostituzione');
      const oldIds=new Set(old.map(e=>e.id)),newIds=new Set(imported.map(e=>e.id));
      rows.push(...imported);
      report.sources.push({source,status:'ok',count:imported.length,lastSuccessAt:checkedAt,added:imported.filter(e=>!oldIds.has(e.id)).length,removed:eligible.filter(e=>!newIds.has(e.id)).length});
    } catch(error) {
      rows.push(...old);report.sources.push({source,status:'error',error:error.message,retained:old.length,lastSuccessAt});
    }
  }
  const succeeded=report.sources.filter(s=>s.status==='ok').length;
  report.status=succeeded===2?'ok':succeeded?'partial':'error';
  return {updatedAt:succeeded?checkedAt:previous.updatedAt||null,events:dedupe(rows).sort((a,b)=>a.startsAt.localeCompare(b.startsAt)),importReport:report};
}
