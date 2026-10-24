let eventWalkingState=null,eventWalkingFocus=null,eventWalkingMap=null,eventWalkingVersion=0,eventWalkingController=null;
const eventWalkingClient=createWalkingClient();
function appendWalkingPreview(container,event,result,{day,before=''}={}){
  if(!walkingPreviewAvailable(typeof location==='undefined'?null:location))return;
  const button=el('button','Percorso a piedi','dialog-save');button.type='button';button.onclick=()=>openEventWalking(event,result,{day,before});container.append(button);
}
function openEventWalking(event,result,{day,before=''}){
  if(!walkingPreviewAvailable(typeof location==='undefined'?null:location)||!eventPosition(event))return;
  eventWalkingController?.abort();eventWalkingFocus=document.activeElement;eventWalkingState={event,result,day,before};
  $('event-walking-event').textContent=event.title;
  $('event-walking-bus').textContent='Linea '+result.number+' · '+busDisplayName(result.arrival.name)+' '+result.arrivalTime.slice(0,5)+' · '+formatDay(day,{day:'numeric',month:'short'});
  const point=eventPosition(event),link=$('event-walking-external');link.href='https://www.google.com/maps/dir/?api=1&travelmode=walking&origin='+result.arrival.lat+','+result.arrival.lon+'&destination='+point.lat+','+point.lon;
  $('event-walking-dialog').showModal();$('event-walking-close').focus();return loadEventWalking();
}
async function loadEventWalking(){
  const state=eventWalkingState;if(!state)return;const {event,result,day,before}=state,version=++eventWalkingVersion;
  eventWalkingController?.abort();const controller=new AbortController();eventWalkingController=controller;
  const valid=()=>version===eventWalkingVersion&&$('event-walking-dialog').open;
  eventWalkingMap?.remove();eventWalkingMap=null;$('event-walking-map').hidden=true;$('event-walking-summary').replaceChildren();$('event-walking-notes').replaceChildren();$('event-walking-retry').hidden=true;
  $('event-walking-status').textContent='Calcolo il percorso pedonale…';
  try{
    const point=eventPosition(event),route=await eventWalkingClient.load(result.arrival,point,{signal:controller.signal});if(!valid())return;
    const minutes=Math.max(1,Math.ceil(route.duration/60)),summary=$('event-walking-summary');
    summary.append(el('p',Math.round(route.distance)+' m sul percorso pedonale · circa '+minutes+' min a piedi.','event-walking-distance'));
    summary.append(el('p',result.duration+' min in autobus + circa '+minutes+' min a piedi · totale stimato '+Math.ceil(result.duration+route.duration/60)+' min dalla salita.'));
    const eta=walkingEventArrival(day,result.arrivalTime,route.duration);
    if(eta){
      summary.append(el('p','Arrivo stimato nei pressi dell’evento: '+eta.time+(eta.day!==day?' del '+formatDay(eta.day,{day:'numeric',month:'short'}):''),'event-walking-eta'));
      if(event.startsAt.length>10&&eventDay(event.startsAt)===day&&Number.isFinite(Date.parse(event.startsAt)))$('event-walking-notes').append(el('p',eta.timestamp<=Date.parse(event.startsAt)?'La stima precede l’inizio dell’evento. Prevedi comunque un margine.':'La stima è successiva all’inizio dell’evento.','event-direct-note'));
    }else summary.append(el('p','Orario finale non calcolabile con certezza: verifica data e cambio d’ora.','event-direct-note'));
    if(before)$('event-walking-notes').append(el('p','La ricerca prevedeva l’arrivo alla fermata entro le '+before+'. La camminata si aggiunge a quell’orario.','event-direct-note'));
    $('event-walking-notes').append(el('p','Calcolato il '+formatDay(dayInRome(new Date(route.fetchedAt)),{day:'numeric',month:'short'})+' · '+route.source,'event-direct-note'));
    $('event-walking-status').textContent='Fermata blu · evento rosso. Percorso stimato.';
    if(typeof L!=='undefined'){
      try{
        const box=$('event-walking-map');box.hidden=false;eventWalkingMap=L.map('event-walking-map');eventWalkingMap.zoomControl.setPosition('bottomleft');
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{if(valid())$('event-walking-status').textContent='Sfondo della mappa non disponibile: distanza e tempi restano consultabili.';}).addTo(eventWalkingMap);
        const line=L.polyline(route.coordinates.map(([lon,lat])=>[lat,lon]),{color:'#254f78',weight:5}).addTo(eventWalkingMap);
        L.circleMarker([result.arrival.lat,result.arrival.lon],{radius:8,color:'#254f78',fillOpacity:1}).bindPopup(el('strong','Fermata: '+busDisplayName(result.arrival.name))).addTo(eventWalkingMap);
        L.circleMarker([point.lat,point.lon],{radius:10,color:'#b13c45',fillOpacity:1}).bindPopup(el('strong','Evento: '+event.title)).addTo(eventWalkingMap);
        const bounds=line.getBounds();bounds.extend([result.arrival.lat,result.arrival.lon]);bounds.extend([point.lat,point.lon]);eventWalkingMap.fitBounds(bounds,{padding:[25,25],maxZoom:18});eventWalkingMap.invalidateSize();
      }catch{eventWalkingMap?.remove();eventWalkingMap=null;$('event-walking-map').hidden=true;$('event-walking-status').textContent='Mappa non disponibile: distanza e tempi del percorso restano consultabili.';}
    }else $('event-walking-status').textContent='Mappa non disponibile: distanza e tempi del percorso restano consultabili.';
  }catch(error){if(!valid())return;$('event-walking-status').textContent='Percorso non disponibile. Puoi riprovare oppure aprire Google Maps.';$('event-walking-retry').hidden=false;}
}
$('event-walking-close').onclick=()=>$('event-walking-dialog').close();
$('event-walking-retry').onclick=loadEventWalking;
$('event-walking-dialog').addEventListener('close',()=>{if($('event-walking-dialog').open)return;++eventWalkingVersion;eventWalkingController?.abort();eventWalkingController=null;eventWalkingMap?.remove();eventWalkingMap=null;eventWalkingState=null;if(eventWalkingFocus?.isConnected)eventWalkingFocus.focus();});
