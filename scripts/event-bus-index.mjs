// Compact, date-aware boarding index, derived exclusively from the official snapshot.
export function eventBusIndex(manifest,assets){
  const days=[];for(let d=manifest.validFrom;d<=manifest.validTo;d=new Date(Date.parse(d+'T12:00:00Z')+86400000).toISOString().slice(0,10))days.push(d);
  const stops=new Map();
  for(const data of assets){
    for(const stop of Object.values(data.stops)){
      if(!stops.has(stop.code))stops.set(stop.code,{...stop,services:{}});
      const previous=stops.get(stop.code);if(previous.name!==stop.name||previous.lat!==stop.lat||previous.lon!==stop.lon)throw Error('Fermata ufficiale discordante: '+stop.code);
    }
    for(const trip of data.trips){
      const active=days.map(day=>trip.dates.includes(day));
      for(const call of trip.calls){if(!call[3])continue;const stop=stops.get(call[0]);
        const bits=stop.services[data.number]||Array(days.length).fill('0');
        active.forEach((available,i)=>{if(available)bits[i]='1';});stop.services[data.number]=bits;
      }
    }
  }
  return {sha256:manifest.sha256,validFrom:manifest.validFrom,validTo:manifest.validTo,days,stops:[...stops.values()].filter(stop=>Object.keys(stop.services).length).map(stop=>({...stop,services:Object.entries(stop.services).map(([number,bits])=>[number,bits.join('')])}))};
}
