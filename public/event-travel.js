// I tre mezzi condividono evento e punto di ritorno, riutilizzando le mappe esistenti.
let travelEvent=null,travelFocus=null,travelMap=null,travelDay='',travelWalkId=null,travelUnified=false,travelMode='walk';
function eventTravelDay(event){
  const first=eventDay(event.startsAt),last=eventDay(event.endsAt);
  return travelEvent?.id===event.id&&travelDay>=first&&travelDay<=last?travelDay:typeof selected!=='undefined'&&['calendar','eventmap'].includes(view)&&selected>=first&&selected<=last?selected:today>=first&&today<=last?today:first;
}
function eventTravelWhen(event,day=eventTravelDay(event)){
  if(typeof eventVenueForDay==='function'){const occurrence=eventVenueForDay(event,day);if(occurrence.startsAt?.length>10&&occurrence.endsAt?.length>10&&eventDay(occurrence.startsAt)===day&&eventDay(occurrence.endsAt)===day)return 'Evento: '+eventWhen({...event,startsAt:occurrence.startsAt,endsAt:occurrence.endsAt});}
  return eventDay(event.startsAt)===eventDay(event.endsAt)?'Evento: '+eventWhen(event):'Giorno scelto: '+formatDay(day,{weekday:'short',day:'numeric',month:'short',year:'numeric'})+' · Verifica gli orari nel programma.';
}
function appendEventTravel(content,event){
  const section=el('section','','event-bus-entry');
  if(!eventPosition(event,eventTravelDay(event))){section.append(el('h3','Come arrivare'),el('p',event.location?'Indirizzo disponibile; punto sulla mappa ancora da confermare per questo giorno. Verifica la sede nel programma ufficiale.':'Il luogo non è abbastanza preciso per suggerire fermate o parcheggi. Verifica la sede nel programma ufficiale.','detail-note'));}
  else{const button=el('button','Come arrivare','dialog-save');button.onclick=()=>openEventTravel(event);section.append(button,el('p','Autobus, parcheggi e indicazioni a piedi','detail-note'));}
  content.append(section);
}
function travelModeButtons(container,mode){
  container.replaceChildren();
  for(const [key,label]of [['bus','Autobus'],['car','Auto'],['walk','A piedi']]){
    const button=el('button',label);button.type='button';button.setAttribute('aria-pressed',String(key===mode));button.onclick=()=>switchEventTravel(key);container.append(button);
  }
}
function openEventTravel(event){
  if(!eventPosition(event,eventTravelDay(event)))return;
  if(travelEvent?.id!==event.id)travelDay=eventTravelDay(event);
  travelEvent=event;travelFocus=document.activeElement;travelUnified=typeof openEventBusPlanner==='function';return switchEventTravel('walk');
}
function renderUnifiedTravel(mode){
  const event=travelEvent,day=eventTravelDay(event),point=eventPosition(event,day);if(!point)return;
  if($('event-bus-dialog').open)$('event-bus-dialog').close();
  if($('parking-dialog').open)$('parking-dialog').close();
  travelMode=mode;travelWalkId=event.id;
  $('event-travel-title').textContent='Come raggiungerci';travelModeButtons($('event-travel-modes'),mode);
  $('event-travel-name').textContent=event.title;$('event-travel-when').textContent=eventTravelWhen(event,day);
  $('event-travel-place').textContent='📍 '+((typeof eventVenueForDay==='function'?eventVenueForDay(event,day).location:event.location)||'Luogo dell’evento');
  const link=$('event-travel-walk');link.hidden=mode==='bus';link.href='https://www.google.com/maps/dir/?api=1&travelmode='+(mode==='car'?'driving':'walking')+'&destination='+point.lat+','+point.lon;link.textContent=mode==='car'?'🚗 Apri Google Maps':'🚶 Apri Google Maps';
  $('event-travel-parking').hidden=mode!=='car';$('event-travel-bus-start').hidden=mode!=='bus';
  $('event-travel-short-note').textContent=mode==='bus'?'Scegli la partenza e confronta gli autobus.':'Percorso e navigazione si aprono in Google Maps.';
  if(!$('event-travel-dialog').open)$('event-travel-dialog').showModal();
  if(!travelMap){drawTravelMap(point,event);}else{travelMap.remove();travelMap=null;drawTravelMap(point,event);}
  $('event-travel-close').focus();
}
function switchEventTravel(mode){
  const event=travelEvent,point=event&&eventPosition(event,eventTravelDay(event));if(!point||!['bus','car','walk'].includes(mode))return;
  if(travelUnified){const unchanged=travelMode===mode&&travelWalkId===event.id&&$('event-travel-dialog').open;if(unchanged)return;renderUnifiedTravel(mode);if(mode==='bus')return openEventBusPlanner(event);return;}
  const activeId={bus:'event-bus-dialog',car:'parking-dialog',walk:'event-travel-dialog'}[mode];
  if($(activeId).open&&(mode==='bus'?eventBusEvent?.id===event.id:mode==='car'?parkingEvent?.id===event.id:travelWalkId===event.id))return;
  if($('event-bus-dialog').open){if(eventBusEvent?.id===event.id)travelDay=$('event-bus-date').value;$('event-bus-dialog').close();}
  if($('parking-dialog').open)$('parking-dialog').close();
  if($('event-travel-dialog').open){travelMap?.remove();travelMap=null;$('event-travel-dialog').close();}
  for(const [id,key]of [['event-travel-modes','walk'],['event-bus-travel-modes','bus'],['parking-travel-modes','car']]){travelModeButtons($(id),key);$(id).hidden=false;}
  if(mode==='bus'){
    const pending=openEventBus(event,{date:travelDay});eventBusFocus=travelFocus;$('event-bus-scroll').scrollTop=0;$('close-event-bus').focus();return pending;
  }
  if(mode==='car'){openEventParking(event);parkingFocus=travelFocus;return;}
  travelWalkId=event.id;$('event-travel-name').textContent=event.title;$('event-travel-when').textContent=eventTravelWhen(event);$('event-travel-place').textContent=(typeof eventVenueForDay==='function'?eventVenueForDay(event,eventTravelDay(event)).location:event.location)||'Luogo indicato dall’evento';
  const link=$('event-travel-walk');link.href='https://www.google.com/maps/dir/?api=1&travelmode=walking&destination='+point.lat+','+point.lon;
  $('event-travel-dialog').showModal();$('event-travel-close').focus();drawTravelMap(point,event);
}
function drawTravelMap(point,event){
  const note=$('event-travel-map-note');note.textContent=travelUnified?'':'Il punto indica la sede dell’evento. Il tragitto si apre in Google Maps.';
  $('event-travel-map').hidden=typeof L==='undefined';
  if(typeof L==='undefined'){note.textContent='Mappa non disponibile. Puoi comunque aprire le indicazioni a piedi.';return;}
  try{
    travelMap=L.map('event-travel-map').setView([point.lat,point.lon],16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{note.textContent='Sfondo non disponibile: le indicazioni a piedi restano accessibili.';}).addTo(travelMap);
    L.circleMarker([point.lat,point.lon],{radius:12,color:'#fff',weight:3,fillColor:'#254f78',fillOpacity:1}).bindPopup(el('strong','★ '+event.title)).addTo(travelMap);travelMap.invalidateSize();
  }catch{travelMap?.remove();travelMap=null;$('event-travel-map').hidden=true;note.textContent='Mappa non disponibile. Puoi comunque aprire le indicazioni a piedi.';}
}
$('event-travel-close').onclick=()=>$('event-travel-dialog').close();
$('event-travel-parking').onclick=()=>{if(travelEvent)openEventParking(travelEvent);};
$('event-travel-bus-start').onclick=()=>{if(travelEvent)return openEventBusPlanner(travelEvent);};
$('event-travel-dialog').addEventListener('close',()=>{if($('event-travel-dialog').open)return;travelMap?.remove();travelMap=null;if(travelFocus?.isConnected)travelFocus.focus();});
