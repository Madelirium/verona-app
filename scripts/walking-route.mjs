// Local prototype only: FOSSGIS routed-foot, not a driving route renamed as walking.
export function walkingPreviewAvailable(location){
  if(!location||!['http:','https:'].includes(location.protocol))return false;
  const host=location.hostname;
  if(['localhost','127.0.0.1','[::1]'].includes(host))return true;
  const parts=String(host).split('.');
  if(parts.length!==4||parts.some(part=>!/^\d{1,3}$/.test(part)||Number(part)>255))return false;
  const [a,b]=parts.map(Number);return location.protocol==='http:'&&(a===10||a===192&&b===168||a===172&&b>=16&&b<=31);
}

export function createWalkingClient({fetchRoute=globalThis.fetch,now=()=>Date.now(),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  const cache=new Map();let queue=Promise.resolve(),lastRequest=-Infinity;
  const point=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat>=44.5&&p.lat<=46.3&&p.lon>=10&&p.lon<=12;
  const distance=(a,b)=>{const r=Math.PI/180,x=(b.lat-a.lat)*r,y=(b.lon-a.lon)*r,h=Math.sin(x/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(y/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));};
  const abort=signal=>{if(signal?.aborted)throw new Error('Calcolo annullato.');};
  return {load(start,end,{signal}={}){
    if(!point(start)||!point(end)||distance(start,end)>2000)return Promise.reject(new Error('Posizioni non valide per questa prova locale.'));
    // Exact public stop/venue coordinates; no visitor identifier or persistent storage.
    const key=[start.lon,start.lat,end.lon,end.lat].join(',');
    const run=async()=>{
      abort(signal);const existing=cache.get(key);if(existing&&now()-existing.fetchedAt<15*60000)return existing;
      const delay=1100-(now()-lastRequest);if(delay>0)await wait(delay);abort(signal);
      const controller=new AbortController(),cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});
      const timer=setTimeout(cancel,15000);lastRequest=now();
      try{
        const url='https://routing.openstreetmap.de/routed-foot/route/v1/foot/'+start.lon+','+start.lat+';'+end.lon+','+end.lat+'?overview=full&geometries=geojson&steps=false&alternatives=false&generate_hints=false&radiuses=40;40';
        const response=await fetchRoute(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'strict-origin-when-cross-origin'});
        if(!response.ok)throw new Error(response.status===429?'Servizio occupato: riprova tra poco.':'Servizio pedonale non disponibile.');
        const data=await response.json(),route=data.routes?.[0],coordinates=route?.geometry?.coordinates;
        if(data.code!=='Ok'||route?.geometry?.type!=='LineString'||!Array.isArray(coordinates)||coordinates.length<2||coordinates.length>5000||!Number.isFinite(route.distance)||route.distance<0||route.distance>10000||!Number.isFinite(route.duration)||route.duration<0||route.duration>7200||data.waypoints?.length!==2)throw new Error('Percorso pedonale non disponibile o non verificabile.');
        if(coordinates.some(p=>!Array.isArray(p)||p.length<2||!point({lat:p[1],lon:p[0]}))||data.waypoints.some(p=>!Number.isFinite(p.distance)||p.distance<0||p.distance>40)||distance(start,{lon:coordinates[0][0],lat:coordinates[0][1]})>60||distance(end,{lon:coordinates.at(-1)[0],lat:coordinates.at(-1)[1]})>60)throw new Error('Il percorso non è abbastanza vicino alla fermata o alla sede.');
        abort(signal);
        const result={distance:route.distance,duration:route.duration,coordinates,fetchedAt:now(),source:'FOSSGIS · OSRM foot / OpenStreetMap'};
        if(cache.size>=30)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
      }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
    };
    const task=queue.then(run);queue=task.catch(()=>{});return task;
  }};
}

// Convert a unique local bus arrival to an instant before adding walking time.
// Round the ETA up to the next minute, including a possible new civil day.
export function walkingEventArrival(day,time,duration){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time)||!Number.isFinite(duration)||duration<0||duration>7200)return null;
  const local=Date.parse(day+'T'+time+'Z');if(!Number.isFinite(local)||new Date(local).toISOString().slice(0,10)!==day)return null;
  const format=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const parts=value=>Object.fromEntries(format.formatToParts(new Date(value)).map(part=>[part.type,part.value]));
  const candidates=[60,120].map(offset=>local-offset*60000).filter(value=>{const p=parts(value);return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':'+p.second===day+'T'+time;});
  if(candidates.length!==1)return null;
  const timestamp=Math.ceil((candidates[0]+duration*1000)/60000)*60000,p=parts(timestamp);
  return {timestamp,day:p.year+'-'+p.month+'-'+p.day,time:p.hour+':'+p.minute};
}
