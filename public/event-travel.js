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
  for(const [key,label]of [['walk','A piedi'],['bus','Autobus'],['car','Auto']]){const b=el('button',label);b.type='button';b.setAttribute('aria-pressed',String(key===mode));b.onclick=()=>switchEventTravel(key);container.append(b);}
}
function travelActive(state){return state===travelState&&$('event-travel-dialog').open;}
function travelAbort(){++travelVersion;travelState?.controller?.abort();}
function cancelEventTravel(){
  const state=travelState;if(!state)return;travelAbort();
  for(const mode of ['walk','bus','car']){const result=state.results[mode];state.results[mode]=result?.row?{...result,pending:false,incomplete:true}:result?.route||result?.parkingCandidates?result:{error:'Ricerca annullata. Puoi aggiornare i percorsi.'};}
  renderTravelChoices();travelSetStatus('Ricerca annullata. Le tratte già verificate restano consultabili.');$('event-travel-cancel').hidden=true;$('event-travel-retry').hidden=false;
}
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
  $('event-travel-locate').disabled=false;$('event-travel-origin-label').textContent='Cerco la tua posizione…';$('event-travel-retry').hidden=true;$('event-travel-cancel').hidden=true;
  if(!$('event-travel-dialog').open)$('event-travel-dialog').showModal();
  renderTravelChoices();drawTravelMap(end,event);$('event-travel-close').focus();locateEventTravel();
}
function switchEventTravel(mode){
  if(!travelEvent||!['active','bus','car','walk'].includes(mode))return;
  if(!travelState||travelState.event.id!==travelEvent.id||!$('event-travel-dialog').open)openEventTravel(travelEvent);
  travelMode=mode==='active'?'walk':mode;renderTravelChoices();drawTravelMap(travelState.end,travelEvent);
}
function renderTravelChoices(){
  const state=travelState;if(!state)return;const focused=document.activeElement?.closest('.travel-option')?.dataset.mode,busFocused=document.activeElement?.closest('.travel-bus-alternative')?.dataset.choice,list=$('event-travel-modes');list.replaceChildren();
  state.results.active=chooseActiveTravel(state.results.walk,state.results.bus);
  for(const [mode,label,icon]of [['walk','A piedi','🚶'],['bus','Autobus','🚌'],['car','Auto','🚗']]){
    const result=state.results[mode],button=el('button','','travel-option');button.type='button';button.dataset.mode=mode;button.setAttribute('aria-pressed',String(mode===travelMode));
    const heading=el('span','','travel-option-heading');heading.append(el('span',icon+' '+label),el('strong',result?.parkingCandidates?.length?result.parkingCandidates.length+' parcheggi trovati':result?.duration!==undefined?travelMinutes(result.duration):result?.error?'Non disponibile':state.inputError?'Da ricalcolare':state.start?'Calcolo…':'Da calcolare'));button.append(heading);
    const description=result?.error||(!state.start?'Scegli il punto di partenza.':!result?(state.inputError?'Correggi giorno e ora di partenza.':'Sto cercando il percorso.'):mode==='bus'&&result.row?'Linea '+result.row.number+' · parti alle '+travelClock(result.row.assessment.leaveAt)+' · arrivo '+travelArrivalClock(result.row.assessment.venueAt):result.route?parkingDistance(result.route.distance)+(result.parking?' fino a '+result.parking.name+' + '+travelMinutes(result.finalWalk.duration)+' a piedi':'')+' · arrivo '+travelArrivalClock(state.departureAt+result.duration*1000):'Sto cercando corse dirette e verificando le camminate.');
    button.append(el('span',description,'travel-option-summary'));
    if(result&&!result.error){const recommended=state.results.active?.kind===mode?'Consigliato · ':'';const note=mode==='bus'?(result.row?travelMinutes(result.row.startWalk.duration+result.row.endWalk.duration)+' a piedi · attesa inclusa · senza cambi':'Verifica in corso')+(result.pending?' · cerco altre opzioni':result.incomplete?' · ricerca parziale':''):mode==='car'?(result.parking?result.checkedParking+' parcheggi confrontati entro 5 km · traffico e ricerca posto esclusi':'Stima senza traffico · nessun parcheggio del catalogo entro 5 km'):'Percorso pedonale verificato';button.append(el('small',recommended+note));}
    button.onclick=()=>{travelMode=mode;renderTravelChoices();drawTravelMap(state.end,state.event);};list.append(button);
  }
  if(focused)list.querySelector('[data-mode="'+focused+'"]')?.focus({preventScroll:true});
  const current=state.results[travelMode],link=$('event-travel-walk');link.hidden=travelMode==='bus';
  const url=new URL('https://www.google.com/maps/dir/');url.searchParams.set('api','1');url.searchParams.set('travelmode',travelMode==='car'?'driving':'walking');const target=travelMode==='car'&&current?.parking?current.parking:state.end;url.searchParams.set('destination',target.lat+','+target.lon);if(state.start)url.searchParams.set('origin',state.start.lat+','+state.start.lon);
  link.href=url.href;link.textContent=travelMode==='car'?(current?.parking?'Naviga al parcheggio ↗':'Naviga in auto ↗'):'Naviga a piedi ↗';
  $('event-travel-parking').hidden=travelMode!=='car';$('event-travel-bus-start').hidden=travelMode!=='bus'||!current?.row;$('event-travel-bus-start').textContent='Vedi viaggio in autobus';
  $('event-travel-other-bus').hidden=travelMode!=='bus';
  $('event-travel-bus-details').replaceChildren();
  if(travelMode==='car'&&current?.parkingCandidates){
    const details=$('event-travel-bus-details');details.append(el('p','Parcheggi trovati nel catalogo; posti liberi non verificati.','detail-note'));
    for(const option of current.parkingCandidates){const button=el('button',option.parking.name+' · '+(option.finalWalk?travelMinutes(option.finalWalk.duration)+' a piedi alla sede':'camminata non calcolata'),'parking-partial-option');button.type='button';button.dataset.parking=option.parking.id;button.setAttribute('aria-pressed',String(option.parking.id===current.parking.id));button.onclick=()=>{state.results.car={...current,...option};renderTravelChoices();drawTravelMap(state.end,state.event);Array.from(details.children).find(n=>n.dataset?.parking===option.parking.id)?.focus();};details.append(button);}
  }
  if(travelMode==='bus'){
    const details=$('event-travel-bus-details');
    if(current?.row){const row=current.row,waiting=Math.max(0,((row.assessment.departAt??(row.assessment.leaveAt+(row.startWalk.duration+120)*1000))-state.departureAt)/1000-row.startWalk.duration);details.append(el('p','Sali alle '+row.row.time.slice(0,5)+' a '+busDisplayName(row.origin.name)+'. Scendi alle '+row.arrivalTime.slice(0,5)+' a '+busDisplayName(row.arrival.name)+'.'),el('p','Totale '+travelMinutes(current.duration)+' dalla partenza richiesta · attesa e margine di salita '+travelMinutes(waiting)+'.','detail-note'),el('p','A piedi: '+travelMinutes(row.startWalk.duration)+' fino alla fermata e '+travelMinutes(row.endWalk.duration)+' fino alla sede.','detail-note'));
      const options=current.rows||[],directions=new Set(),first=[],later=[];for(const option of options){const direction=option.number+'|'+option.row.destination;if(directions.has(direction))later.push(option);else{directions.add(direction);first.push(option);}}const ordered=[...first,...later],shown=state.busShown||8;
      for(const option of ordered.slice(0,shown)){const button=el('button','Linea '+option.number+' · arrivo '+travelArrivalClock(option.assessment.venueAt)+' · '+travelMinutes((option.assessment.venueAt-state.departureAt)/1000)+' totali · '+travelMinutes(option.startWalk.duration+option.endWalk.duration)+' a piedi','travel-bus-alternative');button.type='button';button.dataset.choice=[option.number,option.row.trip,option.row.serviceDay,option.origin.code,option.arrival.code].join('|');button.setAttribute('aria-pressed',String(option===row));button.onclick=()=>{state.busChoice=button.dataset.choice;state.results.bus={...current,row:option,duration:Math.ceil((option.assessment.venueAt-state.departureAt)/1000)};renderTravelChoices();drawTravelMap(state.end,state.event);Array.from(details.children).find(n=>n.dataset?.choice===state.busChoice)?.focus({preventScroll:true});};details.append(button);}
      if(ordered.length>shown){const more=el('button','Altre alternative verificate ('+(ordered.length-shown)+')','travel-bus-alternative');more.type='button';more.onclick=()=>{state.busShown=shown+8;renderTravelChoices();Array.from(details.children).filter(n=>n.dataset?.choice)[shown]?.focus();};details.append(more);}
      if(busFocused)Array.from(details.children).find(n=>n.dataset?.choice===busFocused)?.focus({preventScroll:true});
    }
    if(current?.search){const search=current.search;details.append(el('p','Ricerca fino a '+parkingDistance(search.radius)+' in linea d’aria · '+search.linesLoaded+' linee caricate · '+search.pairsChecked+' coppie di fermate verificate'+(current.pending?' · ampliamento in corso.':current.incomplete?' · parziale: possono esserci altri diretti.':'.'),'detail-note'));if(search.failedLines?.length)details.append(el('p','Linee non caricate: '+search.failedLines.join(', ')+'. Puoi aggiornare i percorsi.','detail-note'));if(search.reasons?.includes('walking-error'))details.append(el('p','Alcune camminate non sono disponibili. Sono proposte solo le corse con entrambe le camminate verificate.','detail-note'));if(search.limits){const info=el('details'),summary=el('summary','Copertura della ricerca');info.append(summary,el('p','Ampliamento da 800 m a 2 km · fino a '+search.limits.lines+' linee, '+search.limits.pairs+' coppie di fermate e '+search.limits.legs+' camminate. Dopo circa un minuto non avvio nuove verifiche; le richieste in corso possono richiedere più tempo. Usa la ricerca estesa per altri orari e fermate.','detail-note'));details.append(info);}}
  }
}
function locateEventTravel(){
  const state=travelState;if(!state)return;if(state.controller&&!state.controller.signal.aborted)cancelEventTravel();else travelAbort();const id=++travelLocationVersion;
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
  try{input=travelInputs();}catch(error){state.results={};state.inputError=error.message;renderTravelChoices();$('event-travel-cancel').hidden=true;$('event-travel-retry').hidden=false;$('event-travel-map-note').textContent='';travelMap?.remove();travelMap=null;$('event-travel-map').hidden=true;travelSetStatus(error.message);return;}
  Object.assign(state,input);travelDay=input.day;state.results={};state.inputError='';state.controller=new AbortController();const version=travelVersion,signal=state.controller.signal,active=()=>travelActive(state)&&version===travelVersion;
  $('event-travel-when').textContent=eventTravelWhen(state.event,state.day);$('event-travel-place').textContent='Destinazione: '+(typeof eventVenueForDay==='function'?eventVenueForDay(state.event,state.day).location:state.event.location);
  state.busChoice=null;state.busShown=8;$('event-travel-retry').hidden=true;$('event-travel-cancel').hidden=false;travelSetStatus('Confronto le opzioni di viaggio…');renderTravelChoices();drawTravelMap(state.end,state.event);
  const road=async mode=>{try{const result=mode==='car'?await calculateTravelCar(state,{signal}):await travelRouteClient.load(state.start,state.end,{mode,signal}).then(route=>({route,duration:route.duration}));if(active())state.results[mode]=result;}catch(error){if(active())state.results[mode]={error:error.message||'Percorso non disponibile.'};}if(active()){renderTravelChoices();if(travelMode===mode)drawTravelMap(state.end,state.event);}};
  const walking=road('walk');
  const bus=async()=>{if(!active())return;try{const result=await calculateTravelBus(state,{signal,active});if(active())state.results.bus=travelPreserveBusChoice(state,result);}catch(error){if(active())state.results.bus={error:error.message||'Ricerca autobus non disponibile.'};}if(active()){renderTravelChoices();if(travelMode==='bus')drawTravelMap(state.end,state.event);}};
  await Promise.allSettled([walking,road('car'),bus()]);if(!active())return;
  travelSetStatus('Percorsi confrontati per il '+formatDay(state.day,{day:'numeric',month:'short'})+' alle '+$('event-travel-time').value+'.'+(state.results.bus?.incomplete?' Ricerca autobus parziale: puoi estenderla.':''));$('event-travel-retry').hidden=false;$('event-travel-cancel').hidden=true;
}
async function calculateTravelCar(state,{signal}){
  const parking=nearbyParking(state.event,{radius:5000}).sort((a,b)=>(busDistance(state.start,a)/8+busDistance(a,state.end)/1.25)-(busDistance(state.start,b)/8+busDistance(b,state.end)/1.25)).slice(0,3);
  if(!parking.length){const route=await travelRouteClient.load(state.start,state.end,{mode:'car',signal});return {route,duration:route.duration};}
  const results=[],candidates=[];
  for(const place of parking){
    if(signal.aborted)throw Error('Calcolo annullato.');
    // A failed drive must not hide the parking or prevent the independent walk check.
    const [drive,walk]=await Promise.allSettled([travelRouteClient.load(state.start,place,{mode:'car',signal}),travelRouteClient.load(place,state.end,{signal})]);
    if(signal.aborted)throw Error('Calcolo annullato.');
    const route=drive.status==='fulfilled'?drive.value:null,finalWalk=walk.status==='fulfilled'?walk.value:null;
    candidates.push({parking:place,route,finalWalk,driveError:drive.status==='rejected'?drive.reason?.code:null});
    if(route&&finalWalk)results.push({route,finalWalk,parking:place,duration:route.duration+finalWalk.duration});
  }
  results.sort((a,b)=>a.duration-b.duration||a.finalWalk.duration-b.finalWalk.duration);
  if(results.length)return {...results[0],checkedParking:results.length};
  candidates.sort((a,b)=>(a.finalWalk?.duration??Infinity)-(b.finalWalk?.duration??Infinity));
  const noDrive=candidates.every(c=>!c.route),noRoute=candidates.every(c=>['NoRoute','NoSegment'].includes(c.driveError));
  const error=noDrive?(noRoute?'Il servizio non trova il percorso auto da questa partenza. I parcheggi ci sono: indica dove si trova l’auto oppure apri le indicazioni.':'Percorso auto temporaneamente non calcolabile. Puoi comunque scegliere un parcheggio e aprire le indicazioni.'):'Parcheggi trovati, ma il viaggio completo non è verificato: manca il calcolo di una tratta.';
  return {...candidates[0],parkingCandidates:candidates,error};
}
async function calculateTravelBus(state,{signal,active}){
  const index=await loadEventBusStops();if(!active())throw Error('Calcolo annullato.');
  return searchDirectTravel({index,manifest:officialBus,...state,loadLine:getOfficialBusLine,loadWalk:(a,b,options)=>travelRouteClient.load(a,b,options),directTrips:directBusTrips,assess:eventTripAssessment,rank:rankTravelBusTrips,distance:busDistance,signal,active,onProgress:result=>{
    if(!active())return;state.results.bus=travelPreserveBusChoice(state,result.pending&&!result.row?{...result,error:undefined}:result);renderTravelChoices();travelSetStatus('Autobus: ricerca fino a '+parkingDistance(result.search.radius)+' · '+result.search.pairsChecked+' coppie verificate…');if(travelMode==='bus')drawTravelMap(state.end,state.event);
  }});
}
function travelPreserveBusChoice(state,result){
  if(!state.busChoice)return result;
  const key=option=>[option.number,option.row.trip,option.row.serviceDay,option.origin.code,option.arrival.code].join('|');
  const previous=state.results.bus?.row,row=result.rows?.find(option=>key(option)===state.busChoice)||(previous&&key(previous)===state.busChoice&&previous.assessment.leaveAt>=Math.max(Date.now(),state.departureAt)?previous:null);
  return row?{...result,error:undefined,row,rows:result.rows?.includes(row)?result.rows:[row,...(result.rows||[])],duration:Math.ceil((row.assessment.venueAt-state.departureAt)/1000)}:result;
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
    note.textContent=state?.picking?'Tocca la mappa per impostare la partenza.':result?.parkingCandidates?'Sono mostrate solo le tratte calcolate; il viaggio completo non è verificato.':result?.row?'Blu: tratti a piedi · ocra: collegamento indicativo tra le fermate ATV.':result?.parking?'Blu: auto · tratteggiato: camminata dal parcheggio · rosso: evento.':result?.route?'Blu: percorso calcolato · rosso: evento.':'Blu: partenza · rosso: evento.';
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
$('event-travel-cancel').onclick=cancelEventTravel;
$('event-travel-origin-search').oninput=searchTravelOrigin;
$('event-travel-pick').onclick=()=>{if(!travelState)return;travelState.picking=!travelState.picking;++travelLocationVersion;$('event-travel-locate').disabled=false;$('event-travel-pick').textContent=travelState.picking?'Annulla scelta sulla mappa':'Scegli sulla mappa';drawTravelMap(travelState.end,travelState.event);$('event-travel-map').scrollIntoView({block:'nearest'});};
for(const id of ['event-travel-date','event-travel-time'])$(id).onchange=()=>{if(travelState){travelState.timeEdited=true;if(travelState.start)calculateEventTravel();}};
$('event-travel-parking').onclick=()=>{if(travelState)openEventParking(travelState.event);};
$('event-travel-bus-start').onclick=openTravelBusDetail;
$('event-travel-other-bus').onclick=async()=>{const state=travelState;if(!state)return;if(state.controller&&!state.controller.signal.aborted)cancelEventTravel();else travelAbort();await openEventBusPlanner(state.event);if(!travelActive(state)||!eventDirectState?.index||eventDirectState.event.id!==state.event.id||eventDirectState.day!==state.day)return;if(state.start){const origins=nearbyBusStops(eventDirectState.index,state.start,state.day,{radius:2000,limit:Infinity,withService:true});if(origins.length){selectEventDirectOrigin(origins[0],state.start);eventDirectState.gpsOrigins=origins;$('event-direct-origin').value=state.label;}}if(state.time){$('event-direct-after').value=state.time;eventDirectSetMode('departure');}};
$('event-travel-dialog').addEventListener('close',()=>{if($('event-travel-dialog').open)return;travelAbort();++travelLocationVersion;travelMap?.remove();travelMap=null;travelState=null;if(travelFocus?.isConnected)travelFocus.focus();});
