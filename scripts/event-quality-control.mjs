import {parseComune,dedupe} from './parsers.mjs';
import {attachComuneVenues} from './event-venues.mjs';
import {conditionFamilies} from './event-text.mjs';
import {VENUE_COORDINATE_REVIEW_METERS} from './event-location-quality.mjs';

// A replay control, not a claim that source prose or locations are universally correct.
export async function auditEventQuality({hits,venues={},catalog,from=catalog.importReport?.from,checkedAt=new Date().toISOString()}){
  if(!Array.isArray(hits)||!Array.isArray(catalog.events)||!/^\d{4}-\d{2}-\d{2}$/.test(from||''))throw Error('Controllo eventi: catalogo, snapshot API o from non validi');
  const sourceIssues=new Map(),sourceReview=[],importerErrors=[],sourceChanges=[],evidenceMissing=new Set();
  const onIssue=issue=>sourceIssues.set(issue.sourceId+':'+issue.code,issue);
  const parsed=parseComune(hits,{from,checkedAt,onIssue});
  const expected=dedupe(await attachComuneVenues(parsed,async id=>{if(!venues[id]){evidenceMissing.add(id);throw Error('Sede assente dallo snapshot');}return venues[id];},{checkedAt,onIssue}));
  const actual=catalog.events.filter(e=>e.source==='Comune di Verona'),byId=new Map(actual.map(e=>[e.id,e]));
  const sourceById=new Map(hits.map(h=>[h.metadata.id,h]));
  const compared=['title','startsAt','endsAt','summary','accessNotes','price','priceLabel','mapDisabled','location'];
  const semanticallySame=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
  for(const event of expected){
    const previous=byId.get(event.id),source=sourceById.get(event.sourceEventId);
    const modified=source?.metadata.modified;
    const changedSinceCollection=Number.isFinite(Date.parse(modified))&&Date.parse(modified)>Date.parse(catalog.updatedAt||0);
    const linkedVenueChanged=event.venueIds?.some(id=>Date.parse(venues[id]?.metadata.modified)>Date.parse(catalog.updatedAt||0));
    if(changedSinceCollection||linkedVenueChanged||(previous?.sourceModifiedAt&&previous.sourceModifiedAt!==modified)){
      sourceChanges.push({sourceId:event.sourceEventId,code:linkedVenueChanged?'linked-venue-changed-since-import':'source-changed-since-import'});continue;
    }
    if(!previous){importerErrors.push({sourceId:event.sourceEventId,eventId:event.id,code:'missing-occurrence'});continue;}
    for(const field of compared){
      if(['mapDisabled','location','accessNotes'].includes(field)&&event.venueIds?.some(id=>evidenceMissing.has(id)))continue;
      if(!semanticallySame(event[field],previous[field]))importerErrors.push({sourceId:event.sourceEventId,eventId:event.id,code:'catalogue-replay-mismatch',field});
    }
    if(!event.venueIds?.some(id=>evidenceMissing.has(id))&&!semanticallySame(event.coordinates?{lat:event.coordinates.lat,lon:event.coordinates.lon}:null,previous.coordinates?{lat:previous.coordinates.lat,lon:previous.coordinates.lon}:null))importerErrors.push({sourceId:event.sourceEventId,eventId:event.id,code:'catalogue-replay-mismatch',field:'coordinates'});
    const data=source.data['ita-IT'];
    const omitted=conditionFamilies([data.description,data.cost_notes,data.about_target_audience].join(' ')).filter(code=>!conditionFamilies(previous.accessNotes||'').includes(code));
    if(omitted.length)sourceReview.push({sourceId:event.sourceEventId,code:'condition-coverage-review',families:omitted,classification:'importer-summary-limit'});
  }
  const physicalKeys=new Set();
  const expectedIds=new Set(expected.map(e=>e.id));
  for(const event of actual){
    if(!expectedIds.has(event.id)){
      const source=sourceById.get(event.sourceEventId),modified=source?.metadata.modified;
      if(!source||Date.parse(modified)>Date.parse(catalog.updatedAt||0)||event.sourceModifiedAt!==modified)sourceChanges.push({sourceId:event.sourceEventId,code:'occurrence-no-longer-in-source-snapshot-not-confirmed-cancelled'});
      else importerErrors.push({eventId:event.id,sourceId:event.sourceEventId,code:'unexpected-occurrence'});
    }
    const start=Date.parse(event.startsAt),end=Date.parse(event.endsAt);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<start){importerErrors.push({eventId:event.id,code:'invalid-exported-time'});continue;}
    const key=event.sourceEventId+':'+start;
    if(physicalKeys.has(key))importerErrors.push({eventId:event.id,code:'duplicate-source-occurrence'});
    physicalKeys.add(key);
  }
  if(byId.size!==actual.length)importerErrors.push({code:'duplicate-event-id'});
  const anomalies=[...sourceIssues.values()].filter(issue=>!issue.code.startsWith('condition-not-retained:'));
  const summaryLimits=[...sourceIssues.values()].filter(issue=>issue.code.startsWith('condition-not-retained:'));
  return {checkedAt,from,catalogCheckedAt:catalog.updatedAt,coordinateReviewThresholdMeters:VENUE_COORDINATE_REVIEW_METERS,status:importerErrors.length?'mismatch':evidenceMissing.size?'incomplete':sourceChanges.length?'source-changed':'ok',scope:'Comune API replay; no exhaustive verification of prose, attachments or cancellations',
    counts:{sourceRecords:hits.length,expectedOccurrences:expected.length,catalogOccurrences:actual.length,sourceAnomalies:anomalies.length,importerErrors:importerErrors.length,sourceChanges:new Set(sourceChanges.map(i=>i.sourceId)).size,missingVenueResources:evidenceMissing.size,conditionReviews:new Set(sourceReview.map(i=>i.sourceId)).size,summaryLimits:summaryLimits.length},
    sourceAnomalies:anomalies.map(issue=>({...issue,classification:issue.code==='invalid-occurrence'?'source-invalid-time':'source-review-required'})),
    importerWarnings:summaryLimits.map(issue=>({...issue,classification:'importer-summary-limit'})),
    importerErrors,sourceChanges:[...new Map(sourceChanges.map(i=>[i.sourceId,i])).values()],conditionReviews:[...new Map(sourceReview.map(i=>[i.sourceId,i])).values()],missingVenueIds:[...evidenceMissing]};
}
