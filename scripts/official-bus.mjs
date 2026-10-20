export function validateOfficialLine(data,manifest,number){
  const fail=()=>{throw new Error('Archivio ATV non valido: linea '+number)};
  if(data.number!==number||data.sha256!==manifest.sha256||data.validFrom!==manifest.validFrom||data.validTo!==manifest.validTo||!data.stops||!Array.isArray(data.trips))fail();
  for(const [code,stop] of Object.entries(data.stops))if(stop.code!==code||!stop.name||!Number.isFinite(stop.lat)||!Number.isFinite(stop.lon)||Math.abs(stop.lat)>90||Math.abs(stop.lon)>180)fail();
  const ids=new Set();
  for(const trip of data.trips){
    if(!trip.id||ids.has(trip.id)||!trip.destination||!Array.isArray(trip.calls)||!trip.calls.length||!Array.isArray(trip.dates))fail();
    ids.add(trip.id);
    if(new Set(trip.dates).size!==trip.dates.length||trip.dates.some(day=>!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<data.validFrom||day>data.validTo))fail();
    let previous=-1;
    for(const call of trip.calls){
      if(!data.stops[call[0]]||!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(call[1])||!Number.isInteger(call[2])||call[2]<0||call[2]>2||typeof call[3]!=='boolean')fail();
      const [h,m,s]=call[1].split(':').map(Number),seconds=call[2]*86400+h*3600+m*60+s;
      if(seconds<previous)fail();previous=seconds;
    }
  }
  const info=manifest.lines.find(line=>line.number===number);
  if(!info||info.tripCount!==data.trips.length||info.stopCount!==Object.keys(data.stops).length)fail();
}
