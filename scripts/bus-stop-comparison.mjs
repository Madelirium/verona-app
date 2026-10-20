export function stopTokens(name){
  return String(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/p\.(?:zza|za)\b/g,'piazza').replace(/p\.ta\b/g,'porta').replace(/\bs\.(?=[a-z])/g,'san ').replace(/stazione porta nuova|stazione p\.?n\.?/g,'stazione fs').replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/);
}
export function compareBusStop(route,stop,blocks){
  const relevant=blocks.filter(block=>!route.timetableDirection||block.direction===route.timetableDirection),names=[...new Set(relevant.flatMap(block=>block.stops.map(row=>row.name)))];
  const uniquePdf=names.includes(stop.name)&&relevant.every(block=>block.stops.filter(row=>row.name===stop.name).length<=1);
  const exact=Boolean(route.timetableDirection&&stop.timetableCandidate&&uniquePdf&&route.stops.filter(row=>row.name===stop.name).length===1);
  const tokens=new Set(stopTokens(stop.name)),generic=new Set(['via','viale','piazza','san','santa','verona','porta','di','del','della']);
  const candidates=names.map(name=>{const other=new Set(stopTokens(name)),shared=[...tokens].filter(token=>other.has(token)),specific=shared.filter(token=>!generic.has(token));return {name,score:shared.length/new Set([...tokens,...other]).size,specific:specific.length};}).filter(item=>item.specific>0&&item.score>=.35).sort((a,b)=>b.score-a.score).slice(0,3).map(item=>item.name);
  return {status:exact?'exact':!route.timetableDirection?'direction-unverified':candidates.length?'review':'unmatched',pdfName:exact?stop.name:null,candidates,googleMapsUrl:'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(stop.lat+','+stop.lon)};
}
