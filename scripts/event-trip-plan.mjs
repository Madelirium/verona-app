// Exact Rome instants: ambiguous/nonexistent local clocks are never guessed.
export function eventTripAssessment({day,departure,arrivalDay=day,arrival,startSeconds,endSeconds,now=Date.now(),deadline='',margin=0,boardingBuffer=120,notBefore=''}){
  const instant=(date,time)=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time))return null;
    const format=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}),local=Date.parse(date+'T'+time+'Z');
    if(!Number.isFinite(local))return null;const values=[60,120].map(offset=>local-offset*60000).filter(t=>format.format(new Date(t)).replace(' ','T')===date+'T'+time);return values.length===1?values[0]:null;
  };
  const departAt=instant(day,departure),arriveAt=instant(arrivalDay,arrival);
  if(departAt===null||arriveAt===null||arriveAt<departAt||![startSeconds,endSeconds,margin,boardingBuffer].every(n=>Number.isFinite(n)&&n>=0)||startSeconds>7200||endSeconds>7200||margin>60||boardingBuffer>600)return {state:'unknown'};
  const target=deadline?instant(arrivalDay,deadline+':00'):null,earliest=notBefore?instant(day,notBefore+':00'):null;if(deadline&&target===null||notBefore&&earliest===null)return {state:'unknown'};
  const leaveAt=departAt-(startSeconds+boardingBuffer)*1000,venueAt=arriveAt+endSeconds*1000,respectsStart=earliest===null||leaveAt>=earliest,canBoard=leaveAt>=now&&respectsStart,canArrive=target===null?null:venueAt<=target-margin*60000;
  return {state:canBoard&&canArrive!==false?'compatible':'late',leaveAt,venueAt,departAt,arriveAt,totalMinutes:Math.ceil((venueAt-leaveAt)/60000),canBoard,canArrive,respectsStart,spareMinutes:target===null?null:Math.floor((target-venueAt)/60000),boardingBuffer,margin};
}
