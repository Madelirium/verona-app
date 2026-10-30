import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function eventSourceRevision(hit){
  const d=hit.data?.['ita-IT']||{};
  return hash({id:hit.metadata?.id,modified:hit.metadata?.modified,title:d.event_title,abstract:d.event_abstract,description:d.description,time:d.time_interval,venues:d.takes_place_in,geo:d.geo,attachments:[d.has_playbill,d.attachment]});
}
export function venueResourceRevision(resource){
  const d=resource.data?.['ita-IT']||{};
  return hash({id:resource.metadata?.id,class:resource.metadata?.classIdentifier,modified:resource.metadata?.modified,name:d.name,address:d.has_address});
}
export function applyEventEditorial(event,review,{venues={},venueChecks={},documentChecks={},now=new Date().toISOString()}={}){
  if(!review)return event;
  const day=event.startsAt.length===10?event.startsAt:new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(event.startsAt));
  if(review.verification){
    const v=review.verification;
    const currentDay=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
    const stale=!event.sourceRevision||v.sourceRevision!==event.sourceRevision||!v.validUntil||currentDay>v.validUntil||currentDay<v.reviewedOn;
    const block=reason=>({...event,mapDisabled:true,coordinates:null,location:'Sede della giornata da verificare nel programma ufficiale',editorialStatus:{state:'stale',reason,reviewedOn:v.reviewedOn},accessNotes:[event.accessNotes,'La verifica editoriale della sede richiede un nuovo controllo: '+reason+'.'].filter(Boolean).join(' ')});
    if(stale)return block('fonte modificata o verifica scaduta');
    for(const proof of v.evidence||[]){if(proof.kind!=='attachment')continue;const check=documentChecks[proof.url];if(!check||check.sha256!==proof.sha256||!(Date.parse(now)-Date.parse(check.checkedAt)>=0&&Date.parse(now)-Date.parse(check.checkedAt)<=48*3600000))return block('programma allegato modificato o controllo recente non disponibile');}
    const occurrence=review.occurrences?.[day];
    if(!occurrence)return block('giornata non compresa nella verifica');
    const venue=venues[occurrence.venueId],check=venueChecks[occurrence.venueId];
    const fresh=check&&Date.parse(now)-Date.parse(check.checkedAt)>=0&&Date.parse(now)-Date.parse(check.checkedAt)<=48*3600000;
    if(occurrence.verified&&(!venue||!fresh||check.revision!==venue.resourceRevision))return block('sede ufficiale modificata o controllo recente non disponibile');
    const p=venue?.coordinates,usable=occurrence.verified===true&&p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat>=44.5&&p.lat<=46.3&&p.lon>=10&&p.lon<=12;
    const resolved={...occurrence,startsAt:event.startsAt,endsAt:event.endsAt,coordinates:usable?{...p,precision:'venue',venueId:occurrence.venueId,source:'Comune di Verona',sourceUrl:venue.sourceUrl}:null,verified:Boolean(usable)};
    const {verification,occurrences,locationsByDay,mapDisabled,coordinates,location,...presentation}=review;
    return {...event,...presentation,location:occurrence.location,coordinates:resolved.coordinates,mapDisabled:!usable,
      occurrences:{[day]:resolved},locationsByDay:{[day]:occurrence.location},areaConfirmed:true,
      editorialStatus:{state:usable?'verified-venue':'name-only',reviewedOn:v.reviewedOn,validUntil:v.validUntil,evidence:v.evidence},
      // Superseded source conflicts stay in locationIssues/provenance, not as contradictory live instructions.
      accessNotes:(event.accessNotes||'').replace(/\s*Sede da verificare:[\s\S]*?Consulta il programma ufficiale prima di partire\./g,'')+(usable?' Luogo verificato sulle fonti ufficiali il '+v.reviewedOn.split('-').reverse().join('/')+'. Il punto identifica la sede, non l’ingresso esatto.':' Coordinate della sede non verificate: consulta il programma ufficiale.')};
  }
  // Preserve existing unversioned presentation overrides without extending them to other days.
  const {locationsByDay,...fields}=review;
  if(locationsByDay&&!locationsByDay[day]){
    if(!fields.occurrences)return event;
    return {...event,...fields,locationsByDay,location:fields.location||'Sede della giornata da verificare nel programma ufficiale',coordinates:null,mapDisabled:true};
  }
  const legacy={...event,...fields,...locationsByDay?{locationsByDay,location:locationsByDay[day]}:{},area:'Verona',areaConfirmed:true};
  return review.localVerified?{...legacy,mapDisabled:true,coordinates:null,editorialStatus:{state:'legacy-unverified',reviewedOn:review.reviewedOn},accessNotes:[legacy.accessNotes,'La verifica editoriale storica non è tracciata: ricontrolla il programma ufficiale.'].filter(Boolean).join(' ')}:legacy;
}
export function editorialSummary(events){
  return {verified:events.filter(e=>e.editorialStatus?.state==='verified-venue').length,nameOnly:events.filter(e=>e.editorialStatus?.state==='name-only').length,
    legacyUnverified:events.filter(e=>e.editorialStatus?.state==='legacy-unverified').map(e=>({id:e.id,sourceUrl:e.sourceUrl})),
    stale:events.filter(e=>e.editorialStatus?.state==='stale').map(e=>({id:e.id,sourceUrl:e.sourceUrl,reason:e.editorialStatus.reason})),
    uncertainSourceResolved:events.filter(e=>e.locationIssues?.length&&e.editorialStatus?.state==='verified-venue').length,
    uncertainSourceRemaining:events.filter(e=>e.locationIssues?.length&&e.mapDisabled).length};
}
