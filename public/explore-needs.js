let exploreNeedFocus=null,exploreNearbyRequest=0,exploreNearbyFocus=null;
function exploreSearchNeed(query){
  const text=placeSearchText(query);
  if(/\b(parcheggi|parcheggio|parcheggiare|parking)\b/.test(text))return 'parking';
  if(/\b(farmacia|farmacie|farmaci)\b/.test(text))return 'pharmacies';
  if(/\b(rifiuti|ecocentro|ecocentri|isole ecologiche|isola ecologica)\b/.test(text))return 'waste';
  return null;
}
function renderExploreNeedHint(){
  const need=exploreSearchNeed($('explore-search').value),button=$('explore-need-hint');button.hidden=!need||(need==='pharmacies'&&!$('explore-pharmacies').hidden);
  button.textContent={parking:'Cerchi un parcheggio? Apri la mappa →',pharmacies:'Cerchi una farmacia di turno? Apri elenco e mappa →',waste:'Dove portare i rifiuti? Vedi le isole ecologiche →'}[need]||'';
  button.onclick=()=>openExploreNeed(need);
}
function openExploreNeed(need){
  if($('explore-needs-dialog').open)$('explore-needs-dialog').close();
  if(need==='parking')openParkingCatalog();
  else if(need==='pharmacies')openPharmacies();
  else if(need==='waste')openWaste('centers');
  else if(need==='nearby'){
    exploreNearbyFocus=$('explore-needs-open');
    exploreMode='map';renderExplore();$('explore-nearby-status').textContent=typeof isSecureContext!=='undefined'&&!isSecureContext?'Nell’anteprima Wi-Fi puoi scegliere una zona sulla mappa. Per la posizione del telefono serve la versione online HTTPS.':'Scegli come cercare. Il catalogo copre il centro di Verona e le zone limitrofe.';
    $('explore-use-location').disabled=false;$('explore-nearby-dialog').showModal();$('explore-nearby-close').focus();
  }
}
function setExploreNearby(point){
  if(!Number.isFinite(point?.lat)||!Number.isFinite(point?.lon)||Math.abs(point.lat)>90||Math.abs(point.lon)>180)return;
  exploreNearbyPoint={lat:point.lat,lon:point.lon};exploreBounds=null;placeMapFocus=null;placeMapSignature=null;placesShown=60;renderExplore();
  $('explore-feedback').textContent='Attività del catalogo entro 1 km · ordinate per distanza in linea d’aria. Categorie e preferiti restano applicati.';
}
$('explore-needs-open').onclick=()=>{exploreNeedFocus=document.activeElement;$('explore-needs-dialog').showModal();$('explore-needs-close').focus();};
$('explore-needs-close').onclick=()=>$('explore-needs-dialog').close();
$('explore-needs-dialog').addEventListener('close',()=>{if(exploreNeedFocus?.isConnected)exploreNeedFocus.focus();});
for(const [id,need]of [['explore-need-parking','parking'],['explore-need-pharmacies','pharmacies'],['explore-need-waste','waste'],['explore-need-nearby','nearby']])$(id).onclick=()=>openExploreNeed(need);
$('explore-nearby-open').onclick=()=>{openExploreNeed('nearby');exploreNearbyFocus=$('explore-nearby-open');};
$('explore-filters-done').onclick=()=>$('explore-needs-dialog').close();
const previousExploreBack=$('explore-back').onclick;
$('explore-back').onclick=()=>{$('explore-needs-dialog').close();previousExploreBack();};
for(const [id,category]of [['explore-quick-all',''],['explore-quick-food','food'],['explore-quick-shops','shops'],['explore-quick-services','services']])$(id).onclick=()=>{$('explore-category').value=category;placeMapFocus=null;placesShown=60;render();$('places-list').scrollTop=0;};
$('explore-need-places').onclick=()=>{$('explore-needs-dialog').close();$('explore-search').focus();};
const previousExploreEvents=$('explore-events').onclick;
$('explore-events').onclick=()=>{$('explore-needs-dialog').close();previousExploreEvents();};
$('explore-nearby-close').onclick=()=>$('explore-nearby-dialog').close();
$('explore-nearby-dialog').addEventListener('close',()=>{exploreNearbyRequest++;$('explore-use-location').disabled=false;exploreNearbyFocus?.focus();});
$('explore-use-location').onclick=()=>{
  const request=++exploreNearbyRequest;$('explore-use-location').disabled=true;$('explore-nearby-status').textContent='Ricerca della posizione…';
  const active=()=>request===exploreNearbyRequest&&$('explore-nearby-dialog').open&&view==='explore';
  requestMapLocation('places',{isActive:active,onError:message=>{if(active()){$('explore-use-location').disabled=false;$('explore-nearby-status').textContent=message;}},onSuccess:point=>{
    if(!active())return;
    if(point.accuracy>1000){$('explore-use-location').disabled=false;$('explore-nearby-status').textContent='Posizione troppo approssimativa. Scegli una zona sulla mappa per affinare la ricerca.';return;}
    setExploreNearby(point);exploreNearbyFocus=$('explore-list-tab');$('explore-nearby-dialog').close();
  }});
};
$('explore-pick-area').onclick=()=>{
  exploreNearbyFocus=$('explore-search-area');$('explore-nearby-dialog').close();exploreMode='map';renderExplore();$('explore-feedback').textContent='Sposta la mappa sulla zona che ti interessa, poi tocca “Cerca qui”.';
};
