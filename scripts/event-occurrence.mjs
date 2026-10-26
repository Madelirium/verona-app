// A venue may vary by civil day. Unverified per-day coordinates never inherit a pin.
export function eventVenueForDay(event,day){
  const valid=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat>=44.5&&p.lat<=46.3&&p.lon>=10&&p.lon<=12;
  const occurrence=event.occurrences?.[day],named=event.locationsByDay?.[day];
  if(occurrence){const usable=!event.mapDisabled&&occurrence.verified===true&&valid(occurrence.coordinates);return {location:occurrence.location||named||event.location||'',coordinates:usable?occurrence.coordinates:null,usable,startsAt:occurrence.startsAt||null,endsAt:occurrence.endsAt||null,reviewedOn:occurrence.reviewedOn||null};}
  if(named)return {location:typeof named==='string'?named:event.location||'',coordinates:null,usable:false,startsAt:null,endsAt:null};
  if(event.occurrences||event.locationsByDay)return {location:event.location||'',coordinates:null,usable:false,startsAt:null,endsAt:null};
  const usable=!event.mapDisabled&&valid(event.coordinates);return {location:event.location||'',coordinates:usable?event.coordinates:null,usable,startsAt:event.startsAt,endsAt:event.endsAt};
}
