// Same official trip, ordered calls and explicit boarding/alighting permissions.
// The day is a CIVIL day in Europe/Rome; service dates can be the previous day.
export function directBusTrips(assets,{origin,point,day,after='00:00',before='',radius=800,limit=12,notBeforeSeconds=0,allowOvernight=false,allTargets=false}){
  const validDay=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
  const validClock=clock=>/^([01]\d|2[0-3]):[0-5]\d$/.test(clock);
  if(!validDay(day)||!validClock(after)||before&&!validClock(before)||!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lon))return [];
  const shift=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
  const seconds=(clock,offset=0)=>/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(clock)&&Number.isInteger(offset)&&offset>=0&&offset<=2?Number(clock.slice(0,2))*3600+Number(clock.slice(3,5))*60+Number(clock.slice(6,8))+offset*86400:NaN;
  // Civil clock differences are not elapsed durations on the DST transition day.
  // Resolve unambiguous local times; never guess which occurrence of 02:xx is meant.
  const offsetFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',timeZoneName:'shortOffset'});
  const offsets=[0,12].map(hour=>{const name=offsetFormat.formatToParts(new Date(day+'T'+String(hour).padStart(2,'0')+':00:00Z')).find(part=>part.type==='timeZoneName').value,match=name.match(/GMT([+-])(\d+)(?::(\d+))?/);return match?(Number(match[2])*60+Number(match[3]||0))*(match[1]==='-'?-1:1):0;});
  const transition=offsets[0]!==offsets[1],instantCache=new Map();
  const localFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const instant=(clock,onDay=day)=>{
    const key=onDay+'T'+clock;if(instantCache.has(key))return instantCache.get(key);
    const wanted=key,local=Date.parse(wanted+'Z');
    const matches=[60,120].map(offset=>local-offset*60000).filter(value=>{const parts=Object.fromEntries(localFormat.formatToParts(new Date(value)).map(part=>[part.type,part.value]));return parts.year+'-'+parts.month+'-'+parts.day+'T'+parts.hour+':'+parts.minute+':'+parts.second===wanted;});
    const value=matches.length===1?matches[0]:NaN;instantCache.set(key,value);return value;
  };
  const distance=stop=>{const r=Math.PI/180,a=(stop.lat-point.lat)*r,b=(stop.lon-point.lon)*r,h=Math.sin(a/2)**2+Math.cos(point.lat*r)*Math.cos(stop.lat*r)*Math.sin(b/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));};
  const minimum=Math.max(Number(after.slice(0,2))*3600+Number(after.slice(3,5))*60,notBeforeSeconds),results=[];
  const maximum=before?Number(before.slice(0,2))*3600+Number(before.slice(3,5))*60:Infinity;
  if(maximum<minimum||transition&&before&&!Number.isFinite(instant(before+':00')))return [];
  for(const data of assets){
    if(!data.alightingAvailable||day<data.validFrom||day>data.validTo||!data.stops[origin])continue;
    const targets=new Map(Object.values(data.stops).map(stop=>[stop.code,distance(stop)]).filter(([code,metres])=>code!==origin&&Number.isFinite(metres)&&metres<=radius));
    if(!targets.size)continue;
    for(const trip of data.trips)for(const serviceDay of [shift(day,-2),shift(day,-1),day]){
      if(!trip.dates.includes(serviceDay))continue;
      for(let order=0;order<trip.calls.length;order++){
        const start=trip.calls[order],departure=seconds(start[1],start[2]);
        if(start[0]!==origin||start[3]!==true||!Number.isFinite(departure)||shift(serviceDay,start[2])!==day||departure%86400<minimum)continue;
        const useInstants=transition||allowOvernight,departureInstant=useInstants?instant(start[1]):0;if(useInstants&&!Number.isFinite(departureInstant))continue;
        let best=null;const candidates=[];
        for(let i=order+1;i<trip.calls.length;i++){
          const call=trip.calls[i];if(call[6]!==true||!targets.has(call[0]))continue;
          const arrivalKnown=Boolean(call[4]),clock=arrivalKnown?call[4]:call[1],offset=arrivalKnown?call[5]:call[2],arrival=seconds(clock,offset);
          const arrivalDay=shift(serviceDay,offset);
          if(!Number.isFinite(arrival)||arrival<departure||arrivalDay!==day&&(!allowOvernight||arrivalDay!==shift(day,1))||arrivalDay>data.validTo)continue;
          if(arrival%86400+(arrivalDay===day?0:86400)>maximum)continue;
          const elapsed=useInstants?(instant(clock,arrivalDay)-departureInstant)/1000:arrival-departure;if(!Number.isFinite(elapsed)||elapsed<0)continue;
          const candidate={code:call[0],order:i,time:clock,arrivalKnown,arrivalDay,seconds:arrival,elapsed,distance:targets.get(call[0])};candidates.push(candidate);
          if(!best||candidate.distance<best.distance||candidate.distance===best.distance&&candidate.seconds<best.seconds)best=candidate;
        }
        const chosenTargets=allTargets?candidates:best?[best]:[];
        for(const best of chosenTargets){
          const timelineMinutes=transition||best.arrivalDay!==day?trip.calls.slice(order,best.order+1).map((call,index)=>index===0?0:Math.ceil((instant(call[4]||call[1],shift(serviceDay,call[4]?call[5]:call[2]))-departureInstant)/60000)):null;
          if(timelineMinutes?.some(value=>!Number.isFinite(value)||value<0))continue;
          results.push({number:data.number,row:{trip:trip.id,serviceDay,order,time:start[1],offset:start[2],minutes:departure/60,destination:trip.destination},origin:data.stops[origin],arrival:data.stops[best.code],arrivalOrder:best.order,arrivalTime:best.time,arrivalDay:best.arrivalDay,arrivalSeconds:best.seconds%86400+(best.arrivalDay===day?0:86400),arrivalKnown:best.arrivalKnown,duration:Math.ceil(best.elapsed/60),distance:best.distance,departureSeconds:departure%86400,timelineMinutes});
        }
      }
    }
  }
  return results.sort((a,b)=>(before?b.arrivalSeconds-a.arrivalSeconds||b.departureSeconds-a.departureSeconds:a.departureSeconds-b.departureSeconds)||a.duration-b.duration||a.distance-b.distance||a.number.localeCompare(b.number,'it',{numeric:true})).slice(0,limit);
}
