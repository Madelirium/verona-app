// The comparison holds the visitor origin only in memory for this open panel.
let travelEvent=null,travelFocus=null,travelMap=null,travelDay='',travelMode='walk',travelState=null,travelVersion=0,travelLocationVersion=0;
const travelRouteClient=createTravelRouteClient();
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
  for(const [key,label]of [['bus','Autobus'],['car','Auto'],['walk','A piedi']]){const b=el('button',label);b.type='button';b.setAttribute('aria-pressed',String(key===mode));b.onclick=()=>switchEventTravel(key);container.append(b);}
}
function travelActive(state){return state===travelState&&$('event-travel-dialog').open;}
function travelAbort(){++travelVersion;travelState?.controller?.abort();}
function travelClock(instant){return new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(instant));}
function travelMinutes(seconds){return Math.max(0,Math.ceil(seconds/60))+' min';}
function travelArrivalClock(instant){const value=Math.ceil(instant/60000)*60000,day=dayInRome(new Date(value));return travelClock(value)+(travelState&&day!==travelState.day?' del '+formatDay(day,{day:'numeric',month:'short'}):'');}
function travelSetStatus(text){$('event-travel-status').textContent=text;}
function travelInputs(){
  const state=travelState;if(!state)return null;
  const day=$('event-travel-date').value,time=$('event-travel-time').value;
  if(!$('event-travel-date').checkValidity()||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Scegli giorno e ora di partenza validi.');
  const departure=walkingEventArrival(day,time+':00',0);if(!departure)throw Error('Quest’ora non è univoca nel cambio dell’ora. Scegli un altro orario.');
  if(departure.timestamp<Date.now()-60000)throw Error('La partenza è già trascorsa. Scegli un orario futuro.');
  const end=eventPosition(state.event,day);if(!end)throw Error('La sede non è confermata per il giorno scelto.');
  return {day,time,departureAt:Math.max(Date.now(),departure.timestamp),end};
}
function openEventTravel(event){
  const day=eventTravelDay(event),end=eventPosition(event,day);if(!end)return;
  travelAbort();++travelLocationVersion;travelEvent=event;travelDay=day;travelMode='walk';travelFocus=document.activeElement;
  travelState={event,day,end,start:null,label:'',results:{},controller:null,picking:false,timeEdited:false};
  $('event-travel-name').textContent=event.title;$('event-travel-when').textContent=eventTravelWhen(event,day);
  $('event-travel-place').textContent='Destinazione: '+(typeof eventVenueForDay==='function'?eventVenueForDay(event,day).location:event.location);
  const date=$('event-travel-date');date.min=eventDay(event.startsAt);date.max=eventDay(event.endsAt);date.value=day;
  const occurrence=typeof eventVenueForDay==='function'?eventVenueForDay(event,day):event;
  const todayDay=dayInRome(new Date()),known=occurrence.startsAt?.length>10&&eventDay(occurrence.startsAt)===day;
  const beforeStart=known?Date.parse(occurrence.startsAt)-3600000:null;
  $('event-travel-time').value=day===todayDay?travelClock(Math.ceil(Date.now()/60000)*60000):known?(dayInRome(new Date(beforeStart))===day?travelClock(beforeStart):'00:00'):'09:00';
  $('event-travel-origin-search').value='';$('event-travel-origin-results').replaceChildren();$('event-travel-origin-options').open=false;
  $('event-travel-locate').disabled=false;$('event-travel-origin-label').textContent='Cerco la tua posizione…';$('event-travel-retry').hidden=true;
  if(!$('event-travel-dialog').open)$('event-travel-dialog').showModal();
  renderTravelChoices();drawTravelMap(end,event);$('event-travel-close').focus();locateEventTravel();
}
function switchEventTravel(mode){
  if(!travelEvent||!['bus','car','walk'].includes(mode))return;
  if(!travelState||travelState.event.id!==travelEvent.id||!$('event-travel-dialog').open)openEventTravel(travelEvent);
  travelMode=mode;renderTravelChoices();drawTravelMap(travelState.end,travelEvent);
}
function renderTravelChoices(){
  const state=travelState;if(!state)return;const focused=document.activeElement?.closest('.travel-option')?.dataset.mode,list=$('event-travel-modes');list.replaceChildren();
  for(const [mode,label,icon]of [['bus','Autobus','🚌'],['car','Auto','🚗'],['walk','A piedi','🚶']]){
    const result=state.results[mode],button=el('button','','travel-option');button.type='button';button.dataset.mode=mode;button.setAttribute('aria-pressed',String(mode===travelMode));
    const heading=el('span','','travel-option-heading');heading.append(el('span',icon+' '+label),el('strong',result?.duration!==undefined?travelMinutes(result.duration):result?.error?'Non disponibile':state.inputError?'Da ricalcolare':state.start?'Calcolo…':'Da calcolare'));button.append(heading);
    const description=result?.error||(!state.start?'Scegli il punto di partenza.':!result?(state.inputError?'Correggi giorno e ora di partenza.':'Sto cercando il percorso.'):mode==='bus'?'Linea '+result.row.number+' · parti a piedi alle '+travelClock(result.row.assessment.leaveAt)+' · arrivo '+travelArrivalClock(result.row.assessment.venueAt):parkingDistance(result.route.distance)+(result.parking?' fino a '+result.parking.name+' + '+travelMinutes(result.finalWalk.duration)+' a piedi':'')+' · arrivo '+travelArrivalClock(state.departureAt+result.duration*1000));
    button.append(el('span',description,'travel-option-summary'));
    if(result&&!result.error)button.append(el('small',mode==='bus'?'Attesa e tratti a piedi inclusi · senza cambi'+(result.incomplete?' · ricerca parziale':''):mode==='car'?(result.parking?'Auto + camminata · traffico e ricerca posto esclusi':'Stima senza traffico · parcheggio escluso'):'Percorso pedonale calcolato'));
    button.onclick=()=>{travelMode=mode;renderTravelChoices();drawTravelMap(state.end,state.event);};list.append(button);
  }
  if(focused)list.querySelector('[data-mode="'+focused+'"]')?.focus({preventScroll:true});
  const current=state.results[travelMode],link=$('event-travel-walk');link.hidden=travelMode==='bus';
  const url=new URL('https://www.google.com/maps/dir/');url.searchParams.set('api','1');url.searchParams.set('travelmode',travelMode==='car'?'driving':'walking');const target=travelMode==='car'&&current?.parking?current.parking:state.end;url.searchParams.set('destination',target.lat+','+target.lon);if(state.start)url.searchParams.set('origin',state.start.lat+','+state.start.lon);
  link.href=url.href;link.textContent=travelMode==='car'?(current?.parking?'Naviga al parcheggio ↗':'Naviga in auto ↗'):'Naviga a piedi ↗';
  $('event-travel-parking').hidden=travelMode!=='car';$('event-travel-bus-start').hidden=travelMode!=='bus';$('event-travel-bus-start').textContent=current?.row?'Vedi viaggio in autobus':'Ricerca autobus e altri orari';
  $('event-travel-bus-details').replaceChildren();
  if(travelMode==='bus'&&current?.row){const row=current.row;$('event-travel-bus-details').append(el('p','Sali alle '+row.row.time.slice(0,5)+' a '+busDisplayName(row.origin.name)+'. Scendi alle '+row.arrivalTime.slice(0,5)+' a '+busDisplayName(row.arrival.name)+'.'),el('p','A piedi: '+travelMinutes(row.startWalk.duration)+' fino alla fermata e '+travelMinutes(row.endWalk.duration)+' fino alla sede.','detail-note'));}
}
function locateEventTravel(){
  const state=travelState;if(!state)return;travelAbort();const id=++travelLocationVersion;
  const active=()=>id===travelLocationVersion&&travelActive(state);
  const fail=error=>{if(!active())return;$('event-travel-locate').disabled=false;travelSetStatus(error?.code===1?'Posizione non autorizzata. Scegli una partenza qui sotto.':error?.code===3?'La posizione non arriva. Riprova o scegli la partenza.':'Posizione non disponibile. Scegli la partenza.');$('event-travel-origin-label').textContent=state.start?state.label:'Partenza da scegliere';$('event-travel-origin-options').open=!state.start;};
  if(!globalThis.isSecureContext||!navigator.geolocation){fail({code:2});return;}
  $('event-travel-locate').disabled=true;travelSetStatus('Attendo la posizione dal dispositivo…');
  try{navigator.geolocation.getCurrentPosition(position=>{
    if(!active())return;const {latitude:lat,longitude:lon,accuracy}=position.coords||{};$('event-travel-locate').disabled=false;
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||!Number.isFinite(accuracy)||accuracy>2000||accuracy<0){fail({code:2});return;}
    setTravelOrigin({lat,lon},accuracy>200?'La mia posizione (approssimativa)':'La mia posizione');
  },fail,{enableHighAccuracy:true,timeout:12000,maximumAge:60000});}catch{fail({code:2});}
}
function setTravelOrigin(point,label){
  if(!travelState)return;++travelLocationVersion;travelState.start=point;travelState.label=label;travelState.picking=false;
  $('event-travel-locate').disabled=false;$('event-travel-origin-label').textContent=label;$('event-travel-origin-options').open=false;$('event-travel-pick').textContent='Scegli sulla mappa';
  return calculateEventTravel();
}
async function calculateEventTravel(){
  const state=travelState;if(!state?.start)return;travelAbort();if(!state.timeEdited&&$('event-travel-date').value===dayInRome(new Date()))$('event-travel-time').value=travelClock(Math.ceil(Date.now()/60000)*60000);let input;
  try{input=travelInputs();}catch(error){state.results={};state.inputError=error.message;renderTravelChoices();$('event-travel-map-note').textContent='';travelMap?.remove();travelMap=null;$('event-travel-map').hidden=true;travelSetStatus(error.message);return;}
  Object.assign(state,input);travelDay=input.day;state.results={};state.inputError='';state.controller=new AbortController();const version=travelVersion,signal=state.controller.signal,active=()=>travelActive(state)&&version===travelVersion;
  $('event-travel-when').textContent=eventTravelWhen(state.event,state.day);$('event-travel-place').textContent='Destinazione: '+(typeof eventVenueForDay==='function'?eventVenueForDay(state.event,state.day).location:state.event.location);
  $('event-travel-retry').hidden=true;travelSetStatus('Confronto i tre percorsi…');renderTravelChoices();drawTravelMap(state.end,state.event);
  const road=async mode=>{try{const result=mode==='car'?await calculateTravelCar(state,{signal}):await travelRouteClient.load(state.start,state.end,{mode,signal}).then(route=>({route,duration:route.duration}));if(active())state.results[mode]=result;}catch(error){if(active())state.results[mode]={error:error.message||'Percorso non disponibile.'};}if(active()){renderTravelChoices();if(travelMode===mode)drawTravelMap(state.end,state.event);}};
  const bus=async()=>{try{const result=await calculateTravelBus(state,{signal,active});if(active())state.results.bus=result;}catch(error){if(active())state.results.bus={error:error.message||'Ricerca autobus non disponibile.'};}if(active()){renderTravelChoices();if(travelMode==='bus')drawTravelMap(state.end,state.event);}};
  await Promise.allSettled([road('walk'),road('car'),bus()]);if(!active())return;
  travelSetStatus('Percorsi confrontati per il '+formatDay(state.day,{day:'numeric',month:'short'})+' alle '+$('event-travel-time').value+'.');$('event-travel-retry').hidden=false;
}
async function calculateTravelCar(state,{signal}){
  const parking=nearbyParking(state.event).slice(0,2);
  if(!parking.length){const route=await travelRouteClient.load(state.start,state.end,{mode:'car',signal});return {route,duration:route.duration};}
  for(const place of parking){try{const route=await travelRouteClient.load(state.start,place,{mode:'car',signal}),finalWalk=await travelRouteClient.load(place,state.end,{signal});return {route,finalWalk,parking:place,duration:route.duration+finalWalk.duration};}catch(error){if(signal.aborted)throw error;}}
  throw Error('Percorso ai parcheggi vicini non disponibile. Apri i parcheggi o riprova.');
}
async function calculateTravelBus(state,{signal,active}){
  const index=await loadEventBusStops();if(!active())throw Error('Calcolo annullato.');
  if(!officialBus.alightingAvailable||!index.days.includes(state.day))return {error:'Il giorno scelto non è coperto dagli orari ATV disponibili.'};
  const origins=nearbyBusStops(index,state.start,state.day,{radius:2000,limit:8,withService:true});if(!origins.length)return {error:'Nessuna fermata disponibile entro 2 km dalla partenza.'};
  const targetNumbers=new Set(nearbyBusStops(index,state.end,state.day,{radius:2000,limit:Infinity,withService:true}).flatMap(s=>s.lines));
  const dayIndex=index.days.indexOf(state.day),allNumbers=[...new Set(origins.flatMap(stop=>stop.services.filter(([,bits])=>[0,1,2].some(offset=>dayIndex>=offset&&bits[dayIndex-offset]==='1')).map(([n])=>n)))].filter(n=>targetNumbers.has(n)&&officialBus.lines.some(line=>line.number===n)),numbers=allNumbers.slice(0,12),assets=[],failed=[];let next=0;
  await Promise.all(Array.from({length:Math.min(3,numbers.length)},async()=>{while(next<numbers.length){if(!active())return;const n=numbers[next++];try{assets.push(await getOfficialBusLine(n));}catch{failed.push(n);}}}));
  if(!active())throw Error('Calcolo annullato.');
  const after=state.time,raw=origins.flatMap(origin=>directBusTrips(assets,{origin:origin.code,point:state.end,day:state.day,after,notBeforeSeconds:eventDirectNow(state.day),allowOvernight:true,allTargets:true,radius:2000,limit:120}));
  const candidates=bestEventConnections(raw,state.start,false).sort((a,b)=>(a.departureSeconds+busDistance(a.arrival,state.end)/1.4)-(b.departureSeconds+busDistance(b.arrival,state.end)/1.4));
  const pairs=[...new Map(candidates.map(row=>[row.origin.code+'|'+row.arrival.code,row])).values()].slice(0,4),checked=[];let incomplete=Boolean(failed.length)||allNumbers.length>numbers.length;
  for(const pair of pairs){
    if(!active())throw Error('Calcolo annullato.');
    try{const startWalk=await travelRouteClient.load(state.start,pair.origin,{signal}),endWalk=await travelRouteClient.load(pair.arrival,state.end,{signal});checked.push(...candidates.filter(row=>row.origin.code===pair.origin.code&&row.arrival.code===pair.arrival.code).map(row=>({...row,startWalk,endWalk})));}catch{incomplete=true;}
  }
  if(!active())throw Error('Calcolo annullato.');
  const rows=rankTravelBusTrips(checked,{day:state.day,departureAt:state.departureAt,assess:eventTripAssessment});
  if(!rows.length)return {error:incomplete?'Ricerca incompleta: alcune linee o camminate non sono disponibili. Riprova o apri la ricerca autobus.':'Nessun collegamento diretto compatibile nei limiti della ricerca. Potrebbero esserci viaggi con cambi.'};
  const row=rows[0];return {row,assets,duration:Math.ceil((row.assessment.venueAt-state.departureAt)/1000),incomplete};
}
function drawTravelMap(point,event){
  travelMap?.remove();travelMap=null;const state=travelState,note=$('event-travel-map-note');$('event-travel-map').hidden=typeof L==='undefined';
  if(typeof L==='undefined'){note.textContent='Mappa non disponibile; tempi e indicazioni restano consultabili.';return;}
  try{
    const map=travelMap=L.map('event-travel-map').setView([point.lat,point.lon],14);map.zoomControl.setPosition('bottomleft');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
    const bounds=[[point.lat,point.lon]];L.circleMarker(bounds[0],{radius:9,color:'#fff',weight:3,fillColor:'#ba503e',fillOpacity:1}).bindPopup(el('strong',event.title)).addTo(map);
    if(state?.start){bounds.push([state.start.lat,state.start.lon]);L.circleMarker(bounds[1],{radius:8,color:'#fff',weight:3,fillColor:'#254f78',fillOpacity:1}).bindPopup(el('strong',state.label)).addTo(map);}
    const result=state?.results[travelMode],line=(coords,options={})=>{const points=coords.map(c=>[c[1],c[0]]);bounds.push(...points);L.polyline(points,{color:'#254f78',weight:5,...options}).addTo(map);};
    if(result?.route)line(result.route.coordinates);if(result?.finalWalk){line(result.finalWalk.coordinates,{dashArray:'5 6'});L.circleMarker([result.parking.lat,result.parking.lon],{radius:7,color:'#ad7433',fillOpacity:1}).bindPopup(el('strong','Parcheggio '+result.parking.name)).addTo(map);}
    if(result?.row){line(result.row.startWalk.coordinates,{dashArray:'5 6'});line(result.row.endWalk.coordinates,{dashArray:'5 6'});const row=result.row,data=result.assets.find(a=>a.number===row.number),trip=data?.trips.find(t=>t.id===row.row.trip);if(trip){const points=trip.calls.slice(row.row.order,row.arrivalOrder+1).map(c=>data.stops[c[0]]).filter(p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lon));if(points.length>1)line(points.map(p=>[p.lon,p.lat]),{color:'#ad7433',weight:4});}}
    if(bounds.length>1)map.fitBounds(bounds,{padding:[18,18],maxZoom:16});
    note.textContent=state?.picking?'Tocca la mappa per impostare la partenza.':result?.row?'Blu: tratti a piedi · ocra: collegamento indicativo tra le fermate ATV.':result?.parking?'Blu: auto · tratteggiato: camminata dal parcheggio · rosso: evento.':result?.route?'Blu: percorso calcolato · rosso: evento.':'Blu: partenza · rosso: evento.';
    map.on('click',e=>{if(travelState?.picking)setTravelOrigin({lat:e.latlng.lat,lon:e.latlng.lng},'Punto scelto sulla mappa');});setTimeout(()=>{if(travelMap===map)map.invalidateSize();},0);
  }catch{travelMap?.remove();travelMap=null;$('event-travel-map').hidden=true;note.textContent='Mappa non disponibile; puoi comunque aprire le indicazioni.';}
}
async function searchTravelOrigin(){
  const state=travelState,query=placeSearchText($('event-travel-origin-search').value),list=$('event-travel-origin-results');list.replaceChildren();++travelLocationVersion;$('event-travel-locate').disabled=false;
  if(query.length<2)return;const request=$('event-travel-origin-search').value;
  try{const index=await loadEventBusStops();if(!travelActive(state)||request!==$('event-travel-origin-search').value)return;
    const matches=index.stops.filter(stop=>placeSearchText(stop.name+' '+stop.code).includes(query)).slice(0,8);
    for(const stop of matches){const b=el('button',busDisplayName(stop.name)+' · '+stop.code);b.type='button';b.onclick=()=>setTravelOrigin({lat:stop.lat,lon:stop.lon},busDisplayName(stop.name));list.append(b);}
    if(!matches.length)list.append(el('p','Nessuna fermata trovata. Prova un altro nome o scegli sulla mappa.'));
  }catch{if(travelActive(state))list.append(el('p','Elenco non disponibile. Puoi scegliere sulla mappa.'));}
}
function openTravelBusDetail(){
  const state=travelState,result=state?.results.bus;if(!state)return;
  if(!result?.row)return openEventBusPlanner(state.event);
  const row=result.row;if(row.assessment.leaveAt<Date.now()){travelSetStatus('Questa partenza è trascorsa. Aggiorno i percorsi.');return calculateEventTravel();}
  const context={event:state.event,day:state.day,before:'',deadlineKind:'venue',margin:0,leaveAfter:state.time,requestedDepartureAt:state.departureAt,direction:'outbound',originReference:row.origin,startPoint:state.start,result:{...row,walking:{startSeconds:row.startWalk.duration,endSeconds:row.endWalk.duration}}};
  openBusTrip(result.assets.find(a=>a.number===row.number),row.row,$('event-travel-bus-start'),context);
  if(row.timelineMinutes){busTripSelection.calls=busTripSelection.calls.slice(0,row.timelineMinutes.length);busTripSelection.calls.forEach((c,i)=>{c.minutes=row.timelineMinutes[i];});}
  busTripSelection.arrival=busTripSelection.calls[row.arrivalOrder-row.row.order];renderBusTrip();openBusJourneySummary();
}
$('event-travel-close').onclick=()=>$('event-travel-dialog').close();
$('event-travel-locate').onclick=locateEventTravel;$('event-travel-retry').onclick=calculateEventTravel;
$('event-travel-origin-search').oninput=searchTravelOrigin;
$('event-travel-pick').onclick=()=>{if(!travelState)return;travelState.picking=!travelState.picking;++travelLocationVersion;$('event-travel-locate').disabled=false;$('event-travel-pick').textContent=travelState.picking?'Annulla scelta sulla mappa':'Scegli sulla mappa';drawTravelMap(travelState.end,travelState.event);$('event-travel-map').scrollIntoView({block:'nearest'});};
for(const id of ['event-travel-date','event-travel-time'])$(id).onchange=()=>{if(travelState){travelState.timeEdited=true;if(travelState.start)calculateEventTravel();}};
$('event-travel-parking').onclick=()=>{if(travelState)openEventParking(travelState.event);};
$('event-travel-bus-start').onclick=openTravelBusDetail;
$('event-travel-dialog').addEventListener('close',()=>{if($('event-travel-dialog').open)return;travelAbort();++travelLocationVersion;travelMap?.remove();travelMap=null;travelState=null;if(travelFocus?.isConnected)travelFocus.focus();});
