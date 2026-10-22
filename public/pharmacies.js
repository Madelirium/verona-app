function pharmacyLink(label,url,primary=false){const link=el('a',label,'pharmacy-link'+(primary?' pharmacy-primary':''));link.href=url;if(!url.startsWith('tel:')){link.target='_blank';link.rel='noopener noreferrer';}return link;}
function openPharmacies(){
  pharmacyReturnFocus=document.activeElement;pharmacyMode='list';pharmacyScope='city';pharmacyQuery='';$('pharmacy-search').value='';$('pharmacy-scope').value='city';$('pharmacy-dialog').showModal();renderPharmacies();$('pharmacy-close').focus();schedulePharmacies();
}
function pharmacyCard(item){
  const card=el('article','','pharmacy-card');card.append(el('h3',item.name),el('p',item.address),el('p',[item.locality,item.city].filter(Boolean).join(' · '),'pharmacy-locality'));
  const actions=el('div','','pharmacy-actions');actions.append(pharmacyLink('Chiama','tel:'+item.phone,true),pharmacyLink('Come arrivare ↗','https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent([item.address,item.locality,item.city,'VR','Italia'].filter(Boolean).join(', '))));card.append(actions);return card;
}
function pharmacyPopup(item){
  const popup=el('div','','pharmacy-popup');popup.append(el('strong',item.name),el('p',item.address));const actions=el('div','','pharmacy-actions'),details=el('button','Scheda','pharmacy-reset');details.onclick=()=>{pharmacyMode='list';pharmacyQuery=item.name;$('pharmacy-search').value=item.name;renderPharmacies();$('pharmacy-list-tab').focus();};actions.append(pharmacyLink('Chiama','tel:'+item.phone,true),details);popup.append(actions);return popup;
}
function renderPharmacies(){
  const periods=pharmacyPeriods(pharmacyData,new Date().toISOString()),all=periods.flatMap(period=>period.items),words=placeSearchText(pharmacyQuery).split(' ').filter(Boolean),items=all.filter(item=>(pharmacyScope==='all'||item.scope==='city')&&words.every(word=>placeSearchText(item.name+' '+item.address+' '+item.city+' '+item.locality).includes(word)));
  $('pharmacy-list-tab').setAttribute('aria-pressed',String(pharmacyMode==='list'));$('pharmacy-map-tab').setAttribute('aria-pressed',String(pharmacyMode==='map'));
  $('pharmacy-list').hidden=pharmacyMode!=='list';$('pharmacy-map-area').hidden=pharmacyMode!=='map';
  const period=periods[0];$('pharmacy-count').textContent=period?items.length+(items.length===1?' farmacia di turno':' farmacie di turno')+(pharmacyScope==='city'?' a Verona':' in provincia'):'Turni da aggiornare';
  const range=value=>new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
  $('pharmacy-period').textContent=period?'Turno dal '+range(period.startsAt)+' al '+range(period.endsAt):'Nessun turno verificato per questo momento.';
  const list=$('pharmacy-list');list.replaceChildren();
  if(!period){list.append(el('h3','Verifica il turno sul servizio ufficiale'),el('p','I dati salvati non coprono questo momento. Non mostriamo farmacie di turno usando un calendario scaduto.','pharmacy-note'),pharmacyLink('Apri Farmamia Verona ↗',pharmacyData.farmamiaUrl||'https://farmamiaverona.it/',true),pharmacyLink('Turni pubblicati dall’Ordine ↗',pharmacyData.sourceUrl||'https://www.ordinefarmacisti.vr.it/turni-farmacie/'));}
  else if(!items.length){list.append(el('p','Nessun risultato con questi filtri. Prova tutta la provincia o cancella la ricerca.','pharmacy-note'));const reset=el('button','Mostra tutte le farmacie del turno','pharmacy-reset');reset.onclick=()=>{pharmacyScope='all';pharmacyQuery='';$('pharmacy-scope').value='all';$('pharmacy-search').value='';renderPharmacies();};list.append(reset);}
  for(const item of items)list.append(pharmacyCard(item));
  const source=el('details','','pharmacy-source');source.append(el('summary','Fonti e aggiornamento'),el('p','Turni: Ordine dei Farmacisti della Provincia di Verona. Raccolta del '+formatDay(dayInRome(pharmacyData.checkedAt||new Date().toISOString()),{day:'numeric',month:'long',year:'numeric'})+'. Non è un collegamento in tempo reale.'));
  if(period)source.append(pharmacyLink('Documento ufficiale del turno (PDF) ↗',period.sourceUrl));
  source.append(pharmacyLink('Tutti i turni dell’Ordine ↗',pharmacyData.sourceUrl||'https://www.ordinefarmacisti.vr.it/turni-farmacie/'),el('p','Posizioni associate tramite telefono univoco o indirizzo e città: © OpenStreetMap contributors · ODbL. I punti possono essere incompleti; usa l’indirizzo della farmacia.'),pharmacyLink('Crediti OpenStreetMap ↗','https://www.openstreetmap.org/copyright'));list.append(source);
  if(pharmacyMode==='map')renderPharmacyMap(items,Boolean(period));
}
function renderPharmacyMap(items,hasPeriod){
  const message=$('pharmacy-map-message'),mapped=items.filter(item=>item.position);
  const missing=items.length-mapped.length;
  message.textContent=!hasPeriod?'Turni da aggiornare: usa i collegamenti ufficiali in Elenco.':mapped.length?mapped.length+(mapped.length===1?' punto sulla mappa · ':' punti sulla mappa · ')+missing+(missing===1?' indirizzo solo in Elenco.':' indirizzi solo in Elenco.'):'Nessuna posizione verificata con questi filtri. Usa Elenco per indirizzi e telefoni.';
  if(typeof L==='undefined'){message.textContent='Mappa non disponibile. Usa Elenco per indirizzi e telefoni.';return;}
  if(!pharmacyMap){pharmacyMap=L.map('pharmacy-map',{preferCanvas:true}).setView([45.4384,10.9916],12);L.tileLayer(placesData.tileUrl||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{pharmacyTilesFailed=true;message.textContent='Le strade non si caricano. Usa Elenco per consultare le farmacie.';}).addTo(pharmacyMap);pharmacyLayer=L.layerGroup().addTo(pharmacyMap);pharmacyMap.on?.('popupopen',()=>$('pharmacy-map').classList.toggle('pharmacy-has-popup',true));pharmacyMap.on?.('popupclose',()=>$('pharmacy-map').classList.toggle('pharmacy-has-popup',false));}
  if(pharmacyTilesFailed)message.textContent='Le strade non si caricano. Usa Elenco per consultare le farmacie.';
  pharmacyMap.invalidateSize();const signature=String(hasPeriod)+'|'+mapped.map(item=>item.id).join(',');if(signature===pharmacyMapSignature)return;pharmacyMapSignature=signature;pharmacyLayer.clearLayers();
  for(const item of mapped){const marker=L.circleMarker([item.position.lat,item.position.lon],{radius:10,color:'#fff',weight:2,fillColor:'#356b68',fillOpacity:1}).bindPopup(pharmacyPopup(item),{maxWidth:260});marker.addTo(pharmacyLayer);}
  if(mapped.length)pharmacyMap.fitBounds(mapped.map(item=>[item.position.lat,item.position.lon]),{padding:[28,28],maxZoom:15});
}
function schedulePharmacies(){clearTimeout(pharmacyTimer);if(!$('pharmacy-dialog').open)return;const now=Date.now(),edges=pharmacyData.periods.flatMap(period=>[Date.parse(period.startsAt),Date.parse(period.endsAt)]).filter(time=>time>now);pharmacyTimer=setTimeout(()=>{if(!$('pharmacy-dialog').open)return;renderPharmacies();schedulePharmacies();},Math.max(50,Math.min(60000,...edges.map(time=>time-now+50))));}
function refreshPharmacyEntry(){$('explore-pharmacies').hidden=$('explore-category').value!=='Farmacie';}
$('explore-pharmacies').onclick=openPharmacies;$('pharmacy-close').onclick=()=>$('pharmacy-dialog').close();
for(const [id,mode]of [['pharmacy-list-tab','list'],['pharmacy-map-tab','map']])$(id).onclick=()=>{pharmacyMode=mode;renderPharmacies();};
$('pharmacy-scope').onchange=()=>{pharmacyScope=$('pharmacy-scope').value;renderPharmacies();};$('pharmacy-search').oninput=()=>{pharmacyQuery=$('pharmacy-search').value;renderPharmacies();};
$('pharmacy-dialog').addEventListener('close',()=>{clearTimeout(pharmacyTimer);if(pharmacyReturnFocus?.isConnected)pharmacyReturnFocus.focus();});
document.addEventListener?.('visibilitychange',()=>{if(document.visibilityState!=='hidden'&&$('pharmacy-dialog').open){renderPharmacies();schedulePharmacies();}});
