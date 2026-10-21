// A single entry point for the official catalogue and the stop index.
let busCatalogRequest=0,busStopFocus=null,busSelectedStop=null;
let busCatalogScope='';
let busOnlyFavorites=false;
function busCatalogFilteredLines(){return busCatalogLines().filter(line=>(!busCatalogScope||busLineCategory(line)===busCatalogScope)&&(!(busOnlyFavorites||busMode==='favorites')||busCatalogFavorite(line))&&(!$('bus-service').value||line.sheets.some(sheet=>sheet.service===$('bus-service').value)));}
function busAlertMatchesNetwork(alert){if(!busCatalogScope)return true;const allowed=new Set(busCatalogLines().filter(line=>busLineCategory(line)===busCatalogScope).map(line=>line.number));return !alert.lines.length||alert.lines.some(number=>allowed.has(number));}
function syncBusScopeControls(){
  for(const [id,scope]of [['bus-scope-all',''],['bus-scope-urban','urban'],['bus-extraurban','extraurban']])$(id).setAttribute('aria-pressed',String(busCatalogScope===scope));
  $('bus-network-scope').value=busCatalogScope;
  $('bus-favorites').setAttribute('aria-pressed',String(busOnlyFavorites||busMode==='favorites'));
  $('bus-favorites').classList.toggle('active',busOnlyFavorites||busMode==='favorites');$('bus-favorites').hidden=busMode==='alerts';
}
function selectBusNetwork(scope){busCatalogScope=scope;$('bus-service').value='';renderBus();$('bus-list').scrollTop=0;}
function busLineCategory(line){return line.sheets.some(sheet=>['urban','evening','holiday'].includes(sheet.service))?'urban':payload.busCategories?.lines?.[line.number]?.category==='extraurban'?'extraurban':'other';}
function busSearchText(value){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('it').replace(/[^a-z0-9]+/g,' ').trim();}
function busDisplayName(value){return String(value).toLocaleLowerCase('it').replace(/(^|[\s/.'-])(\p{L})/gu,(_,prefix,letter)=>prefix+letter.toLocaleUpperCase('it')).replace(/\b(fs|zai|atv)\b/gi,word=>word.toUpperCase());}
function busCatalogLines(){
  const rows=new Map();
  for(const line of officialBus.lines)rows.set(line.number,{...line,sheets:busData.lines.filter(item=>item.number===line.number)});
  for(const sheet of busData.lines)if(!rows.has(sheet.number))rows.set(sheet.number,{number:sheet.number,name:sheet.route,sheets:[sheet]});
  return [...rows.values()].sort((a,b)=>a.number.localeCompare(b.number,'it',{numeric:true}));
}
function busCatalogFavorite(line){return Boolean(busFavorites['official-'+line.number]||line.sheets.some(sheet=>busFavorites[sheet.id]));}
function busCatalogStar(line){
  const chosen=busCatalogFavorite(line),button=el('button',chosen?'★':'☆','bus-favorite'+(chosen?' chosen':''));
  button.setAttribute('aria-label',(chosen?'Rimuovi dalle tue linee: ':'Aggiungi alle tue linee: ')+line.number);button.setAttribute('aria-pressed',String(chosen));
  button.onclick=()=>{for(const sheet of line.sheets)delete busFavorites[sheet.id];delete busFavorites['official-'+line.number];if(!chosen)busFavorites[line.sheets[0]?.id||'official-'+line.number]=true;
    try{localStorage.setItem('verona-bus-v1',JSON.stringify(busFavorites));$('bus-feedback').textContent=chosen?'Linea rimossa dalle tue linee.':'Linea aggiunta alle tue linee.';}catch{$('bus-feedback').textContent='Scelta valida per questa visita: il browser non consente il salvataggio.';}
    renderBus();const replacement=$('bus-list').querySelector?.('[data-bus-star="'+line.number+'"]');if(replacement)replacement.focus();else $('bus-list').focus();
  };button.setAttribute('data-bus-star',line.number);return button;
}
function appendBusCatalogLine(list,line){
  const card=el('article','','bus-card bus-catalog-card'),open=el('button','','bus-open'),body=el('div','','bus-line-body'),sheet=line.sheets[0];
  const hasOfficial=officialBus.lines.some(item=>item.number===line.number),routes=busRouteData.routes.filter(item=>item.number===line.number);
  const category=busLineCategory(line),label=category==='extraurban'?'Extraurbana · ':category==='urban'?'Urbana · ':'';
  body.append(el('strong',busDisplayName(line.name)),el('small',label+(hasOfficial?'Orari ufficiali'+(routes.length?' · Mappa disponibile':''):'Scheda ATV')));
  open.append(el('span',line.number,'bus-number'),body);open.setAttribute('aria-label','Orari linea '+line.number+', '+line.name);
  open.onclick=()=>hasOfficial?openOfficialBus(line.number):openTimetable(sheet);
  const actions=el('div','','bus-card-actions'),times=el('button','Partenze','bus-timetable');times.onclick=open.onclick;actions.append(times);
  if(routes.length){const map=el('button','Mappa e fermate');map.onclick=()=>openBusRoute(busData.lines.find(item=>item.id===routes[0].lineId)||sheet);actions.append(map);}
  if(sheet){const more=el('button','Dettagli');more.setAttribute('aria-label','Dettagli e avvisi linea '+line.number);more.onclick=()=>openBusLine(sheet);actions.append(more);}
  const alerts=busData.alerts.filter(item=>item.lines.includes(line.number));if(alerts.length)body.append(el('small',alerts.length+' avvisi recenti','bus-alert-count'));
  card.append(open,busCatalogStar(line),actions);list.append(card);
}
function renderBusCatalog(){
  const request=++busCatalogRequest,list=$('bus-list'),query=busSearchText($('bus-search').value),service=$('bus-service').value;
  const stopsOnly=busMode==='stops';list.replaceChildren();const lines=busCatalogFilteredLines();
  const matches=stopsOnly?[]:lines.filter(line=>busSearchText(line.number+' '+line.name+' '+line.sheets.map(sheet=>sheet.route).join(' ')).includes(query));
  const scopeLabel={urban:'Urbane',extraurban:'Extraurbane',other:'Altre linee'}[busCatalogScope];
  $('bus-count').textContent=matches.length+(matches.length===1?' linea':' linee')+(scopeLabel?' · '+scopeLabel:'')+(service?' · filtro servizio attivo':'')+(query?(matches.length===1?' trovata':' trovate'):' · orari programmati');
  $('bus-filter-open').setAttribute('aria-label',service||busCatalogScope?'Filtri autobus: filtri attivi':'Filtri autobus');$('bus-filter-open').classList.toggle('active',Boolean(service||busCatalogScope));
  $('bus-extraurban').setAttribute('aria-pressed',String(busCatalogScope==='extraurban'));$('bus-network-scope').value=busCatalogScope;$('bus-service').disabled=Boolean(busCatalogScope&&busCatalogScope!=='urban');
  const day=dayInRome(new Date());$('bus-stale').textContent=day<officialBus.validFrom||day>officialBus.validTo?'Orari fuori validità: consulta ATV prima di partire.':'';
  if(!query&&!stopsOnly){
    if(!matches.length)busEmpty(list,'Nessuna linea da mostrare.',service||busCatalogScope?'Prova a rimuovere i filtri.':'Salva con la stella le linee che usi di più.',service||busCatalogScope?'Rimuovi filtri':'Mostra tutte le linee',()=>{busCatalogScope='';busOnlyFavorites=false;$('bus-service').value='';setBusMode('lines');});
    else for(const line of matches)appendBusCatalogLine(list,line);return;
  }
  if(matches.length){list.append(el('h3','Linee','bus-feed-heading'));for(const line of matches)appendBusCatalogLine(list,line);}
  const heading=el('h3','Fermate','bus-feed-heading'),results=el('div');list.append(heading,results);
  if(query.length===1){results.append(el('p','Scrivi almeno 2 caratteri per cercare una fermata.','bus-feed-note'));return;}
  if(stopsOnly)$('bus-count').textContent='Ricerca fermate…';
  results.append(el('p','Ricerca delle fermate…','bus-feed-note'));
  return loadEventBusStops().then(index=>{
    if(request!==busCatalogRequest||busMode==='alerts'||view!=='bus')return;
    const allowed=new Set(lines.map(line=>line.number));
    const stops=index.stops.filter(stop=>busSearchText(stop.name+' '+stop.code).includes(query)&&stop.services.some(([number])=>allowed.has(number))).sort((a,b)=>(a.code===query?-1:b.code===query?1:a.name.localeCompare(b.name,'it')));
    results.replaceChildren();$('bus-count').textContent=(stopsOnly?'':matches.length+(matches.length===1?' linea':' linee')+' · ')+stops.length+(stops.length===1?' fermata trovata':' fermate trovate')+(scopeLabel?' · '+scopeLabel:'');if(!stops.length){results.append(el('p','Nessuna fermata corrispondente'+(service||busCatalogScope||busOnlyFavorites||busMode==='favorites'?' nelle linee filtrate.':'.'),'bus-feed-note'));return;}
    for(const stop of stops.slice(0,20)){const button=el('button','','bus-search-stop');button.append(el('strong',stop.name),el('small','Fermata '+stop.code+' · Linee '+stop.services.filter(([number])=>allowed.has(number)).map(([number])=>number).join(', ')));button.onclick=()=>openCatalogStop({...stop,services:stop.services.filter(([number])=>allowed.has(number))});results.append(button);}
    if(stops.length>20)results.append(el('p',stops.length+' fermate trovate. Mostrate le prime 20: aggiungi nome o codice per restringere la ricerca.','bus-feed-note'));
  }).catch(()=>{if(request!==busCatalogRequest||busMode==='alerts'||view!=='bus')return;results.replaceChildren(el('p','Impossibile caricare le fermate. Le linee restano consultabili.','bus-feed-note'));const retry=el('button','Riprova ricerca fermate','bus-retry');retry.onclick=renderBusCatalog;results.append(retry);});
}
function openCatalogStop(stop){
  busStopFocus=document.activeElement;busSelectedStop=stop;$('bus-stop-title').textContent=stop.name;$('bus-stop-code').textContent='Fermata '+stop.code;
  const day=dayInRome(new Date()),dayIndex=eventBusStops.days.indexOf(day),active=stop.services.filter(([,bits])=>dayIndex>=0&&bits[dayIndex]==='1').map(([number])=>number),all=stop.services.map(([number])=>number);
  const lines=[...active,...all.filter(number=>!active.includes(number))];officialOptions('bus-stop-line',lines.map(number=>({value:number,label:'Linea '+number+(dayIndex>=0&&!active.includes(number)?' · altri giorni':'')})),lines[0]);
  $('bus-stop-context').textContent=active.length?'Servizio programmato oggi: '+active.join(', '):'Nessun servizio di oggi verificato: consulta data e orari della linea.';
  $('bus-stop-dialog').showModal();renderCatalogStop();
}
function renderCatalogStop(){return renderBusStopPreview($('bus-stop-next'),$('bus-stop-line').value,busSelectedStop.code);}
$('bus-stop-line').onchange=renderCatalogStop;
$('bus-stop-all').onclick=()=>openOfficialBus($('bus-stop-line').value,{stopCode:busSelectedStop.code});
$('close-bus-stop').onclick=()=>$('bus-stop-dialog').close();
$('bus-stop-dialog').addEventListener('close',()=>{if(busStopFocus?.isConnected)busStopFocus.focus();});
$('bus-filter-open').onclick=()=>$('bus-filters-dialog').showModal();
$('close-bus-filters').onclick=()=>$('bus-filters-dialog').close();
$('bus-filters-dialog').addEventListener('close',()=>$('bus-filter-open').focus());
$('bus-filter-reset').onclick=()=>{busCatalogScope='';$('bus-service').value='';renderBus();};
$('bus-network-scope').onchange=()=>{busCatalogScope=$('bus-network-scope').value;if(busCatalogScope&&busCatalogScope!=='urban')$('bus-service').value='';renderBus();};
for(const [id,scope]of [['bus-scope-all',''],['bus-scope-urban','urban'],['bus-extraurban','extraurban']])$(id).onclick=()=>selectBusNetwork(scope);
for(const [id,mode]of [['bus-lines','lines'],['bus-stops','stops'],['bus-alerts','alerts']])$(id).onclick=()=>{if(busMode==='favorites')busOnlyFavorites=true;setBusMode(mode);};
$('bus-favorites').onclick=()=>{if(busMode==='favorites'){busMode='lines';busOnlyFavorites=false;}else busOnlyFavorites=!busOnlyFavorites;renderBus();$('bus-list').scrollTop=0;};
$('bus-filter-apply').onclick=()=>$('bus-filters-dialog').close();
$('bus-back').onclick=()=>{$('bus-filters-dialog').close();setView('home');};
