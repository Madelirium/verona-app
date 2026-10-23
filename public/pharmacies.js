function pharmacyLink(label,url,primary=false){const link=el('a',label,'pharmacy-link'+(primary?' pharmacy-primary':''));link.href=url;if(!url.startsWith('tel:')){link.target='_blank';link.rel='noopener noreferrer';}return link;}
let pharmacyPoint=null,pharmacyLocationRequest=0,pharmacyResultSignature='';
function pharmacyDistance(point,item){if(!item.position)return null;return exploreDistance(point,{lat:item.position.lat,lon:item.position.lon});}
function pharmacyDistanceLabel(distance){return distance<1000?Math.round(distance/10)*10+' m':(distance/1000).toLocaleString('it-IT',{maximumFractionDigits:1})+' km';}
function pharmacyScopeOptions(){
  const select=$('pharmacy-scope');select.replaceChildren();for(const [value,label]of [['city','Verona città'],['all','Tutta la provincia'],...[...new Set(pharmacyData.periods.flatMap(period=>period.items).map(item=>item.city))].filter(city=>!/^VERONA(?:\s*-|$)/i.test(city)).sort((a,b)=>a.localeCompare(b,'it')).map(city=>['town:'+city,city.toLocaleLowerCase('it').replace(/(^|\s)\S/g,letter=>letter.toLocaleUpperCase('it'))])]){const option=el('option',label);option.value=value;select.append(option);}select.value=pharmacyScope;
}
function openPharmacies(){
  pharmacyReturnFocus=document.activeElement;pharmacyMode='list';pharmacyScope='city';pharmacyQuery='';pharmacyPoint=null;pharmacyLocationRequest++;pharmacyResultSignature='';$('pharmacy-location-feedback').textContent='';$('pharmacy-nearby').disabled=false;pharmacyScopeOptions();$('pharmacy-search').value='';$('pharmacy-dialog').showModal();renderPharmacies();$('pharmacy-close').focus();schedulePharmacies();
}
function pharmacyCard(item){
  const card=el('article','','pharmacy-card');card.append(el('h3',item.name),el('p',item.address),el('p',[item.locality,item.city].filter(Boolean).join(' · '),'pharmacy-locality'));
  if(pharmacyPoint)card.append(el('p',item.distance===null?'Distanza non disponibile · usa l’indirizzo':'Circa '+pharmacyDistanceLabel(item.distance)+' in linea d’aria','pharmacy-distance'));
  const actions=el('div','','pharmacy-actions'),call=pharmacyLink('Chiama','tel:'+item.phone,true),directions=pharmacyLink('Indicazioni ↗','https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent([item.address,item.locality,item.city,'VR','Italia'].filter(Boolean).join(', ')));call.setAttribute('aria-label','Chiama '+item.name+' · '+item.phone);directions.setAttribute('aria-label','Indicazioni per '+item.name);call.setAttribute('data-pharmacy-focus','call-'+item.id);directions.setAttribute('data-pharmacy-focus','directions-'+item.id);actions.append(call,directions);card.append(actions);return card;
}
function pharmacyPopup(item){
  const popup=el('div','','pharmacy-popup');popup.append(el('strong',item.name),el('p',item.address));const actions=el('div','','pharmacy-actions'),details=el('button','Scheda','pharmacy-reset');details.onclick=()=>{pharmacyMode='list';pharmacyQuery=item.name;$('pharmacy-search').value=item.name;renderPharmacies();$('pharmacy-list-tab').focus();};actions.append(pharmacyLink('Chiama','tel:'+item.phone,true),details);popup.append(actions);return popup;
}
function renderPharmacies(){
  const list=$('pharmacy-list'),scroll=list.scrollTop||0,focused=document.activeElement?.getAttribute?.('data-pharmacy-focus');
  const periods=pharmacyPeriods(pharmacyData,new Date().toISOString()),all=periods.flatMap(period=>period.items),words=placeSearchText(pharmacyQuery).split(' ').filter(Boolean),items=all.filter(item=>(pharmacyScope==='all'||(pharmacyScope.startsWith('town:')?item.city===pharmacyScope.slice(5):item.scope==='city'))&&words.every(word=>placeSearchText(item.name+' '+item.address+' '+item.city+' '+item.locality).includes(word))).map(item=>({...item,distance:pharmacyPoint?pharmacyDistance(pharmacyPoint,item):null}));
  if(pharmacyPoint)items.sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity)||a.name.localeCompare(b.name,'it'));
  $('pharmacy-distance-reset').hidden=!pharmacyPoint;
  $('pharmacy-order-note').hidden=!pharmacyPoint||!periods.length;$('pharmacy-order-note').textContent=pharmacyPoint?'Distanze in linea d’aria. Le farmacie senza coordinate sono in fondo all’elenco.':'';
  $('pharmacy-list-tab').setAttribute('aria-pressed',String(pharmacyMode==='list'));$('pharmacy-map-tab').setAttribute('aria-pressed',String(pharmacyMode==='map'));
  $('pharmacy-list').hidden=pharmacyMode!=='list';$('pharmacy-map-area').hidden=pharmacyMode!=='map';
  const period=periods[0];$('pharmacy-count').textContent=period?items.length+(items.length===1?' farmacia di turno':' farmacie di turno')+(pharmacyScope==='city'?' a Verona':pharmacyScope==='all'?' in provincia':' · '+pharmacyScope.slice(5)):'Turni da aggiornare';
  const range=value=>new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
  $('pharmacy-period').textContent=period?'Turno fino al '+range(period.endsAt):'Nessun turno verificato per questo momento.';
  $('pharmacy-updated').textContent='Fonte: Ordine dei Farmacisti · raccolta '+(pharmacyData.checkedAt?formatDay(dayInRome(pharmacyData.checkedAt),{day:'numeric',month:'short'}):'non disponibile');
  list.replaceChildren();
  if(!period){list.append(el('h3','Verifica il turno sul servizio ufficiale'),el('p','I dati salvati non coprono questo momento. Non mostriamo farmacie di turno usando un calendario scaduto.','pharmacy-note'),pharmacyLink('Apri Farmamia Verona ↗',pharmacyData.farmamiaUrl||'https://farmamiaverona.it/',true),pharmacyLink('Turni pubblicati dall’Ordine ↗',pharmacyData.sourceUrl||'https://www.ordinefarmacisti.vr.it/turni-farmacie/'));}
  else if(!items.length){list.append(el('p','Nessun risultato con questi filtri. Prova tutta la provincia o cancella la ricerca.','pharmacy-note'));const reset=el('button','Mostra tutte le farmacie del turno','pharmacy-reset');reset.onclick=()=>{pharmacyScope='all';pharmacyQuery='';$('pharmacy-scope').value='all';$('pharmacy-search').value='';renderPharmacies();};list.append(reset);}
  for(const item of items)list.append(pharmacyCard(item));
  const source=el('details','','pharmacy-source');source.append(el('summary','Fonti e aggiornamento'),el('p','Turni: Ordine dei Farmacisti della Provincia di Verona. Raccolta del '+(pharmacyData.checkedAt?formatDay(dayInRome(pharmacyData.checkedAt),{day:'numeric',month:'long',year:'numeric'}):'giorno non disponibile')+'. Non è un collegamento in tempo reale.'));
  if(period)source.append(el('p','Periodo completo: dal '+range(period.startsAt)+' al '+range(period.endsAt)+'.'),pharmacyLink('Documento ufficiale del turno (PDF) ↗',period.sourceUrl));
  source.append(pharmacyLink('Tutti i turni dell’Ordine ↗',pharmacyData.sourceUrl||'https://www.ordinefarmacisti.vr.it/turni-farmacie/'),el('p','Posizioni associate tramite telefono univoco o indirizzo e città: © OpenStreetMap contributors · ODbL. I punti possono essere incompleti; usa l’indirizzo della farmacia.'),pharmacyLink('Crediti OpenStreetMap ↗','https://www.openstreetmap.org/copyright'));list.append(source);
  if(pharmacyMode==='map')try{renderPharmacyMap(items,Boolean(period));}catch{$('pharmacy-map-message').textContent='Mappa non disponibile. Usa Elenco per indirizzi e telefoni.';}
  const signature=periods.map(period=>period.id).join(',')+'|'+items.map(item=>item.id).join(',');
  if(signature===pharmacyResultSignature){if(focused&&typeof list.querySelectorAll==='function')Array.from(list.querySelectorAll('[data-pharmacy-focus]')).find(node=>node.getAttribute('data-pharmacy-focus')===focused)?.focus({preventScroll:true});list.scrollTop=scroll;}else list.scrollTop=0;pharmacyResultSignature=signature;
}
function renderPharmacyMap(items,hasPeriod){
  const message=$('pharmacy-map-message'),mapped=items.filter(item=>item.position);
  const missing=items.length-mapped.length;
  message.textContent=!hasPeriod?'Turni da aggiornare: usa i collegamenti ufficiali in Elenco.':mapped.length?mapped.length+(mapped.length===1?' punto sulla mappa · ':' punti sulla mappa · ')+missing+(missing===1?' indirizzo solo in Elenco.':' indirizzi solo in Elenco.'):'Nessuna posizione verificata con questi filtri. Usa Elenco per indirizzi e telefoni.';
  if(typeof L==='undefined'){message.textContent='Mappa non disponibile. Usa Elenco per indirizzi e telefoni.';return;}
  if(!pharmacyMap){pharmacyMap=L.map('pharmacy-map',{preferCanvas:false}).setView([45.4384,10.9916],12);L.tileLayer(placesData.tileUrl||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{pharmacyTilesFailed=true;message.textContent='Le strade non si caricano. Usa Elenco per consultare le farmacie.';}).addTo(pharmacyMap);pharmacyLayer=L.layerGroup().addTo(pharmacyMap);pharmacyMap.on?.('popupopen',()=>$('pharmacy-map').classList.toggle('pharmacy-has-popup',true));pharmacyMap.on?.('popupclose',()=>$('pharmacy-map').classList.toggle('pharmacy-has-popup',false));}
  if(pharmacyTilesFailed)message.textContent='Le strade non si caricano. Usa Elenco per consultare le farmacie.';
  pharmacyMap.invalidateSize();const signature=String(hasPeriod)+'|'+mapped.map(item=>item.id).join(',')+'|'+(hasPeriod&&pharmacyPoint?pharmacyPoint.lat+','+pharmacyPoint.lon:'');if(signature===pharmacyMapSignature)return;pharmacyMapSignature=signature;pharmacyLayer.clearLayers();
  for(const item of mapped){const marker=L.circleMarker([item.position.lat,item.position.lon],{radius:22,color:'#356b68',weight:1,fillColor:'#356b68',fillOpacity:.18}).bindPopup(pharmacyPopup(item),{maxWidth:260});marker.addTo(pharmacyLayer);const node=marker.getElement?.();if(node){node.setAttribute('tabindex','0');node.setAttribute('role','button');node.setAttribute('aria-label','Farmacia '+item.name);node.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();marker.openPopup();}});}L.circleMarker([item.position.lat,item.position.lon],{radius:8,color:'#fff',weight:2,fillColor:'#356b68',fillOpacity:1,interactive:false}).addTo(pharmacyLayer);}
  if(hasPeriod&&pharmacyPoint)L.circleMarker([pharmacyPoint.lat,pharmacyPoint.lon],{radius:8,color:'#fff',weight:3,fillColor:'#254f78',fillOpacity:1}).bindPopup(el('strong','La tua posizione')).addTo(pharmacyLayer);
  if(mapped.length)pharmacyMap.fitBounds([...mapped.map(item=>[item.position.lat,item.position.lon]),...(hasPeriod&&pharmacyPoint?[[pharmacyPoint.lat,pharmacyPoint.lon]]:[])],{padding:[28,28],maxZoom:15});
}
function schedulePharmacies(){clearTimeout(pharmacyTimer);if(!$('pharmacy-dialog').open)return;const now=Date.now(),edges=pharmacyData.periods.flatMap(period=>[Date.parse(period.startsAt),Date.parse(period.endsAt)]).filter(time=>time>now);pharmacyTimer=setTimeout(()=>{if(!$('pharmacy-dialog').open)return;renderPharmacies();schedulePharmacies();},Math.max(50,Math.min(60000,...edges.map(time=>time-now+50))));}
function refreshPharmacyEntry(){$('explore-pharmacies').hidden=$('explore-category').value!=='Farmacie';}
$('explore-pharmacies').onclick=openPharmacies;$('pharmacy-close').onclick=()=>$('pharmacy-dialog').close();
for(const [id,mode]of [['pharmacy-list-tab','list'],['pharmacy-map-tab','map']])$(id).onclick=()=>{pharmacyMode=mode;renderPharmacies();};
function cancelPendingPharmacyLocation(){if($('pharmacy-nearby').disabled){pharmacyLocationRequest++;$('pharmacy-nearby').disabled=false;$('pharmacy-location-feedback').textContent='';}}
$('pharmacy-scope').onchange=()=>{cancelPendingPharmacyLocation();if(!pharmacyPoint)$('pharmacy-location-feedback').textContent='';pharmacyScope=$('pharmacy-scope').value;renderPharmacies();};$('pharmacy-search').oninput=()=>{cancelPendingPharmacyLocation();if(!pharmacyPoint)$('pharmacy-location-feedback').textContent='';pharmacyQuery=$('pharmacy-search').value;renderPharmacies();};
$('pharmacy-dialog').addEventListener('close',()=>{clearTimeout(pharmacyTimer);pharmacyLocationRequest++;pharmacyPoint=null;pharmacyMap?.remove?.();pharmacyMap=null;pharmacyLayer=null;pharmacyMapSignature=null;pharmacyTilesFailed=false;if(pharmacyReturnFocus?.isConnected)pharmacyReturnFocus.focus();});
$('pharmacy-distance-reset').onclick=()=>{pharmacyLocationRequest++;pharmacyPoint=null;$('pharmacy-location-feedback').textContent='';$('pharmacy-nearby').disabled=false;renderPharmacies();$('pharmacy-nearby').focus();};
$('pharmacy-nearby').onclick=()=>{
  const feedback=$('pharmacy-location-feedback');
  if(!pharmacyPeriods(pharmacyData,new Date().toISOString()).length){feedback.textContent='I turni sono da aggiornare. Consulta Farmamia per la ricerca attuale.';return;}
  if(typeof isSecureContext!=='undefined'&&!isSecureContext){feedback.textContent='La posizione richiede HTTPS. In Wi-Fi cerca il comune o la farmacia, oppure usa la versione online.';return;}
  if(typeof navigator==='undefined'||!navigator.geolocation){feedback.textContent='Posizione non disponibile. Cerca il comune o la farmacia.';return;}
  const request=++pharmacyLocationRequest;$('pharmacy-nearby').disabled=true;feedback.textContent='Cerco la posizione…';
  const active=()=>request===pharmacyLocationRequest&&$('pharmacy-dialog').open;
  const fail=error=>{if(!active())return;$('pharmacy-nearby').disabled=false;feedback.textContent=error.code===1?'Permesso negato. Puoi cercare per comune o nome.':'Posizione non disponibile. Riprova o cerca per comune.';};
  try{navigator.geolocation.getCurrentPosition(position=>{if(!active())return;const {latitude:lat,longitude:lon,accuracy}=position.coords||{};if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||!Number.isFinite(accuracy)||accuracy<0){fail({code:2});return;}pharmacyPoint={lat,lon};pharmacyScope='all';$('pharmacy-scope').value='all';$('pharmacy-nearby').disabled=false;feedback.textContent=accuracy>200?'Posizione approssimativa: le distanze possono essere imprecise.':'';renderPharmacies();},fail,{enableHighAccuracy:true,timeout:12000,maximumAge:0});}catch{fail({code:2});}
};
document.addEventListener?.('visibilitychange',()=>{if(document.visibilityState!=='hidden'&&$('pharmacy-dialog').open){renderPharmacies();schedulePharmacies();}});
