// I tre mezzi condividono evento e punto di ritorno, riutilizzando le mappe esistenti.
let travelEvent=null,travelFocus=null,travelMap=null,travelDay='';
function appendEventTravel(content,event){
  const section=el('section','','event-bus-entry');
  if(!eventPosition(event)){section.append(el('h3','Come arrivare'),el('p','Il luogo non è abbastanza preciso per suggerire fermate o parcheggi. Verifica la sede nel programma ufficiale.','detail-note'));}
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
  if(!eventPosition(event))return;
  travelEvent=event;travelFocus=document.activeElement;travelDay='';return switchEventTravel('walk');
}
function switchEventTravel(mode){
  const event=travelEvent,point=event&&eventPosition(event);if(!point||!['bus','car','walk'].includes(mode))return;
  if($('event-bus-dialog').open){travelDay=$('event-bus-date').value;$('event-bus-dialog').close();}
  if($('parking-dialog').open)$('parking-dialog').close();
  if($('event-travel-dialog').open)$('event-travel-dialog').close();
  for(const [id,key]of [['event-travel-modes','walk'],['event-bus-travel-modes','bus'],['parking-travel-modes','car']]){travelModeButtons($(id),key);$(id).hidden=false;}
  if(mode==='bus'){
    const pending=openEventBus(event,{date:travelDay});eventBusFocus=travelFocus;$('event-bus-scroll').scrollTop=0;$('close-event-bus').focus();return pending;
  }
  if(mode==='car'){openEventParking(event);parkingFocus=travelFocus;return;}
  $('event-travel-name').textContent=event.title;$('event-travel-place').textContent=event.location||'Luogo indicato dall’evento';
  const link=$('event-travel-walk');link.href='https://www.google.com/maps/dir/?api=1&travelmode=walking&destination='+point.lat+','+point.lon;
  $('event-travel-dialog').showModal();$('event-travel-close').focus();drawTravelMap(point,event);
}
function drawTravelMap(point,event){
  const note=$('event-travel-map-note');note.textContent='Il punto indica la sede dell’evento. Il tragitto si apre in Google Maps.';
  $('event-travel-map').hidden=typeof L==='undefined';
  if(typeof L==='undefined'){note.textContent='Mappa non disponibile. Puoi comunque aprire le indicazioni a piedi.';return;}
  try{
    travelMap=L.map('event-travel-map').setView([point.lat,point.lon],16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{note.textContent='Sfondo non disponibile: le indicazioni a piedi restano accessibili.';}).addTo(travelMap);
    L.circleMarker([point.lat,point.lon],{radius:12,color:'#fff',weight:3,fillColor:'#254f78',fillOpacity:1}).bindPopup(el('strong','★ '+event.title)).addTo(travelMap);travelMap.invalidateSize();
  }catch{travelMap?.remove();travelMap=null;$('event-travel-map').hidden=true;note.textContent='Mappa non disponibile. Puoi comunque aprire le indicazioni a piedi.';}
}
$('event-travel-close').onclick=()=>$('event-travel-dialog').close();
$('event-travel-dialog').addEventListener('close',()=>{travelMap?.remove();travelMap=null;if(travelFocus?.isConnected)travelFocus.focus();});
