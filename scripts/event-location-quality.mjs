import {text,publicEventText} from './event-text.mjs';
// Screening threshold, not a statement of venue/entrance accuracy.
export const VENUE_COORDINATE_REVIEW_METERS=350;

// Only compare explicit street+civic evidence, never geocode or match venue names.
export function streetAddresses(value){
  const rows=[];
  const re=/\b(via|viale|piazza|piazzale|largo|vicolo|corso|lungadige|v\.)\s+([\p{L}’'. -]{2,65}?)\s*,?\s*(?:n[.°º]?\s*)?(\d{1,3}(?:\s*\/\s*[a-z]|[a-z])?)(?![\p{L}\d])/giu;
  for(const match of text(value).replace(/\bp\.zza\b/gi,'piazza').replace(/\bv\.le\b/gi,'viale').matchAll(re)){
    if(/\b(?:dal|dalle|alle|fino|ore|anno)\b/i.test(match[2]))continue;
    const road=match[2].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
    rows.push({kind:match[1].toLowerCase()==='v.'?'via':match[1].toLowerCase(),road,number:match[3].toLowerCase().replace(/[\s/]/g,''),label:publicEventText(match[0],120)});
  }
  return [...new Map(rows.map(row=>[row.kind+':'+row.road+':'+row.number,row])).values()].slice(0,12);
}
function sameRoad(a,b){
  if(a.kind!==b.kind)return false;
  if(a.road===b.road)return true;
  // Compare the whole name: Vittorio Veneto is not Vittorio Emanuele.
  // Compatible initials (A. Fedeli / Aldo Fedeli) remain aliases, never geocoding.
  const tokens=road=>road.split(' ').filter(word=>word&&!['di','del','della','dello','dei','degli','delle','d'].includes(word));
  const x=tokens(a.road),y=tokens(b.road);
  return x.length===y.length&&x.every((word,i)=>word===y[i]||(word.length===1&&y[i].startsWith(word))||(y[i].length===1&&word.startsWith(y[i])));
}
function matches(a,b){return sameRoad(a,b)&&a.number===b.number;}
export function addressConflict(first,second){
  const a=streetAddresses(first),b=streetAddresses(second);
  return a.length===1&&b.length>0&&!b.some(row=>matches(a[0],row));
}
export function narrativeVenueAddresses(description){
  const blocks=String(description??'').split(/<\/(?:p|li|div)>/i);
  const found=[];
  for(const block of blocks){
    // A contact office in the same paragraph is not the event's destination.
    const venueText=text(block).split(/\b(?:per (?:informazioni|iscrizioni|prenotazioni)|contatti|sede (?:legale|amministrativa)|segreteria)\b/i)[0];
    for(const sentence of venueText.split(/(?<!\b[A-ZÀ-Ý]\.)(?<=[.!?])\s+(?=[A-ZÀ-Ý])/u)){
      if(!/presso|si (?:svolg|terr)|nei locali|in sala|nella sala|al (?:centro|cdc)|sede/i.test(sentence))continue;
      for(const row of streetAddresses(sentence))if(!found.some(other=>matches(row,other)))found.push(row);
    }
  }
  return found.slice(0,8).map(row=>row.label);
}
export function variableVenueProgramme(description,address=''){
  const clean=text(description),place=text(address);
  return /\b(?:luoghi vari|sedi diverse|diverse sedi|teatri delle otto|teatri delle 8)\b/i.test(clean+' '+place)
    || /(?:spettacol|concert|event|incontr)[^.!?]{0,100}\bpresso\b[^.!?]{0,100}\be in (?:altre )?(?:location|sedi|luoghi)\b/i.test(clean);
}
export function disableUncertainLocation(event,code,message){
  const warning='Sede da verificare: '+message+' Consulta il programma ufficiale prima di partire.';
  return {...event,mapDisabled:true,coordinates:null,
    location:'Sede da verificare nel programma ufficiale',
    locationIssues:[...new Set([...(event.locationIssues||[]),code])],
    reviewReasons:[...new Set([...(event.reviewReasons||[]),warning])],
    accessNotes:[event.accessNotes,warning].filter(Boolean).join(' ')};
}
export function coordinateDistance(a,b){
  const rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
  const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
