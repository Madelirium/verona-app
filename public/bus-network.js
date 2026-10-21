let busNetworkInitialized=false;
let busNetworkMap=null,busNetworkLayer=null,busNetworkLines=[],busNetworkGroups=[],busNetworkStops=[],busNetworkRequest=0,busNetworkFocus=null,busNetworkMode='map',busNetworkFit=true;
let busNetworkExplore=true,networkStopIndex=null,networkChosenStop=null,networkChosenLine='',networkChosenRoutes=[],networkRouteState='',networkStopError=false;
let networkStopsRenderer=null;
function networkAvailableLines(){const allowed=view==='bus'&&typeof busCatalogFilteredLines==='function'?new Set(busCatalogFilteredLines().map(line=>line.number)):null;return [...new Set(busRouteData.routes.map(route=>route.number))].filter(number=>!allowed||allowed.has(number)).sort((a,b)=>a.localeCompare(b,'it',{numeric:true}));}
function networkStops(groups){
  const stops=new Map();for(const group of groups)for(const route of group.routes)for(const stop of route.stops){const key=stop.ref||stop.id;if(!stops.has(key))stops.set(key,{...stop,numbers:[],color:group.color});const item=stops.get(key);if(!item.numbers.includes(group.number))item.numbers.push(group.number);}return [...stops.values()];
}
function rememberNetworkLines(){try{localStorage.setItem('verona-bus-network-v1',JSON.stringify(busNetworkLines));}catch{}}
function openBusNetwork({compare=false}={}){
  busNetworkExplore=!compare;networkChosenStop=null;networkChosenLine='';networkChosenRoutes=[];networkRouteState='';networkStopError=false;
  busNetworkFocus=document.activeElement;const available=networkAvailableLines();
  {busNetworkInitialized=true;let saved=null;try{saved=JSON.parse(localStorage.getItem('verona-bus-network-v1')||'null');}catch{}
    const preferred=Array.isArray(saved)?saved:[...busFavoriteNumbers()];busNetworkLines=[...new Set(preferred)].filter(number=>available.includes(number)).slice(0,6);if(!busNetworkLines.length&&!Array.isArray(saved))busNetworkLines=['11','12','13'].filter(number=>available.includes(number));}
  officialOptions('network-line',available.map(number=>({value:number,label:'Linea '+number})),'','Aggiungi una linea');
  $('network-line').disabled=!available.length;$('network-add-line').disabled=!available.length;$('network-favorites').disabled=!available.length;
  busNetworkMode='map';busNetworkFit=!busNetworkExplore;$('network-stop-search').value='';syncNetworkMode();if(!$('bus-network-dialog').open)$('bus-network-dialog').showModal();return busNetworkExplore?loadNetworkStops():loadBusNetwork();
}
function syncNetworkMode(){
  $('network-shell').classList.toggle('network-has-selection',false);
  $('network-all-stops').setAttribute('aria-pressed',String(busNetworkExplore));$('network-compare').setAttribute('aria-pressed',String(!busNetworkExplore));
  $('network-picker').hidden=busNetworkExplore;$('network-lines').hidden=busNetworkExplore;$('network-selected-stop').hidden=true;
  $('network-stop-search').setAttribute('aria-label',busNetworkExplore?'Cerca una fermata per nome o codice':'Cerca una fermata nelle linee selezionate');
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
  if(busNetworkExplore)return renderNetworkExplorer(focusStop);
  renderNetworkChips();const list=$('network-stops'),mapBox=$('network-map'),isMap=busNetworkMode==='map';mapBox.hidden=!isMap;list.hidden=isMap;$('network-stop-search').hidden=isMap;
  $('network-map-tab').setAttribute('aria-pressed',String(isMap));$('network-list-tab').setAttribute('aria-pressed',String(!isMap));
  const failed=busNetworkGroups.filter(group=>!group.routes.length);$('network-status').textContent=busNetworkLines.length?busNetworkLines.length+' linee · '+busNetworkStops.length+' fermate'+(failed.length?' · Percorso non disponibile: '+failed.map(group=>group.number).join(', '):''):'Aggiungi una linea per vedere percorsi e fermate.';
  if(!networkAvailableLines().length)$('network-status').textContent='Nessun tracciato disponibile per la rete e i filtri scelti. Puoi consultare fermate e orari dalla sezione Autobus.';
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
$('network-list-tab').onclick=()=>{busNetworkMode='list';if(busNetworkExplore)networkChosenStop=null;renderBusNetwork();};
$('network-stop-search').oninput=()=>{if(busNetworkExplore&&busNetworkMode==='map')busNetworkFit=true;renderBusNetwork();};
$('network-fit').onclick=()=>{busNetworkMode='map';busNetworkFit=true;renderBusNetwork();};
$('network-retry').onclick=()=>busNetworkExplore?loadNetworkStops():loadBusNetwork();

async function loadNetworkStops(){
  const request=++busNetworkRequest;$('network-status').textContent='Caricamento delle fermate ufficiali…';$('network-retry').hidden=true;
  try{const index=await loadEventBusStops();if(request!==busNetworkRequest||!$('bus-network-dialog').open)return;networkStopIndex=index;networkStopError=false;renderNetworkExplorer();}
  catch{if(request!==busNetworkRequest||!$('bus-network-dialog').open)return;networkStopError=true;$('network-status').textContent='Fermate non disponibili. Riprova oppure usa Confronta linee.';$('network-retry').hidden=false;}
}
function networkOfficialStops(){
  const allowed=typeof busCatalogFilteredLines==='function'?new Set(busCatalogFilteredLines().map(line=>line.number)):null;
  return (networkStopIndex?.stops||[]).filter(stop=>Number.isFinite(stop.lat)&&Number.isFinite(stop.lon)&&Math.abs(stop.lat)<=90&&Math.abs(stop.lon)<=180&&(stop.lat!==0||stop.lon!==0)).map(stop=>({...stop,numbers:stop.services.map(([number])=>number).filter(number=>!allowed||allowed.has(number))})).filter(stop=>stop.numbers.length);
}
function networkExplorerMatches(){const query=placeSearchText($('network-stop-search').value);return networkOfficialStops().filter(stop=>(!networkChosenLine||stop.numbers.includes(networkChosenLine))&&placeSearchText(stop.name+' '+stop.code).includes(query));}
function selectNetworkStop(stop){networkChosenStop=stop;renderNetworkStopPanel();busNetworkMap?.invalidateSize();}
function renderNetworkStopPanel(){
  const panel=$('network-selected-stop');panel.replaceChildren();panel.hidden=!networkChosenStop||!busNetworkExplore;$('network-shell').classList.toggle('network-has-selection',!panel.hidden);if(panel.hidden)return;
  const stop=networkChosenStop,head=el('div','','network-stop-heading'),title=el('div'),close=el('button','×');close.setAttribute('aria-label','Chiudi fermata selezionata');close.onclick=()=>{networkChosenStop=null;renderNetworkExplorer();};title.append(el('strong',stop.name),el('small','Fermata '+stop.code));head.append(title,close);panel.append(head);
  const lines=el('div','','network-stop-lines');lines.setAttribute('role','group');lines.setAttribute('aria-label','Linee che passano da questa fermata');
  for(const number of stop.numbers){const button=el('button','Linea '+number);button.setAttribute('aria-label','Mostra percorso linea '+number+' dalla fermata '+stop.code);button.setAttribute('aria-pressed',String(networkChosenLine===number));button.onclick=()=>selectNetworkLine(number);lines.append(button);}panel.append(lines);
  if(networkChosenLine){const times=el('button','Orari linea '+networkChosenLine+' qui','bus-stop-all-times');times.onclick=()=>openOfficialBus(networkChosenLine,{stopCode:stop.code});panel.append(times);}
  panel.append(el('p',networkChosenLine?'Linea '+networkChosenLine+' · '+(networkRouteState==='loading'?'Caricamento percorso…':networkRouteState==='ready'?'Percorso colorato e fermate evidenziate.':networkRouteState==='error'?'Percorso non caricato. Riprova selezionando la linea.':'Tracciato non disponibile: mostriamo le fermate ufficiali, senza collegarle con un percorso inventato.'):'Scegli una linea per vedere percorso e fermate. Le linee elencate possono avere giorni di servizio diversi.','network-selection-note'));
}
async function selectNetworkLine(number){
  const request=++busNetworkRequest;networkChosenLine=number;networkChosenRoutes=[];networkRouteState='loading';busNetworkFit=false;$('network-stop-search').value='';renderNetworkExplorer();
  try{const routes=await loadEventRouteLine(number);if(request!==busNetworkRequest||!$('bus-network-dialog').open||!busNetworkExplore)return;networkChosenRoutes=routes;networkRouteState=routes.length?'ready':'missing';}
  catch{if(request!==busNetworkRequest||!$('bus-network-dialog').open||!busNetworkExplore)return;networkRouteState='error';}
  busNetworkFit=true;renderNetworkExplorer();
}
function renderNetworkExplorer(focusCode=null){
  const isMap=busNetworkMode==='map',mapBox=$('network-map'),list=$('network-stops');mapBox.hidden=!isMap;list.hidden=isMap;$('network-stop-search').hidden=false;
  $('network-map-tab').setAttribute('aria-pressed',String(isMap));$('network-list-tab').setAttribute('aria-pressed',String(!isMap));$('network-retry').hidden=!networkStopError;
  const stops=networkExplorerMatches(),count=stops.length+(stops.length===1?' fermata ufficiale':' fermate ufficiali');$('network-status').textContent=networkChosenLine?'Linea '+networkChosenLine+' · '+count:count+' · Tocca un punto e scegli una linea';
  if(!stops.length)$('network-status').textContent='Nessuna fermata per la ricerca e i filtri scelti.';renderNetworkStopPanel();
  if(!isMap){list.replaceChildren();const sorted=stops.slice().sort((a,b)=>a.name.localeCompare(b.name,'it'));for(const stop of sorted.slice(0,80)){const card=el('article','','network-stop-card');card.append(el('strong',stop.name),el('small','Fermata '+stop.code+' · Linee '+stop.numbers.join(', ')));const button=el('button','Vedi fermata e linee');button.onclick=()=>{networkChosenStop=stop;busNetworkMode='map';renderNetworkExplorer(stop.code);};card.append(button);list.append(card);}if(sorted.length>80)list.append(el('p','Prime 80 fermate su '+sorted.length+'. Cerca per nome o codice.','timetable-prompt'));return;}
  if(typeof L==='undefined'){$('network-status').textContent='Mappa non disponibile. Usa l’elenco Fermate per scegliere una linea.';return;}
  if(!busNetworkMap){busNetworkMap=L.map('network-map',{preferCanvas:true}).setView([45.4384,10.9916],13);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{$('network-status').textContent='Sfondo non disponibile. Fermate e linee restano consultabili.';}).addTo(busNetworkMap);busNetworkLayer=L.layerGroup().addTo(busNetworkMap);}
  if(!busNetworkMap.networkStopsMove){busNetworkMap.networkStopsMove=true;busNetworkMap.on('moveend',()=>{if(busNetworkExplore&&$('bus-network-dialog').open&&busNetworkMode==='map')drawNetworkExplorer();});}
  busNetworkMap.invalidateSize();if(focusCode){const stop=stops.find(stop=>stop.code===focusCode);if(stop)busNetworkMap.setView([stop.lat,stop.lon],17);}
  drawNetworkExplorer();installMapLocation(busNetworkMap,'network');
}
function drawNetworkExplorer(){
  if(!busNetworkMap||!busNetworkLayer)return;busNetworkLayer.clearLayers();const stops=networkExplorerMatches(),bounds=[];
  for(const route of networkChosenRoutes){L.polyline(route.segments,{color:'#fff',weight:8,opacity:.9}).addTo(busNetworkLayer);L.polyline(route.segments,{color:eventBusPalette[0],weight:5,opacity:.95}).bindPopup(el('strong','Linea '+networkChosenLine+' · '+route.label)).addTo(busNetworkLayer);for(const segment of route.segments)bounds.push(...segment);}
  const visible=busNetworkMap.getBounds?.().pad(.15);
  if(!networkStopsRenderer&&typeof L.canvas==='function'){const pane=busNetworkMap.getPane('network-stop-pins')||busNetworkMap.createPane('network-stop-pins');pane.style.zIndex=450;networkStopsRenderer=L.canvas({tolerance:16,pane:'network-stop-pins'});}
  for(const stop of stops){if(visible&&!visible.contains([stop.lat,stop.lon]))continue;const chosen=stop.code===networkChosenStop?.code;L.circleMarker([stop.lat,stop.lon],{renderer:networkStopsRenderer||undefined,radius:chosen?9:6,color:chosen?'#8a5600':eventBusPalette[0],fillColor:chosen?'#f3c84b':'#fff',fillOpacity:1,weight:chosen?3:2}).bindTooltip(stop.name+' · '+stop.code).on('click',()=>{selectNetworkStop(stop);drawNetworkExplorer();}).addTo(busNetworkLayer);}
  if(busNetworkFit){busNetworkFit=false;if(bounds.length)busNetworkMap.fitBounds(bounds,{padding:[20,20],maxZoom:14});else if(stops.length)busNetworkMap.fitBounds(stops.map(stop=>[stop.lat,stop.lon]),{padding:[20,20],maxZoom:16});}
}
$('network-all-stops').onclick=()=>{busNetworkRequest++;busNetworkExplore=true;networkChosenLine='';networkChosenRoutes=[];networkChosenStop=null;$('network-stop-search').value='';busNetworkFit=true;syncNetworkMode();return loadNetworkStops();};
$('network-compare').onclick=()=>{busNetworkExplore=false;busNetworkRequest++;syncNetworkMode();busNetworkFit=true;return loadBusNetwork();};
