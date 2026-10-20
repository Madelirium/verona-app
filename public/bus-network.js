let busNetworkInitialized=false;
let busNetworkMap=null,busNetworkLayer=null,busNetworkLines=[],busNetworkGroups=[],busNetworkStops=[],busNetworkRequest=0,busNetworkFocus=null,busNetworkMode='map',busNetworkFit=true;
function networkAvailableLines(){return [...new Set(busRouteData.routes.map(route=>route.number))].sort((a,b)=>a.localeCompare(b,'it',{numeric:true}));}
function networkStops(groups){
  const stops=new Map();for(const group of groups)for(const route of group.routes)for(const stop of route.stops){const key=stop.ref||stop.id;if(!stops.has(key))stops.set(key,{...stop,numbers:[],color:group.color});const item=stops.get(key);if(!item.numbers.includes(group.number))item.numbers.push(group.number);}return [...stops.values()];
}
function rememberNetworkLines(){try{localStorage.setItem('verona-bus-network-v1',JSON.stringify(busNetworkLines));}catch{}}
function openBusNetwork(){
  busNetworkFocus=document.activeElement;const available=networkAvailableLines();
  if(!busNetworkInitialized){busNetworkInitialized=true;let saved=null;try{saved=JSON.parse(localStorage.getItem('verona-bus-network-v1')||'null');}catch{}
    const preferred=Array.isArray(saved)?saved:[...busFavoriteNumbers()];busNetworkLines=[...new Set(preferred)].filter(number=>available.includes(number)).slice(0,6);if(!busNetworkLines.length&&!Array.isArray(saved))busNetworkLines=['11','12','13'].filter(number=>available.includes(number));}
  officialOptions('network-line',available.map(number=>({value:number,label:'Linea '+number})),'','Aggiungi una linea');
  busNetworkMode='map';busNetworkFit=true;$('network-stop-search').value='';if(!$('bus-network-dialog').open)$('bus-network-dialog').showModal();return loadBusNetwork();
}
async function loadBusNetwork(){
  const request=++busNetworkRequest;$('network-status').textContent='Caricamento delle linee…';renderNetworkChips();
  const groups=await Promise.all(busNetworkLines.map(async(number,i)=>{try{return {number,color:eventBusPalette[i%eventBusPalette.length],routes:await loadEventRouteLine(number)};}catch{return {number,color:eventBusPalette[i%eventBusPalette.length],routes:[],error:true};}}));
  if(request!==busNetworkRequest||!$('bus-network-dialog').open)return;
  busNetworkGroups=groups;busNetworkStops=networkStops(groups);renderBusNetwork();
}
function renderNetworkChips(){
  const legend=$('network-lines');legend.replaceChildren();busNetworkLines.forEach((number,i)=>{const button=el('button','','network-line-chip'),swatch=el('span','','event-bus-line-swatch');swatch.style.backgroundColor=eventBusPalette[i%eventBusPalette.length];button.append(swatch,el('span','Linea '+number+' ×'));button.setAttribute('aria-label','Rimuovi linea '+number+' dalla mappa');button.onclick=()=>{busNetworkLines=busNetworkLines.filter(n=>n!==number);rememberNetworkLines();busNetworkFit=true;loadBusNetwork();};legend.append(button);});
}
function networkStopPopup(stop){
  const box=el('div','','bus-map-stop');box.append(el('strong',stop.name),el('small','Fermata '+(stop.ref||'senza codice')));
  const select=el('select','','network-popup-line');select.setAttribute('aria-label','Linea alla fermata');for(const number of stop.numbers){const option=el('option','Linea '+number);option.value=number;select.append(option);}select.value=stop.numbers[0];if(stop.numbers.length>1)box.append(select);else box.append(el('small','Linea '+stop.numbers[0]));
  const preview=el('div','','bus-stop-preview');preview.setAttribute('aria-live','polite');box.append(preview);box.loadDepartures=()=>/^\d+$/.test(stop.ref||'')?renderBusStopPreview(preview,select.value,stop.ref):Promise.resolve(preview.replaceChildren(el('p','Scegli la fermata negli orari della linea.')));
  select.onchange=()=>box.loadDepartures().then(()=>busNetworkMap?.eachLayer?.(layer=>layer.getPopup?.()?.getContent()===box&&layer.getPopup().update()));
  const all=el('button','Tutti gli orari','bus-stop-all-times');all.onclick=()=>openOfficialBus(select.value,{stopCode:stop.ref||''});box.append(all);return box;
}
function renderBusNetwork(focusStop=null){
  renderNetworkChips();const list=$('network-stops'),mapBox=$('network-map'),isMap=busNetworkMode==='map';mapBox.hidden=!isMap;list.hidden=isMap;$('network-stop-search').hidden=isMap;
  $('network-map-tab').setAttribute('aria-pressed',String(isMap));$('network-list-tab').setAttribute('aria-pressed',String(!isMap));
  const failed=busNetworkGroups.filter(group=>!group.routes.length);$('network-status').textContent=busNetworkLines.length?busNetworkLines.length+' linee · '+busNetworkStops.length+' fermate'+(failed.length?' · Percorso non disponibile: '+failed.map(group=>group.number).join(', '):''):'Aggiungi una linea per vedere percorsi e fermate.';
  $('network-retry').hidden=!failed.length;list.replaceChildren();
  if(!isMap){const query=placeSearchText($('network-stop-search').value);const stops=busNetworkStops.filter(stop=>placeSearchText(stop.name+' '+(stop.ref||'')).includes(query)).sort((a,b)=>a.name.localeCompare(b.name,'it'));
    if(!stops.length)list.append(el('p',query?'Nessuna fermata con questo nome o codice nelle linee selezionate.':'Nessuna fermata da mostrare. Aggiungi una linea.','timetable-prompt'));
    for(const stop of stops){const card=el('article','','network-stop-card');card.append(el('strong',stop.name),el('small','Fermata '+(stop.ref||'senza codice')+' · Linee '+stop.numbers.join(', ')));const locate=el('button','Vedi sulla mappa');locate.onclick=()=>{busNetworkMode='map';renderBusNetwork(stop.ref||stop.id);};card.append(locate);for(const number of stop.numbers){const button=el('button','Orari linea '+number);button.onclick=()=>openOfficialBus(number,{stopCode:stop.ref||''});card.append(button);}list.append(card);}return;
  }
  if(typeof L==='undefined'){$('network-status').textContent='Mappa non disponibile. Apri Fermate per consultare linee e orari.';return;}
  if(!busNetworkMap){busNetworkMap=L.map('network-map',{preferCanvas:true}).setView([45.4384,10.9916],13);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{$('network-status').textContent='Le strade non si caricano. Puoi consultare l’elenco Fermate.';}).addTo(busNetworkMap);busNetworkLayer=L.layerGroup().addTo(busNetworkMap);}
  busNetworkMap.invalidateSize();busNetworkLayer.clearLayers();const bounds=[];
  for(const group of busNetworkGroups)for(const route of group.routes){L.polyline(route.segments,{color:'#fff',weight:7,opacity:.8}).addTo(busNetworkLayer);L.polyline(route.segments,{color:group.color,weight:4,opacity:.85}).bindPopup(el('strong','Linea '+group.number+' · '+route.label)).addTo(busNetworkLayer);for(const segment of route.segments)bounds.push(...segment);}
  let focused=null;for(const stop of busNetworkStops){const popup=networkStopPopup(stop),marker=L.circleMarker([stop.lat,stop.lon],{radius:6,color:stop.color,fillColor:'#fff',fillOpacity:1,weight:2}).bindPopup(popup,{minWidth:200,maxWidth:260,maxHeight:Math.max(110,Math.min(270,(mapBox.clientHeight||330)-35))}).addTo(busNetworkLayer);marker.on?.('popupopen',()=>popup.loadDepartures().then(()=>marker.getPopup()?.update()));if((stop.ref||stop.id)===focusStop)focused={marker,stop};}
  installMapLocation(busNetworkMap,'network');if(focused){busNetworkMap.setView([focused.stop.lat,focused.stop.lon],17);focused.marker.openPopup();}else if(busNetworkFit&&bounds.length){busNetworkMap.fitBounds(bounds,{padding:[20,20],maxZoom:13});busNetworkFit=false;}
}
$('bus-network-open').onclick=openBusNetwork;
$('close-bus-network').onclick=()=>$('bus-network-dialog').close();
$('bus-network-dialog').addEventListener('close',()=>{busNetworkRequest++;if(busNetworkFocus?.isConnected)busNetworkFocus.focus();});
$('network-add-line').onclick=()=>{const number=$('network-line').value;if(!number||busNetworkLines.includes(number))return;if(busNetworkLines.length>=6){$('network-status').textContent='Puoi confrontare fino a 6 linee. Rimuovine una per aggiungerne un’altra.';return;}busNetworkLines.push(number);rememberNetworkLines();busNetworkFit=true;loadBusNetwork();};
$('network-favorites').onclick=()=>{const available=networkAvailableLines(),numbers=[...busFavoriteNumbers()].filter(number=>available.includes(number)).slice(0,6);if(!numbers.length){$('network-status').textContent='Non hai linee preferite con una mappa disponibile. Aggiungile con la stella nell’elenco Autobus.';return;}busNetworkLines=numbers;rememberNetworkLines();busNetworkFit=true;loadBusNetwork();};
$('network-map-tab').onclick=()=>{busNetworkMode='map';renderBusNetwork();};
$('network-list-tab').onclick=()=>{busNetworkMode='list';renderBusNetwork();};
$('network-stop-search').oninput=()=>renderBusNetwork();
$('network-fit').onclick=()=>{busNetworkMode='map';busNetworkFit=true;renderBusNetwork();};
$('network-retry').onclick=()=>loadBusNetwork();
