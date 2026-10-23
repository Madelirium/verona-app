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
    if(view==='saved'){render();$('saved-feedback').textContent=$('bus-feedback').textContent;return;}
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
  body.append(el('small','Orari e fermate →','bus-open-hint'));const actions=el('div','','bus-card-actions');
  if(routes.length){const map=el('button','Mappa e fermate');map.onclick=()=>openBusRoute(busData.lines.find(item=>item.id===routes[0].lineId)||sheet);actions.append(map);}
  if(sheet){const more=el('button','Info linea');more.setAttribute('aria-label','Dettagli e avvisi linea '+line.number);more.onclick=()=>openBusLine(sheet);actions.append(more);}
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
  const health=officialArchiveStatus();$('bus-stale').textContent=health.state==='current'?'':health.message;
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
function openCatalogStop(stop,preset={}){
  if(!preset.returning)busStopFocus=document.activeElement;busSelectedStop=stop;
  $('bus-stop-title').textContent=busDisplayName(stop.name);$('bus-stop-code').textContent='Fermata '+stop.code;
  const numbers=stop.services.map(([number])=>number),line=preset.line||(numbers.length===1?numbers[0]:'');
  if(!$('bus-stop-dialog').open)$('bus-stop-dialog').showModal();
  return renderBusStopExperience($('bus-stop-shared'),stop,{line,onChoose:number=>openCatalogStop(stop,{line:number,returning:true}),isOpen:()=>$('bus-stop-dialog').open,onDay:(number,filters)=>{
    $('bus-stop-dialog').close();openOfficialBus(number,{stopCode:stop.code,mode:'day',...filters,onReturn:()=>{openCatalogStop(stop,{line:number,returning:true});$('bus-stop-shared').stopUi.day.focus();}});
  }});
}
$('close-bus-stop').onclick=()=>$('bus-stop-dialog').close();
$('bus-stop-dialog').addEventListener('close',()=>{cancelBusStopExperience($('bus-stop-shared'));if(busStopFocus?.isConnected)busStopFocus.focus();});
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

// Shared stop experience. Line buttons survive async updates, preserving focus.
function cancelBusStopExperience(box){if(box.stopUi){clearTimeout(box.stopUi.timer);box.stopUi.version++;box.stopUi.loading=false;box.stopUi.loadedLine='';}}
function renderBusStopExperience(box,stop,options={}){
  const numbers=stop.numbers||stop.services.map(([number])=>number),key=stop.code+'|'+numbers.join(',')+'|'+Boolean(options.compact)+'|'+Boolean(options.mapHome);
  let ui=box.stopUi;
  if(!ui||ui.key!==key){
    cancelBusStopExperience(box);box.replaceChildren();box.classList.toggle('stop-experience',true);
    ui={key,version:0,buttons:new Map(),selected:'',loadedLine:'',loading:false,dayFilter:'',direction:''};box.stopUi=ui;
    ui.filter=el('button','Giorno e direzione','stop-time-filter');ui.filter.disabled=true;ui.filter.onclick=()=>openBusStopFilters(box,stop);
    if(options.compact){const head=el('div','','stop-experience-head'),title=el('div'),close=el('button','×');title.append(el('strong',busDisplayName(stop.name)),el('small','Fermata '+stop.code+(options.mapHome?' · orari previsti':'')));close.setAttribute('aria-label','Chiudi fermata selezionata');close.onclick=()=>ui.options.onClose?.();head.append(title,ui.filter,close);box.append(head);}
    const label=el('p','Scegli la linea','stop-experience-label'),lines=el('div','','stop-experience-lines');lines.setAttribute('role','group');lines.setAttribute('aria-label','Linee della fermata '+stop.code);
    const dateIndex=eventBusStops?.days.indexOf(dayInRome(new Date()))??-1;
    for(const number of numbers){const service=stop.services?.find(([n])=>n===number),otherDay=service&&dateIndex>=0&&service[1][dateIndex]!=='1',button=el('button',(options.mapHome?'':'Linea ')+number+(otherDay?' · altri giorni':''));button.setAttribute('aria-label','Mostra partenze linea '+number+' dalla fermata '+stop.code);button.onclick=()=>ui.options.onChoose(number);ui.buttons.set(number,button);lines.append(button);}
    ui.caption=el('p','','stop-experience-caption');ui.caption.setAttribute('role','status');
    ui.results=el('div','','stop-experience-results');ui.results.setAttribute('aria-label','Prossime partenze della fermata');ui.results.setAttribute('tabindex','0');
    ui.day=el('button','Orari del giorno','stop-experience-day');ui.day.onclick=()=>{const filters={date:ui.dayFilter||dayInRome(new Date()),destination:ui.direction};return ui.options.onDay?ui.options.onDay(ui.selected,filters):openOfficialBus(ui.selected,{stopCode:stop.code,mode:'day',...filters});};
    ui.note=el('p','','stop-experience-note');box.append(label,lines);if(!options.compact)box.append(ui.filter);box.append(ui.caption,ui.results,ui.day,ui.note);
  }
  ui.options=options;const number=options.line||'';if(ui.selected!==number)ui.direction='';ui.selected=number;
  for(const [value,button]of ui.buttons){button.setAttribute('aria-pressed',String(value===number));const bits=stop.services?.find(([n])=>n===value)?.[1],dateIndex=eventBusStops?.days.indexOf(dayInRome(new Date()))??-1;button.textContent=(options.mapHome?'':'Linea ')+value+(bits&&dateIndex>=0&&bits[dateIndex]!=='1'?' · altri giorni':'');}
  ui.day.hidden=!number;ui.filter.hidden=!number;ui.filter.disabled=ui.loadedLine!==number;ui.note.textContent=options.routeState==='missing'?'Tracciato non disponibile. Fermate e orari restano consultabili.':options.routeState==='error'?'Percorso non caricato. Tocca di nuovo la linea per riprovare.':options.routeState==='ready'?'Percorso indicativo · fonte OSM.':'Orari programmati, senza ritardi in tempo reale.';
  if(!number){clearTimeout(ui.timer);ui.version++;ui.loadedLine='';ui.loading=false;ui.caption.textContent='Quale autobus vuoi prendere?';ui.results.replaceChildren(el('p','Scegli una linea per vedere direzioni e prossime partenze.','stop-experience-empty'));return Promise.resolve();}
  if(ui.data&&ui.loadedLine===number)ui.note.textContent+=' Archivio ATV: '+formatDay(ui.data.validFrom,{day:'numeric',month:'short'})+' – '+formatDay(ui.data.validTo,{day:'numeric',month:'short',year:'numeric'})+'.';
  if(ui.loadedLine===number||ui.loading&&ui.loadingLine===number)return ui.pending||Promise.resolve();
  const previousScroll=ui.lastRenderedLine===number?(ui.results.scrollTop||0):0;
  clearTimeout(ui.timer);const version=++ui.version;ui.loading=true;ui.loadingLine=number;ui.caption.textContent='Caricamento linea '+number+'…';ui.results.replaceChildren();
  ui.pending=(async()=>{
    try{
      const data=await getOfficialBusLine(number);if(box.stopUi!==ui||ui.version!==version||options.isOpen&&!options.isOpen())return;
      ui.loadedLine=number;ui.data=data;ui.filter.disabled=false;const now=new Date(),day=ui.dayFilter||dayInRome(now),rows=day===dayInRome(now)?nextBusStopDepartures(data,stop.code,now,options.mapHome?30:3,ui.direction):busStopCalendarDay(data,stop.code,day,ui.direction);ui.results.replaceChildren();
      if(rows===null){ui.caption.textContent='Orari fuori validità per oggi.';ui.results.append(el('p','Scegli una data coperta negli orari del giorno o verifica ATV.','stop-experience-empty'));return;}
      if(!data.stops[stop.code]){ui.caption.textContent='Fermata non presente negli orari di questa linea.';ui.results.append(el('p',ui.caption.textContent,'stop-experience-empty'));return;}
      ui.caption.textContent=(day===dayInRome(now)?'Oggi · '+formatDay(day,{day:'numeric',month:'short'}):formatDay(day,{weekday:'short',day:'numeric',month:'short',year:'numeric'}))+(ui.direction?' · verso '+busDisplayName(ui.direction):' · tutte le direzioni')+(rows[0]?.offset>0?' · prime partenze nei giorni successivi':' · orari programmati');ui.note.textContent+=' Archivio ATV: '+formatDay(data.validFrom,{day:'numeric',month:'short'})+' – '+formatDay(data.validTo,{day:'numeric',month:'short',year:'numeric'})+'.';
      if(!rows.length)ui.results.append(el('p',day===dayInRome(now)?'Nessun’altra partenza nei prossimi 7 giorni coperti dall’archivio con questi filtri.':'Nessuna partenza in questa data e direzione. Cambia giorno o direzione.','stop-experience-empty'));
      for(const row of rows){const card=el('button','','stop-experience-departure'),clock=el('div'),destination=el('div','','stop-experience-destination');clock.append(el('strong',row.time.slice(0,5)));if(row.offset)clock.append(el('small',(row.offset===1?'Domani · ':'')+formatDay(shiftDay(dayInRome(now),row.offset),{day:'numeric',month:'short'})));destination.append(el('span','Verso'),el('strong',busDisplayName(row.destination)));card.append(clock,destination);{card.setAttribute('aria-label','Vedi fermate della corsa delle '+row.time.slice(0,5)+' verso '+busDisplayName(row.destination));card.append(el('span','Fermate e orari ›','bus-trip-link'));card.onclick=()=>openBusTrip(data,row,card);}ui.results.append(card);}
      ui.lastRenderedLine=number;ui.results.scrollTop=previousScroll;
      ui.timer=setTimeout(()=>{if(box.stopUi!==ui||ui.version!==version||ui.options.isOpen&&!ui.options.isOpen())return;ui.loadedLine='';renderBusStopExperience(box,stop,ui.options);},60000);
    }catch{
      if(box.stopUi!==ui||ui.version!==version||options.isOpen&&!options.isOpen())return;ui.loadedLine='';ui.caption.textContent='Orari temporaneamente non disponibili.';const retry=el('button','Riprova','stop-experience-retry');retry.onclick=()=>renderBusStopExperience(box,stop,ui.options);ui.results.replaceChildren(retry);
    }finally{if(ui.version===version)ui.loading=false;}
  })();return ui.pending;
}

let busStopFilterContext=null;
function openBusStopFilters(box,stop){
 const ui=box.stopUi;if(!ui?.data||!ui.selected)return;busStopFilterContext={box,stop,ui};
 $('stop-filter-date').min=ui.data.validFrom;$('stop-filter-date').max=ui.data.validTo;$('stop-filter-date').value=ui.dayFilter||dayInRome(new Date());
 const destinations=[...new Set(ui.data.trips.filter(trip=>trip.calls.some(call=>call[0]===stop.code&&call[3])).map(trip=>trip.destination))].sort();
 officialOptions('stop-filter-direction',destinations.map(value=>({value,label:busDisplayName(value)})),ui.direction,'Tutte le direzioni');
 $('stop-filter-status').textContent='Linea '+ui.selected+' · '+busDisplayName(stop.name)+' · Archivio dal '+formatDay(ui.data.validFrom,{day:'numeric',month:'long'})+' al '+formatDay(ui.data.validTo,{day:'numeric',month:'long',year:'numeric'});
 $('stop-time-filters').showModal();$('stop-filter-close').focus();
}
$('stop-filter-close').onclick=()=>$('stop-time-filters').close();
$('stop-filter-apply').onclick=()=>{
 const context=busStopFilterContext;if(!context)return;const {box,stop,ui}=context,day=$('stop-filter-date').value;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day||day<ui.data.validFrom||day>ui.data.validTo){$('stop-filter-status').textContent='Scegli una data compresa nella validità dell’archivio.';return;}
 $('stop-time-filters').close();if(box.stopUi!==ui||ui.options.isOpen&&!ui.options.isOpen())return;
 ui.dayFilter=day;ui.direction=$('stop-filter-direction').value;ui.loadedLine='';ui.results.scrollTop=0;renderBusStopExperience(box,stop,ui.options);
};
