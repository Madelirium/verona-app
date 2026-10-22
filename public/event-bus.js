let eventBusStops=null,eventBusStopsLoad=null,eventBusEvent=null,eventBusRequest=0,eventBusFocus=null,eventBusMap=null,eventBusLayer=null;
let eventBusRouteGroups=[],eventBusSelectedLine='',eventBusFitFull=false,eventBusCurrent=null;
const eventBusPalette=['#245f9e','#b13c45','#397348','#7950a0','#a96711','#007d80','#b23c77','#5c6684'];
function busDistance(a,b){const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlon=(b.lon-a.lon)*rad,h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
function nearbyBusStops(index,point,day,{radius=800,limit=3}={}){
  const dateIndex=index.days.indexOf(day);
  return index.stops.map(stop=>({...stop,distance:busDistance(point,stop),knownDate:dateIndex>=0,lines:stop.services.filter(([,bits])=>dateIndex<0||bits[dateIndex]==='1').map(([number])=>number)})).filter(stop=>stop.distance<=radius).sort((a,b)=>a.distance-b.distance||a.code.localeCompare(b.code)).slice(0,limit);
}
async function loadEventBusStops(){
  if(eventBusStops)return eventBusStops;
  if(!eventBusStopsLoad)eventBusStopsLoad=(async()=>{const response=await fetch(officialBus.stopIndexAsset);if(!response.ok)throw Error('HTTP '+response.status);const index=await response.json();if(index.sha256!==officialBus.sha256||!Array.isArray(index.stops)||!Array.isArray(index.days))throw Error('Indice non coerente');eventBusStops=index;return index;})().catch(error=>{eventBusStopsLoad=null;throw error;});
  return eventBusStopsLoad;
}
function appendEventBus(content,event){
  const section=el('section','','event-bus-entry');section.append(el('h3','Come arrivare in autobus'));
  if(!eventPosition(event)){section.append(el('p','La posizione dell’evento non è abbastanza precisa per suggerire una fermata.','detail-note'));}
  else if(!officialBus.stopIndexAsset){section.append(el('p','Fermate vicine non disponibili in questa raccolta.','detail-note'));}
  else{const button=el('button','Fermate e autobus vicini','dialog-save');button.onclick=()=>openEventBus(event);section.append(button,el('p','Fino a 3 fermate entro 800 m · distanza in linea d’aria.','detail-note'));}
  content.append(section);
}
function openEventBus(event,{date:chosenDay}={}){
  if(!eventPosition(event))return;eventBusFocus=document.activeElement;eventBusEvent=event;
  $('event-bus-title').textContent='Autobus per l’evento';$('event-bus-name').textContent=event.title;
  const date=$('event-bus-date');date.min=eventDay(event.startsAt);date.max=eventDay(event.endsAt);date.value=chosenDay>=date.min&&chosenDay<=date.max?chosenDay:today>=date.min&&today<=date.max?today:date.min;
  if(typeof travelModeButtons==='function'){$('event-bus-travel-modes').hidden=false;travelModeButtons($('event-bus-travel-modes'),'bus');travelEvent=event;}
  if(!$('event-bus-dialog').open)$('event-bus-dialog').showModal();return renderEventBus();
}
function matchingEventBusRoutes(routes,stops,number){
  const codes=new Set(stops.filter(stop=>stop.lines.includes(number)).map(stop=>stop.code));
  return routes.filter(route=>route.stops.some(stop=>codes.has(String(stop.ref))));
}
async function loadEventRouteLine(number){
  const ids=[...new Set(busRouteData.routes.filter(route=>route.number===number).map(route=>route.lineId))];
  if(!ids.length)return [];
  for(const id of ids){
    if(busRouteData.routes.filter(route=>route.lineId===id).every(route=>Array.isArray(route.stops)&&Array.isArray(route.segments)))continue;
    if(!/^atv-(urban|holiday|evening)-[0-9]+$/.test(id))throw Error('Linea inattesa');
    if(!busRouteLoads.has(id))busRouteLoads.set(id,(async()=>{
      const response=await fetch((busRouteData.assetBase||'bus-routes/')+id+'.json');if(!response.ok)throw Error('HTTP '+response.status);
      const data=await response.json();if(!Array.isArray(data.routes)||!data.routes.length||data.routes.some(route=>route.lineId!==id||route.number!==number||!Array.isArray(route.stops)||!Array.isArray(route.segments)))throw Error('Tracciato non valido');
      busRouteData.routes=busRouteData.routes.filter(route=>route.lineId!==id).concat(data.routes);
    })().catch(error=>{busRouteLoads.delete(id);throw error;}));
    await busRouteLoads.get(id);
  }
  return busRouteData.routes.filter(route=>route.number===number);
}
async function loadEventRouteGroups(stops){
  const available=new Set(busRouteData.routes.map(route=>route.number));
  const numbers=[...new Set(stops.flatMap(stop=>stop.lines))].sort((a,b)=>Number(available.has(b))-Number(available.has(a))).slice(0,8);
  return Promise.all(numbers.map(async(number,i)=>{
    try{const all=await loadEventRouteLine(number),routes=matchingEventBusRoutes(all,stops,number);return {number,color:eventBusPalette[i%eventBusPalette.length],routes,status:routes.length?'ready':all.length?'unmatched':'missing'};}
    catch{return {number,color:eventBusPalette[i%eventBusPalette.length],routes:[],status:'error'};}
  }));
}
function renderEventBusLegend(){
  const legend=$('event-bus-line-legend');legend.replaceChildren();
  const all=el('button','Tutte le linee');all.setAttribute('aria-pressed',String(!eventBusSelectedLine));all.onclick=()=>{eventBusSelectedLine='';renderEventBusLegend();drawEventBusMap(eventBusCurrent.point,eventBusCurrent.stops);};legend.append(all);
  for(const group of eventBusRouteGroups){const button=el('button','','event-bus-line-toggle'),swatch=el('span','','event-bus-line-swatch');swatch.style.backgroundColor=group.color;button.append(swatch,el('span','Linea '+group.number));button.style.borderColor=group.color;button.setAttribute('aria-pressed',String(eventBusSelectedLine===group.number));button.setAttribute('aria-label','Mostra linea '+group.number+(group.status==='ready'?'':' · tracciato non disponibile'));button.onclick=()=>{eventBusSelectedLine=eventBusSelectedLine===group.number?'':group.number;renderEventBusLegend();drawEventBusMap(eventBusCurrent.point,eventBusCurrent.stops);};legend.append(button);}
  const missing=eventBusRouteGroups.filter(group=>group.status!=='ready');
  $('event-bus-route-status').textContent=eventBusRouteGroups.length?(missing.length?'Tracciato non disponibile per '+missing.map(group=>group.number).join(', ')+'. Fermate e orari restano consultabili. ':'')+'Fino a 8 linee vicine · percorsi OSM indicativi. Varianti e deviazioni vanno verificate con ATV.':'Nessuna linea con partenze programmate alle fermate vicine nella data scelta.';
  if(missing.some(group=>group.status==='error')){const retry=el('button','Riprova i percorsi');retry.onclick=()=>renderEventBus();legend.append(retry);}
  $('event-bus-full-routes').disabled=!eventBusRouteGroups.some(group=>group.routes.length);$('event-bus-full-routes').textContent=eventBusFitFull?'Vicino all’evento':'Percorsi completi';
}
function eventStopPopup(stop,numbers){
  const popup=el('div','','bus-map-stop');popup.append(el('strong',stop.name),el('small','Fermata '+(stop.code||stop.ref||'senza codice')));
  const day=$('event-bus-date').value;for(const number of numbers){const button=el('button','Orari linea '+number);button.onclick=()=>openOfficialBus(number,{stopCode:String(stop.code||stop.ref||''),date:day});popup.append(button);}return popup;
}
function drawEventBusMap(point,stops){
  const box=$('event-bus-map');if(typeof L==='undefined'){box.hidden=true;return;}
  box.hidden=false;
  if(!eventBusMap){eventBusMap=L.map('event-bus-map',{preferCanvas:true}).setView([point.lat,point.lon],16);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{$('event-bus-map-note').textContent='Le strade non si caricano: fermate e orari restano disponibili nell’elenco.';}).addTo(eventBusMap);eventBusLayer=L.layerGroup().addTo(eventBusMap);}
  eventBusMap.invalidateSize();eventBusLayer.clearLayers();
  const groups=eventBusRouteGroups.filter(group=>!eventBusSelectedLine||group.number===eventBusSelectedLine),routeStops=new Map(),bounds=[[point.lat,point.lon]];
  for(const group of groups)for(const route of group.routes){
    L.polyline(route.segments,{color:'#fff',weight:7,opacity:.8}).addTo(eventBusLayer);L.polyline(route.segments,{color:group.color,weight:4,opacity:.88}).bindPopup(el('strong','Linea '+group.number+' · '+route.label)).addTo(eventBusLayer);
    for(const segment of route.segments)bounds.push(...segment);
    for(const stop of route.stops){const key=stop.ref||stop.id;if(!routeStops.has(key))routeStops.set(key,{...stop,numbers:new Set(),color:group.color});routeStops.get(key).numbers.add(group.number);}
  }
  for(const stop of routeStops.values())L.circleMarker([stop.lat,stop.lon],{radius:4,color:stop.color,weight:2,fillColor:'#fff',fillOpacity:1}).bindPopup(eventStopPopup(stop,[...stop.numbers]),{maxWidth:260,maxHeight:180}).addTo(eventBusLayer);
  for(const stop of stops){const numbers=stop.lines.filter(number=>groups.some(group=>group.number===number));if(eventBusRouteGroups.length&&!numbers.length)continue;const color=groups.find(group=>numbers.includes(group.number))?.color||'#254f78';L.circleMarker([stop.lat,stop.lon],{radius:8,color,fillColor:'#fff',fillOpacity:1,weight:3}).bindPopup(eventStopPopup(stop,numbers),{maxWidth:260,maxHeight:180}).addTo(eventBusLayer);}
  const title=el('div','','event-destination-popup');title.append(el('strong',eventBusEvent.title),el('small','Luogo dell’evento'));
  if(typeof L.marker==='function'&&typeof L.divIcon==='function')L.marker([point.lat,point.lon],{icon:L.divIcon({className:'event-destination-icon',html:'<span class="event-destination-star">★</span><span class="event-destination-label">Evento</span>',iconSize:[58,56],iconAnchor:[29,28]}),zIndexOffset:1000,title:eventBusEvent.title,alt:'Luogo dell’evento'}).bindPopup(title).addTo(eventBusLayer);
  else L.circleMarker([point.lat,point.lon],{radius:14,color:'#fff',weight:4,fillColor:'#b47a13',fillOpacity:1}).bindPopup(title).addTo(eventBusLayer);
  eventBusMap.fitBounds(eventBusFitFull&&groups.some(group=>group.routes.length)?bounds:[[point.lat,point.lon],...stops.map(stop=>[stop.lat,stop.lon])],{padding:[30,30],maxZoom:16});installMapLocation(eventBusMap,'event-bus');
}
async function renderEventBus(){
  eventBusRouteGroups=[];eventBusSelectedLine='';eventBusFitFull=false;$('event-bus-line-legend').replaceChildren();$('event-bus-route-status').textContent='';$('event-bus-full-routes').disabled=true;
  const request=++eventBusRequest,event=eventBusEvent,day=$('event-bus-date').value,point=eventPosition(event),list=$('event-bus-stops');list.replaceChildren();$('event-bus-map').hidden=true;$('event-bus-map-note').textContent='';$('event-bus-status').textContent='Cerco le fermate vicine…';
  if(!day||day<eventDay(event.startsAt)||day>eventDay(event.endsAt)){$('event-bus-status').textContent='Scegli una data compresa nella durata dell’evento.';return;}
  try{
    const index=await loadEventBusStops();if(request!==eventBusRequest||!$('event-bus-dialog').open)return;
    const stops=nearbyBusStops(index,point,day),mapStops=nearbyBusStops(index,point,day,{limit:Infinity}),valid=index.days.includes(day);
    $('event-bus-status').textContent=stops.length?stops.length+' fermate entro 800 m · '+formatDay(day,{day:'numeric',month:'long'}):'Nessuna fermata nell’archivio entro 800 m. Verifica altre soluzioni per raggiungere l’evento.';
    $('event-bus-validity').textContent=(valid?'Linee con partenze programmate nella data scelta.':'La data è fuori dalla validità dell’archivio: le linee elencate non confermano il servizio per quel giorno.')+' Archivio ATV valido dal '+formatDay(index.validFrom,{day:'numeric',month:'short'})+' al '+formatDay(index.validTo,{day:'numeric',month:'short',year:'numeric'})+'. Orari senza ritardi in tempo reale.';
    for(const stop of stops){const card=el('article','','nearby-bus-stop');card.append(el('h3',stop.name),el('p','Fermata '+stop.code+' · circa '+Math.round(stop.distance/10)*10+' m in linea d’aria'));
      if(!stop.lines.length)card.append(el('p','Nessuna partenza programmata da questa fermata nella data scelta.'));
      const actions=el('div','','nearby-bus-lines');for(const number of stop.lines.sort((a,b)=>a.localeCompare(b,'it',{numeric:true}))){const button=el('button','Linea '+number+' · Orari');button.onclick=()=>openOfficialBus(number,{stopCode:stop.code,date:day});actions.append(button);}card.append(actions);
      const walk=el('a','A piedi dalla fermata all’evento ↗','bus-secondary-link');walk.href='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(stop.lat+','+stop.lon)+'&destination='+encodeURIComponent(point.lat+','+point.lon)+'&travelmode=walking';walk.target='_blank';walk.rel='noopener noreferrer';card.append(walk);list.append(card);
    }
    eventBusCurrent={point,stops:mapStops};drawEventBusMap(point,mapStops);
    $('event-bus-route-status').textContent='Caricamento dei percorsi delle linee…';
    const groups=await loadEventRouteGroups(mapStops);if(request!==eventBusRequest||!$('event-bus-dialog').open)return;eventBusRouteGroups=groups;renderEventBusLegend();drawEventBusMap(point,mapStops);
  }catch{if(request!==eventBusRequest||!$('event-bus-dialog').open)return;$('event-bus-status').textContent='Fermate temporaneamente non disponibili. Puoi riprovare.';const retry=el('button','Riprova','dialog-save');retry.onclick=renderEventBus;list.append(retry);}
}
$('close-event-bus').onclick=()=>$('event-bus-dialog').close();
$('event-bus-date').onchange=renderEventBus;
$('event-bus-dialog').addEventListener('close',()=>{eventBusRequest++;if(eventBusFocus?.isConnected)eventBusFocus.focus();});

$('event-bus-full-routes').onclick=()=>{if(!eventBusCurrent)return;eventBusFitFull=!eventBusFitFull;renderEventBusLegend();drawEventBusMap(eventBusCurrent.point,eventBusCurrent.stops);};
