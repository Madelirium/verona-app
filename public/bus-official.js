// Programmed service only. Dates are service dates in Europe/Rome, including day offsets.
const officialBus = payload.busOfficial || {lines:[]};
const officialBusCache = new Map(),officialBusLoads=new Map();
let officialBusData=null, officialBusRequest=0, officialBusFocus=null;
let officialTimeMode='next';
let officialBusReturn=null;
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
    const response=await fetch(officialBus.assetBase+encodeURIComponent(number)+'.json');if(!response.ok)throw new Error('HTTP '+response.status);
    const data=await response.json();if(data.number!==number||data.sha256!==officialBus.sha256||data.validFrom!==officialBus.validFrom||data.validTo!==officialBus.validTo||!Array.isArray(data.trips)||!data.stops)throw new Error('Archivio non coerente');officialBusCache.set(number,data);return data;
  })().finally(()=>officialBusLoads.delete(number)));
  return officialBusLoads.get(number);
}
function nextBusStopDepartures(data,stopCode,now=new Date(),limit=3){
  const day=dayInRome(now),rows=officialDepartures(data,day,stopCode);if(rows===null)return null;
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(now).split(':').map(Number),seconds=parts[0]*3600+parts[1]*60+parts[2];
  const previous=shiftDay(day,-1),overnight=(officialDepartures(data,previous,stopCode)||[]).filter(row=>row.offset>0).map(row=>({...row,minutes:row.minutes-1440,offset:row.offset-1}));
  const future=[];for(let offset=1;offset<7;offset++)for(const row of officialDepartures(data,shiftDay(day,offset),stopCode)||[])future.push({...row,minutes:row.minutes+offset*1440,offset:row.offset+offset});
  return [...overnight,...rows,...future].filter(row=>row.minutes*60+Number(row.time.slice(6,8))>=seconds).sort((a,b)=>a.minutes-b.minutes||a.time.localeCompare(b.time)).slice(0,limit);
}
const busPreviewVersions=new WeakMap();
let busTripSelection=null,busTripFocus=null;
function busTripTimeline(data,row){
  const trip=data.trips.find(trip=>trip.id===row.trip&&trip.dates.includes(row.serviceDay)),origin=trip?.calls[row.order];
  if(!origin||origin[1]!==row.time)return [];
  const seconds=(time,offset)=>Number(time.slice(0,2))*3600+Number(time.slice(3,5))*60+Number(time.slice(6,8)||0)+(offset||0)*86400,start=seconds(origin[1],origin[2]);
  return trip.calls.slice(row.order).map((call,index)=>{const arrival=index>0&&Boolean(call[4]),time=arrival?call[4]:call[1],offset=arrival?call[5]:call[2];return {code:call[0],name:data.stops[call[0]]?.name||'Fermata '+call[0],time,day:shiftDay(row.serviceDay,offset||0),minutes:Math.max(0,Math.ceil((seconds(time,offset)-start)/60)),origin:index===0,arrival};});
}
function openBusTrip(data,row,focus=null){
  busTripFocus=focus||document.activeElement;busTripSelection={data,row,calls:busTripTimeline(data,row)};
  $('bus-trip-title').textContent='Linea '+data.number+' · '+row.time.slice(0,5);
  const first=busTripSelection.calls[0];$('bus-trip-summary').textContent=first?formatDay(first.day,{weekday:'long',day:'numeric',month:'long'})+' · Da '+busDisplayName(first.name)+' verso '+busDisplayName(row.destination):'Corsa non disponibile in questo archivio.';
  $('bus-trip-search').value='';renderBusTrip();$('bus-trip-dialog').showModal();$('bus-trip-close').focus();
}
function renderBusTrip(){
  const list=$('bus-trip-stops');list.replaceChildren();if(!busTripSelection)return;
  const query=placeSearchText($('bus-trip-search').value),all=busTripSelection.calls,calls=all.filter(call=>placeSearchText(call.name+' '+call.code).includes(query));
  $('bus-trip-count').textContent=query?(calls.length?calls.length+(calls.length===1?' fermata trovata in questa corsa':' fermate trovate in questa corsa'):'Nessuna fermata con questo nome in questa corsa.'):all.length+' fermate · orari previsti';
  for(const call of calls){const item=el('li','','bus-trip-stop'+(call.origin?' bus-trip-origin':'')),clock=el('div','','bus-trip-clock'),info=el('div');clock.append(el('strong',call.time.slice(0,5)));clock.title=call.time;
    if(call.day!==all[0]?.day)clock.append(el('small',formatDay(call.day,{day:'numeric',month:'short'})));
    info.append(el('strong',busDisplayName(call.name)),el('small',call.origin?'La tua partenza · Fermata '+call.code:(call.arrival?'Arrivo previsto':'Passaggio previsto')+' · '+call.minutes+' min dalla partenza · Fermata '+call.code));item.append(clock,info);list.append(item);
  }
}
$('bus-trip-search').oninput=renderBusTrip;
$('bus-trip-close').onclick=()=>$('bus-trip-dialog').close();
$('bus-trip-dialog').addEventListener('close',()=>{if(busTripFocus?.isConnected)busTripFocus.focus();else $('network-sheet-more').focus();busTripSelection=null;});
async function renderBusStopPreview(box,number,stopCode,now=null){
  const version=(busPreviewVersions.get(box)||0)+1;busPreviewVersions.set(box,version);
  box.replaceChildren(el('p','Caricamento delle prossime partenze…','bus-stop-preview-note'));
  try{
    const data=await getOfficialBusLine(number),rows=nextBusStopDepartures(data,stopCode,now||new Date());if(busPreviewVersions.get(box)!==version)return;box.replaceChildren();
    if(rows===null){box.append(el('p','Archivio scaduto o data non coperta. Consulta la fonte ATV.','bus-stop-preview-note'));return;}
    if(!data.stops[stopCode]){box.append(el('p','Scegli la fermata nell’elenco completo degli orari.','bus-stop-preview-note'));return;}
    box.append(el('small','Prossime partenze · orari previsti','bus-stop-preview-caption'));
    if(!rows.length)box.append(el('p','Nessun’altra partenza nei prossimi giorni coperti dall’archivio.','bus-stop-preview-note'));
    for(const row of rows){const entry=el('div','','bus-stop-departure'),clock=el('div');clock.append(el('strong',row.time.slice(0,5)));if(row.offset)clock.append(el('small',row.offset===1?'Domani':'Tra '+row.offset+' giorni'));entry.append(clock,el('span','→ '+row.destination));box.append(entry);}
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
  if(!officialBusData)return;
  const day=$('official-date').value,stop=$('official-stop').value;
  const isToday=day===dayInRome(new Date()),next=isToday&&officialTimeMode==='next';
  $('official-next').hidden=!isToday;$('official-next').setAttribute('aria-pressed',String(next));$('official-day').setAttribute('aria-pressed',String(!next));
  if(!day||day<officialBusData.validFrom||day>officialBusData.validTo){$('official-summary').textContent='Data fuori dalla validità dell’archivio: aggiorna i dati o consulta ATV.';return;}
  if(!stop){$('official-summary').textContent='Scegli una fermata per vedere gli orari.';return;}
  const rows=next?officialUpcomingRows(officialBusData,day,stop,$('official-destination').value):officialDepartures(officialBusData,day,stop,$('official-destination').value);
  $('official-summary').textContent=rows.length+' partenze · '+formatDay(day,{day:'numeric',month:'long'})+' · '+officialBusData.stops[stop].name;
  if(!rows.length){list.append(el('p',next?'Nessun’altra partenza per il servizio di oggi. Consulta Tutta la giornata o scegli un’altra data.':'Nessuna partenza programmata per questa fermata, data e destinazione nell’archivio.','timetable-prompt'));return;}
  for(const row of rows){const item=el('div','','timetable-row'),clock=el('div'),meta=el('div','','timetable-row-meta');clock.append(el('strong',row.time.slice(0,5),'timetable-time'));if(row.offset)clock.append(el('small','Giorno successivo +'+row.offset));meta.append(el('strong','→ '+row.destination));item.append(clock,meta);list.append(item);}
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
    updateOfficialDestinations(preset.stopCode?'':saved.destination);renderOfficialTimes();
    const contextName=data.stops[preset.stopCode]?.name||'Scegli una fermata';$('official-context-label').textContent='Linea '+number+' · '+(typeof busDisplayName==='function'?busDisplayName(contextName):contextName);
    if(preset.stopCode&&!data.stops[preset.stopCode])$('official-summary').textContent='Questo codice fermata non è presente nella linea ufficiale. Scegli una fermata dall’elenco.';
  }catch{if(request!==officialBusRequest)return;$('official-summary').textContent='Impossibile caricare gli orari. Controlla la connessione e riprova.';const retry=el('button','Riprova');retry.onclick=()=>loadOfficialLine(number,preset);$('official-results').append(retry);}
}
function openOfficialBus(number='',preset={}){
  officialBusFocus=document.activeElement;
  officialBusReturn=preset.onReturn||null;
  $('official-bus-dialog').classList.toggle('official-context-known',Boolean(preset.stopCode));$('official-context').hidden=!preset.stopCode;
  $('close-official-bus').textContent=officialBusReturn?'←':'×';$('close-official-bus').setAttribute('aria-label',officialBusReturn?'Torna alla fermata':'Chiudi orari ufficiali');
  officialTimeMode=preset.mode==='day'?'day':'next';
  const lines=[...officialBus.lines].sort((a,b)=>a.number.localeCompare(b.number,'it',{numeric:true}));
  officialOptions('official-line',lines.map(line=>({value:line.number,label:line.number+' · '+line.name})),number||lines[0]?.number);
  $('official-bus-dialog').showModal();loadOfficialLine($('official-line').value,preset);
}
$('close-official-bus').onclick=()=>$('official-bus-dialog').close();
$('official-bus-dialog').addEventListener('close',()=>{officialBusRequest++;const back=officialBusReturn;officialBusReturn=null;if(back)back();else if(officialBusFocus?.isConnected)officialBusFocus.focus();});
$('official-change').onclick=()=>{$('official-bus-dialog').classList.toggle('official-context-known',false);$('official-context').hidden=true;$('official-stop').focus();};
$('official-line').onchange=()=>loadOfficialLine($('official-line').value,{date:$('official-date').value});
for(const id of ['official-date','official-stop','official-destination'])$(id).onchange=()=>{if(id!=='official-destination')updateOfficialDestinations();renderOfficialTimes();$('official-results').scrollTop=0;};
$('official-next').onclick=()=>{officialTimeMode='next';renderOfficialTimes();$('official-results').scrollTop=0;};
$('official-day').onclick=()=>{officialTimeMode='day';renderOfficialTimes();$('official-results').scrollTop=0;};

$('bus-official-all').hidden=!officialBus.lines.length;
$('bus-official-all').onclick=()=>openOfficialBus();
