export function matchTimetableDirection(stops,blocks){
  const counts=new Map();for(const stop of stops)counts.set(stop.name,(counts.get(stop.name)||0)+1);
  const candidates=[];
  for(const direction of new Set(blocks.map(block=>block.direction))){
    const rows=blocks.find(block=>block.direction===direction).stops,names=rows.map(stop=>stop.name);
    const ordered=stops.filter(stop=>counts.get(stop.name)===1&&names.filter(name=>name===stop.name).length===1).map(stop=>names.indexOf(stop.name)).filter(index=>index>=0);
    if(ordered.length<3)continue;let correct=0,total=0;for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length;j++){total++;if(ordered[j]>ordered[i])correct++;}
    candidates.push({direction,sharedStops:ordered.length,orderAgreement:correct/total});
  }
  candidates.sort((a,b)=>b.orderAgreement-a.orderAgreement||b.sharedStops-a.sharedStops);
  const best=candidates[0];return best&&best.orderAgreement>=.9&&(!candidates[1]||candidates[1].orderAgreement<=.6)?best:null;
}
export function parseBusRoute(elements,relationId,{collectedAt,timetableDirections=[],timetableBlocks=[],number='11',lineId='atv-urban-11',allowUnmatchedDirection=false}={}){
  const lookup=new Map(elements.map(element=>[element.type+'/'+element.id,element]));
  const route=lookup.get('relation/'+relationId),tags=route?.tags||{};
  if(tags.route!=='bus'||tags.ref!==number||!['ATV','Azienda Trasporti Verona'].includes(tags.operator)||!tags.from||!tags.to)throw Error('Relazione diversa dalla linea ATV richiesta');
  const position=node=>{if(!node||!Number.isFinite(node.lat)||!Number.isFinite(node.lon)||node.lat<44.5||node.lat>46.3||node.lon<10||node.lon>12)throw Error('Posizione mancante o fuori area');return [node.lat,node.lon];};
  const segments=[],stops=[],platforms=route.members.some(member=>member.role.startsWith('platform'));
  for(const member of route.members){
    const element=lookup.get(member.type+'/'+member.ref),isStop=platforms?['platform','platform_entry_only','platform_exit_only'].includes(member.role):['stop','stop_entry_only','stop_exit_only','forward_stop','backward_stop'].includes(member.role);
    if(isStop){
      let point,positionKind='source-node';if(member.type==='node')point=position(element);else if(member.type==='way'&&element?.nodes?.length){const points=element.nodes.map(id=>position(lookup.get('node/'+id)));point=[(Math.min(...points.map(p=>p[0]))+Math.max(...points.map(p=>p[0])))/2,(Math.min(...points.map(p=>p[1]))+Math.max(...points.map(p=>p[1])))/2];positionKind='platform-area';}else throw Error('Tipo di fermata da verificare');
      const [lat,lon]=point;stops.push({id:member.type+'/'+element.id,name:element.tags?.name||'Fermata senza nome',ref:element.tags?.ref||null,lat,lon,positionKind,sourceUrl:'https://www.openstreetmap.org/'+member.type+'/'+element.id});
    }else if(member.type==='way'&&['','forward','backward'].includes(member.role)){
      if(!element?.nodes?.length)throw Error('Geometria incompleta');const coordinates=element.nodes.map(id=>position(lookup.get('node/'+id)));if(coordinates.length>1)segments.push(coordinates);
    }
  }
  if(!segments.length||stops.length<2)throw Error('Percorso o fermate insufficienti');
  let direction=null,match=null;
  if(number==='11')direction=timetableDirections.find(value=>tags.to==='San Michele'?value.startsWith('(Bussolengo) - Chievo'):value.startsWith('S.Michele Nord'))||null;
  if(!direction){match=matchTimetableDirection(stops,timetableBlocks);direction=match?.direction||null;}
  if(!direction&&!allowUnmatchedDirection)throw Error('Direzione ATV da verificare');
  const counts=new Map();for(const stop of stops)counts.set(stop.name,(counts.get(stop.name)||0)+1);for(const stop of stops)stop.timetableCandidate=counts.get(stop.name)===1&&stop.positionKind!=='platform-area';
  return {id:String(relationId),lineId,number,from:tags.from,to:tags.to,label:tags.from+' → '+tags.to,sourceUrl:'https://www.openstreetmap.org/relation/'+relationId,sourceModifiedAt:route.timestamp,collectedAt,timetableDirection:direction,directionMatch:match?{method:'unique-exact-names-and-order',...match}:direction?{method:'reviewed-line-11'}:null,segments,stops};
}
export function validateBusRoutes(data){
  if(!Array.isArray(data.routes))throw Error('Catalogo percorsi non valido');const ids=new Set();
  for(const route of data.routes){const identity=route.lineId+'/'+route.id;
    if(ids.has(identity)||!/^atv-(urban|holiday|evening)-[0-9]+$/.test(route.lineId)||route.lineId.split('-').at(-1)!==route.number||!(route.timetableDirection===null||typeof route.timetableDirection==='string'&&route.timetableDirection)||new URL(route.sourceUrl).origin!=='https://www.openstreetmap.org')throw Error('Identità percorso non valida');ids.add(identity);
    const valid=point=>Array.isArray(point)&&point.length===2&&Number.isFinite(point[0])&&Number.isFinite(point[1])&&point[0]>=44.5&&point[0]<=46.3&&point[1]>=10&&point[1]<=12;
    if(!route.segments.length||route.segments.some(segment=>segment.length<2||segment.some(point=>!valid(point))))throw Error('Geometria percorso non valida');
    if(route.stops.length<2||route.stops.some(stop=>!valid([stop.lat,stop.lon])||!stop.name))throw Error('Fermata mappa non valida');
  }return data.routes.length;
}
