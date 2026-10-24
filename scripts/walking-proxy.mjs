// Optional pedestrian proxy. Never expose the provider key or log route coordinates.
export function createWalkingHandler({key='',allowedOrigins=['https://veronaintasca.it'],fetchRoute=globalThis.fetch,now=()=>Date.now(),dailyLimit=500}={}){
  const cache=new Map();let last=-Infinity,windowStart=now(),used=0;
  const distance=(a,b)=>{const r=Math.PI/180,h=Math.sin((b.lat-a.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lon-a.lon)*r/2)**2;return 12742000*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));};
  const point=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat>=44.5&&p.lat<=46.3&&p.lon>=10&&p.lon<=12;
  return async(req,res)=>{
    if(new URL(req.url,'http://localhost').pathname!=='/api/walking-route')return false;
    const origin=req.headers.origin,allowed=allowedOrigins.includes(origin);
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(allowed?{'Access-Control-Allow-Origin':origin}:{}),...(status===429?{'Retry-After':'2'}:{})});res.end(JSON.stringify(data));};
    if(!allowed){send(403,{error:'Origine non autorizzata.'});return true;}
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'});res.end();return true;}
    if(req.method!=='POST'){send(405,{error:'Metodo non consentito.'});return true;}
    if(!key){send(503,{error:'Servizio pedonale non configurato.'});return true;}
    if(!String(req.headers['content-type']||'').startsWith('application/json')){send(415,{error:'Formato non consentito.'});return true;}
    try{
      let body='';for await(const part of req){body+=part;if(Buffer.byteLength(body)>1024){send(413,{error:'Richiesta troppo grande.'});return true;}}
      let data;try{data=JSON.parse(body);}catch{send(400,{error:'Richiesta non valida.'});return true;}
      const {start,end}=data||{};if(!point(start)||!point(end)||distance(start,end)>2000){send(400,{error:'Percorso fuori dall’area o troppo lungo.'});return true;}
      const id=[start.lon,start.lat,end.lon,end.lat].join(','),saved=cache.get(id);
      if(saved&&now()-saved.at<900000){send(200,saved.data);return true;}
      if(now()-windowStart>=86400000){windowStart=now();used=0;}
      if(now()-last<1550||used>=dailyLimit){send(429,{error:'Limite del servizio raggiunto. Riprova più tardi.'});return true;}
      last=now();used++;
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);let response;
      try{response=await fetchRoute('https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson',{method:'POST',headers:{Authorization:key,'Content-Type':'application/json'},body:JSON.stringify({coordinates:[[start.lon,start.lat],[end.lon,end.lat]],instructions:false,radiuses:[40,40]}),signal:controller.signal});
        if(!response.ok){send(response.status===429?429:502,{error:'Fornitore pedonale temporaneamente non disponibile.'});return true;}
        const text=await response.text();if(text.length>1000000)throw Error('Large response');const upstream=JSON.parse(text),feature=upstream.features?.[0],geometry=feature?.geometry,summary=feature?.properties?.summary,coords=geometry?.coordinates;
        if(geometry?.type!=='LineString'||!Array.isArray(coords)||coords.length<2||coords.length>5000||coords.some(p=>!Array.isArray(p)||!point({lat:p[1],lon:p[0]}))||!Number.isFinite(summary?.distance)||summary.distance<0||summary.distance>10000||!Number.isFinite(summary.duration)||summary.duration<0||summary.duration>7200)throw Error('Invalid route');
        const snaps=[distance(start,{lon:coords[0][0],lat:coords[0][1]}),distance(end,{lon:coords.at(-1)[0],lat:coords.at(-1)[1]})];if(snaps.some(d=>d>40))throw Error('Distant snap');
        const normalized={code:'Ok',routes:[{distance:summary.distance,duration:summary.duration,geometry}],waypoints:snaps.map(distance=>({distance})),source:'openrouteservice / HeiGIT · OpenStreetMap'};
        if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(id,{at:now(),data:normalized});send(200,normalized);
      }finally{clearTimeout(timer);}
    }catch{send(502,{error:'Calcolo pedonale non disponibile. Riprova.'});}
    return true;
  };
}
