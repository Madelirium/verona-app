let eventDirectState=null,eventDirectVersion=0,eventDirectFocus=null;
const eventDirectDrafts=new Map();
let eventDirectLocationVersion=0;
async function openEventBusPlanner(event){
  const day=typeof eventTravelDay==='function'?eventTravelDay(event):eventDay(event.startsAt);
  if(!eventPosition(event,day))return;
  eventBusEvent=event;$('event-bus-date').value=day;
  return openEventDirect();
}
function cancelEventDirectLocation(){
  ++eventDirectLocationVersion;$('event-direct-locate').disabled=!eventDirectState?.index||$('event-direct-origin').disabled;
  $('event-direct-locate').textContent='Usa la mia posizione';$('event-direct-location-status').textContent='';
}
function selectEventDirectOrigin(stop,point=null){
  cancelEventDirectLocation();++eventDirectVersion;eventDirectState.origin=stop;eventDirectState.startPoint=point;eventDirectState.gpsOrigins=null;
  $('event-direct-origin').value=busDisplayName(stop.name)+' · '+stop.code;
  $('event-direct-origins').replaceChildren();$('event-direct-origins').hidden=true;$('event-direct-search').disabled=false;
  $('event-direct-status').textContent='Partenza da '+busDisplayName(stop.name)+'. Cerca le corse dirette verso l’evento.';$('event-direct-search').focus();
}
function locateEventDirectOrigin(){
  const state=eventDirectState,feedback=$('event-direct-location-status');if(!state?.index||$('event-direct-origin').disabled)return;
  cancelEventDirectLocation();
  if(typeof isSecureContext!=='undefined'&&!isSecureContext){feedback.textContent='La posizione richiede HTTPS. Nell’anteprima Wi-Fi HTTP cerca la fermata per nome oppure usa il sito online.';return;}
  if(typeof navigator==='undefined'||!navigator.geolocation){feedback.textContent='Posizione non disponibile. Puoi cercare la fermata per nome o codice.';return;}
  const request=++eventDirectLocationVersion,active=()=>request===eventDirectLocationVersion&&eventDirectState===state&&$('event-direct-dialog').open;
  $('event-direct-locate').disabled=true;$('event-direct-locate').textContent='Cerco la posizione…';feedback.textContent='Attendo la posizione del dispositivo. Puoi continuare anche cercando per nome.';
  const fail=error=>{if(!active())return;cancelEventDirectLocation();feedback.textContent=error?.code===1?'Posizione non autorizzata. Puoi cercare la fermata per nome o codice.':error?.code===3?'La posizione non arriva. Riprova oppure cerca la fermata per nome.':'Non riesco a rilevare la posizione. Riprova oppure cerca la fermata per nome.';};
  try{navigator.geolocation.getCurrentPosition(position=>{
    if(!active())return;const {latitude:lat,longitude:lon,accuracy}=position.coords||{};
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||!Number.isFinite(accuracy)||accuracy<0){fail({code:2});return;}
    cancelEventDirectLocation();
    if(accuracy>2000){feedback.textContent='La posizione è troppo approssimativa per scegliere una fermata. Riprova con una posizione più precisa oppure cerca per nome.';return;}
    const stops=nearbyBusStops(state.index,{lat,lon},state.day,{radius:2000,limit:5,withService:true}),list=$('event-direct-origins');
    ++eventDirectVersion;state.origin=null;resetEventDirectResults();$('event-direct-origin').value='';$('event-direct-search').disabled=true;list.replaceChildren();list.hidden=!stops.length;
    list.hidden=true;state.startPoint=null;state.gpsOrigins=null;
    if(stops.length){state.origin=stops[0];state.startPoint={lat,lon};state.gpsOrigins=stops;$('event-direct-origin').value='La mia posizione';$('event-direct-search').disabled=false;}
    feedback.textContent=!stops.length?'Nessuna fermata con servizio nell’archivio entro 2 km. Cerca per nome o codice.':(accuracy>200?'Posizione approssimativa: le distanze possono essere imprecise. ':'')+'Partenza dalla tua posizione. Confronterò '+stops.length+' fermate vicine: non devi sceglierle tu.';
    $('event-direct-status').textContent=stops.length?'Controlla l’orario e premi Mostra autobus. Le distanze a piedi restano da verificare se non attivi il calcolo.':'Puoi cercare un’altra fermata per nome.';
  },fail,{enableHighAccuracy:true,timeout:12000,maximumAge:0});}catch{fail({code:2});}
}
function resetEventDirectResults(){
  $('event-direct-dialog').classList.toggle('has-connections',false);
  if(typeof clearEventConnectionMap==='function')clearEventConnectionMap();
  $('event-direct-search-bar').hidden=false;
  eventDirectState?.controller?.abort();$('event-direct-cancel').hidden=true;
  $('event-direct-results').replaceChildren();$('event-direct-more').hidden=true;
  $('event-direct-query').hidden=true;$('event-direct-edit').hidden=true;$('event-direct-form').hidden=false;
}
function showMoreEventDirect(){
  const cards=Array.from($('event-direct-results').children).filter(card=>card.className==='event-direct-card'),next=cards.filter(card=>card.hidden).slice(0,3);
  next.forEach(card=>{card.hidden=false;});$('event-direct-more').hidden=!cards.some(card=>card.hidden);
  next[0]?.focus();
}
function editEventDirect(){
  const editing=$('event-direct-form').hidden;$('event-direct-form').hidden=!editing;$('event-direct-edit').setAttribute('aria-expanded',String(editing));
  $('event-direct-dialog').classList.toggle('has-connections',!editing);$('event-direct-query').hidden=editing;
  $('event-direct-search-bar').hidden=!editing;
  if(typeof connectionMap!=='undefined'){$('event-connection-panel').hidden=editing||!connectionMap;if(!editing)connectionMap?.invalidateSize();}
  $('event-direct-edit').textContent=editing?'Torna ai risultati':'Modifica ricerca';
  if(editing)$('event-direct-body').scrollTop=0;
  $(editing?($('event-direct-day-field').hidden?'event-direct-locate':'event-direct-day'):'event-direct-results').focus();
}
function eventDirectSetMode(mode){
  if(!eventDirectState||!['departure','arrival'].includes(mode))return;
  if(eventDirectState.mode===mode)return;
  ++eventDirectVersion;eventDirectState.mode=mode;
  $('event-direct-after-field').hidden=mode==='arrival';$('event-direct-before-field').hidden=mode!=='arrival';
  $('event-direct-departure-mode').setAttribute('aria-pressed',String(mode==='departure'));
  $('event-direct-arrival-mode').setAttribute('aria-pressed',String(mode==='arrival'));
  $('event-direct-before-label').textContent=$('event-direct-walk-mode').checked?'Arrivo alla sede entro':'Arrivo alla fermata entro';
  $('event-direct-mode-note').textContent=$('event-direct-walk-mode').checked?'Saranno valutati camminate, margine di salita e anticipo scelto.':mode==='arrival'?'Arrivo alla fermata vicina: il tratto a piedi fino all’evento non è incluso.':'Cerca le partenze dall’orario scelto. Il tratto finale a piedi resta da verificare.';
  resetEventDirectResults();$('event-direct-search').disabled=!eventDirectState.origin;
  $('event-direct-status').textContent=mode==='arrival'&&!$('event-direct-before').value?'L’orario di inizio non è disponibile per questo giorno. Imposta tu l’arrivo alla fermata.':'Imposta l’orario e premi Mostra autobus dopo aver scelto la fermata.';
}
function eventDirectNow(day){
  if(day!==dayInRome(new Date()))return 0;
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date()).split(':').map(Number);
  return parts[0]*3600+parts[1]*60+parts[2];
}
async function openEventDirect(){
  const event=eventBusEvent,day=$('event-bus-date').value;if(!event||!eventPosition(event,day))return;
  const draft=eventDirectDrafts.get(event.id+'|'+day);
  eventDirectFocus=document.activeElement;++eventDirectVersion;
  eventDirectState={event,day,origin:null,index:null,mode:null};
  $('event-direct-day').value=day;$('event-direct-day').min=eventDay(event.startsAt);$('event-direct-day').max=eventDay(event.endsAt);
  $('event-direct-day-field').hidden=eventDay(event.startsAt)===eventDay(event.endsAt);
  $('event-direct-close').setAttribute('aria-label',$('event-bus-dialog').open?'Torna alla mappa delle fermate':'Torna all’evento');
  $('event-direct-walk-disclosure').textContent='Cercando con le camminate attive invii a '+(payload.walking?.endpoint?'openrouteservice/HeiGIT':'FOSSGIS/OpenStreetMap')+' le coordinate dei punti di partenza (anche GPS, se usato) e della sede. Fino a cinque punti di salita e sei di discesa per ricerca.';
  $('event-direct-limit-note').textContent='Orari programmati ATV, senza ritardi in tempo reale. Camminate non incluse finché non scegli di calcolarle.';
  $('event-direct-walk-options').hidden=typeof eventWalkingEnabled!=='function'||!eventWalkingEnabled();$('event-direct-walk-mode').checked=false;$('event-direct-margin').value='10';
  $('event-direct-event').textContent=event.title+' · '+(typeof eventTravelWhen==='function'?eventTravelWhen(event,day):eventWhen(event));
  $('event-direct-origin').value='';$('event-direct-origins').replaceChildren();$('event-direct-origins').hidden=true;
  const now=eventDirectNow(day);$('event-direct-after').value=String(Math.floor(now/3600)).padStart(2,'0')+':'+String(Math.floor(now/60)%60).padStart(2,'0');
  const startAt=typeof eventVenueForDay==='function'?eventVenueForDay(event,day).startsAt:event.startsAt;
  const knownStart=startAt?.length>10&&eventDay(startAt)===day&&Number.isFinite(Date.parse(startAt));
  $('event-direct-before').value=knownStart?new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(startAt)):'';
  eventDirectSetMode(knownStart&&Date.parse(startAt)>Date.now()?'arrival':'departure');
  if(draft){$('event-direct-after').value=draft.after;$('event-direct-before').value=draft.before;eventDirectSetMode(draft.mode);if(draft.complete&&typeof eventWalkingEnabled==='function'&&eventWalkingEnabled()){$('event-direct-walk-mode').checked=true;$('event-direct-margin').value=draft.margin;$('event-direct-walk-mode').onchange();}}
  // Changing the mode must not discard the shared stop-index load.
  const loadState=eventDirectState;
  resetEventDirectResults();$('event-direct-search').disabled=true;$('event-direct-origin').disabled=true;
  cancelEventDirectLocation();
  $('event-direct-status').textContent='Caricamento delle fermate…';
  if(!$('event-direct-dialog').open)$('event-direct-dialog').showModal();$('event-direct-close').focus();
  try{
    const index=await loadEventBusStops();if(loadState!==eventDirectState||!$('event-direct-dialog').open)return;
    eventDirectState.index=index;
    if(!officialBus.alightingAvailable){$('event-direct-status').textContent='L’archivio non include i permessi di discesa necessari per questa ricerca.';return;}
    if(!index.days.includes(day)){$('event-direct-status').textContent='Il giorno scelto non è coperto dall’archivio ATV. Torna alle fermate e scegli un altro giorno dell’evento.';return;}
    $('event-direct-origin').disabled=false;$('event-direct-locate').disabled=false;$('event-direct-status').textContent='Usa la posizione oppure scrivi il nome della fermata da cui vuoi salire.';
    if(draft){const origin=index.stops.find(stop=>stop.code===draft.origin);if(origin){eventDirectState.origin=origin;$('event-direct-origin').value=busDisplayName(origin.name)+' · '+origin.code;$('event-direct-search').disabled=false;$('event-direct-status').textContent='Fermata e orario conservati. Premi Mostra autobus per aggiornare i risultati.';}}
  }catch{if(loadState!==eventDirectState)return;$('event-direct-status').textContent='Fermate non disponibili. Controlla la connessione e riprova.';const retry=el('button','Riprova','dialog-save');retry.onclick=openEventDirect;$('event-direct-results').append(retry);}
}
function eventDirectOriginSearch(){
  cancelEventDirectLocation();
  ++eventDirectVersion;const state=eventDirectState;if(!state?.index)return;state.origin=null;state.startPoint=null;state.gpsOrigins=null;
  $('event-direct-search').disabled=true;resetEventDirectResults();
  const query=placeSearchText($('event-direct-origin').value),list=$('event-direct-origins');list.replaceChildren();list.hidden=query.length<2;
  if(query.length<2){$('event-direct-status').textContent='Scrivi almeno due lettere o il codice della fermata.';return;}
  const matches=state.index.stops.filter(stop=>placeSearchText(stop.name+' '+stop.code).includes(query)).sort((a,b)=>Number(String(b.code)===query)-Number(String(a.code)===query)||Number(placeSearchText(b.name).startsWith(query))-Number(placeSearchText(a.name).startsWith(query)));
  for(const stop of matches.slice(0,8)){const button=el('button',busDisplayName(stop.name)+' · '+stop.code,'event-direct-origin-option');button.type='button';button.onclick=()=>selectEventDirectOrigin(stop);list.append(button);}
  $('event-direct-status').textContent=!matches.length?'Nessuna fermata trovata. Prova un nome diverso o il codice.':matches.length>8?'Mostro le prime 8 fermate. Aggiungi altre lettere per restringere la ricerca.':'Scegli la fermata e il lato corretto della strada.';
}
async function searchEventDirect(){
  cancelEventDirectLocation();
  const state=eventDirectState;if(!state?.origin||!state.index?.days.includes(state.day))return;
  const arrivalMode=state.mode==='arrival',after=arrivalMode?'00:00':$('event-direct-after').value,before=arrivalMode?$('event-direct-before').value:'',complete=Boolean($('event-direct-walk-mode').checked)&&typeof eventWalkingEnabled==='function'&&eventWalkingEnabled(),margin=complete?Number($('event-direct-margin').value):0;
  resetEventDirectResults();
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(arrivalMode?before:after)){$('event-direct-status').textContent=arrivalMode?'Scegli un orario valido di arrivo alla fermata.':'Scegli un orario di partenza valido.';return;}
  if(complete&&(!Number.isInteger(margin)||margin<0||margin>60)){$('event-direct-status').textContent='Scegli un anticipo tra 0 e 60 minuti.';return;}
  if(arrivalMode&&Number(before.slice(0,2))*3600+Number(before.slice(3,5))*60<eventDirectNow(state.day)){$('event-direct-status').textContent='L’orario di arrivo è già trascorso. Scegli un altro orario oppure Parti dalle.';return;}
  const version=++eventDirectVersion,dayIndex=state.index.days.indexOf(state.day),origins=state.gpsOrigins||eventDirectOrigins(state.index,state.origin,state.day),numbers=[...new Set(origins.flatMap(stop=>stop.services.filter(([,bits])=>[0,1,2].some(offset=>dayIndex>=offset&&bits[dayIndex-offset]==='1')).map(([number])=>number)))].filter(number=>officialBus.lines.some(line=>line.number===number));
  const valid=()=>version===eventDirectVersion&&$('event-direct-dialog').open;
  $('event-direct-search').disabled=true;$('event-direct-cancel').hidden=false;$('event-direct-results').replaceChildren();$('event-direct-status').textContent='Cerco corse senza cambi…';
  const assets=[],failed=[];let next=0;
  await Promise.all(Array.from({length:Math.min(3,numbers.length)},async()=>{while(next<numbers.length){const number=numbers[next++];if(!valid())return;try{assets.push(await getOfficialBusLine(number));}catch{failed.push(number);}}}));
  if(!valid())return;
  let candidates=origins.flatMap(origin=>directBusTrips(assets,{origin:origin.code,point:eventPosition(state.event,state.day),day:state.day,after,before,notBeforeSeconds:eventDirectNow(state.day),allowOvernight:!arrivalMode,allTargets:complete,limit:complete?120:24}));
  let walkingIncomplete=false;
  if(complete&&candidates.length){
    const controller=new AbortController();state.controller=controller;
    const verified=await evaluateEventWalkingCandidates(candidates,origins,state.startPoint||state.origin,eventPosition(state.event,state.day),state.day,{deadline:before,margin,notBefore:arrivalMode?'':after,signal:controller.signal,active:valid,status:text=>{$('event-direct-status').textContent=text;}});
    if(!valid())return;candidates=verified.rows;walkingIncomplete=verified.incomplete;
  }
  if(!complete)candidates=bestEventConnections(candidates,state.startPoint||state.origin,false);
  if(!valid())return;$('event-direct-search').disabled=false;$('event-direct-cancel').hidden=true;
  const rows=candidates.sort((a,b)=>(complete?Number(b.assessment.state==='compatible')-Number(a.assessment.state==='compatible'):0)||(arrivalMode?(complete?b.departureSeconds-a.departureSeconds:b.arrivalSeconds-a.arrivalSeconds||b.departureSeconds-a.departureSeconds):a.departureSeconds-b.departureSeconds)||a.duration-b.duration||busDistance(state.origin,a.origin)-busDistance(state.origin,b.origin)).slice(0,12),list=$('event-direct-results');
  $('event-direct-limit-note').textContent=complete?'Orari programmati ATV, senza ritardi in tempo reale. Camminate stimate, due minuti per salire e anticipo scelto inclusi solo nelle schede verificate. Controlla accessi e attraversamenti.':'Orari programmati ATV, senza ritardi in tempo reale. Il tempo a piedi non è incluso: verifica come raggiungere la fermata e la sede.';
  const partial=failed.length?' Ricerca incompleta: non ho caricato le linee '+failed.join(', ')+'. Puoi riprovare.':'';
  $('event-direct-status').textContent=(rows.length?(arrivalMode?(rows.length===12?'Fino a 12 corse':'Corse')+' con arrivo alla fermata entro le '+before+', ordinate dalle più vicine a quell’orario.':rows.length===12?'Prime 12 corse dirette disponibili.':rows.length+' corse dirette trovate.') :failed.length?'Nessuna corsa trovata nei dati caricati.':arrivalMode?'Nessuna corsa diretta con arrivo alla fermata entro le '+before+'. Prova un altro orario o Parti dalle. Non esclude viaggi con cambi.':'Nessuna corsa diretta trovata con questi criteri nell’archivio: non significa che non esistano viaggi con cambi.')+partial;
  if(complete)$('event-direct-status').textContent=(rows.length?'Risultati con verifica delle camminate e '+margin+' minuti di anticipo'+(before?' sulle '+before:'')+'.':'Nessun viaggio compatibile con i tempi indicati nei limiti della ricerca. Prova un altro orario o un anticipo minore.')+(walkingIncomplete?' Alcuni percorsi a piedi non sono disponibili: le schede non verificate non confermano l’arrivo.':'')+partial;
  for(const result of rows){
    const card=el('article','','event-direct-card');card.tabIndex=-1;card.hidden=list.children.length>=3;card.append(el('h3','Linea '+result.number+' · senza cambi'),el('p','Sali alle '+result.row.time.slice(0,5)+' a '+busDisplayName(result.origin.name),'event-direct-board'),el('p',(result.arrivalKnown?'Scendi alle ':'Passaggio alle ')+result.arrivalTime.slice(0,5)+' a '+busDisplayName(result.arrival.name),'event-direct-alight'),el('p','Circa '+result.duration+' min in bus · '+parkingDistance(result.distance)+' in linea d’aria dall’evento.','event-direct-duration'));
    const mapped=typeof selectEventConnection==='function',extra=mapped?el('details','','connection-more'):card;
    if(mapped){extra.append(el('summary','Direzione e dettagli'));card.connectionResult=result;if(typeof L!=='undefined'){const mapButton=el('button','Linea '+result.number+' · '+result.row.time.slice(0,5),'connection-select');mapButton.type='button';mapButton.setAttribute('aria-label','Mostra sulla mappa linea '+result.number+' delle '+result.row.time.slice(0,5));mapButton.setAttribute('aria-pressed','false');mapButton.onclick=()=>selectEventConnection(result,state,assets);card.connectionButton=mapButton;card.children[0].replaceChildren(mapButton);}}
    extra.append(el('p','Direzione: '+busDisplayName(result.row.destination),'event-direct-note'));
    if(state.startPoint)extra.append(el('p','Fermata '+result.origin.code+' · circa '+parkingDistance(busDistance(state.startPoint,result.origin))+' dalla tua posizione, in linea d’aria.','event-journey-alternative'));
    else if(result.origin.code!==state.origin.code)extra.append(el('p','Fermata alternativa '+result.origin.code+' · circa '+parkingDistance(busDistance(state.origin,result.origin))+' dalla fermata scelta, in linea d’aria.','event-journey-alternative'));
    if(mapped)card.append(extra);
    if(result.arrivalDay&&result.arrivalDay!==state.day)card.append(el('p','Arrivo il '+formatDay(result.arrivalDay,{weekday:'short',day:'numeric',month:'short'}),'event-journey-warning'));
    if(complete)card.append(el('p',result.assessment.state==='compatible'?'Alla sede verso le '+eventJourneyMoment(result.assessment.venueAt,state.day,true)+' · parti a piedi entro '+eventJourneyMoment(result.assessment.leaveAt,state.day)+(before?' · circa '+result.assessment.spareMinutes+' min di anticipo':''):'Camminate non verificate: puntualità da controllare.',result.assessment.state==='compatible'?'event-journey-compatible':'event-journey-warning'));
    const button=el('button','Vedi viaggio','dialog-save');button.type='button';button.onclick=()=>{
      if(eventDirectNow(state.day)>result.departureSeconds){$('event-direct-status').textContent='Questa partenza è già trascorsa. Premi Mostra autobus per aggiornare i risultati.';return;}
      if(result.assessment?.state==='compatible'&&result.assessment.leaveAt<Date.now()){$('event-direct-status').textContent='Il tempo per raggiungere questa partenza è trascorso. Aggiorna la ricerca.';return;}
      const context={event:state.event,day:state.day,before:arrivalMode?before:'',deadlineKind:complete?'venue':'stop',margin,leaveAfter:complete&&!arrivalMode?after:'',direction:'outbound',originReference:state.origin,startPoint:state.startPoint||null,result};
      const data=assets.find(asset=>asset.number===result.number);openBusTrip(data,result.row,button,context);
      if(result.timelineMinutes){busTripSelection.calls=busTripSelection.calls.slice(0,result.timelineMinutes.length);busTripSelection.calls.forEach((call,index)=>{call.minutes=result.timelineMinutes[index];});}
      busTripSelection.arrival=busTripSelection.calls[result.arrivalOrder-result.row.order];renderBusTrip();openBusJourneySummary();
    };
    card.append(button);list.append(card);
  }
  if(rows.length){
    $('event-direct-dialog').classList.toggle('has-connections',true);
    $('event-direct-search-bar').hidden=true;
    $('event-direct-form').hidden=true;$('event-direct-query').textContent=(state.startPoint?'Dalla mia posizione':'Da '+busDisplayName(state.origin.name))+' · '+formatDay(state.day,{day:'numeric',month:'short'})+' · '+(arrivalMode?'arrivo '+(complete?'alla sede':'alla fermata')+' entro le '+before:'partenza dalle '+after);$('event-direct-query').hidden=false;
    $('event-direct-edit').hidden=false;$('event-direct-edit').textContent='Modifica ricerca';$('event-direct-edit').setAttribute('aria-expanded','false');$('event-direct-more').hidden=rows.length<=3;
    $('event-direct-results').focus();
    if(typeof selectEventConnection==='function')selectEventConnection(rows[0],state,assets);
  }
  if(!rows.length&&!failed.length){const recover=el('button',arrivalMode?'Cerca partenze successive':'Cambia la partenza','event-direct-edit');recover.type='button';recover.onclick=()=>{if(arrivalMode){eventDirectSetMode('departure');return searchEventDirect();}$('event-direct-origin').focus();};list.append(recover);}
  if(failed.length){const retry=el('button','Riprova le linee non caricate','dialog-save');retry.onclick=searchEventDirect;list.append(retry);}
}
$('event-bus-plan').onclick=openEventDirect;
$('event-direct-origin').oninput=eventDirectOriginSearch;
$('event-direct-search').onclick=searchEventDirect;
$('event-direct-cancel').onclick=()=>{++eventDirectVersion;eventDirectState?.controller?.abort();$('event-direct-search').disabled=!eventDirectState?.origin;$('event-direct-cancel').hidden=true;$('event-direct-status').textContent='Ricerca annullata. Puoi modificare i dati o riprovare.';};
$('event-direct-locate').onclick=locateEventDirectOrigin;
$('event-direct-more').onclick=showMoreEventDirect;
$('event-direct-edit').onclick=editEventDirect;
$('event-direct-day').onchange=async()=>{
  const state=eventDirectState,day=$('event-direct-day').value;if(!state)return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<eventDay(state.event.startsAt)||day>eventDay(state.event.endsAt)){$('event-direct-day').value=state.day;$('event-direct-status').textContent='Scegli un giorno compreso nelle date dell’evento.';return;}
  if(!state.index?.days.includes(day)){$('event-direct-day').value=state.day;$('event-direct-status').textContent='Gli orari ATV non coprono questo giorno. Scegli un’altra data.';return;}
  if(!eventPosition(state.event,day)){$('event-direct-day').value=state.day;$('event-direct-status').textContent='La sede non è confermata per questo giorno. Controlla il programma dell’evento.';return;}
  const reference=state.origin,point=state.startPoint;$('event-bus-date').value=day;await openEventDirect();
  if(!eventDirectState||eventDirectState.day!==day||eventDirectState.event.id!==state.event.id||!$('event-direct-dialog').open||$('event-direct-origin').disabled)return;
  if(point){const stops=nearbyBusStops(eventDirectState.index,point,day,{radius:2000,limit:5,withService:true});if(stops.length){eventDirectState.origin=stops[0];eventDirectState.startPoint=point;eventDirectState.gpsOrigins=stops;$('event-direct-origin').value='La mia posizione';$('event-direct-search').disabled=false;}}
  else if(reference){const stop=eventDirectState.index.stops.find(s=>s.code===reference.code);if(stop)selectEventDirectOrigin(stop);}
  $('event-direct-status').textContent='Giorno aggiornato. Controlla l’orario e premi Mostra autobus.';
};
for(const id of ['event-direct-after','event-direct-before'])$(id).onchange=()=>{++eventDirectVersion;resetEventDirectResults();$('event-direct-search').disabled=!eventDirectState?.origin;$('event-direct-status').textContent='Orario modificato. Premi Mostra autobus.';};
for(const [id,mode]of [['event-direct-departure-mode','departure'],['event-direct-arrival-mode','arrival']])$(id).onclick=()=>eventDirectSetMode(mode);
for(const id of ['event-direct-walk-mode','event-direct-margin'])$(id).onchange=()=>{++eventDirectVersion;resetEventDirectResults();const enabled=Boolean($('event-direct-walk-mode').checked);$('event-direct-before-label').textContent=enabled?'Arrivo alla sede entro':'Arrivo alla fermata entro';$('event-direct-mode-note').textContent=enabled?'Saranno verificati entrambi i tratti a piedi, due minuti per salire e l’anticipo scelto.':'Il tratto a piedi non è incluso negli orari del bus.';$('event-direct-search').disabled=!eventDirectState?.origin;$('event-direct-status').textContent='Opzioni modificate: premi Mostra autobus.';};
$('event-direct-close').onclick=()=>$('event-direct-dialog').close();
$('event-direct-dialog').addEventListener('close',()=>{if($('event-direct-dialog').open)return;++eventDirectVersion;eventDirectState?.controller?.abort();if(eventDirectState?.origin){const state=eventDirectState;eventDirectDrafts.set(state.event.id+'|'+state.day,{origin:state.origin.code,mode:state.mode,after:$('event-direct-after').value,before:$('event-direct-before').value,complete:Boolean($('event-direct-walk-mode').checked),margin:$('event-direct-margin').value});if(eventDirectDrafts.size>6)eventDirectDrafts.delete(eventDirectDrafts.keys().next().value);}eventDirectState=null;cancelEventDirectLocation();if(eventDirectFocus?.isConnected)eventDirectFocus.focus();});

function appendEventJourneyContext(content,selection){
  const context=selection.eventContext,call=selection.arrival;if(!context||!call)return;
  const point=context.targetPoint||eventPosition(context.event,context.day),stop=selection.data.stops[call.code];
  const validPoint=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon);
  const result={...context.result,origin:selection.data.stops[selection.calls[0].code],arrival:stop,arrivalTime:call.time,arrivalDay:call.day,duration:call.minutes,distance:validPoint(point)&&validPoint(stop)?busDistance(stop,point):null};
  const destination=context.direction==='return'?(context.targetLabel||'Punto di partenza iniziale'):context.event.title;
  const more=el('details','','journey-more');more.append(el('summary','Percorso a piedi e informazioni'));
  if(validPoint(point)&&validPoint(stop)){
    const walk=el('a','Apri il tratto a piedi in Google Maps ↗','detail-link');walk.href='https://www.google.com/maps/dir/?api=1&travelmode=walking&origin='+stop.lat+','+stop.lon+'&destination='+point.lat+','+point.lon;walk.target='_blank';walk.rel='noopener noreferrer';more.append(walk);
  }
  if(typeof appendEventJourneyTools==='function')appendEventJourneyTools(content,context,result);
  more.append(el('p','Destinazione: '+destination+'. '+(context.before?'Arrivo '+(context.deadlineKind==='venue'?'alla sede':'alla fermata')+' richiesto entro le '+context.before+'. ':'')+(result.distance!==null?'Dalla fermata restano circa '+parkingDistance(result.distance)+' in linea d’aria; ':'')+'il tempo a piedi non è incluso negli orari del bus.','event-direct-note'));content.append(more);
}
function eventDirectOrigins(index,origin,day){
  const more=nearbyBusStops(index,origin,day,{radius:300,limit:5,withService:true}).filter(stop=>stop.code!==origin.code);
  return [origin,...more.slice(0,4)];
}
function bestEventConnections(rows,reference,complete=false){
  const best=new Map();
  for(const row of rows){const key=[row.number,row.row.trip,row.row.serviceDay].join('|'),old=best.get(key);let prefer=!old;
    if(old){const checked=complete&&row.assessment.state==='compatible',oldChecked=complete&&old.assessment.state==='compatible';prefer=checked&&!oldChecked||checked&&oldChecked&&(row.assessment.venueAt<old.assessment.venueAt||row.assessment.venueAt===old.assessment.venueAt&&row.assessment.leaveAt>old.assessment.leaveAt)||!checked&&!oldChecked&&(busDistance(reference,row.origin)<busDistance(reference,old.origin)||busDistance(reference,row.origin)===busDistance(reference,old.origin)&&row.distance<old.distance);}
    if(prefer)best.set(key,row);
  }return [...best.values()];
}

function eventJourneyWarnings(selection){
  const context=selection.eventContext,call=selection.arrival;if(!context||!call)return [];
  const messages=[],point=context.targetPoint||eventPosition(context.event,context.day),stop=selection.data.stops[call.code];
  if(context.result.arrival.code!==call.code||context.result.arrivalTime!==call.time||context.result.arrivalDay&&context.result.arrivalDay!==call.day)messages.push('Fermata di arrivo modificata: ricalcola camminate e margine prima di confermare il viaggio.');
  if(context.before&&(call.day>context.day||call.day===context.day&&call.time>context.before+':00'))messages.push('Attenzione: questa fermata supera il limite richiesto delle '+context.before+'. Scegli un’altra corsa o modifica l’orario.');
  if(point&&stop&&busDistance(stop,point)>800)messages.push('Questa fermata è distante dalla destinazione. Il viaggio va verificato nuovamente.');
  return messages;
}
