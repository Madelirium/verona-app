// Programmed service only. Dates are service dates in Europe/Rome, including day offsets.
const officialBus = payload.busOfficial || {lines:[]};
const officialBusCache = new Map(),officialBusLoads=new Map();
let officialBusData=null, officialBusRequest=0, officialBusFocus=null;
let officialTimeMode='next';
let officialBusReturn=null,officialEventContext=null;
function renderOfficialEventContext(day=''){
  const box=$('official-event-context'),warning=$('official-event-warning');box.hidden=!officialEventContext;
  warning.textContent='';warning.hidden=true;
  if(!officialEventContext){$('official-event-title').textContent='';$('official-event-when').textContent='';return;}
  const {event,day:eventDate}=officialEventContext;
  $('official-event-title').textContent='Per l’evento: '+event.title;
  $('official-event-when').textContent=typeof eventTravelWhen==='function'?eventTravelWhen(event,eventDate):eventWhen(event);
  if(/^\d{4}-\d{2}-\d{2}$/.test(day)&&day!==eventDate){warning.hidden=false;warning.textContent='La data del servizio è diversa dal giorno scelto per l’evento ('+formatDay(eventDate,{day:'numeric',month:'short'})+').';}
}
function officialUpcomingRows(data,day,stop,destination='',now=new Date()){
  const rows=officialDepartures(data,day,stop,destination);if(rows===null)return null;
  if(day!==dayInRome(now))return rows;
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(now).split(':').map(Number),seconds=parts[0]*3600+parts[1]*60+parts[2];
  const overnight=(officialDepartures(data,shiftDay(day,-1),stop,destination)||[]).filter(row=>row.offset>0).map(row=>({...row,minutes:row.minutes-1440,offset:row.offset-1}));
  return [...overnight,...rows].filter(row=>row.minutes*60+Number(row.time.slice(6,8)||0)>=seconds).sort((a,b)=>a.minutes-b.minutes);
}
function updateOfficialDestinations(preferred=$('official-destination').value){
  if(!officialBusData)return;
  const day=$('official-date').value,stop=$('official-stop').value,rows=officialDepartures(officialBusData,day,stop)||[];
  officialOptions('official-destination',[...new Set(rows.map(row=>row.destination))].sort().map(value=>({value,label:value})),preferred,'Tutte le destinazioni');
}
function officialDepartures(data,day,stop,destination=''){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!data.validFrom||!data.validTo||day<data.validFrom||day>data.validTo)return null;
  const rows=[];
  for(const trip of data.trips){
    if(!trip.dates.includes(day)||(destination&&trip.destination!==destination))continue;
    trip.calls.forEach((call,index)=>{if(call[0]===stop&&call[3])rows.push({serviceDay:day,trip:trip.id,destination:trip.destination,time:call[1],offset:call[2],order:index,minutes:Number(call[1].slice(0,2))*60+Number(call[1].slice(3,5))+call[2]*1440});});
  }
  return rows.sort((a,b)=>a.minutes-b.minutes||a.time.localeCompare(b.time)||a.trip.localeCompare(b.trip));
}
async function getOfficialBusLine(number){
  if(officialBusCache.has(number))return officialBusCache.get(number);
  if(!officialBusLoads.has(number))officialBusLoads.set(number,(async()=>{
    const response=await fetch(officialBus.assetBase+encodeURIComponent(number)+'.json',typeof AbortSignal!=='undefined'&&typeof AbortSignal.timeout==='function'?{signal:AbortSignal.timeout(15000)}:{});if(!response.ok)throw new Error('HTTP '+response.status);
    const data=await response.json();if(data.number!==number||data.sha256!==officialBus.sha256||data.validFrom!==officialBus.validFrom||data.validTo!==officialBus.validTo||officialBus.alightingAvailable&&!data.alightingAvailable||!Array.isArray(data.trips)||!data.stops)throw new Error('Archivio non coerente');officialBusCache.set(number,data);return data;
  })().finally(()=>officialBusLoads.delete(number)));
  return officialBusLoads.get(number);
}
function nextBusStopDepartures(data,stopCode,now=new Date(),limit=3,destination=''){
  const day=dayInRome(now),rows=officialDepartures(data,day,stopCode,destination);if(rows===null)return null;
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(now).split(':').map(Number),seconds=parts[0]*3600+parts[1]*60+parts[2];
  const previous=shiftDay(day,-1),overnight=(officialDepartures(data,previous,stopCode,destination)||[]).filter(row=>row.offset>0).map(row=>({...row,minutes:row.minutes-1440,offset:row.offset-1}));
  const future=[];for(let offset=1;offset<7;offset++)for(const row of officialDepartures(data,shiftDay(day,offset),stopCode,destination)||[])future.push({...row,minutes:row.minutes+offset*1440,offset:row.offset+offset});
  return [...overnight,...rows,...future].filter(row=>row.minutes*60+Number(row.time.slice(6,8))>=seconds).sort((a,b)=>a.minutes-b.minutes||a.time.localeCompare(b.time)).slice(0,limit);
}
function busStopCalendarDay(data,stopCode,day,destination=''){
  const rows=officialDepartures(data,day,stopCode,destination);if(rows===null)return null;
  const overnight=(officialDepartures(data,shiftDay(day,-1),stopCode,destination)||[]).filter(row=>row.offset>0).map(row=>({...row,minutes:row.minutes-1440,offset:row.offset-1}));
  return [...overnight,...rows].filter(row=>row.offset===0).sort((a,b)=>a.minutes-b.minutes||a.time.localeCompare(b.time));
}
const busPreviewVersions=new WeakMap();
let busTripSelection=null,busTripFocus=null;
function busTripTimeline(data,row){
  const trip=data.trips.find(trip=>trip.id===row.trip&&trip.dates.includes(row.serviceDay)),origin=trip?.calls[row.order];
  if(!origin||origin[1]!==row.time)return [];
  const seconds=(time,offset)=>Number(time.slice(0,2))*3600+Number(time.slice(3,5))*60+Number(time.slice(6,8)||0)+(offset||0)*86400,start=seconds(origin[1],origin[2]);
  return trip.calls.slice(row.order).map((call,index)=>{const arrival=index>0&&Boolean(call[4]),time=arrival?call[4]:call[1],offset=arrival?call[5]:call[2];return {code:call[0],name:data.stops[call[0]]?.name||'Fermata '+call[0],time,day:shiftDay(row.serviceDay,offset||0),minutes:Math.max(0,Math.ceil((seconds(time,offset)-start)/60)),origin:index===0,arrival,alighting:call[6]};});
}
function openBusTrip(data,row,focus=null){
  busTripFocus=focus||document.activeElement;busTripSelection={data,row,calls:busTripTimeline(data,row)};
  $('bus-trip-title').textContent='Linea '+data.number+' · '+row.time.slice(0,5);
  const first=busTripSelection.calls[0];$('bus-trip-summary').textContent=first?formatDay(first.day,{weekday:'long',day:'numeric',month:'long'})+' · Da '+busDisplayName(first.name)+' verso '+busDisplayName(row.destination):'Corsa non disponibile in questo archivio.';
  $('bus-trip-arrival').hidden=true;$('bus-trip-arrival').textContent='';$('bus-trip-search').value='';renderBusTrip();$('bus-trip-dialog').showModal();$('bus-trip-close').focus();
}
function renderBusTrip(){
  const list=$('bus-trip-stops');list.replaceChildren();if(!busTripSelection)return;
  const query=placeSearchText($('bus-trip-search').value),all=busTripSelection.calls,calls=all.filter(call=>placeSearchText(call.name+' '+call.code).includes(query));
  $('bus-trip-count').textContent=query?(calls.length?calls.length+(calls.length===1?' fermata trovata in questa corsa':' fermate trovate in questa corsa'):'Nessuna fermata con questo nome in questa corsa.'):all.length+' fermate · orari previsti';
  for(const call of calls){const item=el('li','','bus-trip-stop'+(call.origin?' bus-trip-origin':'')),clock=el('div','','bus-trip-clock'),info=el('div');clock.append(el('strong',call.time.slice(0,5)));clock.title=call.time;
    if(call.day!==all[0]?.day)clock.append(el('small',formatDay(call.day,{day:'numeric',month:'short'})));
    info.append(el('strong',busDisplayName(call.name)),el('small',call.origin?'La tua partenza · Fermata '+call.code:(call.arrival?'Arrivo previsto':'Passaggio previsto')+' · '+call.minutes+' min dalla partenza · Fermata '+call.code));item.append(clock,info);
    if(!call.origin&&call.alighting===false)info.append(el('small','Non è consentita la discesa a questa fermata.'));
    if(!call.origin&&call.alighting!==false){const choose=el('button',busTripSelection.arrival===call?'✓ Destinazione':'Scegli arrivo','bus-trip-choose');choose.setAttribute('data-focus-key','bus-arrival-'+all.indexOf(call));choose.setAttribute('aria-pressed',String(busTripSelection.arrival===call));choose.setAttribute('aria-label','Scendi a '+busDisplayName(call.name)+' alle '+call.time.slice(0,5));choose.onclick=()=>{busTripSelection.arrival=call;const summary=$('bus-trip-arrival');summary.hidden=false;summary.textContent=busDisplayName(call.name)+' · '+(call.arrival?'arrivo programmato ':'passaggio programmato ')+call.time.slice(0,5)+' del '+formatDay(call.day,{day:'numeric',month:'short'})+' · '+call.minutes+' min dalla partenza';const scroll=list.scrollTop||0;renderBusTrip();list.scrollTop=scroll;const replacement=Array.from(list.children).flatMap(item=>Array.from(item.children)).find(node=>node.getAttribute('data-focus-key')==='bus-arrival-'+all.indexOf(call));replacement?.focus({preventScroll:true});openBusJourneySummary();};item.append(choose);}
    list.append(item);
  }
}
$('bus-trip-search').oninput=renderBusTrip;
$('bus-trip-close').onclick=()=>$('bus-trip-dialog').close();
$('bus-trip-dialog').addEventListener('close',()=>{if($('bus-journey-dialog').open)$('bus-journey-dialog').close();if(busTripFocus?.isConnected)busTripFocus.focus();else $('network-sheet-more').focus();busTripSelection=null;});
async function renderBusStopPreview(box,number,stopCode,now=null){
  const version=(busPreviewVersions.get(box)||0)+1;busPreviewVersions.set(box,version);
  box.replaceChildren(el('p','Caricamento delle prossime partenze…','bus-stop-preview-note'));
  try{
    const data=await getOfficialBusLine(number),rows=nextBusStopDepartures(data,stopCode,now||new Date());if(busPreviewVersions.get(box)!==version)return;box.replaceChildren();
    if(rows===null){box.append(el('p','Archivio scaduto o data non coperta. Consulta la fonte ATV.','bus-stop-preview-note'));return;}
    if(!data.stops[stopCode]){box.append(el('p','Scegli la fermata nell’elenco completo degli orari.','bus-stop-preview-note'));return;}
    box.append(el('small','Prossime partenze · orari previsti','bus-stop-preview-caption'));
    if(!rows.length)box.append(el('p','Nessun’altra partenza nei prossimi giorni coperti dall’archivio.','bus-stop-preview-note'));
    for(const row of rows){const entry=el('button','','bus-stop-departure'),clock=el('div');entry.type='button';clock.append(el('strong',row.time.slice(0,5)));if(row.offset)clock.append(el('small',row.offset===1?'Domani':'Tra '+row.offset+' giorni'));entry.append(clock,el('span','→ '+row.destination),el('span','Fermate e arrivo ›','bus-trip-link'));entry.setAttribute('aria-label','Vedi fermate della corsa delle '+row.time.slice(0,5)+' verso '+row.destination);entry.onclick=()=>openBusTrip(data,row,entry);box.append(entry);}
  }catch{if(busPreviewVersions.get(box)!==version)return;box.replaceChildren(el('p','Orari temporaneamente non disponibili.','bus-stop-preview-note'));const retry=el('button','Riprova');retry.onclick=()=>renderBusStopPreview(box,number,stopCode);box.append(retry);}
}
function officialOptions(id,items,value,placeholder){
  const select=$(id);select.replaceChildren();
  if(placeholder){const option=el('option',placeholder);option.value='';select.append(option);}
  for(const item of items){const option=el('option',item.label);option.value=item.value;select.append(option);}
  select.value=items.some(item=>item.value===value)?value:placeholder?'':items[0]?.value||'';
}
function renderOfficialTimes(){
  const list=$('official-results');list.replaceChildren();
  renderOfficialEventContext($('official-date').value);
  if(!officialBusData)return;
  const day=$('official-date').value,stop=$('official-stop').value;
  const isToday=day===dayInRome(new Date()),next=isToday&&officialTimeMode==='next';
  $('official-next').hidden=!isToday;$('official-next').setAttribute('aria-pressed',String(next));$('official-day').setAttribute('aria-pressed',String(!next));
  if(!day||day<officialBusData.validFrom||day>officialBusData.validTo){$('official-summary').textContent='Data fuori dalla validità dell’archivio: aggiorna i dati o consulta ATV.';return;}
  if(!stop){$('official-summary').textContent='Scegli una fermata per vedere gli orari.';return;}
  const rows=next?officialUpcomingRows(officialBusData,day,stop,$('official-destination').value):officialDepartures(officialBusData,day,stop,$('official-destination').value);
  $('official-summary').textContent=rows.length+' partenze · '+formatDay(day,{day:'numeric',month:'long'})+' · '+officialBusData.stops[stop].name;
  if(!rows.length){list.append(el('p',next?'Nessun’altra partenza per il servizio di oggi. Consulta Tutta la giornata o scegli un’altra data.':'Nessuna partenza programmata per questa fermata, data e destinazione nell’archivio.','timetable-prompt'));return;}
  for(const row of rows){const item=el('button','','timetable-row bus-official-trip'),clock=el('div'),meta=el('div','','timetable-row-meta');item.type='button';clock.append(el('strong',row.time.slice(0,5),'timetable-time'));if(row.offset)clock.append(el('small','Giorno successivo +'+row.offset));meta.append(el('strong','→ '+row.destination),el('span','Fermate e arrivo ›','bus-trip-link'));item.append(clock,meta);item.setAttribute('aria-label','Vedi fermate della corsa delle '+row.time.slice(0,5)+' verso '+row.destination);item.setAttribute('data-focus-key','official-trip-'+row.serviceDay+'-'+row.trip+'-'+row.order);item.onclick=()=>openBusTrip(officialBusData,row,item);list.append(item);}
  try{localStorage.setItem('verona-official-bus-'+officialBusData.number,JSON.stringify({stop,destination:$('official-destination').value}));}catch{}
}
async function loadOfficialLine(number,preset={}){
  const request=++officialBusRequest;officialBusData=null;$('official-results').replaceChildren();$('official-summary').textContent='Caricamento degli orari…';
  for(const id of ['official-date','official-stop','official-destination'])$(id).disabled=true;
  try{
    const data=await getOfficialBusLine(number);
    if(request!==officialBusRequest||!$('official-bus-dialog').open)return;
    officialBusData=data;
    let saved={};try{saved=JSON.parse(localStorage.getItem('verona-official-bus-'+number)||'{}')||{};}catch{}
    const stops=Object.values(data.stops).sort((a,b)=>a.name.localeCompare(b.name,'it')||a.code.localeCompare(b.code));
    officialOptions('official-stop',stops.map(s=>({value:s.code,label:s.name+' · '+s.code})),preset.stopCode||saved.stop,'Scegli la fermata');
    officialOptions('official-destination',[...new Set(data.trips.map(t=>t.destination))].sort().map(value=>({value,label:value})),preset.stopCode?'':saved.destination,'Tutte le destinazioni');
    const input=$('official-date');input.min=data.validFrom;input.max=data.validTo;input.value=preset.date||dayInRome(new Date().toISOString());
    $('official-validity').textContent='Archivio valido dal '+formatDay(data.validFrom,{day:'numeric',month:'long'})+' al '+formatDay(data.validTo,{day:'numeric',month:'long',year:'numeric'})+'. Fonte: ATV / RAP Veneto · NAP. Pubblicato il '+formatDay(dayInRome(data.publicationTimestamp),{day:'numeric',month:'long'})+'.';
    for(const id of ['official-date','official-stop','official-destination'])$(id).disabled=false;
    updateOfficialDestinations(preset.destination||(preset.stopCode?'':saved.destination));renderOfficialTimes();
    const contextName=data.stops[preset.stopCode]?.name||'Scegli una fermata';$('official-context-label').textContent='Linea '+number+' · Partenze da '+(typeof busDisplayName==='function'?busDisplayName(contextName):contextName);
    if(preset.stopCode&&!data.stops[preset.stopCode])$('official-summary').textContent='Questo codice fermata non è presente nella linea ufficiale. Scegli una fermata dall’elenco.';
  }catch{if(request!==officialBusRequest)return;$('official-summary').textContent='Impossibile caricare gli orari. Controlla la connessione e riprova.';const retry=el('button','Riprova');retry.onclick=()=>loadOfficialLine(number,preset);$('official-results').append(retry);}
}
function openOfficialBus(number='',preset={}){
  officialBusFocus=document.activeElement;
  officialBusReturn=preset.onReturn||null;
  const context=preset.eventContext;
  officialEventContext=context?.event&&typeof context.event.title==='string'&&typeof context.event.startsAt==='string'&&typeof context.event.endsAt==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(context.day)?{event:{...context.event},day:context.day}:null;
  $('official-event-context').open=false;renderOfficialEventContext();
  $('official-bus-title').textContent=officialEventContext?'Orari della fermata':'Quando passa?';
  $('official-bus-dialog').classList.toggle('official-context-known',Boolean(preset.stopCode));$('official-context').hidden=!preset.stopCode;
  $('close-official-bus').textContent=officialBusReturn||officialEventContext?'←':'×';$('close-official-bus').setAttribute('aria-label',officialBusReturn?'Torna alla fermata':officialEventContext?'Torna alle fermate dell’evento':'Chiudi orari ufficiali');
  officialTimeMode=preset.mode==='day'?'day':'next';
  const lines=[...officialBus.lines].sort((a,b)=>a.number.localeCompare(b.number,'it',{numeric:true}));
  officialOptions('official-line',lines.map(line=>({value:line.number,label:line.number+' · '+line.name})),number||lines[0]?.number);
  if(!$('official-bus-dialog').open)$('official-bus-dialog').showModal();return loadOfficialLine($('official-line').value,preset);
}
$('close-official-bus').onclick=()=>$('official-bus-dialog').close();
$('official-bus-dialog').addEventListener('close',()=>{if($('official-bus-dialog').open)return;officialBusRequest++;const back=officialBusReturn;officialBusReturn=null;officialEventContext=null;renderOfficialEventContext();if(back)back();else if(officialBusFocus?.isConnected)officialBusFocus.focus();});
$('official-change').onclick=()=>{$('official-bus-dialog').classList.toggle('official-context-known',false);$('official-context').hidden=true;$('official-stop').focus();};
$('official-line').onchange=()=>loadOfficialLine($('official-line').value,{date:$('official-date').value});
for(const id of ['official-date','official-stop','official-destination'])$(id).onchange=()=>{if(id!=='official-destination')updateOfficialDestinations();renderOfficialTimes();$('official-results').scrollTop=0;};
$('official-next').onclick=()=>{officialTimeMode='next';renderOfficialTimes();$('official-results').scrollTop=0;};
$('official-day').onclick=()=>{officialTimeMode='day';renderOfficialTimes();$('official-results').scrollTop=0;};

$('bus-official-all').hidden=!officialBus.lines.length;
$('bus-official-all').onclick=()=>openOfficialBus();

function openBusJourneySummary(){
 const selection=busTripSelection,arrival=selection?.arrival,index=selection?.calls.indexOf(arrival);if(!arrival||index<1)return;
 const calls=selection.calls.slice(0,index+1),origin=calls[0],content=$('bus-journey-content');content.replaceChildren();
 $('bus-journey-title').textContent='Il tuo viaggio · linea '+selection.data.number;
 for(const [call,label,kind]of [[origin,'Partenza','start'],[arrival,arrival.arrival?'Arrivo programmato':'Passaggio programmato','end']]){
  const card=el('section','','bus-journey-point '+kind),head=el('p',label+' · '+formatDay(call.day,{weekday:'short',day:'numeric',month:'short',year:'numeric'}),'bus-journey-label');
  card.append(head,el('strong',call.time.slice(0,5),'bus-journey-time'),el('h3',busDisplayName(call.name)),el('p','Fermata '+call.code,'bus-journey-code'));content.append(card);
 }
 const between=Math.max(0,calls.length-2);content.append(el('p',arrival.minutes+' min di viaggio · '+between+(between===1?' fermata intermedia':' fermate intermedie'),'bus-journey-duration'),el('h3','Fermate del tuo viaggio','bus-journey-stops-title'));
 const list=el('ol','','bus-journey-timeline');list.setAttribute('aria-label','Fermate dalla salita alla destinazione');
 calls.forEach((call,i)=>{const item=el('li','','bus-journey-call'+(i===0?' start':i===calls.length-1?' end':'')),info=el('div');info.append(el('strong',busDisplayName(call.name)),el('small',i===0?'Sali qui':i===calls.length-1?'Destinazione':call.minutes+' min dalla partenza'));item.append(el('span',call.time.slice(0,5)),info);if(call.day!==origin.day)info.append(el('small',formatDay(call.day,{day:'numeric',month:'short'})));list.append(item);});
 content.append(list);content.scrollTop=0;$('bus-journey-dialog').showModal();$('bus-journey-title').focus({preventScroll:true});
}
$('bus-journey-close').onclick=()=>$('bus-journey-dialog').close();
$('bus-journey-change').onclick=()=>$('bus-journey-dialog').close();
$('bus-journey-departures').onclick=()=>{$('bus-journey-dialog').close();$('bus-trip-dialog').close();};
