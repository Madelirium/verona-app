import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {parseComune} from './parsers.mjs';
import {readComuneCatalog,readComuneResource,readComuneDocument} from './event-sync.mjs';
import {auditEventQuality} from './event-quality-control.mjs';
import {applyEventEditorial,editorialSummary,venueResourceRevision,eventSourceRevision} from './event-editorial.mjs';

const args=process.argv.slice(2),value=key=>{const i=args.indexOf(key);return i<0?null:args[i+1];};
const catalog=JSON.parse(await readFile(value('--catalog')||'data/events.json','utf8'));
let hits,venues={},liveVenueChecks=null,liveDocumentChecks=null;const diagnostics={};
if(args.includes('--live')){
  hits=await readComuneCatalog({diagnostics});
  const rows=parseComune(hits,{from:catalog.importReport.from,checkedAt:new Date().toISOString()});
  let verification={venues:{},documents:{}};try{verification=JSON.parse(await readFile('data/event-venue-verifications.json','utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  liveVenueChecks={};liveDocumentChecks={};
  for(const id of new Set([...rows.flatMap(e=>e.venueIds||[]),...Object.keys(verification.venues||{}).map(Number)])){
    try{venues[id]=await readComuneResource(id);}catch(error){console.warn('Sede non verificabile '+id+': '+error.message);}
    if(venues[id])liveVenueChecks[id]={checkedAt:new Date().toISOString(),revision:venueResourceRevision(venues[id])};
  }
  for(const url of Object.keys(verification.documents||{})){try{liveDocumentChecks[url]={checkedAt:new Date().toISOString(),...await readComuneDocument(url)};}catch(error){liveDocumentChecks[url]={error:error.message};}}
}else{
  if(!value('--source')||!value('--venues'))throw Error('Usa --live oppure --source snapshot-api.json --venues snapshot-sedi.json; opzionale --out rapporto.json');
  hits=JSON.parse(await readFile(value('--source'),'utf8'));venues=JSON.parse(await readFile(value('--venues'),'utf8'));
}
const report=await auditEventQuality({hits,venues,catalog});report.collectionDiagnostics=diagnostics;
try{
  const editorial=JSON.parse(await readFile('data/editorial.json','utf8')),verification=JSON.parse(await readFile('data/event-venue-verifications.json','utf8'));
  const source=catalog.importReport.sources.find(s=>s.source==='Comune di Verona');
  const revisions=new Map(hits.map(hit=>[hit.metadata.id,hit]));
  report.editorial=editorialSummary(catalog.events.map(e=>{
    const current=args.includes('--live')&&e.source==='Comune di Verona'?{...e,sourceRevision:revisions.has(e.sourceEventId)?eventSourceRevision(revisions.get(e.sourceEventId)):undefined}:e;
    return applyEventEditorial(current,editorial[e.sourceUrl],{venues:verification.venues,venueChecks:liveVenueChecks||source?.diagnostics?.editorialVenues||{},documentChecks:liveDocumentChecks||source?.diagnostics?.editorialDocuments||{},now:report.checkedAt});
  }));
  if((report.editorial.stale.length||report.editorial.legacyUnverified.length)&&report.status==='ok')report.status='review-required';
}catch(error){if(error.code!=='ENOENT')throw error;}
if(value('--out')){await mkdir(dirname(value('--out')),{recursive:true});await writeFile(value('--out'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report.counts,null,2));
if(report.status!=='ok')process.exitCode=1;
