// External directions: no origin, location request or route calculation in Verona.
let directionsEvent=null,directionsFocus=null;
function mapsEventDay(event){const first=eventDay(event.startsAt),last=eventDay(event.endsAt);return typeof selected!=='undefined'&&['calendar','eventmap'].includes(view)&&selected>=first&&selected<=last?selected:today>=first&&today<=last?today:first;}
function appendEventTravel(content,event){
  if(eventPosition(event,mapsEventDay(event)))return;
  const section=el('section','','event-bus-entry');section.append(el('h3','Come arrivare'),el('p','Il punto sulla mappa non è confermato per questa giornata. Verifica la sede nel programma ufficiale.','detail-note'));content.append(section);
}
function openEventTravel(event){openEventDirections(event);}
function defaultMapsUrl(point,device={}){
  const coords=point.lat+','+point.lon,destination=encodeURIComponent(coords),google='https://www.google.com/maps/dir/?api=1&destination='+destination;
  if(/Android/i.test(device.userAgent||''))return 'intent:0,0?q='+destination+'#Intent;scheme=geo;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url='+encodeURIComponent(google)+';end';
  if(/iPhone|iPad|iPod/i.test(device.userAgent||'')||(device.platform==='MacIntel'&&device.maxTouchPoints>1))return 'https://maps.apple.com/?daddr='+destination;
  return google;
}
function configureEventDirections(event){
  const point=eventPosition(event,mapsEventDay(event)),button=$('detail-travel');button.hidden=!point;if(!point)return;
  const url=defaultMapsUrl(point,typeof navigator==='undefined'?{}:navigator);
  button.onclick=()=>{if(url.startsWith('intent:'))window.location.assign(url);else window.open(url,'_blank','noopener,noreferrer');};
}
function openEventDirections(event){
  const day=mapsEventDay(event),point=eventPosition(event,day);if(!point)return;
  directionsEvent=event;directionsFocus=document.activeElement;
  $('directions-name').textContent=event.title;
  const venue=typeof eventVenueForDay==='function'?eventVenueForDay(event,day):event;
  $('directions-place').textContent=venue.location||event.location||'Sede dell’evento';
  const destination=encodeURIComponent(point.lat+','+point.lon);
  $('directions-google').href='https://www.google.com/maps/dir/?api=1&destination='+destination;
  $('directions-apple').href='https://maps.apple.com/?daddr='+destination;
  $('directions-status').textContent='Se le mappe del dispositivo non si aprono, puoi usare uno di questi collegamenti.';
  $('directions-dialog').showModal();$('directions-google').focus();
}
$('directions-close').onclick=()=>$('directions-dialog').close();
$('directions-dialog').addEventListener('close',()=>{directionsEvent=null;if(directionsFocus?.isConnected)directionsFocus.focus();});

// A ready-made cycling map; no route engine, location request or data importer.
let cycleMap=null,cycleTiles=null,cycleFocus=null,cycleTileError=false;
function openCycleMap(){
  if(!$('cycle-dialog').open){cycleFocus=document.activeElement;$('cycle-dialog').showModal();$('cycle-close').focus();}
  $('cycle-status').textContent='Caricamento mappa ciclabile…';
  $('cycle-retry').hidden=true;
  if(typeof L==='undefined'){$('cycle-status').textContent='Mappa non disponibile. Controlla la connessione o apri la mappa completa.';$('cycle-retry').hidden=false;return;}
  if(!cycleMap){
    cycleMap=L.map('cycle-map').setView([45.4384,10.9916],14);
    cycleTiles=L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',{maxZoom:20,attribution:'<a href="https://www.cyclosm.org/" target="_blank" rel="noopener noreferrer">CyclOSM</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'});
    cycleTiles.on('loading',()=>{cycleTileError=false;$('cycle-status').textContent='Caricamento mappa ciclabile…';});
    cycleTiles.on('tileerror',()=>{cycleTileError=true;$('cycle-retry').hidden=false;$('cycle-status').textContent='Alcune parti della mappa non si caricano. Riprova o apri la mappa completa.';});
    cycleTiles.on('load',()=>{if(!cycleTileError){$('cycle-status').textContent='Mappa ciclabile · CyclOSM / OpenStreetMap';$('cycle-retry').hidden=true;}});
    cycleTiles.addTo(cycleMap);
  }else if(!cycleTileError)$('cycle-status').textContent='Mappa ciclabile · CyclOSM / OpenStreetMap';
  else{$('cycle-retry').hidden=false;$('cycle-status').textContent='Alcune parti della mappa non si caricano. Riprova o apri la mappa completa.';}
  cycleMap.invalidateSize();
}
$('utilities-cycle').onclick=openCycleMap;
$('cycle-retry').onclick=()=>{if(!cycleMap){openCycleMap();return;}cycleTileError=false;cycleTiles.redraw();};
$('cycle-reset').onclick=()=>cycleMap?.setView([45.4384,10.9916],14);
$('cycle-close').onclick=()=>$('cycle-dialog').close();
$('cycle-dialog').addEventListener('close',()=>{if(cycleFocus?.isConnected)cycleFocus.focus();});
