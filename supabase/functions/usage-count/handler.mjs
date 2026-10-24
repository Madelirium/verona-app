export const sections=new Set(['home','discover','calendar','saved','news','bus','explore','eventmap','district','games']);
export const actions=new Set(['view','event_open','event_saved','event_participation','news_open','bus_timetable_open','bus_journey_open','travel_open','pharmacies_open','waste_open','parking_open','weather_open']);
const origins=new Set(['https://veronaintasca.it','https://www.veronaintasca.it']);

// Public project key authentication is not bot protection: no per-person keys or IP storage.
export function createHandler({publishableKeys,record}){
  return async request=>{
    const origin=request.headers.get('origin');
    const headers={'Cache-Control':'no-store','Vary':'Origin'};
    const respond=status=>new Response(null,{status,headers});
    if(!origins.has(origin))return respond(403);
    Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type, apikey','Access-Control-Max-Age':'600'});
    if(request.method==='OPTIONS')return respond(204);
    if(request.method!=='POST')return respond(405);
    if(!publishableKeys?.length)return respond(503);
    if(!publishableKeys.includes(request.headers.get('apikey')))return respond(401);
    if(request.headers.get('dnt')==='1'||request.headers.get('sec-gpc')==='1')return respond(204);
    if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return respond(415);
    if(Number(request.headers.get('content-length'))>160)return respond(413);
    try{
      // Read at most 160 bytes, including chunked requests; do not log the body or headers.
      const reader=request.body?.getReader();if(!reader)return respond(400);
      let size=0;const chunks=[];
      while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>160){await reader.cancel();return respond(413);}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      let data;try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{return respond(400);}
      if(!data||Array.isArray(data)||Object.keys(data).length!==2||!sections.has(data.section)||!actions.has(data.action))return respond(400);
      return respond(await record(data.section,data.action)?204:429);
    }catch{return respond(503);}
  };
}
