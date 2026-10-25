// Scheduled stop calls and indicative OSM geometry remain separate sources.
let connectionMap=null,connectionLayer=null,connectionVersion=0,connectionChoice=null;
function clearEventConnectionMap(){
  ++connectionVersion;connectionChoice=null;connectionMap?.remove();connectionMap=null;connectionLayer=null;$('event-connection-panel').hidden=true;
}
function connectionRouteMatches(route,result){
  const stops=route.stops||[],start=stops.findIndex(s=>String(s.ref)===String(result.origin.code));
  return start>=0&&stops.some((s,i)=>i>start&&String(s.ref)===String(result.arrival.code));
}
async function selectEventConnection(result,state,assets){
  const version=++connectionVersion,active=()=>version===connectionVersion&&eventDirectState===state&&$('event-direct-dialog').open;
  connectionChoice=result;
  for(const card of $('event-direct-results').children){const selected=card.connectionResult===result;card.classList.toggle('connection-selected',selected);if(card.connectionButton){card.connectionButton.setAttribute('aria-pressed',String(selected));card.connectionButton.textContent=(selected?'✓ ':'')+'Linea '+card.connectionResult.number+' · '+card.connectionResult.row.time.slice(0,5);}}
  if(typeof L==='undefined'){$('event-connection-status').textContent='Mappa non disponibile. Fermate e orari sono nelle proposte.';return;}
  const point=eventPosition(state.event,state.day);if(!point)return;
  $('event-connection-panel').hidden=false;$('event-connection-map').hidden=false;$('event-connection-toggle').textContent='Riduci mappa';$('event-connection-toggle').setAttribute('aria-expanded','true');
  $('event-connection-label').textContent='Linea '+result.number+' · '+result.row.time.slice(0,5)+' → '+result.arrivalTime.slice(0,5);
  try{
    if(!connectionMap){connectionMap=L.map('event-connection-map',{preferCanvas:true});connectionMap.zoomControl.setPosition('bottomleft');L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{if(active())$('event-connection-status').textContent='Sfondo non disponibile. Usa le fermate e gli orari nell’elenco.';}).addTo(connectionMap);connectionLayer=L.layerGroup().addTo(connectionMap);}
    connectionLayer.clearLayers();connectionMap.invalidateSize();
    const bounds=[[point.lat,point.lon],[result.origin.lat,result.origin.lon],[result.arrival.lat,result.arrival.lon]],asset=assets.find(a=>a.number===result.number),calls=asset?busTripTimeline(asset,result.row).slice(0,result.arrivalOrder-result.row.order+1):[];
    for(const call of calls){const stop=asset.stops[call.code];if(!stop||!Number.isFinite(stop.lat)||!Number.isFinite(stop.lon))continue;const popup=el('div');popup.append(el('strong',call.time.slice(0,5)+' · '+busDisplayName(call.name)),el('small',formatDay(call.day,{day:'numeric',month:'short'})));L.circleMarker([stop.lat,stop.lon],{radius:4,color:'#254f78',fillColor:'#fff',fillOpacity:1,weight:2}).bindPopup(popup).addTo(connectionLayer);}
    for(const [stop,label,color]of [[result.origin,'Sali alle '+result.row.time.slice(0,5),'#254f78'],[result.arrival,'Scendi alle '+result.arrivalTime.slice(0,5),'#397348']]){const popup=el('div');popup.append(el('strong',label),el('p',busDisplayName(stop.name)));L.circleMarker([stop.lat,stop.lon],{radius:8,color:'#fff',weight:3,fillColor:color,fillOpacity:1}).bindPopup(popup).addTo(connectionLayer);}
    const eventPopup=el('strong',state.event.title);
    if(typeof L.marker==='function'&&typeof L.divIcon==='function')L.marker([point.lat,point.lon],{icon:L.divIcon({className:'event-destination-icon',html:'<span class="event-destination-star">★</span><span class="event-destination-label">Evento</span>',iconSize:[58,56],iconAnchor:[29,28]}),title:state.event.title,alt:'Luogo dell’evento',zIndexOffset:1000}).bindPopup(eventPopup).addTo(connectionLayer);
    else L.circleMarker([point.lat,point.lon],{radius:12,color:'#fff',weight:3,fillColor:'#b13c45',fillOpacity:1}).bindPopup(eventPopup).addTo(connectionLayer);
    if(state.startPoint){L.circleMarker([state.startPoint.lat,state.startPoint.lon],{radius:6,color:'#254f78',fillColor:'#fff',fillOpacity:1}).bindPopup(el('strong','Punto di partenza')).addTo(connectionLayer);bounds.push([state.startPoint.lat,state.startPoint.lon]);}
    connectionMap.fitBounds(bounds,{padding:[25,25],maxZoom:16});$('event-connection-status').textContent='Fermate e orari programmati ATV · cerco il tracciato…';
    let routes=[];try{routes=await loadEventRouteLine(result.number);}catch{}
    if(!active())return;
    const route=routes.find(r=>connectionRouteMatches(r,result));
    if(route&&Array.isArray(route.segments)){L.polyline(route.segments,{color:'#254f78',weight:5,opacity:.65}).bindPopup(el('strong','Linea '+result.number+' · tracciato OSM indicativo')).addTo(connectionLayer);$('event-connection-status').textContent='Orari ATV · linea blu: tracciato OSM indicativo, varianti da verificare.';}
    else $('event-connection-status').textContent='Orari ATV · tracciato non verificato per questa direzione. Mostro le fermate.';
  }catch{if(active()){$('event-connection-panel').hidden=true;$('event-direct-status').textContent+=' Mappa non disponibile: puoi usare le proposte.';}}
}
$('event-connection-toggle').onclick=()=>{const map=$('event-connection-map');map.hidden=!map.hidden;$('event-connection-toggle').setAttribute('aria-expanded',String(!map.hidden));$('event-connection-toggle').textContent=map.hidden?'Mostra mappa':'Riduci mappa';if(!map.hidden)connectionMap?.invalidateSize();};
$('event-direct-dialog').addEventListener('close',()=>{if(!$('event-direct-dialog').open)clearEventConnectionMap();});
