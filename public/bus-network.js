let busNetworkInitialized=false;
let busNetworkMap=null,busNetworkLayer=null,busNetworkLines=[],busNetworkGroups=[],busNetworkStops=[],busNetworkRequest=0,busNetworkFocus=null,busNetworkMode='map',busNetworkFit=true;
let busNetworkExplore=true,networkStopIndex=null,networkChosenStop=null,networkChosenLine='',networkChosenRoutes=[],networkRouteState='',networkStopError=false;
let networkStopsRenderer=null;
let networkStopsCache=null,networkMatchCache=null,networkSearchOpen=false;
function networkMapTopPadding(){return busNetworkInline?68+(networkSearchOpen?54:0):110;}
function closeNetworkActions(restoreFocus=false){const open=!$('network-actions-menu').hidden;$('network-actions-menu').hidden=true;$('network-actions-toggle').setAttribute('aria-expanded','false');if(open&&restoreFocus)$('network-actions-toggle').focus();}
function mountNetworkActions(){
  closeNetworkActions();$('network-actions-toggle').hidden=!busNetworkInline;
  if(busNetworkInline){$('network-actions-items').append($('network-return-stop'),$('network-fit'),$('bus-catalog-entry'),$('network-options-toggle'));$('network-actions-menu').append($('network-extra-options'));}
  else{$('network-view-tools').append($('network-fit'),$('network-options-toggle'));$('network-shell').append($('network-return-stop'),$('network-extra-options'));$('bus-entry-tabs').append($('bus-catalog-entry'));}
}
function setNetworkSearch(open){networkSearchOpen=Boolean(open);$('network-shell').classList.toggle('network-search-open',networkSearchOpen);$('network-search-toggle').setAttribute('aria-expanded',String(networkSearchOpen));if(!open){$('network-stop-search').value='';$('network-search-results').hidden=true;} }
let busNetworkInline=false,busMapArea='map',busMapHomeReady=false,networkSheetSize='medium',networkSheetStop='';
function networkIsOpen(){return busNetworkInline?view==='bus'&&busMapArea==='map':Boolean($('bus-network-dialog').open);}
function enterBusMapHome(){if(!busMapHomeReady&&busMode==='favorites')busMode='lines';if(busMapArea==='map')return showBusMapHome();showBusCatalogHome();}
function leaveBusMapHome(){closeNetworkActions();closeNetworkLineMenu(false);busNetworkRequest++;if(typeof cancelBusStopExperience==='function')cancelBusStopExperience($('network-selected-stop'));}
function showBusMapHome(){
  busMapArea='map';busNetworkInline=true;$('bus-view').classList.toggle('bus-map-mode',true);$('bus-map-home').hidden=false;
  $('bus-map-entry').setAttribute('aria-pressed','true');$('bus-catalog-entry').setAttribute('aria-pressed','false');
  $('bus-map-home').append($('network-shell'));$('network-shell').classList.toggle('network-inline',true);
  mountNetworkActions();
  $('network-nearby').hidden=false;$('network-options-toggle').hidden=false;$('network-extra-options').hidden=true;
  $('network-options-toggle').setAttribute('aria-expanded','false');
  if(networkStopIndex){const allowed=typeof busCatalogFilteredLines==='function'?new Set(busCatalogFilteredLines().map(line=>line.number)):null;if(allowed&&networkChosenLine&&!allowed.has(networkChosenLine)){networkChosenLine='';networkChosenRoutes=[];networkRouteState='';}if(networkChosenStop)networkChosenStop=networkOfficialStops().find(stop=>stop.code===networkChosenStop.code)||null;}
  if(!busMapHomeReady){busMapHomeReady=true;return openBusNetwork({embedded:true});}
  return networkStopIndex?renderBusNetwork():loadNetworkStops();
}
function showBusCatalogHome(){
  leaveBusMapHome();busMapArea='catalog';$('bus-view').classList.toggle('bus-map-mode',false);$('bus-map-home').hidden=true;
  $('bus-map-entry').setAttribute('aria-pressed','false');$('bus-catalog-entry').setAttribute('aria-pressed','true');renderBus();$('bus-map-entry').focus();
}
function networkAvailableLines(){const allowed=view==='bus'&&typeof busCatalogFilteredLines==='function'?new Set(busCatalogFilteredLines().map(line=>line.number)):null;return [...new Set(busRouteData.routes.map(route=>route.number))].filter(number=>!allowed||allowed.has(number)).sort((a,b)=>a.localeCompare(b,'it',{numeric:true}));}
function networkStops(groups){
  const stops=new Map();for(const group of groups)for(const route of group.routes)for(const stop of route.stops){const key=stop.ref||stop.id;if(!stops.has(key))stops.set(key,{...stop,numbers:[],color:group.color});const item=stops.get(key);if(!item.numbers.includes(group.number))item.numbers.push(group.number);}return [...stops.values()];
}
function rememberNetworkLines(){try{localStorage.setItem('verona-bus-network-v1',JSON.stringify(busNetworkLines));}catch{}}
function openBusNetwork({compare=false,embedded=false}={}){
  busNetworkInline=embedded;$('network-shell').classList.toggle('network-inline',embedded);
  (embedded?$('bus-map-home'):$('bus-network-dialog')).append($('network-shell'));
  mountNetworkActions();
  $('network-nearby').hidden=!embedded;$('network-options-toggle').hidden=!embedded;$('network-extra-options').hidden=embedded;
  busNetworkExplore=!compare;networkChosenStop=null;networkChosenLine='';networkChosenRoutes=[];networkRouteState='';networkStopError=false;
  busNetworkFocus=document.activeElement;const available=networkAvailableLines();
  {busNetworkInitialized=true;let saved=null;try{saved=JSON.parse(localStorage.getItem('verona-bus-network-v1')||'null');}catch{}
    const preferred=Array.isArray(saved)?saved:[...busFavoriteNumbers()];busNetworkLines=[...new Set(preferred)].filter(number=>available.includes(number)).slice(0,6);if(!busNetworkLines.length&&!Array.isArray(saved))busNetworkLines=['11','12','13'].filter(number=>available.includes(number));}
  officialOptions('network-line',available.map(number=>({value:number,label:'Linea '+number})),'','Aggiungi una linea');
  $('network-line').disabled=!available.length;$('network-add-line').disabled=!available.length;$('network-favorites').disabled=!available.length;
  busNetworkMode='map';busNetworkFit=!busNetworkExplore;$('network-stop-search').value='';syncNetworkMode();if(!embedded&&!networkIsOpen())$('bus-network-dialog').showModal();return busNetworkExplore?loadNetworkStops():loadBusNetwork();
}
function syncNetworkMode(){
  renderNetworkLineRail();
  updateNetworkSheet();
  $('network-shell').classList.toggle('network-has-selection',false);
  $('network-all-stops').setAttribute('aria-pressed',String(busNetworkExplore));$('network-compare').setAttribute('aria-pressed',String(!busNetworkExplore));
  $('network-picker').hidden=busNetworkExplore;$('network-lines').hidden=busNetworkExplore;$('network-selected-stop').hidden=true;
  $('network-stop-search').setAttribute('aria-label',busNetworkExplore?'Cerca una fermata per nome o codice':'Cerca una fermata nelle linee selezionate');
}
async function loadBusNetwork(){
  const request=++busNetworkRequest;$('network-status').textContent='Caricamento delle linee…';renderNetworkChips();
  const groups=await Promise.all(busNetworkLines.map(async(number,i)=>{try{return {number,color:eventBusPalette[i%eventBusPalette.length],routes:await loadEventRouteLine(number)};}catch{return {number,color:eventBusPalette[i%eventBusPalette.length],routes:[],error:true};}}));
  if(request!==busNetworkRequest||!networkIsOpen())return;
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
$('bus-network-open').onclick=()=>view==='bus'?showBusMapHome():openBusNetwork();
$('close-bus-network').onclick=()=>$('bus-network-dialog').close();
$('bus-network-dialog').addEventListener('close',()=>{busNetworkRequest++;if(typeof cancelBusStopExperience==='function')cancelBusStopExperience($('network-selected-stop'));if(busNetworkFocus?.isConnected)busNetworkFocus.focus();});
$('network-add-line').onclick=()=>{const number=$('network-line').value;if(!number||busNetworkLines.includes(number))return;if(busNetworkLines.length>=6){$('network-status').textContent='Puoi confrontare fino a 6 linee. Rimuovine una per aggiungerne un’altra.';return;}busNetworkLines.push(number);rememberNetworkLines();busNetworkFit=true;loadBusNetwork();};
$('network-favorites').onclick=()=>{const available=networkAvailableLines(),numbers=[...busFavoriteNumbers()].filter(number=>available.includes(number)).slice(0,6);if(!numbers.length){$('network-status').textContent='Non hai linee preferite con una mappa disponibile. Aggiungile con la stella nell’elenco Autobus.';return;}busNetworkLines=numbers;rememberNetworkLines();busNetworkFit=true;loadBusNetwork();};
$('network-map-tab').onclick=()=>{busNetworkMode='map';renderBusNetwork();};
$('network-list-tab').onclick=()=>{busNetworkMode='list';if(busNetworkExplore)networkChosenStop=null;renderBusNetwork();};
$('network-stop-search').onfocus=()=>closeNetworkLineMenu(false);
$('network-stop-search').oninput=()=>{closeNetworkLineMenu(false);if(busNetworkInline&&busNetworkMode==='map')return renderNetworkSearch();if(busNetworkExplore&&busNetworkMode==='map')busNetworkFit=true;renderBusNetwork();};
$('network-fit').onclick=()=>{closeNetworkActions(true);busNetworkMode='map';busNetworkFit=true;renderBusNetwork();};
$('network-retry').onclick=()=>busNetworkExplore?loadNetworkStops():loadBusNetwork();

async function loadNetworkStops(){
  const request=++busNetworkRequest;$('network-status').textContent='Caricamento delle fermate ufficiali…';$('network-retry').hidden=true;
  try{const index=await loadEventBusStops();if(request!==busNetworkRequest||!networkIsOpen())return;networkStopIndex=index;networkStopError=false;renderNetworkExplorer();}
  catch{if(request!==busNetworkRequest||!networkIsOpen())return;networkStopError=true;$('network-status').textContent='Fermate non disponibili. Riprova oppure usa Confronta linee.';$('network-retry').hidden=false;}
}
function networkOfficialStops(){
  const allowed=typeof busCatalogFilteredLines==='function'?new Set(busCatalogFilteredLines().map(line=>line.number)):null;
  const key=allowed?[...allowed].sort().join('|'):'*';if(networkStopsCache?.index===networkStopIndex&&networkStopsCache.key===key)return networkStopsCache.stops;
  const stops=(networkStopIndex?.stops||[]).filter(stop=>Number.isFinite(stop.lat)&&Number.isFinite(stop.lon)&&Math.abs(stop.lat)<=90&&Math.abs(stop.lon)<=180&&(stop.lat!==0||stop.lon!==0)).map(stop=>({...stop,numbers:stop.services.map(([number])=>number).filter(number=>!allowed||allowed.has(number))})).filter(stop=>stop.numbers.length);
  networkStopsCache={index:networkStopIndex,key,stops};return stops;
}
function networkExplorerMatches(){const query=placeSearchText($('network-stop-search').value),stops=networkOfficialStops();if(networkMatchCache?.stops===stops&&networkMatchCache.query===query&&networkMatchCache.line===networkChosenLine)return networkMatchCache.result;const result=stops.filter(stop=>(!networkChosenLine||stop.numbers.includes(networkChosenLine))&&(!query||placeSearchText(stop.name+' '+stop.code).includes(query)));networkMatchCache={stops,query,line:networkChosenLine,result};return result;}
function selectNetworkStop(stop){if(busNetworkInline)setNetworkSearch(false);closeNetworkLineMenu(false);networkChosenStop=stop;$('network-search-results').hidden=true;$('network-extra-options').hidden=busNetworkInline;if(busNetworkInline)$('network-options-toggle').setAttribute('aria-expanded','false');renderNetworkStopPanel();busNetworkMap?.invalidateSize();if(busNetworkInline)busNetworkMap?.panInside?.([stop.lat,stop.lon],{paddingTopLeft:[20,networkMapTopPadding()],paddingBottomRight:[20,($('network-sheet').clientHeight||200)+15]});}
function renderNetworkStopPanel(){
  updateNetworkSheet();const panel=$('network-selected-stop');panel.hidden=!networkChosenStop||!busNetworkExplore;$('network-shell').classList.toggle('network-has-selection',!panel.hidden);if(panel.hidden){if(typeof cancelBusStopExperience==='function')cancelBusStopExperience(panel);return;}
  if(typeof renderBusStopExperience==='function')return renderBusStopExperience(panel,networkChosenStop,{compact:true,mapHome:busNetworkInline,line:networkChosenLine,routeState:networkRouteState,isOpen:()=>networkIsOpen()&&busNetworkExplore,onChoose:selectNetworkLine,onClose:()=>{networkChosenStop=null;renderNetworkExplorer();$('network-stop-search').focus();}});
  panel.replaceChildren();
  const stop=networkChosenStop,head=el('div','','network-stop-heading'),title=el('div'),close=el('button','×');close.setAttribute('aria-label','Chiudi fermata selezionata');close.onclick=()=>{networkChosenStop=null;renderNetworkExplorer();};title.append(el('strong',stop.name),el('small','Fermata '+stop.code));head.append(title,close);panel.append(head);
  const lines=el('div','','network-stop-lines');lines.setAttribute('role','group');lines.setAttribute('aria-label','Linee che passano da questa fermata');
  for(const number of stop.numbers){const button=el('button','Linea '+number);button.setAttribute('aria-label','Mostra percorso linea '+number+' dalla fermata '+stop.code);button.setAttribute('aria-pressed',String(networkChosenLine===number));button.onclick=()=>selectNetworkLine(number);lines.append(button);}panel.append(lines);
  if(networkChosenLine){const times=el('button','Orari linea '+networkChosenLine+' qui','bus-stop-all-times');times.onclick=()=>openOfficialBus(networkChosenLine,{stopCode:stop.code});panel.append(times);}
  panel.append(el('p',networkChosenLine?'Linea '+networkChosenLine+' · '+(networkRouteState==='loading'?'Caricamento percorso…':networkRouteState==='ready'?'Percorso colorato e fermate evidenziate.':networkRouteState==='error'?'Percorso non caricato. Riprova selezionando la linea.':'Tracciato non disponibile: mostriamo le fermate ufficiali, senza collegarle con un percorso inventato.'):'Scegli una linea per vedere percorso e fermate. Le linee elencate possono avere giorni di servizio diversi.','network-selection-note'));
}
async function selectNetworkLine(number){
  closeNetworkActions();
  closeNetworkLineMenu(false);
  const fromStop=busNetworkInline&&$('network-selected-stop').contains?.(document.activeElement);
  if(busNetworkInline)setNetworkSearch(false);
  const request=++busNetworkRequest;networkChosenLine=number;networkChosenRoutes=[];networkRouteState='loading';busNetworkFit=false;$('network-stop-search').value='';renderNetworkExplorer();
  if(fromStop&&networkSheetSize==='compact')$('network-sheet-more').focus();
  try{const routes=await loadEventRouteLine(number);if(request!==busNetworkRequest||!networkIsOpen()||!busNetworkExplore)return;networkChosenRoutes=routes;networkRouteState=routes.length?'ready':'missing';}
  catch{if(request!==busNetworkRequest||!networkIsOpen()||!busNetworkExplore)return;networkRouteState='error';}
  busNetworkFit=true;renderNetworkExplorer();
}
function renderNetworkExplorer(focusCode=null){
  renderNetworkLineRail();
  const isMap=busNetworkMode==='map',mapBox=$('network-map'),list=$('network-stops');mapBox.hidden=!isMap;list.hidden=isMap;$('network-stop-search').hidden=false;
  $('network-shell').classList.toggle('network-show-list',!isMap);$('network-list-tab').textContent=busNetworkInline?'Elenco fermate':'Fermate';$('network-fit').textContent=busNetworkInline?'Percorso completo':'Inquadra tutto';$('network-return-stop').hidden=!busNetworkInline||!networkChosenStop;
  $('network-fit').hidden=busNetworkInline&&!networkChosenLine;
  $('network-search-toggle').hidden=!busNetworkInline||!isMap;
  if(busNetworkInline){$('network-stop-search').placeholder='Nome o codice fermata…';$('network-stop-search').setAttribute('aria-label','Cerca fermata o linea');}
  $('network-clear-line').hidden=!busNetworkInline||!networkChosenLine||Boolean(networkChosenStop);$('network-clear-line').textContent='× Linea '+networkChosenLine;$('network-clear-line').setAttribute('aria-label','Rimuovi selezione linea '+networkChosenLine);
  $('network-map-tab').setAttribute('aria-pressed',String(isMap));$('network-list-tab').setAttribute('aria-pressed',String(!isMap));$('network-retry').hidden=!networkStopError;
  const stops=networkExplorerMatches(),count=stops.length+(stops.length===1?' fermata ufficiale':' fermate ufficiali');$('network-status').textContent=networkChosenLine?'Linea '+networkChosenLine+' · '+count:count+' · Tocca un punto e scegli una linea';
  if(networkChosenLine&&networkRouteState==='missing')$('network-status').textContent+=' · Tracciato non disponibile';
  if(networkChosenLine&&networkRouteState==='loading')$('network-status').textContent+=' · Caricamento percorso…';
  if(networkChosenLine&&networkRouteState==='error')$('network-status').textContent+=' · Percorso non caricato: riseleziona la linea per riprovare';
  if(!stops.length)$('network-status').textContent='Nessuna fermata per la ricerca e i filtri scelti.';renderNetworkStopPanel();
  if(!isMap){list.replaceChildren();const sorted=stops.slice().sort((a,b)=>a.name.localeCompare(b.name,'it'));for(const stop of sorted.slice(0,80)){const card=el('article','','network-stop-card');card.append(el('strong',stop.name),el('small','Fermata '+stop.code+' · Linee '+stop.numbers.join(', ')));const button=el('button','Vedi fermata e linee');button.onclick=()=>{networkChosenStop=stop;busNetworkMode='map';renderNetworkExplorer(stop.code);};card.append(button);list.append(card);}if(sorted.length>80)list.append(el('p','Prime 80 fermate su '+sorted.length+'. Cerca per nome o codice.','timetable-prompt'));return;}
  if(typeof L==='undefined'){$('network-status').textContent='Mappa non disponibile. Usa l’elenco Fermate per scegliere una linea.';return;}
  if(!busNetworkMap){busNetworkMap=L.map('network-map',{preferCanvas:true}).setView([45.4384,10.9916],13);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{$('network-status').textContent='Sfondo non disponibile. Fermate e linee restano consultabili.';}).addTo(busNetworkMap);busNetworkLayer=L.layerGroup().addTo(busNetworkMap);}
  if(!busNetworkMap.networkStopsMove){busNetworkMap.networkStopsMove=true;busNetworkMap.on('moveend',()=>{if(busNetworkExplore&&networkIsOpen()&&busNetworkMode==='map')drawNetworkExplorer();});}
  busNetworkMap.invalidateSize();if(focusCode){const stop=stops.find(stop=>stop.code===focusCode);if(stop)busNetworkMap.setView([stop.lat,stop.lon],17);}
  drawNetworkExplorer();installMapLocation(busNetworkMap,'network');
}
function renderNetworkLineRail(){
  const rail=$('network-line-rail');rail.hidden=!busNetworkInline||!busNetworkExplore||busNetworkMode!=='map';if(rail.hidden){closeNetworkLineMenu(false);return;}
  const lines=(typeof busCatalogFilteredLines==='function'?busCatalogFilteredLines():officialBus.lines).slice().sort((a,b)=>a.number.localeCompare(b.number,'it',{numeric:true}));
  const signature=lines.map(line=>line.number+'|'+line.name).join(';');
  if(rail.lineSignature!==signature){
    rail.lineSignature=signature;rail.lineButtons=new Map();const results=$('network-line-results');results.replaceChildren();
    const all=el('button','Tutte le linee');all.setAttribute('aria-label','Mostra tutte le fermate, senza filtro linea');all.onclick=()=>{busNetworkRequest++;networkChosenStop=null;networkChosenLine='';networkChosenRoutes=[];networkRouteState='';$('network-stop-search').value='';$('network-search-results').hidden=true;busNetworkFit=true;closeNetworkLineMenu();renderNetworkExplorer();};results.append(all);rail.allButton=all;
    for(const line of lines){const name=typeof busDisplayName==='function'?busDisplayName(line.name||''):line.name||'',button=el('button','');button.append(el('strong',line.number),el('span',name));button.title='Linea '+line.number+' · '+name;button.setAttribute('aria-label','Mostra percorso linea '+line.number+' · '+name);button.onclick=()=>{networkChosenStop=null;$('network-search-results').hidden=true;closeNetworkLineMenu();return selectNetworkLine(line.number);};rail.lineButtons.set(line.number,button);results.append(button);}
  }
  rail.allButton.setAttribute('aria-pressed',String(!networkChosenLine));
  for(const [number,button]of rail.lineButtons)button.setAttribute('aria-pressed',String(number===networkChosenLine));
  const selected=lines.find(line=>line.number===networkChosenLine);$('network-line-toggle').textContent=selected?'Linea '+selected.number+' · '+(typeof busDisplayName==='function'?busDisplayName(selected.name||''):selected.name||''):'Scegli una linea';
  filterNetworkLineMenu();
}
function closeNetworkLineMenu(restoreFocus=true){const open=!$('network-line-menu').hidden;$('network-line-menu').hidden=true;$('network-line-toggle').setAttribute('aria-expanded','false');if(open&&restoreFocus)$('network-line-toggle').focus();}
function filterNetworkLineMenu(){
  const rail=$('network-line-rail'),query=placeSearchText($('network-line-query').value);let count=0;
  if(!rail.lineButtons)return;
  rail.allButton.hidden=Boolean(query);
  for(const [number,button]of rail.lineButtons){button.hidden=!placeSearchText(button.title).includes(query);if(!button.hidden)count++;}
  $('network-line-empty').hidden=count>0;$('network-line-empty').textContent=query?'Nessuna linea trovata. Prova un altro numero o destinazione.':'Nessuna linea per i filtri scelti.';
}
$('network-line-toggle').onclick=()=>{const menu=$('network-line-menu');if(!menu.hidden)return closeNetworkLineMenu();setNetworkSearch(false);$('network-search-results').hidden=true;$('network-extra-options').hidden=true;$('network-options-toggle').setAttribute('aria-expanded','false');$('network-line-query').value='';filterNetworkLineMenu();menu.hidden=false;$('network-line-toggle').setAttribute('aria-expanded','true');$('network-line-toggle').focus();};
$('network-search-toggle').onclick=()=>{closeNetworkLineMenu(false);setNetworkSearch(!networkSearchOpen);if(!networkSearchOpen)renderBusNetwork();};
$('network-line-close').onclick=()=>closeNetworkLineMenu();
$('network-actions-toggle').onclick=()=>{if(!$('network-actions-menu').hidden)return closeNetworkActions(true);closeNetworkLineMenu(false);setNetworkSearch(false);$('network-extra-options').hidden=true;$('network-options-toggle').setAttribute('aria-expanded','false');$('network-actions-menu').hidden=false;$('network-actions-toggle').setAttribute('aria-expanded','true');};
$('network-actions-close').onclick=()=>closeNetworkActions(true);
$('network-actions-menu').onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation?.();closeNetworkActions(true);}};
$('network-shell').addEventListener('pointerdown',event=>{if(!event.target?.closest?.('#network-actions-menu, #network-actions-toggle'))closeNetworkActions();});
$('network-line-query').oninput=filterNetworkLineMenu;
$('network-line-menu').onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation?.();closeNetworkLineMenu();return;}if(!['ArrowDown','ArrowUp'].includes(event.key))return;const rail=$('network-line-rail'),buttons=[rail.allButton,...rail.lineButtons.values()].filter(button=>!button.hidden),index=buttons.indexOf(document.activeElement),next=event.key==='ArrowDown'?Math.min(buttons.length-1,index+1):Math.max(0,index-1);buttons[next]?.focus();event.preventDefault();};
function drawNetworkExplorer(){
  if(!busNetworkMap||!busNetworkLayer)return;busNetworkLayer.clearLayers();const stops=networkExplorerMatches(),bounds=[];
  for(const route of networkChosenRoutes){L.polyline(route.segments,{color:'#fff',weight:8,opacity:.9}).addTo(busNetworkLayer);L.polyline(route.segments,{color:eventBusPalette[0],weight:5,opacity:.95}).bindPopup(el('strong','Linea '+networkChosenLine+' · '+route.label)).addTo(busNetworkLayer);for(const segment of route.segments)bounds.push(...segment);}
  const visible=busNetworkMap.getBounds?.().pad(.15);
  if(!networkStopsRenderer&&typeof L.canvas==='function'){const pane=busNetworkMap.getPane('network-stop-pins')||busNetworkMap.createPane('network-stop-pins');pane.style.zIndex=450;networkStopsRenderer=L.canvas({tolerance:16,pane:'network-stop-pins'});}
  const inView=stops.filter(stop=>!visible||visible.contains([stop.lat,stop.lon]));
  const groups=busNetworkInline&&!networkChosenStop&&!networkChosenLine&&busNetworkMap.getZoom()<15?clusterNetworkStops(inView,stop=>busNetworkMap.latLngToContainerPoint([stop.lat,stop.lon])):inView.map(stop=>({stops:[stop],lat:stop.lat,lon:stop.lon}));
  for(const group of groups){
    if(group.stops.length>1){const marker=L.marker([group.lat,group.lon],{title:group.stops.length+' fermate · ingrandisci',icon:L.divIcon({className:'network-cluster',html:'<span>'+group.stops.length+'</span>',iconSize:[44,44],iconAnchor:[22,22]})}).on('click',()=>busNetworkMap.fitBounds(group.stops.map(stop=>[stop.lat,stop.lon]),{padding:[40,40],maxZoom:Math.min(17,busNetworkMap.getZoom()+2)})).addTo(busNetworkLayer);marker.getElement?.()?.setAttribute('aria-label',group.stops.length+' fermate, ingrandisci la mappa');continue;}
    const stop=group.stops[0],chosen=stop.code===networkChosenStop?.code;L.circleMarker([stop.lat,stop.lon],{renderer:networkStopsRenderer||undefined,radius:chosen?9:6,color:chosen?'#8a5600':eventBusPalette[0],fillColor:chosen?'#f3c84b':'#fff',fillOpacity:1,weight:chosen?3:2}).bindTooltip(stop.name+' · '+stop.code).on('click',()=>{selectNetworkStop(stop);drawNetworkExplorer();}).addTo(busNetworkLayer);
  }
  if(busNetworkFit){busNetworkFit=false;const fit=busNetworkInline?{paddingTopLeft:[20,networkMapTopPadding()],paddingBottomRight:[20,networkChosenStop?($('network-sheet').clientHeight||180)+15:90]}:{padding:[20,20]};if(bounds.length)busNetworkMap.fitBounds(bounds,{...fit,maxZoom:14});else if(stops.length)busNetworkMap.fitBounds(stops.map(stop=>[stop.lat,stop.lon]),{...fit,maxZoom:16});}
}
function clusterNetworkStops(stops,project,cellSize=88){
  const groups=new Map();for(const stop of stops){const point=project(stop),key=Math.floor(point.x/cellSize)+':'+Math.floor(point.y/cellSize);if(!groups.has(key))groups.set(key,{stops:[],lat:0,lon:0});const group=groups.get(key);group.stops.push(stop);group.lat+=stop.lat;group.lon+=stop.lon;}
  return [...groups.values()].map(group=>({...group,lat:group.lat/group.stops.length,lon:group.lon/group.stops.length}));
}
$('network-all-stops').onclick=()=>{if(busNetworkInline&&typeof busCatalogScope!=='undefined'){busCatalogScope='';busOnlyFavorites=false;if(busMode==='favorites')busMode='lines';$('bus-service').value='';}busNetworkRequest++;busNetworkExplore=true;networkChosenLine='';networkChosenRoutes=[];networkChosenStop=null;$('network-stop-search').value='';busNetworkFit=true;syncNetworkMode();return loadNetworkStops();};
$('network-compare').onclick=()=>{busNetworkExplore=false;busNetworkRequest++;syncNetworkMode();busNetworkFit=true;return loadBusNetwork();};

function updateNetworkSheet(){
  const active=busNetworkExplore&&Boolean(networkChosenStop);$('network-sheet').hidden=!active;if(!active){networkSheetStop='';$('network-map').inert=false;return;}
  if(networkSheetStop!==networkChosenStop.code){networkSheetStop=networkChosenStop.code;networkSheetSize='compact';}
  $('network-map').inert=Boolean(busNetworkInline&&networkSheetSize==='full');
  $('network-sheet').classList.toggle('network-sheet-has-line',Boolean(networkChosenLine));
  $('network-sheet').setAttribute('data-size',networkSheetSize);
  $('network-sheet-less').setAttribute('aria-disabled',String(networkSheetSize==='compact'));$('network-sheet-more').setAttribute('aria-disabled',String(networkSheetSize==='full'));
  const stateLabel=networkSheetSize==='compact'&&networkChosenLine?'Scorri gli orari':{compact:'Compatta',medium:'Partenze',full:'Dettagli'}[networkSheetSize];$('network-sheet-label').textContent=stateLabel;
  $('network-sheet-more').setAttribute('aria-expanded',String(networkSheetSize==='full'));
}
function resizeNetworkSheet(direction){
  const sizes=['compact','medium','full'];networkSheetSize=sizes[Math.max(0,Math.min(2,sizes.indexOf(networkSheetSize)+direction))];updateNetworkSheet();busNetworkMap?.invalidateSize();
}
function renderNetworkSearch(){
  const box=$('network-search-results'),query=placeSearchText($('network-stop-search').value);box.replaceChildren();box.hidden=!query;if(!query)return;
  if(!networkStopIndex){box.append(el('p','Caricamento delle fermate…'));loadEventBusStops().then(index=>{networkStopIndex=index;if(networkIsOpen()&&placeSearchText($('network-stop-search').value)===query)renderNetworkSearch();}).catch(()=>{if(networkIsOpen())box.replaceChildren(el('p','Fermate non caricate. Usa Riprova sulla mappa.'));});return;}
  const lines=(typeof busCatalogFilteredLines==='function'?busCatalogFilteredLines():officialBus.lines).filter(line=>placeSearchText(line.number+' '+(line.name||'')).includes(query)).sort((a,b)=>Number(b.number===query)-Number(a.number===query));
  for(const line of lines.slice(0,3)){const button=el('button','Linea '+line.number+' · '+(typeof busDisplayName==='function'?busDisplayName(line.name):line.name));button.onclick=()=>{box.hidden=true;$('network-stop-search').value='';networkChosenStop=null;const pending=selectNetworkLine(line.number);$('network-stop-search').focus();return pending;};box.append(button);}
  const stops=networkOfficialStops().filter(stop=>placeSearchText(stop.name+' '+stop.code).includes(query)).sort((a,b)=>Number(b.code===query)-Number(a.code===query));
  for(const stop of stops.slice(0,5)){const button=el('button',(typeof busDisplayName==='function'?busDisplayName(stop.name):stop.name)+' · Fermata '+stop.code);button.onclick=()=>{box.hidden=true;$('network-stop-search').value='';if(!stop.numbers.includes(networkChosenLine)){networkChosenLine='';networkChosenRoutes=[];networkRouteState='';}busNetworkMode='map';selectNetworkStop(stop);renderNetworkExplorer(stop.code);if(networkChosenLine)$('network-sheet-more').focus();else $('network-selected-stop').stopUi?.buttons.values().next().value?.focus();};box.append(button);}
  if(!lines.length&&!stops.length)box.append(el('p','Nessun risultato. Prova un nome o codice diverso.'));
}
$('network-stop-search').onkeydown=event=>{if(!busNetworkInline)return;if(event.key==='Escape'){$('network-search-results').hidden=true;}if(event.key==='ArrowDown'){$('network-search-results').querySelector?.('button')?.focus();event.preventDefault();}};
$('network-clear-line').onclick=()=>{networkChosenLine='';networkChosenRoutes=[];networkRouteState='';$('network-stop-search').value='';renderNetworkExplorer();$('network-stop-search').focus();};
$('bus-map-entry').onclick=()=>{const pending=showBusMapHome();$('network-actions-toggle').focus();return pending;};
$('bus-catalog-entry').onclick=showBusCatalogHome;
$('network-sheet-less').onclick=()=>resizeNetworkSheet(-1);
$('network-sheet-more').onclick=()=>resizeNetworkSheet(1);
$('network-options-toggle').onclick=()=>{closeNetworkLineMenu(false);const box=$('network-extra-options');box.hidden=!box.hidden;$('network-options-toggle').setAttribute('aria-expanded',String(!box.hidden));};
$('network-nearby').onclick=()=>requestMapLocation('network');
$('network-return-stop').onclick=()=>{closeNetworkActions(true);if(networkChosenStop)busNetworkMap?.setView([networkChosenStop.lat,networkChosenStop.lon],17);};
let networkSheetPointer=null;
$('network-sheet-tools').onpointerdown=event=>{if(event.target?.closest?.('button'))return;networkSheetPointer={y:event.clientY,id:event.pointerId};$('network-sheet-tools').setPointerCapture?.(event.pointerId);};
$('network-sheet-tools').onpointerup=event=>{if(!networkSheetPointer||networkSheetPointer.id!==event.pointerId)return;const delta=networkSheetPointer.y-event.clientY;networkSheetPointer=null;if(Math.abs(delta)>35)resizeNetworkSheet(delta>0?1:-1);};
$('network-sheet-tools').onpointercancel=()=>{networkSheetPointer=null;};
