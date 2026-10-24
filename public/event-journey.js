// Event journey tools hold only transient coordinates; no visitor position is persisted.
let eventCompleteContext=null,eventCompleteResult=null,eventCompleteVersion=0,eventCompleteController=null,eventCompleteMap=null,eventCompleteManual=false,eventCompleteProviderNote='';
let eventReturnContext=null,eventReturnIndex=null,eventReturnVersion=0,eventReturnRows=[],eventReturnController=null;
function appendEventJourneyTools(content,context,result){
  const check=el('button','Verifica i tempi a piedi','event-direct-edit');check.type='button';check.onclick=()=>openEventComplete(context,result);content.append(check);
}
$('bus-journey-return').onclick=()=>{if(busTripSelection?.eventContext)openEventReturn(busTripSelection.eventContext);};
function eventJourneyChecked(selection){
  const context=selection.eventContext,result=context.result,call=selection.arrival;
  const key=selection.row.trip+'|'+selection.row.serviceDay+'|'+selection.calls[0].code+'|'+call.code+'|'+call.day+'|'+call.time;
  if(context.checkedJourney?.key===key)return context.checkedJourney;
  if(result.assessment?.state==='compatible'&&result.arrival.code===call.code&&result.arrivalTime===call.time&&(result.arrivalDay||context.day)===call.day&&result.origin.code===selection.calls[0].code)return {assessment:result.assessment,walking:result.walking};
  return null;
}
function appendEventJourneyOverview(content,selection,part){
  const context=selection.eventContext,checked=eventJourneyChecked(selection),assessment=checked?.assessment,returning=context.direction==='return';
  if(part==='start'){
    const hero=el('section','','journey-answer');
    hero.append(el('p',assessment?'Arrivo '+(returning?'alla destinazione':'all’evento')+' stimato':'Discesa dal bus · orario programmato'),el('strong',assessment?eventJourneyMoment(assessment.venueAt,context.day,true):selection.arrival.time.slice(0,5)+(selection.arrival.day!==context.day?' del '+formatDay(selection.arrival.day,{day:'numeric',month:'short'}):'')),el('p',assessment?'Circa '+assessment.totalMinutes+' minuti complessivi · '+(checked.manual?'minuti a piedi stimati da te':'camminate incluse'):'Camminata finale ancora da verificare. Questo non è l’orario di arrivo '+(returning?'alla destinazione.':'all’evento.')));content.append(hero);
    const start=el('section','','journey-walk-step');start.append(el('h3','1. Raggiungi la fermata'));
    start.append(el('p',assessment?'Parti a piedi entro le '+eventJourneyMoment(assessment.leaveAt,context.day)+'. Sono inclusi 2 minuti per salire sul bus.':context.startPoint?'Parti dalla posizione che hai scelto. Il tempo a piedi fino al bus è da verificare.':returning?'Parti dalla sede dell’evento. Verifica il tempo a piedi fino al bus.':'Partenza dalla fermata scelta: '+busDisplayName((context.originReference||context.result.origin).name)+'. Il tragitto da casa non è incluso.'));content.append(start);
  }else{
    const end=el('section','','journey-walk-step');end.append(el('h3','4. Raggiungi '+(returning?'la destinazione':'l’evento')),el('p',returning?(context.targetLabel||'Punto iniziale di partenza'):context.event.location||context.event.title));
    end.append(el('p',assessment?'Arrivo stimato verso le '+eventJourneyMoment(assessment.venueAt,context.day,true)+(context.before&&assessment.spareMinutes!==null?' · circa '+assessment.spareMinutes+' minuti prima delle '+context.before:'')+'.':'Il tempo di questo tratto a piedi non è ancora calcolato.'));content.append(end);
  }
}
function eventJourneyClock(instant){return new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(instant));}
function eventJourneyMoment(instant,day,roundUp=false){const value=(roundUp?Math.ceil(instant/60000):Math.floor(instant/60000))*60000,actual=dayInRome(new Date(value));return eventJourneyClock(value)+(actual!==day?' del '+formatDay(actual,{day:'numeric',month:'short'}):'');}
function eventWalkingEnabled(){return Boolean(payload.walking?.endpoint)||walkingPreviewAvailable(typeof location==='undefined'?null:location);}
function openEventComplete(context,result){
  eventCompleteController?.abort();++eventCompleteVersion;eventCompleteContext=context;eventCompleteResult=result;
  $('event-complete-calculate').disabled=false;eventCompleteManual=false;$('event-complete-manual-toggle').textContent='Inserisci tu i minuti a piedi';
  $('event-complete-name').textContent=context.event.title+' · '+(context.direction==='return'?'Ritorno':'Andata');
  const from=context.direction==='return'?eventPosition(context.event,context.venueDay||context.day):(context.startPoint||context.originReference||result.origin),to=context.targetPoint||eventPosition(context.event,context.venueDay||context.day);
  $('event-complete-from').textContent=context.direction==='return'?'Partenza a piedi dalla sede dell’evento.':context.startPoint?'Partenza a piedi dalla posizione rilevata.':'Partenza dalla fermata inizialmente scelta: '+busDisplayName((context.originReference||result.origin).name)+'. Il tragitto da casa non è incluso.';
  $('event-complete-target').value=context.before||'';$('event-complete-margin').value=context.direction==='return'?'0':String(context.deadlineKind==='venue'?context.margin:10);
  $('event-complete-result').replaceChildren();$('event-complete-status').textContent='Linea '+result.number+' · '+formatDay(context.day,{day:'numeric',month:'short'})+' · '+result.row.time.slice(0,5)+' → '+result.arrivalTime.slice(0,5)+(result.arrivalDay&&result.arrivalDay!==context.day?' del '+formatDay(result.arrivalDay,{day:'numeric',month:'short'}):'');
  const available=eventWalkingEnabled();$('event-complete-provider').textContent=available?'Calcolando, invii al servizio '+(payload.walking?.endpoint?'openrouteservice/HeiGIT':'FOSSGIS/OpenStreetMap')+' le coordinate di partenza e destinazione. Usate solo per il calcolo e la cache temporanea, senza archiviazione permanente.':'Il servizio pedonale integrato non è configurato per questo sito. Puoi usare Google Maps o inserire una tua stima dei minuti a piedi.';
  eventCompleteProviderNote=$('event-complete-provider').textContent;$('event-complete-manual-toggle').hidden=!available;$('event-complete-provider-link').href=payload.walking?.endpoint?'https://openrouteservice.org/':'https://routing.openstreetmap.de/about.html';
  $('event-complete-manual').hidden=available;$('event-complete-start-minutes').value='';$('event-complete-end-minutes').value='';$('event-complete-calculate').textContent=available?'Calcola camminate e arrivo':'Valuta con i minuti che inserisci';
  const link=$('event-complete-external');link.href='https://www.google.com/maps/dir/?api=1&travelmode=walking&origin='+result.arrival.lat+','+result.arrival.lon+'&destination='+to.lat+','+to.lon;
  $('event-complete-map').hidden=true;eventCompleteMap?.remove();eventCompleteMap=null;$('event-complete-dialog').showModal();$('event-complete-close').focus();
}
async function calculateEventComplete(){
  const context=eventCompleteContext,result=eventCompleteResult;if(!context||!result)return;
  const margin=Number($('event-complete-margin').value),deadline=$('event-complete-target').value;
  if(!Number.isInteger(margin)||margin<0||margin>60||deadline&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(deadline)){$('event-complete-status').textContent='Controlla l’orario e scegli un anticipo tra 0 e 60 minuti.';return;}
  const version=++eventCompleteVersion;eventCompleteController?.abort();const controller=new AbortController();eventCompleteController=controller;
  const active=()=>version===eventCompleteVersion&&$('event-complete-dialog').open,from=context.direction==='return'?eventPosition(context.event,context.venueDay||context.day):(context.startPoint||context.originReference||result.origin),to=context.targetPoint||eventPosition(context.event,context.venueDay||context.day),automatic=eventWalkingEnabled()&&!eventCompleteManual;
  $('event-complete-calculate').disabled=true;$('event-complete-result').replaceChildren();$('event-complete-status').textContent='Verifico i tratti a piedi…';
  try{
    let start,end;
    if(automatic){
      start=from.lat===result.origin.lat&&from.lon===result.origin.lon?{duration:0,distance:0,coordinates:[]}:await eventWalkingClient.load(from,result.origin,{signal:controller.signal});if(!active())return;
      end=await eventWalkingClient.load(result.arrival,to,{signal:controller.signal});if(!active())return;
    }else{
      const first=$('event-complete-start-minutes').value,last=$('event-complete-end-minutes').value;
      if(first===''||last===''||![first,last].every(v=>Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=120))throw Error('Inserisci i minuti per entrambi i tratti a piedi, anche 0 se sei già alla fermata.');
      start={duration:Number(first)*60};end={duration:Number(last)*60};
    }
    const assessment=eventTripAssessment({day:context.day,departure:result.row.time,arrivalDay:result.arrivalDay||context.day,arrival:result.arrivalTime,startSeconds:start.duration,endSeconds:end.duration,deadline,margin,notBefore:context.leaveAfter||'',now:Date.now()});
    if(assessment.state==='compatible')context.checkedJourney={key:result.row.trip+'|'+result.row.serviceDay+'|'+result.origin.code+'|'+result.arrival.code+'|'+(result.arrivalDay||context.day)+'|'+result.arrivalTime,assessment,walking:{startSeconds:start.duration,endSeconds:end.duration},manual:!automatic};else context.checkedJourney=null;
    const box=$('event-complete-result');
    box.append(el('p',Math.ceil(start.duration/60)+' min a piedi fino alla fermata · 2 min di margine per salire','event-direct-note'),el('p',result.duration+' min in autobus · circa '+Math.ceil(end.duration/60)+' min a piedi dopo la discesa','event-direct-note'));
    if(assessment.state==='unknown'){$('event-complete-status').textContent='Orario non valutabile con certezza: verifica data e cambio d’ora.';return;}
    box.append(el('h3','Arrivo stimato: '+eventJourneyMoment(assessment.venueAt,context.day,true)),el('p','Parti a piedi entro le '+eventJourneyMoment(assessment.leaveAt,context.day)+' · circa '+assessment.totalMinutes+' min complessivi, dal momento consigliato per partire.'));
    if(!assessment.canBoard)box.append(el('p',!assessment.respectsStart?'Questa corsa richiede di partire a piedi prima delle '+context.leaveAfter+'. Scegli una corsa successiva.':'Con il tempo a piedi e il margine di salita, questa partenza non è più raggiungibile. Scegli una corsa successiva.','event-journey-warning'));
    if(assessment.canArrive===false)box.append(el('p','Non rispetta l’arrivo richiesto con '+margin+' minuti di anticipo. Scegli una corsa precedente.','event-journey-warning'));
    if(assessment.canArrive===true)box.append(el('p','Arrivo stimato con '+assessment.spareMinutes+' minuti di anticipo rispetto alle '+deadline+'.','event-journey-compatible'));
    $('event-complete-status').textContent=(automatic?'Stima del servizio pedonale. ':'Stima personale: percorso a piedi non verificato. ')+(assessment.state==='compatible'?'Orari programmati compatibili con i tempi indicati.':'È necessario modificare il viaggio.')+' Ritardi, attraversamenti e accessi possono cambiare i tempi.';
    if(automatic&&typeof L!=='undefined'){
      eventCompleteMap?.remove();const map=$('event-complete-map');map.hidden=false;eventCompleteMap=L.map('event-complete-map');eventCompleteMap.zoomControl.setPosition('bottomleft');
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(eventCompleteMap);
      const points=[];for(const leg of [start,end])if(leg.coordinates.length){const p=leg.coordinates.map(([lon,lat])=>[lat,lon]);L.polyline(p,{color:'#397348',weight:5}).addTo(eventCompleteMap);points.push(...p);}
      for(const [point,label,color]of [[result.origin,'Salita','#254f78'],[result.arrival,'Discesa','#254f78'],[to,'Destinazione','#b13c45']]){L.circleMarker([point.lat,point.lon],{radius:7,color,fillOpacity:1}).bindPopup(el('strong',label)).addTo(eventCompleteMap);points.push([point.lat,point.lon]);}
      eventCompleteMap.fitBounds(points,{padding:[40,40],maxZoom:17});eventCompleteMap.invalidateSize();
    }
  }catch(error){if(active())$('event-complete-status').textContent=automatic?'Camminate non disponibili: nessuna puntualità calcolata. Riprova oppure apri Google Maps.':error.message;}
  finally{if(active())$('event-complete-calculate').disabled=false;}
}
$('event-complete-calculate').onclick=calculateEventComplete;
$('event-complete-close').onclick=()=>{const context=eventCompleteContext;$('event-complete-dialog').close();if($('bus-journey-dialog').open&&busTripSelection?.eventContext===context)openBusJourneySummary();};
$('event-complete-dialog').addEventListener('close',()=>{if($('event-complete-dialog').open)return;++eventCompleteVersion;eventCompleteController?.abort();eventCompleteContext=null;eventCompleteResult=null;eventCompleteMap?.remove();eventCompleteMap=null;});
for(const id of ['event-complete-target','event-complete-margin','event-complete-start-minutes','event-complete-end-minutes'])$(id).onchange=()=>{++eventCompleteVersion;if(eventCompleteContext)eventCompleteContext.checkedJourney=null;eventCompleteController?.abort();$('event-complete-calculate').disabled=false;$('event-complete-result').replaceChildren();$('event-complete-status').textContent='Dati modificati: ricalcola la stima.';};

function openEventReturn(context){
  eventReturnController?.abort();eventReturnContext=context;eventReturnIndex=null;++eventReturnVersion;eventReturnRows=[];
  $('event-return-walk-disclosure').textContent='Cercando con le camminate attive invii a '+(payload.walking?.endpoint?'openrouteservice/HeiGIT':'FOSSGIS/OpenStreetMap')+' le coordinate della sede e del punto iniziale di partenza, anche GPS se usato. Nessuna archiviazione permanente.';
  $('event-return-name').textContent=context.event.title+' → '+busDisplayName(context.originReference?.name||context.result.origin.name);
  const event=context.event,endAt=typeof eventVenueForDay==='function'?eventVenueForDay(event,context.day).endsAt:event.endsAt,known=endAt?.length>10&&eventDay(endAt)===context.day&&Date.parse(endAt)>Date.now();
  $('event-return-day').min=context.day;$('event-return-day').max=officialBus.validTo;$('event-return-day').value=context.day;
  $('event-return-after').value=known?new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(endAt)):'';
  $('event-return-status').textContent=known?'Uscita proposta dalla fine dell’evento: puoi modificarla. Prima di scegliere verifica il tempo a piedi fino al bus.':'Scegli giorno e orario in cui vuoi ripartire. La fine dell’evento non è disponibile per questa giornata.';
  $('event-return-results').replaceChildren();$('event-return-more').hidden=true;$('event-return-search').disabled=false;$('event-return-cancel').hidden=true;$('event-return-walk-mode').checked=false;$('event-return-walk-options').hidden=!eventWalkingEnabled();$('event-return-dialog').showModal();$('event-return-close').focus();
}
async function searchEventReturn(){
  const context=eventReturnContext;if(!context)return;const day=$('event-return-day').value,after=$('event-return-after').value,version=++eventReturnVersion,active=()=>version===eventReturnVersion&&$('event-return-dialog').open;
  $('event-return-results').replaceChildren();$('event-return-more').hidden=true;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<context.day||!/^([01]\d|2[0-3]):[0-5]\d$/.test(after)){$('event-return-status').textContent='Scegli un giorno e un orario validi per il ritorno.';return;}
  eventReturnController?.abort();const complete=Boolean($('event-return-walk-mode').checked)&&eventWalkingEnabled();const controller=new AbortController();eventReturnController=controller;
  $('event-return-search').disabled=true;$('event-return-cancel').hidden=false;$('event-return-status').textContent='Cerco corse dirette di ritorno…';
  try{
    const index=await loadEventBusStops();if(!active())return;eventReturnIndex=index;if(!index.days.includes(day))throw Error('Giorno fuori dalla validità dell’archivio ATV. Consulta gli orari ufficiali.');
    const origins=nearbyBusStops(index,eventPosition(context.event,context.venueDay||context.day),day,{radius:800,limit:5,withService:true}),i=index.days.indexOf(day),numbers=[...new Set(origins.flatMap(s=>s.services.filter(([,bits])=>[0,1,2].some(o=>i>=o&&bits[i-o]==='1')).map(([n])=>n)))].filter(n=>officialBus.lines.some(l=>l.number===n));
    const assets=[],failed=[];let next=0;await Promise.all(Array.from({length:Math.min(3,numbers.length)},async()=>{while(next<numbers.length){const n=numbers[next++];if(!active())return;try{assets.push(await getOfficialBusLine(n));}catch{failed.push(n);}}}));if(!active())return;
    const target=context.startPoint||context.originReference||context.result.origin;
    let candidates=origins.flatMap(origin=>directBusTrips(assets,{origin:origin.code,point:target,day,after,notBeforeSeconds:Math.max(eventDirectNow(day),Number(after.slice(0,2))*3600+Number(after.slice(3,5))*60+120),radius:500,allowOvernight:true,allTargets:complete,limit:complete?120:24})),walkingIncomplete=false;
    if(complete&&candidates.length){const verified=await evaluateEventWalkingCandidates(candidates,origins,eventPosition(context.event,context.venueDay||context.day),target,day,{notBefore:after,signal:controller.signal,active,status:text=>{$('event-return-status').textContent=text;}});if(!active())return;candidates=verified.rows;walkingIncomplete=verified.incomplete;}else candidates=bestEventConnections(candidates,eventPosition(context.event,context.venueDay||context.day),false);
    eventReturnRows=candidates.sort((a,b)=>(complete?Number(b.assessment.state==='compatible')-Number(a.assessment.state==='compatible'):0)||a.departureSeconds-b.departureSeconds||a.arrivalSeconds-b.arrivalSeconds).slice(0,12);
    const list=$('event-return-results');
    for(const [i,row]of eventReturnRows.entries()){
      const card=el('article','','event-direct-card');card.hidden=i>=3;card.tabIndex=-1;
      card.append(el('h3','Linea '+row.number+' · ritorno senza cambi'),el('p','Sali alle '+row.row.time.slice(0,5)+' a '+busDisplayName(row.origin.name)),el('p','Scendi alle '+row.arrivalTime.slice(0,5)+' a '+busDisplayName(row.arrival.name)+(row.arrivalDay!==day?' · '+formatDay(row.arrivalDay,{day:'numeric',month:'short'}):'')),el('p','Direzione: '+busDisplayName(row.row.destination)));
      if(complete)card.append(el('p',row.assessment.state==='compatible'?'Esci verso le '+eventJourneyMoment(row.assessment.leaveAt,day)+' · a destinazione verso le '+eventJourneyMoment(row.assessment.venueAt,day,true):'Camminate non verificate: controlla se riesci a raggiungere la fermata.',row.assessment.state==='compatible'?'event-journey-compatible':'event-journey-warning'));
      const choose=el('button','Vedi ritorno','dialog-save');choose.type='button';choose.onclick=()=>{
        if(eventDirectNow(day)>row.departureSeconds||row.assessment?.state==='compatible'&&row.assessment.leaveAt<Date.now()){$('event-return-status').textContent='Partenza trascorsa: aggiorna la ricerca.';return;}
        const data=assets.find(a=>a.number===row.number),back={...context,day,venueDay:context.venueDay||context.day,direction:'return',before:'',leaveAfter:after,targetPoint:target,targetLabel:context.startPoint?'Posizione di partenza iniziale':busDisplayName((context.originReference||context.result.origin).name),result:row};
        openBusTrip(data,row.row,choose,back);if(row.timelineMinutes){busTripSelection.calls=busTripSelection.calls.slice(0,row.timelineMinutes.length);busTripSelection.calls.forEach((call,j)=>{call.minutes=row.timelineMinutes[j];});}busTripSelection.arrival=busTripSelection.calls[row.arrivalOrder-row.row.order];renderBusTrip();openBusJourneySummary();
      };card.append(choose);list.append(card);
    }
    $('event-return-status').textContent=(eventReturnRows.length?'Corse programmate del '+formatDay(day,{day:'numeric',month:'short'})+'. Verifica anche i tratti a piedi.':'Nessun ritorno diretto trovato entro i limiti della ricerca (5 fermate vicine alla sede, destinazione entro 500 m). Non esclude viaggi con cambi.')+(failed.length?' Ricerca incompleta: linee non caricate '+failed.join(', ')+'. Riprova.':'');if(complete&&!eventReturnRows.length)$('event-return-status').textContent='Nessun ritorno compatibile con l’uscita richiesta e le camminate nei limiti della ricerca. Cambia orario o giorno.';if(walkingIncomplete)$('event-return-status').textContent+=' Alcune camminate non sono disponibili: le schede non verificate non confermano la raggiungibilità.';$('event-return-more').hidden=eventReturnRows.length<=3;
  }catch(error){if(active())$('event-return-status').textContent=error.message||'Ritorno non disponibile. Riprova.';}
  finally{if(active()){$('event-return-search').disabled=false;$('event-return-cancel').hidden=true;}}
}
$('event-return-search').onclick=searchEventReturn;
$('event-return-more').onclick=()=>{const rows=Array.from($('event-return-results').children),next=rows.filter(r=>r.hidden).slice(0,3);next.forEach(r=>r.hidden=false);$('event-return-more').hidden=!rows.some(r=>r.hidden);next[0]?.focus();};
$('event-return-close').onclick=()=>$('event-return-dialog').close();
$('event-return-dialog').addEventListener('close',()=>{if($('event-return-dialog').open)return;++eventReturnVersion;eventReturnController?.abort();eventReturnContext=null;eventReturnIndex=null;eventReturnRows=[];});
for(const id of ['event-return-day','event-return-after','event-return-walk-mode'])$(id).onchange=()=>{++eventReturnVersion;eventReturnController?.abort();$('event-return-cancel').hidden=true;$('event-return-results').replaceChildren();$('event-return-more').hidden=true;$('event-return-search').disabled=false;$('event-return-status').textContent='Dati modificati: cerca nuovamente il ritorno.';};

async function evaluateEventWalkingCandidates(candidates,origins,start,end,day,{deadline='',margin=0,notBefore='',signal,active=()=>true,status=()=>{}}={}){
  const starts=new Map(),ends=new Map(),targets=[...new Map([...candidates].sort((a,b)=>a.distance-b.distance).map(row=>[row.arrival.code,row.arrival])).values()].slice(0,6),codes=new Set(targets.map(s=>s.code));let incomplete=false;
  const rows=candidates.filter(row=>codes.has(row.arrival.code)),legs=[...origins.map(stop=>({map:starts,code:stop.code,from:start,to:stop})),...targets.map(stop=>({map:ends,code:stop.code,from:stop,to:end}))];
  for(const [i,leg]of legs.entries()){
    if(!active())return {rows:[],incomplete:true};status('Verifico camminate '+(i+1)+' di '+legs.length+'…');
    try{const route=leg.from.lat===leg.to.lat&&leg.from.lon===leg.to.lon?{duration:0,distance:0,coordinates:[]}:await eventWalkingClient.load(leg.from,leg.to,{signal});leg.map.set(leg.code,route);}catch{incomplete=true;}
  }
  if(!active())return {rows:[],incomplete:true};
  const evaluated=rows.map(row=>({...row,walking:{startSeconds:starts.get(row.origin.code)?.duration,endSeconds:ends.get(row.arrival.code)?.duration},assessment:eventTripAssessment({day,departure:row.row.time,arrivalDay:row.arrivalDay||day,arrival:row.arrivalTime,startSeconds:starts.get(row.origin.code)?.duration,endSeconds:ends.get(row.arrival.code)?.duration,deadline,margin,notBefore,now:Date.now()})})).filter(row=>row.assessment.state!=='late');
  return {rows:bestEventConnections(evaluated,start,true),incomplete};
}

$('event-return-cancel').onclick=()=>{++eventReturnVersion;eventReturnController?.abort();$('event-return-search').disabled=false;$('event-return-cancel').hidden=true;$('event-return-status').textContent='Ricerca annullata. Puoi modificare i dati o riprovare.';};

$('event-complete-manual-toggle').onclick=()=>{++eventCompleteVersion;eventCompleteController?.abort();eventCompleteManual=!eventCompleteManual;$('event-complete-provider').textContent=eventCompleteManual?'Valutazione locale: minuti e coordinate non vengono inviati al servizio.':eventCompleteProviderNote;$('event-complete-manual').hidden=!eventCompleteManual&&eventWalkingEnabled();$('event-complete-manual-toggle').textContent=eventCompleteManual?'Torna al calcolo del servizio':'Inserisci tu i minuti a piedi';$('event-complete-calculate').disabled=false;$('event-complete-calculate').textContent=eventCompleteManual?'Valuta con i minuti che inserisci':'Calcola camminate e arrivo';$('event-complete-result').replaceChildren();$('event-complete-status').textContent=eventCompleteManual?'I minuti inseriti sono una tua stima, non un percorso pedonale verificato.':'Puoi ricalcolare con il servizio pedonale.';};
