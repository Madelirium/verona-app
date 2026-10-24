let eventDirectState=null,eventDirectVersion=0,eventDirectFocus=null;
function eventDirectSetMode(mode){
  if(!eventDirectState||!['departure','arrival'].includes(mode))return;
  if(eventDirectState.mode===mode)return;
  ++eventDirectVersion;eventDirectState.mode=mode;
  $('event-direct-after-field').hidden=mode==='arrival';$('event-direct-before-field').hidden=mode!=='arrival';
  $('event-direct-departure-mode').setAttribute('aria-pressed',String(mode==='departure'));
  $('event-direct-arrival-mode').setAttribute('aria-pressed',String(mode==='arrival'));
  $('event-direct-mode-note').textContent=mode==='arrival'?'Arrivo alla fermata vicina: il tratto a piedi fino all’evento non è incluso.':'Cerca le partenze dall’orario scelto. Il tratto finale a piedi resta da verificare.';
  $('event-direct-results').replaceChildren();$('event-direct-search').disabled=!eventDirectState.origin;
  $('event-direct-status').textContent=mode==='arrival'&&!$('event-direct-before').value?'L’orario di inizio non è disponibile per questo giorno. Imposta tu l’arrivo alla fermata.':'Imposta l’orario e premi Cerca corse dopo aver scelto la fermata.';
}
function eventDirectNow(day){
  if(day!==dayInRome(new Date()))return 0;
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date()).split(':').map(Number);
  return parts[0]*3600+parts[1]*60+parts[2];
}
async function openEventDirect(){
  const event=eventBusEvent,day=$('event-bus-date').value;if(!event||!eventPosition(event))return;
  eventDirectFocus=document.activeElement;++eventDirectVersion;
  eventDirectState={event,day,origin:null,index:null,mode:null};
  $('event-direct-event').textContent=event.title+' · '+(typeof eventTravelWhen==='function'?eventTravelWhen(event,day):eventWhen(event));
  $('event-direct-origin').value='';$('event-direct-origins').replaceChildren();$('event-direct-origins').hidden=true;
  const now=eventDirectNow(day);$('event-direct-after').value=String(Math.floor(now/3600)).padStart(2,'0')+':'+String(Math.floor(now/60)%60).padStart(2,'0');
  const knownStart=event.startsAt.length>10&&eventDay(event.startsAt)===day&&Number.isFinite(Date.parse(event.startsAt));
  $('event-direct-before').value=knownStart?new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(event.startsAt)):'';
  eventDirectSetMode(knownStart&&Date.parse(event.startsAt)>Date.now()?'arrival':'departure');
  // Changing the mode must not discard the shared stop-index load.
  const loadState=eventDirectState;
  $('event-direct-results').replaceChildren();$('event-direct-search').disabled=true;$('event-direct-origin').disabled=true;
  $('event-direct-status').textContent='Caricamento delle fermate…';
  $('event-direct-dialog').showModal();$('event-direct-close').focus();
  try{
    const index=await loadEventBusStops();if(loadState!==eventDirectState||!$('event-direct-dialog').open)return;
    eventDirectState.index=index;
    if(!officialBus.alightingAvailable){$('event-direct-status').textContent='L’archivio non include i permessi di discesa necessari per questa ricerca.';return;}
    if(!index.days.includes(day)){$('event-direct-status').textContent='Il giorno scelto non è coperto dall’archivio ATV. Torna alle fermate e scegli un altro giorno dell’evento.';return;}
    $('event-direct-origin').disabled=false;$('event-direct-status').textContent='Scrivi il nome della fermata da cui vuoi salire, poi sceglila dall’elenco.';
  }catch{if(loadState!==eventDirectState)return;$('event-direct-status').textContent='Fermate non disponibili. Controlla la connessione e riprova.';const retry=el('button','Riprova','dialog-save');retry.onclick=openEventDirect;$('event-direct-results').append(retry);}
}
function eventDirectOriginSearch(){
  ++eventDirectVersion;const state=eventDirectState;if(!state?.index)return;state.origin=null;
  $('event-direct-search').disabled=true;$('event-direct-results').replaceChildren();
  const query=placeSearchText($('event-direct-origin').value),list=$('event-direct-origins');list.replaceChildren();list.hidden=query.length<2;
  if(query.length<2){$('event-direct-status').textContent='Scrivi almeno due lettere o il codice della fermata.';return;}
  const matches=state.index.stops.filter(stop=>placeSearchText(stop.name+' '+stop.code).includes(query));
  for(const stop of matches.slice(0,8)){const button=el('button',busDisplayName(stop.name)+' · '+stop.code,'event-direct-origin-option');button.type='button';button.onclick=()=>{++eventDirectVersion;state.origin=stop;$('event-direct-origin').value=busDisplayName(stop.name)+' · '+stop.code;list.replaceChildren();list.hidden=true;$('event-direct-search').disabled=false;$('event-direct-status').textContent='Partenza da '+busDisplayName(stop.name)+'. Cerca le corse dirette verso l’evento.';$('event-direct-search').focus();};list.append(button);}
  $('event-direct-status').textContent=!matches.length?'Nessuna fermata trovata. Prova un nome diverso o il codice.':matches.length>8?'Mostro le prime 8 fermate. Aggiungi altre lettere per restringere la ricerca.':'Scegli la fermata e il lato corretto della strada.';
}
async function searchEventDirect(){
  const state=eventDirectState;if(!state?.origin||!state.index?.days.includes(state.day))return;
  const arrivalMode=state.mode==='arrival',after=arrivalMode?'00:00':$('event-direct-after').value,before=arrivalMode?$('event-direct-before').value:'';
  $('event-direct-results').replaceChildren();
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(arrivalMode?before:after)){$('event-direct-status').textContent=arrivalMode?'Scegli un orario valido di arrivo alla fermata.':'Scegli un orario di partenza valido.';return;}
  if(arrivalMode&&Number(before.slice(0,2))*3600+Number(before.slice(3,5))*60<eventDirectNow(state.day)){$('event-direct-status').textContent='L’orario di arrivo è già trascorso. Scegli un altro orario oppure Parti dalle.';return;}
  const version=++eventDirectVersion,dayIndex=state.index.days.indexOf(state.day),numbers=state.origin.services.filter(([,bits])=>[0,1,2].some(offset=>dayIndex>=offset&&bits[dayIndex-offset]==='1')).map(([number])=>number).filter(number=>officialBus.lines.some(line=>line.number===number));
  const valid=()=>version===eventDirectVersion&&$('event-direct-dialog').open;
  $('event-direct-search').disabled=true;$('event-direct-results').replaceChildren();$('event-direct-status').textContent='Cerco corse senza cambi…';
  const assets=[],failed=[];let next=0;
  await Promise.all(Array.from({length:Math.min(3,numbers.length)},async()=>{while(next<numbers.length){const number=numbers[next++];if(!valid())return;try{assets.push(await getOfficialBusLine(number));}catch{failed.push(number);}}}));
  if(!valid())return;$('event-direct-search').disabled=false;
  const rows=directBusTrips(assets,{origin:state.origin.code,point:eventPosition(state.event),day:state.day,after,before,notBeforeSeconds:eventDirectNow(state.day)}),list=$('event-direct-results');
  const partial=failed.length?' Ricerca incompleta: non ho caricato le linee '+failed.join(', ')+'. Puoi riprovare.':'';
  $('event-direct-status').textContent=(rows.length?(arrivalMode?(rows.length===12?'Fino a 12 corse':'Corse')+' con arrivo alla fermata entro le '+before+', ordinate dalle più vicine a quell’orario.':rows.length===12?'Prime 12 corse dirette disponibili.':rows.length+' corse dirette trovate.') :failed.length?'Nessuna corsa trovata nei dati caricati.':arrivalMode?'Nessuna corsa diretta con arrivo alla fermata entro le '+before+'. Prova un altro orario o Parti dalle. Non esclude viaggi con cambi.':'Nessuna corsa diretta trovata con questi criteri nell’archivio: non significa che non esistano viaggi con cambi.')+partial;
  for(const result of rows){
    const card=el('article','','event-direct-card');card.append(el('h3','Linea '+result.number+' · senza cambi'),el('p','Sali a '+busDisplayName(result.origin.name)+' alle '+result.row.time.slice(0,5)),el('p','Scendi a '+busDisplayName(result.arrival.name)+' · '+(result.arrivalKnown?'arrivo ':'passaggio ')+result.arrivalTime.slice(0,5)),el('p','Circa '+result.duration+' min in autobus · circa '+parkingDistance(result.distance)+' dall’evento in linea d’aria. Verifica il percorso a piedi.'));
    const button=el('button','Vedi viaggio','dialog-save');button.type='button';button.onclick=()=>{
      if(eventDirectNow(state.day)>result.departureSeconds){$('event-direct-status').textContent='Questa partenza è già trascorsa. Premi Cerca corse per aggiornare i risultati.';return;}
      const data=assets.find(asset=>asset.number===result.number);openBusTrip(data,result.row,button);
      if(result.timelineMinutes){busTripSelection.calls=busTripSelection.calls.slice(0,result.timelineMinutes.length);busTripSelection.calls.forEach((call,index)=>{call.minutes=result.timelineMinutes[index];});}
      busTripSelection.arrival=busTripSelection.calls[result.arrivalOrder-result.row.order];renderBusTrip();openBusJourneySummary();
      $('bus-journey-content').append(el('p','Destinazione: '+state.event.title+'. '+(arrivalMode?'Arrivo alla fermata richiesto entro le '+before+'. ':'')+'Dalla fermata all’evento restano circa '+parkingDistance(result.distance)+' in linea d’aria; il tempo a piedi non è incluso.','event-direct-note'));
      if(typeof appendWalkingPreview==='function')appendWalkingPreview($('bus-journey-content'),state.event,result,{day:state.day,before:arrivalMode?before:''});
    };
    const walk=el('a','Dalla fermata all’evento a piedi ↗','detail-link'),point=eventPosition(state.event);walk.href='https://www.google.com/maps/dir/?api=1&travelmode=walking&origin='+result.arrival.lat+','+result.arrival.lon+'&destination='+point.lat+','+point.lon;walk.target='_blank';walk.rel='noopener noreferrer';card.append(button,walk);list.append(card);
  }
  if(failed.length){const retry=el('button','Riprova le linee non caricate','dialog-save');retry.onclick=searchEventDirect;list.append(retry);}
}
$('event-bus-plan').onclick=openEventDirect;
$('event-direct-origin').oninput=eventDirectOriginSearch;
$('event-direct-search').onclick=searchEventDirect;
for(const id of ['event-direct-after','event-direct-before'])$(id).onchange=()=>{++eventDirectVersion;$('event-direct-results').replaceChildren();$('event-direct-search').disabled=!eventDirectState?.origin;$('event-direct-status').textContent='Orario modificato. Premi Cerca corse.';};
for(const [id,mode]of [['event-direct-departure-mode','departure'],['event-direct-arrival-mode','arrival']])$(id).onclick=()=>eventDirectSetMode(mode);
$('event-direct-close').onclick=()=>$('event-direct-dialog').close();
$('event-direct-dialog').addEventListener('close',()=>{if($('event-direct-dialog').open)return;++eventDirectVersion;eventDirectState=null;if(eventDirectFocus?.isConnected)eventDirectFocus.focus();});
