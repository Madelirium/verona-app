export function parseBusRoute(elements,relationId,{collectedAt,timetableDirections=[]}={}){
  const lookup=new Map(elements.map(element=>[element.type+'/'+element.id,element]));
  const route=lookup.get('relation/'+relationId),tags=route?.tags||{};
  if(tags.route!=='bus'||tags.ref!=='11'||tags.operator!=='ATV'||!tags.from||!tags.to)throw Error('Relazione diversa dalla linea 11 ATV');
  const position=node=>{if(!node||!Number.isFinite(node.lat)||!Number.isFinite(node.lon)||node.lat<44.5||node.lat>46.3||node.lon<10||node.lon>12)throw Error('Posizione mancante o fuori area');return [node.lat,node.lon];};
  const segments=[],stops=[];
  for(const member of route.members){
    const element=lookup.get(member.type+'/'+member.ref);
    if(member.role==='platform'){
      if(member.type!=='node')throw Error('Tipo di fermata da verificare');
      const [lat,lon]=position(element);
      stops.push({id:'node/'+element.id,name:element.tags?.name||'Fermata senza nome',ref:element.tags?.ref||null,lat,lon,sourceUrl:'https://www.openstreetmap.org/node/'+element.id});
    }else if(member.type==='way'&&['','forward','backward'].includes(member.role)){
      if(!element?.nodes?.length)throw Error('Geometria incompleta');
      const coordinates=element.nodes.map(id=>position(lookup.get('node/'+id)));
      if(coordinates.length>1)segments.push(coordinates);
    }
  }
  if(!segments.length||stops.length<2)throw Error('Percorso o fermate insufficienti');
  const outbound=tags.to==='San Michele';
  const direction=timetableDirections.find(value=>outbound?value.startsWith('(Bussolengo) - Chievo'):value.startsWith('S.Michele Nord'));
  if(!direction)throw Error('Direzione ATV da verificare');
  // Solo nomi identici e univoci; niente geocodifica o corrispondenze approssimative.
  const counts=new Map();for(const stop of stops)counts.set(stop.name,(counts.get(stop.name)||0)+1);
  for(const stop of stops)stop.timetableCandidate=counts.get(stop.name)===1;
  return {id:String(relationId),lineId:'atv-urban-11',number:'11',from:tags.from,to:tags.to,label:tags.from+' → '+tags.to,sourceUrl:'https://www.openstreetmap.org/relation/'+relationId,sourceModifiedAt:route.timestamp,collectedAt,timetableDirection:direction,segments,stops};
}

export function validateBusRoutes(data){
  if(!Array.isArray(data.routes))throw Error('Catalogo percorsi non valido');
  const ids=new Set();
  for(const route of data.routes){
    if(ids.has(route.id)||route.lineId!=='atv-urban-11'||route.number!=='11'||!route.timetableDirection||new URL(route.sourceUrl).origin!=='https://www.openstreetmap.org')throw Error('Identità percorso non valida');ids.add(route.id);
    const valid=point=>Array.isArray(point)&&point.length===2&&Number.isFinite(point[0])&&Number.isFinite(point[1])&&point[0]>=44.5&&point[0]<=46.3&&point[1]>=10&&point[1]<=12;
    if(!route.segments.length||route.segments.some(segment=>segment.length<2||segment.some(point=>!valid(point))))throw Error('Geometria percorso non valida');
    if(route.stops.length<2||route.stops.some(stop=>!valid([stop.lat,stop.lon])||!stop.name))throw Error('Fermata mappa non valida');
  }
  return data.routes.length;
}
