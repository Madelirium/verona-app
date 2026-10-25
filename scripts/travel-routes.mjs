// Small, on-demand FOSSGIS requests, serialised across both profiles (max 1/s).
// Coordinates are transient; no storage or visitor identifiers are used.
export function createTravelRouteClient({fetchRoute=globalThis.fetch,now=()=>Date.now(),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  const cache=new Map();let queue=Promise.resolve(),last=-Infinity;
  const point=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat>=44.5&&p.lat<=46.3&&p.lon>=10&&p.lon<=12;
  const distance=(a,b)=>{const r=Math.PI/180,h=Math.sin((b.lat-a.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lon-a.lon)*r/2)**2;return 12742000*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));};
  const check=signal=>{if(signal?.aborted)throw Error('Calcolo annullato.');};
  return {load(start,end,{mode='walk',signal}={}){
    if(!['walk','car'].includes(mode)||!point(start)||!point(end)||distance(start,end)>(mode==='walk'?20000:60000))return Promise.reject(Error('Percorso fuori dall’area di ricerca.'));
    const id=[mode,start.lat,start.lon,end.lat,end.lon].join('|');
    const run=async()=>{
      check(signal);const saved=cache.get(id);if(saved&&now()-saved.fetchedAt<300000)return saved;
      if(distance(start,end)<1)return {distance:0,duration:0,coordinates:[[start.lon,start.lat],[end.lon,end.lat]],source:'Posizioni coincidenti',fetchedAt:now()};
      const delay=1100-(now()-last);if(delay>0)await wait(delay);check(signal);
      const controller=new AbortController(),cancel=()=>controller.abort(),timeout=setTimeout(cancel,15000);signal?.addEventListener('abort',cancel,{once:true});last=now();
      try{
        const profile=mode==='car'?'car':'foot',snap=mode==='car'?150:60;
        const url='https://routing.openstreetmap.de/routed-'+profile+'/route/v1/'+(mode==='car'?'driving':'foot')+'/'+start.lon+','+start.lat+';'+end.lon+','+end.lat+'?overview=full&geometries=geojson&steps=false&alternatives=false&generate_hints=false&radiuses='+snap+';'+snap;
        const response=await fetchRoute(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'strict-origin-when-cross-origin'});
        if(!response.ok)throw Error(response.status===429?'Servizio occupato: riprova tra poco.':'Percorso temporaneamente non disponibile.');
        const data=await response.json(),route=data.routes?.[0],coords=route?.geometry?.coordinates;
        if(data.code!=='Ok'||route?.geometry?.type!=='LineString'||!Array.isArray(coords)||coords.length<2||coords.length>30000||coords.some(c=>!Array.isArray(c)||!point({lat:c[1],lon:c[0]}))||!Number.isFinite(route.distance)||route.distance<0||route.distance>200000||!Number.isFinite(route.duration)||route.duration<0||route.duration>86400||data.waypoints?.length!==2||data.waypoints.some(p=>!Number.isFinite(p.distance)||p.distance<0||p.distance>snap)||distance(start,{lat:coords[0][1],lon:coords[0][0]})>snap+20||distance(end,{lat:coords.at(-1)[1],lon:coords.at(-1)[0]})>snap+20)throw Error('Il servizio non ha restituito un percorso verificabile.');
        check(signal);const result={distance:route.distance,duration:route.duration,coordinates:coords,source:'FOSSGIS · OSRM '+profile+' / OpenStreetMap',fetchedAt:now()};
        if(cache.size>=40)cache.delete(cache.keys().next().value);cache.set(id,result);return result;
      }finally{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);}
    };
    const result=queue.then(run);queue=result.catch(()=>{});return result;
  }};
}

// Rank only bus trips whose two real pedestrian routes have been checked.
export function rankTravelBusTrips(candidates,{day,departureAt,now=Date.now(),assess}){
  return candidates.map(row=>({...row,assessment:assess({day,departure:row.row.time,arrivalDay:row.arrivalDay||day,arrival:row.arrivalTime,startSeconds:row.startWalk?.duration,endSeconds:row.endWalk?.duration,now:Math.max(now,departureAt),margin:0})})).filter(row=>row.assessment.state==='compatible'&&row.assessment.leaveAt>=departureAt).sort((a,b)=>a.assessment.venueAt-b.assessment.venueAt||a.assessment.totalMinutes-b.assessment.totalMinutes);
}

// Prefer walking nearby. A bus must save meaningful time AND reduce walking.
export function chooseActiveTravel(walk,bus){
  const walking=walk?.route&&Number.isFinite(walk.duration)&&walk.duration>=0;
  const transit=bus?.row&&Number.isFinite(bus.duration)&&bus.duration>=0;
  if(walking&&walk.duration<=900&&walk.route.distance<=1200)return {...walk,kind:'walk',reason:'nearby'};
  if(walking&&transit){
    const saved=walk.duration-bus.duration,start=bus.row.startWalk,end=bus.row.endWalk;
    const useful=saved>=Math.max(300,walk.duration*.2)&&Number.isFinite(start?.distance)&&Number.isFinite(end?.distance)&&start.distance<=Math.min(1000,walk.route.distance*.5)&&start.distance+end.distance<=walk.route.distance*.7;
    return useful?{...bus,kind:'bus',reason:'faster',savedSeconds:saved}:{...walk,kind:'walk',reason:'no-gain'};
  }
  if(walking)return {...walk,kind:'walk',reason:bus?'walking-only':'checking-bus'};
  if(transit)return {...bus,kind:'bus',reason:'walking-unavailable'};
  if(walk&&bus)return {error:'Nessun percorso verificato disponibile. Puoi riprovare o cercare altri autobus.'};
  return undefined;
}
