const parkingData=payload.parking||{items:[]};
let parkingEvent=null,parkingFocus=null,parkingMap=null,parkingLayer=null,parkingSelected='';
let parkingTarget=null,parkingView='map',parkingPicking=false,parkingRequest=0;
function parkingPoint(){return parkingEvent?eventPosition(parkingEvent):parkingTarget;}
function parkingReset(){parkingTarget=null;parkingView='map';parkingPicking=false;parkingSelected='';parkingRequest++;$('parking-feedback').textContent='';$('parking-nearby').disabled=false;$('parking-center').hidden=true;}
function nearbyParking(event,{radius=1500,type=''}={}){
  const point=eventPosition(event);if(!point)return [];
  return parkingData.items.filter(item=>Number.isFinite(item.lat)&&Number.isFinite(item.lon)&&(!type||item.typeKey===type)).map(item=>({...item,distance:busDistance(point,item)})).filter(item=>item.distance<=radius).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
}
function appendEventParking(content,event){
  const section=el('section','','event-bus-entry');section.append(el('h3','Dove parcheggiare'));
  if(!eventPosition(event))section.append(el('p','La posizione dell’evento non è abbastanza precisa per cercare parcheggi vicini.','detail-note'));
  else if(!parkingData.items.length)section.append(el('p','Catalogo parcheggi non disponibile in questa raccolta.','detail-note'));
  else{const count=nearbyParking(event).length,button=el('button','Parcheggi vicini','dialog-save');button.onclick=()=>openEventParking(event);section.append(button,el('p',count?count+' parcheggi nel dataset entro 1,5 km · distanza in linea d’aria.':'Nessun parcheggio nel dataset entro 1,5 km. Puoi ampliare la ricerca.','detail-note'));}
  content.append(section);
}
function parkingLink(label,url){const link=el('a',label,'parking-link');link.href=url;link.target='_blank';link.rel='noopener noreferrer';return link;}
function parkingDistance(metres){return metres<1000?Math.round(metres/10)*10+' m':(metres/1000).toLocaleString('it-IT',{maximumFractionDigits:1})+' km';}
function openEventParking(event){
  if(!eventPosition(event))return;parkingFocus=document.activeElement;parkingEvent=event;parkingSelected='';$('parking-event-name').textContent=event.title;
  parkingReset();
  configureParkingView(true);
  $('parking-radius').value='1500';$('parking-type').value='';$('parking-dialog').showModal();renderEventParking();$('parking-close').focus();
}
function configureParkingView(eventMode){
  $('parking-eyebrow').textContent=eventMode?'Arrivare all’evento':'Muoversi a Verona';
  $('parking-title').textContent=eventMode?'Dove parcheggiare':'Parcheggi a Verona';
  $('parking-distance-control').hidden=!parkingPoint();
  $('parking-clear').hidden=!parkingTarget;
  $('parking-destination').hidden=eventMode;$('parking-nearby').hidden=eventMode;
  $('parking-close').setAttribute('aria-label',eventMode?'Torna all’evento':'Chiudi parcheggi');
  $('parking-map').setAttribute('aria-label',eventMode?'Mappa dell’evento e dei parcheggi vicini':'Mappa dei parcheggi a Verona');
  $('parking-results').setAttribute('aria-label',eventMode?'Parcheggi ordinati per distanza':'Elenco dei parcheggi');
  $('parking-map-legend').textContent=eventMode?'● Blu: evento · ● Ocra: parcheggi':parkingTarget?'◎ Destinazione · ● Parcheggi':'● Ocra: parcheggi · Blu: selezionato';
}
function openParkingCatalog(){
  parkingFocus=document.activeElement;parkingEvent=null;parkingReset();configureParkingView(false);
  $('parking-event-name').textContent='I principali parcheggi del catalogo del Comune.';$('parking-type').value='';$('parking-dialog').showModal();renderEventParking();$('parking-close').focus();
}
function parkingRows(){const point=parkingPoint();return point?nearbyParking(parkingEvent||{coordinates:point},{radius:Number($('parking-radius').value),type:$('parking-type').value}):parkingData.items.filter(item=>Number.isFinite(item.lat)&&Number.isFinite(item.lon)&&(!$('parking-type').value||item.typeKey===$('parking-type').value)).sort((a,b)=>a.name.localeCompare(b.name,'it'));}
function parkingLayout(){
  const mapMode=parkingView==='map';$('parking-dialog').setAttribute('data-parking-view',parkingView);$('parking-dialog').setAttribute('data-parking-selected',String(Boolean(parkingSelected)));
  $('parking-map').hidden=!mapMode;$('parking-map-legend').hidden=!mapMode;$('parking-map-tab').setAttribute('aria-pressed',String(mapMode));$('parking-list-tab').setAttribute('aria-pressed',String(!mapMode));$('parking-map-prompt').hidden=!mapMode||Boolean(parkingSelected)||!parkingRows().length;$('parking-deselect').hidden=!mapMode||!parkingSelected;
  parkingMap?.invalidateSize();
  $('parking-results').hidden=mapMode&&!parkingSelected&&parkingRows().length>0;
  const chosen=parkingData.items.find(item=>item.id===parkingSelected);$('parking-go').hidden=!mapMode||!chosen;if(chosen)$('parking-go').href='https://www.google.com/maps/dir/?api=1&travelmode=driving&destination='+chosen.lat+','+chosen.lon;
  for(const card of $('parking-results').children)card.hidden=mapMode&&Boolean(parkingSelected)&&card.getAttribute('data-parking-id')!==parkingSelected;
}
function renderEventParking(){
  const point=parkingPoint(),rows=parkingRows(),list=$('parking-results');list.replaceChildren();if(!rows.some(row=>row.id===parkingSelected))parkingSelected='';
  $('parking-count').textContent=rows.length+(rows.length===1?' parcheggio nel catalogo':' parcheggi nel catalogo')+(point?' · distanze in linea d’aria':'');
  if(!rows.length){list.append(el('p','Nessun parcheggio del catalogo corrisponde alla ricerca. Il dataset copre i principali parcheggi di Verona, non tutta la provincia.','parking-empty'));if(parkingData.items.length){const reset=el('button',point?'Amplia a 3 km e mostra tutti':'Mostra tutti i tipi','parking-link');reset.onclick=()=>{$('parking-radius').value='3000';$('parking-type').value='';renderEventParking();$(point?'parking-radius':'parking-type').focus();};list.append(reset);}}
  for(const item of rows){const card=el('article','','parking-card');card.setAttribute('data-parking-id',item.id);card.tabIndex=-1;card.classList.toggle('parking-selected',parkingSelected===item.id);
    const title=el('button',item.name,'parking-card-title');title.setAttribute('aria-label','Evidenzia sulla mappa: '+item.name);title.onclick=()=>selectParking(item.id,false);
    const type=item.typeKey==='free'?'Gratuito secondo il Comune':item.typeKey==='paid'?'A pagamento':'Tipologia da verificare';card.append(title,el('p',(point?parkingDistance(item.distance)+(parkingEvent?' dall’evento':' dal punto scelto')+' · ':'')+type,'parking-meta'),el('p',item.address||'Indirizzo non indicato'));
    const actions=el('div','','parking-actions'),destination=item.lat+','+item.lon,drive=parkingLink('Portami qui ↗','https://www.google.com/maps/dir/?api=1&travelmode=driving&destination='+destination);drive.className+=' parking-primary';actions.append(drive);if(point)actions.append(parkingLink(parkingEvent?'Da qui a piedi all’evento ↗':'Da qui a piedi alla destinazione ↗','https://www.google.com/maps/dir/?api=1&travelmode=walking&origin='+destination+'&destination='+point.lat+','+point.lon));
    const buses=el('button','Autobus nelle vicinanze','parking-link');buses.type='button';buses.onclick=()=>openParkingBus(item);actions.append(buses);
    if(item.website)actions.append(parkingLink('Sito indicato dal Comune ↗',item.website));card.append(actions);list.append(card);
  }
  const details=el('details','','parking-source'),summary=el('summary','Fonte e aggiornamento');details.append(summary,el('p','Comune di Verona · CC BY 4.0. Dati raccolti il '+(parkingData.updatedAt?formatDay(dayInRome(parkingData.updatedAt),{day:'numeric',month:'long',year:'numeric'}):'giorno non disponibile')+'.'));
  if(parkingData.status==='error')details.append(el('p','Ultima raccolta non riuscita: sono conservati i dati precedenti.'));
  details.append(parkingLink('Apri il dataset del Comune ↗',parkingData.sourceUrl||'https://www.comune.verona.it/Amministrazione/Documenti-e-dati/Dataset/Parcheggi-a-Verona'));list.append(details);
  parkingLayout();drawParkingMap(point,rows);
}
function drawParkingMap(point,rows){
  const center=point||{lat:45.4384,lon:10.9916};
  const note=$('parking-map-note');note.textContent='';
  if(typeof L==='undefined'){note.textContent='Mappa non disponibile. Puoi usare l’elenco e le indicazioni.';parkingView='list';parkingLayout();return;}
  try{
    if(!parkingMap){parkingMap=L.map('parking-map',{preferCanvas:false}).setView([center.lat,center.lon],14);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{note.textContent='Sfondo non disponibile: elenco e indicazioni restano consultabili.';}).addTo(parkingMap);parkingLayer=L.layerGroup().addTo(parkingMap);}
    parkingMap.invalidateSize();parkingLayer.clearLayers();
    parkingMap.zoomControl?.setPosition('topright');
    if(point){const eventPin=L.circleMarker([point.lat,point.lon],parkingEvent?{radius:12,color:'#fff',weight:3,fillColor:'#254f78',fillOpacity:1}:{radius:10,color:'#254f78',weight:4,fillColor:'#fff',fillOpacity:1}).bindPopup(el('strong','★ '+(parkingEvent?.title||parkingTarget.name)));eventPin.addTo(parkingLayer);}
    for(const item of rows){
      const color=parkingSelected===item.id?'#254f78':'#a46b13',hit=L.circleMarker([item.lat,item.lon],{radius:22,stroke:false,fillColor:color,fillOpacity:.12}).addTo(parkingLayer);
      const choose=()=>selectParking(item.id,true);hit.on?.('click',choose);const node=hit.getElement?.();if(node){node.setAttribute('tabindex','0');node.setAttribute('role','button');node.setAttribute('aria-label','Parcheggio '+item.name);node.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();choose();}});}
      L.circleMarker([item.lat,item.lon],{radius:parkingSelected===item.id?12:9,color:'#fff',weight:2,fillColor:color,fillOpacity:1,interactive:false}).addTo(parkingLayer);
    }
    if(!parkingMap.parkingClickBound){parkingMap.on?.('click',event=>{if(parkingPicking)setParkingTarget({lat:event.latlng.lat,lon:event.latlng.lng,name:'Punto scelto sulla mappa'});});parkingMap.parkingClickBound=true;}
    parkingMap.fitBounds([...(point||!rows.length?[[center.lat,center.lon]]:[]),...rows.map(item=>[item.lat,item.lon])],{padding:[24,24],maxZoom:16});
  }catch{note.textContent='Mappa non disponibile. Puoi usare l’elenco e le indicazioni.';parkingView='list';parkingLayout();}
}
function selectParking(id,fromMap){
  parkingSelected=id;parkingView='map';const rows=parkingRows();parkingLayout();
  for(const card of $('parking-results').children){const selected=card.getAttribute('data-parking-id')===id;card.classList.toggle('parking-selected',selected);if(selected&&fromMap){card.scrollIntoView?.({block:'nearest'});card.focus();}}
  const chosen=rows.find(item=>item.id===id),point=parkingPoint();if(chosen&&parkingMap){drawParkingMap(point,rows);parkingMap.fitBounds([...(point?[[point.lat,point.lon]]:[]),[chosen.lat,chosen.lon]],{paddingTopLeft:[24,40],paddingBottomRight:[24,Math.round((parkingMap.getSize?.().y||400)*.6)],maxZoom:16});}
  if(!parkingMap){parkingView='list';parkingLayout();}
}
$('parking-close').onclick=()=>$('parking-dialog').close();
$('parking-dialog').addEventListener('close',()=>{parkingRequest++;parkingPicking=false;parkingMap?.remove();parkingMap=null;parkingLayer=null;parkingEvent=null;parkingTarget=null;if(parkingFocus?.isConnected)parkingFocus.focus();});
for(const id of ['parking-radius','parking-type'])$(id).onchange=()=>{parkingSelected='';renderEventParking();$('parking-results').scrollTop=0;};
function setParkingTarget(target){
  parkingRequest++;$('parking-nearby').disabled=false;
  parkingTarget=target;parkingPicking=false;parkingSelected='';parkingView='map';$('parking-center').hidden=true;$('parking-feedback').textContent='';$('parking-radius').value='1500';configureParkingView(false);$('parking-event-name').textContent=target.name;renderEventParking();
}
function parkingDestinations(query){
  const words=placeSearchText(query).split(' ').filter(Boolean);if(words.join('').length<2)return [];
  const entries=[...parkingData.items.map(item=>({...item,name:'Parcheggio '+item.name,label:'Parcheggio '+item.name+' · '+item.address})),...placesData.items.map(item=>({...item,label:item.name+' · '+(item.address||'')})),...events.map(event=>{const point=eventPosition(event);return point?{...point,name:event.location||event.title,label:(event.location||event.title)+' · Evento'}:null;}).filter(Boolean)],seen=new Set();
  return entries.filter(item=>Number.isFinite(item.lat)&&Number.isFinite(item.lon)&&words.every(word=>placeSearchText(item.label).includes(word))).filter(item=>{const key=item.lat.toFixed(4)+','+item.lon.toFixed(4);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,8);
}
function renderParkingSearch(){const list=$('parking-search-results'),query=$('parking-search').value;list.replaceChildren();const rows=parkingDestinations(query);for(const item of rows){const button=el('button',item.label,'parking-link');button.onclick=()=>{$('parking-search-dialog').close();setParkingTarget({lat:item.lat,lon:item.lon,name:item.name});};list.append(button);}if(!rows.length)list.append(el('p',query.trim().length<2?'Scrivi almeno due lettere.':'Nessun luogo nel catalogo locale. Puoi scegliere un punto sulla mappa.','parking-empty'));}
$('parking-destination').onclick=()=>{$('parking-search').value='';renderParkingSearch();$('parking-search-dialog').showModal();$('parking-search-close').focus();};
$('parking-search').oninput=renderParkingSearch;
$('parking-search-close').onclick=()=>$('parking-search-dialog').close();
$('parking-search-dialog').addEventListener('close',()=>$('parking-destination').focus());
$('parking-pick').onclick=()=>{$('parking-search-dialog').close();if(!parkingMap){$('parking-feedback').textContent='Mappa non disponibile: puoi cercare un luogo o usare l’elenco.';parkingView='list';parkingLayout();return;}parkingPicking=true;parkingView='map';parkingSelected='';$('parking-feedback').textContent='Tocca la destinazione sulla mappa, oppure sposta la mappa e usa il suo centro.';$('parking-center').hidden=false;parkingLayout();};
$('parking-center').onclick=()=>{const center=parkingMap?.getCenter();if(center)setParkingTarget({lat:center.lat,lon:center.lng,name:'Punto scelto sulla mappa'});};
$('parking-clear').onclick=()=>{parkingRequest++;parkingTarget=null;parkingPicking=false;parkingSelected='';$('parking-center').hidden=true;$('parking-feedback').textContent='';$('parking-nearby').disabled=false;configureParkingView(false);$('parking-event-name').textContent='I principali parcheggi del catalogo del Comune.';renderEventParking();};
for(const [id,mode]of [['parking-map-tab','map'],['parking-list-tab','list']])$(id).onclick=()=>{parkingView=mode;parkingLayout();if(mode==='map')drawParkingMap(parkingPoint(),parkingRows());};
$('parking-deselect').onclick=()=>{parkingSelected='';parkingLayout();drawParkingMap(parkingPoint(),parkingRows());};
$('parking-nearby').onclick=()=>{
  const feedback=$('parking-feedback');
  if(typeof isSecureContext!=='undefined'&&!isSecureContext){feedback.textContent='In Wi-Fi HTTP la posizione non è disponibile: usa la versione online HTTPS oppure scegli un punto con “Dove vuoi andare?”.';return;}
  if(typeof navigator==='undefined'||!navigator.geolocation){feedback.textContent='Posizione non disponibile. Scegli una destinazione o un punto sulla mappa.';return;}
  const request=++parkingRequest;$('parking-nearby').disabled=true;feedback.textContent='Ricerca della posizione…';
  const valid=()=>request===parkingRequest&&$('parking-dialog').open;
  const fail=error=>{if(!valid())return;$('parking-nearby').disabled=false;feedback.textContent=error.code===1?'Permesso negato. Puoi scegliere un punto sulla mappa.':'Posizione non disponibile o ricerca scaduta. Riprova o scegli un punto sulla mappa.';};
  try{navigator.geolocation.getCurrentPosition(position=>{if(!valid())return;$('parking-nearby').disabled=false;const {latitude:lat,longitude:lon,accuracy}=position.coords||{};if(!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isFinite(accuracy)||Math.abs(lat)>90||Math.abs(lon)>180||accuracy<0){fail({code:2});return;}setParkingTarget({lat,lon,name:'La mia posizione'});feedback.textContent=accuracy>200?'Posizione approssimativa: precisione circa '+Math.round(accuracy)+' m. Puoi scegliere un punto più preciso sulla mappa.':'';},fail,{enableHighAccuracy:true,timeout:12000,maximumAge:0});}catch{fail({code:2});}
};
let parkingBusPlace=null,parkingBusFocus=null,parkingBusRequest=0;
function openParkingBus(item){
  parkingBusFocus=document.activeElement;parkingBusPlace=item;$('parking-bus-place').textContent=item.name+' · '+item.address;$('parking-bus-day').value=today;$('parking-bus-radius').value='800';$('parking-bus-dialog').showModal();$('parking-bus-close').focus();return renderParkingBus();
}
async function renderParkingBus(){
  const request=++parkingBusRequest,place=parkingBusPlace,day=$('parking-bus-day').value,radius=Number($('parking-bus-radius').value),list=$('parking-bus-stops');list.replaceChildren();$('parking-bus-validity').textContent='';
  if(!place)return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day||![400,800,1200].includes(radius)){$('parking-bus-status').textContent='Scegli un giorno e una distanza validi.';return;}
  $('parking-bus-status').textContent='Cerco le fermate vicine…';
  try{
    if(!officialBus.stopIndexAsset)throw Error('Indice fermate assente');
    const index=await loadEventBusStops();if(request!==parkingBusRequest||!$('parking-bus-dialog').open)return;
    const covered=index.days.includes(day),all=nearbyBusStops(index,place,day,{radius,limit:Infinity}).filter(stop=>!covered||stop.lines.length),stops=all.slice(0,5);
    $('parking-bus-status').textContent=stops.length?(stops.length+' fermate '+(covered?'con servizio programmato ':'nell’archivio ')+'entro '+parkingDistance(radius)+(all.length>5?' · mostro le 5 più vicine':'')):(covered?'Nessuna fermata con partenze programmate entro '+parkingDistance(radius)+'. Prova ad ampliare la distanza.':'Nessuna fermata nell’archivio entro '+parkingDistance(radius)+'. Prova ad ampliare la distanza.');
    $('parking-bus-validity').textContent=(covered?'Linee con partenze nella data scelta. ':'Data fuori copertura: le linee elencate non confermano il servizio per quel giorno. ')+'Archivio ATV: '+formatDay(index.validFrom,{day:'numeric',month:'short'})+' – '+formatDay(index.validTo,{day:'numeric',month:'short',year:'numeric'})+'.';
    for(const [position,stop]of stops.entries()){
      const card=el('details','','parking-bus-stop');card.open=position===0;const summary=el('summary');summary.append(el('strong',stop.name),el('span','Circa '+parkingDistance(stop.distance)+' in linea d’aria · Fermata '+stop.code),el('span','Linee '+(stop.lines.join(', ')||'non indicate')));card.append(summary);
      const walk=parkingLink('Raggiungi la fermata a piedi ↗','https://www.google.com/maps/dir/?api=1&travelmode=walking&origin='+place.lat+','+place.lon+'&destination='+stop.lat+','+stop.lon);card.append(walk);
      for(const number of [...stop.lines].sort((a,b)=>a.localeCompare(b,'it',{numeric:true}))){
        const row=el('section','','parking-bus-line');row.append(el('h3','Linea '+number));
        const actions=el('div','','parking-bus-actions'),times=el('button',covered?'Orari programmati':'Consulta archivio orari','parking-link');times.type='button';times.onclick=()=>openOfficialBus(number,{stopCode:String(stop.code),date:day});actions.append(times);
        if(busRouteData.routes.some(route=>route.number===number)){
          const route=el('button','Percorso','parking-link'),note=el('p','','parking-bus-route-note');note.setAttribute('role','status');route.type='button';route.onclick=async()=>{
            route.disabled=true;note.textContent='Carico il percorso…';
            try{const routes=await loadEventRouteLine(number);if(request!==parkingBusRequest||!$('parking-bus-dialog').open)return;const match=routes.find(route=>route.stops.some(item=>String(item.ref)===String(stop.code)));if(!match){note.textContent='Il tracciato disponibile non è associato a questa fermata. Consulta gli orari o gli avvisi ATV.';return;}
              const line=busData.lines.find(line=>line.id===match.lineId)||{id:match.lineId,number};await openBusRoute(line);if(request!==parkingBusRequest||!$('bus-route-dialog').open)return;$('bus-route-variant').value=match.id;busRouteMode='map';renderBusRoute(match.stops.find(item=>String(item.ref)===String(stop.code)).id);note.textContent='';
            }catch{note.textContent='Percorso non disponibile. Puoi riprovare; gli orari restano consultabili.';}finally{route.disabled=false;}
          };actions.append(route);row.append(actions,note);
        }else{row.append(actions,el('p','Tracciato non disponibile nell’app.','parking-bus-route-note'));}
        card.append(row);
      }
      list.append(card);
    }
  }catch{if(request!==parkingBusRequest||!$('parking-bus-dialog').open)return;$('parking-bus-status').textContent='Fermate non disponibili al momento. Il parcheggio resta consultabile.';const retry=el('button','Riprova','parking-link');retry.onclick=renderParkingBus;list.append(retry);}
}
$('parking-bus-close').onclick=()=>$('parking-bus-dialog').close();
$('parking-bus-dialog').addEventListener('close',()=>{parkingBusRequest++;parkingBusPlace=null;if(parkingBusFocus?.isConnected)parkingBusFocus.focus();});
for(const id of ['parking-bus-day','parking-bus-radius'])$(id).onchange=()=>{const pending=renderParkingBus();$('parking-bus-stops').scrollTop=0;return pending;};
