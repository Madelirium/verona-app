// Programmed service only. Dates are service dates in Europe/Rome, including day offsets.
const officialBus = payload.busOfficial || {lines:[]};
const officialBusCache = new Map(),officialBusLoads=new Map();
let officialBusData=null, officialBusRequest=0, officialBusFocus=null;
function officialDepartures(data,day,stop,destination=''){
  if(day<data.validFrom||day>data.validTo)return null;
  const rows=[];
  for(const trip of data.trips){
    if(!trip.dates.includes(day)||(destination&&trip.destination!==destination))continue;
    trip.calls.forEach((call,index)=>{if(call[0]===stop&&call[3])rows.push({trip:trip.id,destination:trip.destination,time:call[1],offset:call[2],order:index,minutes:Number(call[1].slice(0,2))*60+Number(call[1].slice(3,5))+call[2]*1440});});
  }
  return rows.sort((a,b)=>a.minutes-b.minutes||a.time.localeCompare(b.time)||a.trip.localeCompare(b.trip));
}
async function getOfficialBusLine(number){
  if(officialBusCache.has(number))return officialBusCache.get(number);
  if(!officialBusLoads.has(number))officialBusLoads.set(number,(async()=>{
    const response=await fetch(officialBus.assetBase+encodeURIComponent(number)+'.json');if(!response.ok)throw new Error('HTTP '+response.status);
    const data=await response.json();if(data.number!==number||data.sha256!==officialBus.sha256||!Array.isArray(data.trips)||!data.stops)throw new Error('Archivio non coerente');officialBusCache.set(number,data);return data;
  })().finally(()=>officialBusLoads.delete(number)));
  return officialBusLoads.get(number);
}
function nextBusStopDepartures(data,stopCode,now=new Date()){
  const day=dayInRome(now),rows=officialDepartures(data,day,stopCode);if(rows===null)return null;
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(now).split(':').map(Number),seconds=parts[0]*3600+parts[1]*60+parts[2];
  const previous=shiftDay(day,-1),overnight=(officialDepartures(data,previous,stopCode)||[]).filter(row=>row.offset>0).map(row=>({...row,minutes:row.minutes-1440,offset:row.offset-1}));
  const future=[];for(let offset=1;offset<7;offset++)for(const row of officialDepartures(data,shiftDay(day,offset),stopCode)||[])future.push({...row,minutes:row.minutes+offset*1440,offset:row.offset+offset});
  return [...overnight,...rows,...future].filter(row=>row.minutes*60+Number(row.time.slice(6,8))>=seconds).sort((a,b)=>a.minutes-b.minutes||a.time.localeCompare(b.time)).slice(0,3);
}
const busPreviewVersions=new WeakMap();
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
  if(!day||day<officialBusData.validFrom||day>officialBusData.validTo){$('official-summary').textContent='Data fuori dalla validità dell’archivio: aggiorna i dati o consulta ATV.';return;}
  if(!stop){$('official-summary').textContent='Scegli una fermata per vedere gli orari.';return;}
  const rows=officialDepartures(officialBusData,day,stop,$('official-destination').value);
  $('official-summary').textContent=rows.length+' partenze · '+formatDay(day,{day:'numeric',month:'long'})+' · '+officialBusData.stops[stop].name;
  if(!rows.length){list.append(el('p','Nessuna partenza programmata per questa fermata, data e destinazione nell’archivio.','timetable-prompt'));return;}
  for(const row of rows){const item=el('div','','timetable-row'),clock=el('div'),meta=el('div','','timetable-row-meta');clock.append(el('strong',row.time.slice(0,5),'timetable-time'));if(row.offset)clock.append(el('small','Giorno successivo +'+row.offset));meta.append(el('strong','→ '+row.destination),el('small','Corsa '+row.trip));item.append(clock,meta);list.append(item);}
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
    renderOfficialTimes();
    if(preset.stopCode&&!data.stops[preset.stopCode])$('official-summary').textContent='Questo codice fermata non è presente nella linea ufficiale. Scegli una fermata dall’elenco.';
  }catch{if(request!==officialBusRequest)return;$('official-summary').textContent='Impossibile caricare gli orari. Controlla la connessione e riprova.';const retry=el('button','Riprova');retry.onclick=()=>loadOfficialLine(number,preset);$('official-results').append(retry);}
}
function openOfficialBus(number='',preset={}){
  officialBusFocus=document.activeElement;
  const lines=[...officialBus.lines].sort((a,b)=>a.number.localeCompare(b.number,'it',{numeric:true}));
  officialOptions('official-line',lines.map(line=>({value:line.number,label:line.number+' · '+line.name})),number||lines[0]?.number);
  $('official-bus-dialog').showModal();loadOfficialLine($('official-line').value,preset);
}
$('close-official-bus').onclick=()=>$('official-bus-dialog').close();
$('official-bus-dialog').addEventListener('close',()=>{officialBusRequest++;if(officialBusFocus?.isConnected)officialBusFocus.focus();});
$('official-line').onchange=()=>loadOfficialLine($('official-line').value,{date:$('official-date').value});
for(const id of ['official-date','official-stop','official-destination'])$(id).onchange=()=>{renderOfficialTimes();$('official-results').scrollTop=0;};

$('bus-official-all').hidden=!officialBus.lines.length;
$('bus-official-all').onclick=()=>openOfficialBus();
