// Self-contained: also serialized into the browser to compare existing saved snapshots.
export function eventChangeReview(snapshot,catalog,{sources=[],from=''}={}){
  const day=value=>value?.length===10?value:new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  const family=(a,b)=>a.source===b.source&&(a.sourceEventId&&b.sourceEventId?a.sourceEventId===b.sourceEventId:Boolean(a.sourceUrl&&a.sourceUrl===b.sourceUrl));
  let current=catalog.find(e=>e.id===snapshot.id);
  if(!current){
    const stable=snapshot.sourceOccurrenceId?catalog.filter(e=>family(e,snapshot)&&e.sourceOccurrenceId===snapshot.sourceOccurrenceId):[];
    const candidates=stable.length?stable:catalog.filter(e=>family(e,snapshot)&&day(e.startsAt)===day(snapshot.startsAt));
    if(candidates.length===1)current=candidates[0];
  }
  if(!current){
    if(from&&day(snapshot.endsAt)<from)return {kind:'historical',fields:[],current:null,message:''};
    const success=sources.find(source=>source.source===snapshot.source)?.status==='ok';
    return {kind:success?'not-present':'unverified',fields:[],current:null,message:success?'Non più presente nel catalogo attuale: verifica il programma ufficiale. Non significa che sia annullato.':'Presenza nel catalogo da verificare: aggiornamento della fonte non confermato.'};
  }
  const fields=[];
  const instant=value=>value?.length===10?value:Date.parse(value);
  if(instant(snapshot.startsAt)!==instant(current.startsAt)||instant(snapshot.endsAt)!==instant(current.endsAt))fields.push('time');
  const clean=value=>String(value||'').normalize('NFC').replace(/\s+/g,' ').trim().toLocaleLowerCase('it');
  const point=e=>!e.mapDisabled&&Number.isFinite(e.coordinates?.lat)&&Number.isFinite(e.coordinates?.lon)?e.coordinates:null;
  const a=point(snapshot),b=point(current),distance=a&&b?Math.hypot((a.lat-b.lat)*111195,(a.lon-b.lon)*111195*Math.cos(a.lat*Math.PI/180)):0;
  if(clean(snapshot.location)!==clean(current.location)||Boolean(a)!==Boolean(b)||distance>25||Boolean(snapshot.mapDisabled)!==Boolean(current.mapDisabled))fields.push('location');
  return {kind:fields.length?'changed':'unchanged',fields,current,message:fields.length?'Rispetto al salvataggio '+(fields.includes('time')&&fields.includes('location')?'orario e luogo sono cambiati':fields.includes('time')?'l’orario è cambiato':'il luogo è cambiato')+'. Verifica i nuovi dettagli prima di partire.':''};
}

export function detectEventChanges(previous,current,{checkedAt,from,successfulSources=[]}={}){
  const sources=successfulSources.map(source=>({source,status:'ok'})),changes=[];
  for(const old of previous){
    if(!successfulSources.includes(old.source))continue;
    const review=eventChangeReview(old,current,{sources,from});
    if(!['changed','not-present'].includes(review.kind))continue;
    changes.push({checkedAt,source:old.source,sourceEventId:old.sourceEventId,previousId:old.id,currentId:review.current?.id||null,
      kind:review.kind,fields:review.fields,sourceUrl:old.sourceUrl,
      before:{startsAt:old.startsAt,endsAt:old.endsAt,location:old.location,mapDisabled:Boolean(old.mapDisabled),coordinates:!old.mapDisabled&&old.coordinates?{lat:old.coordinates.lat,lon:old.coordinates.lon}:null},
      after:review.current?{startsAt:review.current.startsAt,endsAt:review.current.endsAt,location:review.current.location,mapDisabled:Boolean(review.current.mapDisabled),coordinates:!review.current.mapDisabled&&review.current.coordinates?{lat:review.current.coordinates.lat,lon:review.current.coordinates.lon}:null}:null});
  }
  return changes;
}
