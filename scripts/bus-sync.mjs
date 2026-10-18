import {busSources,busFeed,decodeAtv,parseBusLines,parseBusUpdates} from './bus.mjs';

async function request(url){
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'VeronaLocal/0.2 (+https://github.com/Madelirium/verona-app)'}});
      if(response.ok)return decodeAtv(new Uint8Array(await response.arrayBuffer()),response.headers.get('content-type')||'');
      if(response.status!==429&&response.status<500)throw Error(`HTTP ${response.status}: ${url}`);
      if(attempt===2)throw Error(`HTTP ${response.status}: ${url}`);
    }catch(error){if(attempt===2||/^HTTP 4/.test(error.message))throw error;}
    await new Promise(resolve=>setTimeout(resolve,(attempt+1)*1000));
  }
}

export async function collectBus({previous={lines:[],alerts:[],sources:[]},checkedAt=new Date().toISOString(),get=request}={}){
  const data={updatedAt:previous.updatedAt||null,checkedAt,status:'ok',lines:[],alerts:[],updates:[],sources:[],scope:'Schede urbane feriali, serali e festive di Verona. Orari nei PDF ufficiali; nessun dato di arrivo in tempo reale.',extraurbanUrl:'https://www.atv.verona.it/orari_linee_bus_extraurbani',portalUrl:'https://www.mycicero.it/atv-vr/TPWebPortal/it/timetable/stops'};
  function lastSuccess(key,rows){return previous.sources?.find(s=>s.key===key)?.lastSuccessAt||rows.map(row=>row.checkedAt).filter(Boolean).sort().at(-1)||null;}
  for(const source of busSources){
    const old=(previous.lines||[]).filter(line=>line.service===source.key);
    try{
      const rows=parseBusLines(await get(source.url),source,checkedAt);
      if(old.length>=5&&rows.length<old.length*.3)throw Error('Calo superiore al 70%: verificare la fonte prima di sostituire le linee');
      data.lines.push(...rows);data.sources.push({key:source.key,status:'ok',count:rows.length,lastSuccessAt:checkedAt});
    }catch(error){data.lines.push(...old);data.sources.push({key:source.key,status:'error',error:error.message,retained:old.length,lastSuccessAt:lastSuccess(source.key,old)});}
  }
  const oldUpdates=previous.updates||previous.alerts||[];
  try{
    data.updates=parseBusUpdates(await get(busFeed),checkedAt);
    if(!data.updates.length)throw Error('Feed vuoto: verificare prima di sostituire le pubblicazioni');
    data.alerts=data.updates.filter(item=>item.serviceAlert);data.sources.push({key:'rss',status:'ok',count:data.updates.length,alerts:data.alerts.length,lastSuccessAt:checkedAt});
  }catch(error){data.updates=oldUpdates;data.alerts=previous.alerts||[];data.sources.push({key:'rss',status:'error',error:error.message,retained:oldUpdates.length,lastSuccessAt:lastSuccess('rss',oldUpdates)});}
  const succeeded=data.sources.filter(s=>s.status==='ok').length;
  data.status=succeeded===4?'ok':succeeded?'partial':'error';if(succeeded)data.updatedAt=checkedAt;
  data.lines.sort((a,b)=>a.number.localeCompare(b.number,'it',{numeric:true})||a.service.localeCompare(b.service));
  return data;
}
