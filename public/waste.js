function wasteLink(label,url){const link=el('a',label,'waste-link');link.href=url;link.target='_blank';link.rel='noopener noreferrer';return link;}
function wasteDayLabel(day){const tomorrow=new Date(Date.parse(today+'T12:00:00Z')+86400000).toISOString().slice(0,10);return (day===today?'Oggi · ':day===tomorrow?'Domani · ':'')+formatDay(day,{weekday:'long',day:'numeric',month:'long'});}
function renderWasteEntry(){
  const zone=wasteSelection&&wasteData.zones.find(zone=>zone.id===wasteSelection.zoneId),button=$('home-waste'),next=zone&&wasteUpcoming(wasteData,zone.id,today,1)[0];button.hidden=true;
  if(zone)button.textContent=next?wasteDayLabel(next.day)+' · '+next.material:'Raccolta: calendario da aggiornare';
  $('utilities-waste-preview').textContent=zone?(button.textContent+(next&&zone.dates?' · '+zone.exposureTime:'')):'Scegli la zona · giorni e isole ecologiche';
  const home=$('home-daily-waste');home.replaceChildren();
  home.append(el('span','Raccolta porta a porta','home-row-label'),el('strong',zone?button.textContent:'Scegli la tua zona →'));
  if(next&&zone.dates)home.append(el('span',zone.exposureTime,'home-row-note'));
  home.onclick=()=>openWaste();
  const compact=$('home-collection'),upcoming=zone?wasteUpcoming(wasteData,zone.id,today,20):[],first=upcoming[0],covered=today>=wasteData.validFrom&&today<=wasteData.validTo;
  const tomorrow=new Date(Date.parse(today+'T12:00:00Z')+86400000).toISOString().slice(0,10);
  const when=first?(first.day===today?'oggi':first.day===tomorrow?'domani':formatDay(first.day,{weekday:'short',day:'numeric',month:'short'})):'';
  $('home-collection-label').textContent=first?(zone.dates?'Esponi ':'Raccolta ')+when:'Raccolta';
  $('home-collection-value').textContent=!zone?'Inserisci indirizzo':!covered?'Da aggiornare':first?[...new Set(upcoming.filter(item=>item.day===first.day).map(item=>item.material))].join(' · '):'Nessun ritiro previsto';
  compact.setAttribute('aria-label','Raccolta porta a porta: '+$('home-collection-value').textContent+(first?' · '+$('home-collection-label').textContent+(zone.dates?' · '+zone.exposureTime:''):'')+' · Apri calendario');compact.onclick=()=>openWaste();
  $('district-waste').textContent=zone?'♻ Rifiuti · '+zone.name:'♻ Rifiuti e raccolta';
}
function openWaste(tab='collection'){
  wasteReturnFocus=document.activeElement;wasteTab=tab;wasteEditing=!wasteSelection;wasteDraft=wasteSelection?'':'help';wasteAddress=null;$('waste-feedback').textContent='';
  renderWasteDialog();$('waste-dialog').showModal();$('waste-close').focus();
}
function renderWasteDialog(){
  const collection=wasteTab==='collection';$('waste-collection-panel').hidden=!collection;$('waste-centers-panel').hidden=collection;
  $('waste-collection-tab').setAttribute('aria-pressed',String(collection));$('waste-centers-tab').setAttribute('aria-pressed',String(!collection));
  if(collection)renderWasteCollection();else renderWasteCenters();
}
function wasteStep(draft){wasteDraft=draft;if(draft==='')wasteAddress=null;$('waste-feedback').textContent='';renderWasteCollection();const body=$('waste-collection-panel');body.scrollTop=0;body.children[0]?.focus();}
function wasteHeading(text){const heading=el('h3',text);heading.tabIndex=-1;return heading;}
function wasteAction(text,action,primary=false){const button=el('button',text,primary?'dialog-save':'waste-secondary');button.type='button';button.onclick=action;return button;}
function renderWasteCollection(){
  const body=$('waste-collection-panel');body.replaceChildren();
  const covered=today>=wasteData.validFrom&&today<=wasteData.validTo;
  if(wasteEditing||!wasteSelection){
    const draftZone=wasteData.zones.find(zone=>zone.id===wasteDraft);
    if(!covered){
      body.append(wasteHeading('Il calendario va aggiornato'),el('p','Questi giorni di raccolta non coprono la data di oggi. Consulta il calendario AMIA.','waste-note'),wasteLink('Apri i calendari AMIA ↗',wasteData.links.calendars));
    }else if(wasteDraft==='help'){
      renderWasteAddress(body);
    }else if(draftZone){
      body.append(wasteHeading('Il tuo calendario'),el('p',draftZone.name,'waste-coverage'));
      const recap=el('div','','waste-recap');
      if(draftZone.dates){recap.append(el('p',draftZone.area),el('p','Carta, plastica/metalli, umido e secco'),el('p',draftZone.exposureDayOffset===-1?'Esposizione la sera precedente al ritiro, '+draftZone.exposureTime+'.':'Esposizione il giorno del calendario, '+draftZone.exposureTime+'.'));}
      else for(const rule of draftZone.rules){const weekday=formatDay('2026-02-'+String(1+rule.weekday).padStart(2,'0'),{weekday:'long'});recap.append(el('p',rule.material+' · '+weekday));}
      const found=wasteAddress?.result?.status==='matched'&&wasteAddress.result.zoneId===draftZone.id;
      if(found)body.append(el('p',wasteAddress.street+', civico '+wasteAddress.civic,'waste-address-found'));
      body.append(recap,el('p',found?'Indirizzo trovato nell’elenco ufficiale. Conferma per salvare la zona su questo dispositivo.':'Conferma solo se la tua via e il tuo civico appartengono a questa zona.','waste-note'));
      if(!found)body.append(wasteLink(draftZone.dates?'Controlla il calendario ufficiale AMIA (PDF) ↗':'Non sei sicuro? Controlla l’elenco delle vie (PDF) ↗',draftZone.sourceUrl||wasteData.links.streets));
      body.append(wasteAction('Conferma zona',()=>{
        if(today<wasteData.validFrom||today>wasteData.validTo){wasteStep('');return;}
        wasteSelection={zoneId:draftZone.id,version:wasteData.version,confirmedAt:new Date().toISOString()};saveWasteSelection();wasteEditing=false;renderWasteCollection();renderWasteEntry();body.scrollTop=0;body.children[0]?.focus();
      },true),wasteAction('Torna indietro',()=>wasteStep(found?'help':'')));
    }else{
      body.append(wasteHeading('Raccolta porta a porta'),wasteAction('Trova la zona di raccolta',()=>wasteStep('help'),true),el('p','Oppure scegli il colore, se lo conosci già.','waste-note'));
      const zones=el('details','','waste-more');zones.append(el('summary','Conosco già la zona o il calendario'));
      for(const zone of wasteData.zones){const button=wasteAction(zone.name,()=>wasteStep(zone.id));button.className='waste-zone';button.setAttribute('data-zone',zone.id);const dot=el('span','','waste-zone-dot');dot.setAttribute('aria-hidden','true');button.append(dot);zones.append(button);if(zone.area)zones.append(el('p',zone.area,'waste-note'));}
      body.append(zones,el('p','Ricerca per via: alcune vie della Circoscrizione 7. Sono disponibili anche i cinque calendari annuali AMIA: scegli il tuo solo se conosci la zona.','waste-note'));
    }
    if(wasteSelection)body.append(wasteAction('Annulla modifica',()=>{wasteEditing=false;wasteStep('');}));
  }else{
    const zone=wasteData.zones.find(zone=>zone.id===wasteSelection.zoneId),rows=wasteUpcoming(wasteData,zone.id,today);
    body.append(wasteHeading('Raccolta porta a porta'));
    const zoneRow=el('div','','waste-zone-row');zoneRow.append(el('span',zone.name),wasteAction('Cambia zona',()=>{wasteEditing=true;wasteStep('');}));body.append(zoneRow);
    if(!rows.length)body.append(el('p','Il calendario va aggiornato. Consulta i giorni di raccolta sul sito AMIA.','waste-empty'),wasteLink('Apri i calendari AMIA ↗',wasteData.links.calendars));
    else{
      const next=el('article','','waste-next');next.append(el('span',zone.dates?'Da esporre':'Prossima raccolta','waste-kicker'),el('strong',wasteDayLabel(rows[0].day)),el('span',rows[0].material,'waste-material'));if(zone.dates)next.append(el('span',zone.exposureTime,'waste-exposure'));body.append(next);
      body.append(el('p','Poi, nei prossimi giorni','waste-kicker'));for(const row of rows.slice(1,3))body.append(wasteDayCard(row));
      const more=el('details','','waste-more');more.append(el('summary','Altre raccolte in programma'));for(const row of rows.slice(3))more.append(wasteDayCard(row));body.append(more);
    }
    body.append(el('p',zone.dates?(zone.exposureDayOffset===-1?'Le date qui mostrate sono le sere di esposizione. Il ritiro avviene la mattina successiva.':'Esponi la sera del giorno indicato, tra le 19 e le 21.')+' Calendario domestico 2026: controlla eventuali avvisi AMIA.':'Qui trovi carta e plastica/metalli. Orari di esposizione e variazioni festive: verifica con AMIA.','waste-note'));
    if(zone.dates)body.append(wasteLink('Il tuo calendario AMIA (PDF) ↗',zone.sourceUrl));
  }
  const source=el('details','','waste-source');source.append(el('summary','Informazioni sul servizio'),el('p','Cinque calendari AMIA 2026: date pubblicate nei PDF, comprese le variazioni stagionali e festive già riportate. Non comprende variazioni pubblicate dopo il controllo del '+formatDay(wasteData.calendarsCheckedOn||wasteData.checkedOn,{day:'numeric',month:'long',year:'numeric'})+'. Le tre zone della Circoscrizione 7 coprono solo carta e plastica/metalli, secondo la comunicazione comunale del 30 gennaio. Copertura limitata al 2026, aggiornamento manuale.'));
  source.append(wasteLink('Comunicazione del Comune ↗',wasteData.sourceUrl),wasteLink('Istruzioni e calendari AMIA ↗',wasteData.links.calendars),wasteLink('Avvisi e variazioni AMIA ↗',wasteData.links.changes));
  if(wasteSelection)source.append(wasteAction('Rimuovi la zona salvata',()=>{wasteSelection=null;wasteEditing=true;wasteStep('');saveWasteSelection();renderWasteEntry();}));body.append(source);
}
function wasteDayCard(row){const card=el('article','','waste-day');card.append(el('strong',wasteDayLabel(row.day)),el('span',row.material));if(row.exposureTime)card.append(el('small',row.exposureTime,'waste-exposure'));return card;}
function renderWasteAddress(body){
  if(!wasteAddress)wasteAddress={query:'',street:'',civic:'',result:null};
  const address=wasteAddress;
  body.append(wasteHeading('Trova la zona di raccolta'),el('p','Cerca il calendario per casa tua.','waste-note'),el('p','Ricerca disponibile per alcune vie della Circoscrizione 7.','waste-coverage'));
  const form=el('form','','waste-address-form');form.noValidate=true;
  const streetLabel=el('label','Via o piazza','waste-address-field'),input=el('input');input.type='search';input.id='waste-street';input.value=address.query;input.autocomplete='off';input.placeholder='Per esempio: Tiberghien';streetLabel.htmlFor=input.id;streetLabel.append(input);
  const suggestions=el('div','','waste-street-results');suggestions.setAttribute('role','group');suggestions.setAttribute('aria-label','Vie trovate');
  const searchStatus=el('p','','waste-note');searchStatus.setAttribute('role','status');
  const civicLabel=el('label','Numero civico','waste-address-field'),civic=el('input');civic.id='waste-civic';civic.type='text';civic.inputMode='numeric';civic.autocomplete='off';civic.value=address.civic;civic.placeholder='Per esempio: 12';civicLabel.htmlFor=civic.id;civicLabel.append(civic);civicLabel.hidden=false;
  const submit=el('button','Trova il calendario','dialog-save');submit.type='submit';submit.hidden=false;
  const result=el('p','','waste-address-result');result.setAttribute('role','status');result.tabIndex=-1;result.hidden=true;
  const help=el('div','','waste-address-help');help.hidden=true;help.append(wasteLink('Verifica sull’elenco ufficiale (PDF) ↗',wasteData.links.streets),wasteLink('Cerca le altre zone sul sito AMIA ↗',wasteData.links.calendars));
  const showResult=message=>{searchStatus.textContent='';result.textContent=message;result.hidden=false;help.hidden=false;result.focus();};
  const suggest=()=>{
    suggestions.replaceChildren();civicLabel.hidden=false;submit.hidden=false;
    if(address.street){searchStatus.textContent='Via scelta: '+address.street;return;}
    const names=searchWasteStreets(wasteData,address.query);
    searchStatus.textContent=result.hidden===false?'':!address.query.trim()?'Digita almeno due lettere per vedere le vie coperte.':names.length?(names.length>8?'Ci sono altre vie: scrivi qualche lettera in più.':'Tocca la tua via tra i risultati.'):address.query.trim().length<2?'Scrivi almeno due lettere del nome della via.':'Via non presente nell’elenco verificato. Puoi comunque controllare su AMIA.';
    for(const name of names.slice(0,8)){const choice=wasteAction(name,()=>{address.query=name;address.street=name;address.result=null;renderWasteCollection();$('waste-civic').focus();});choice.className='waste-street-choice';suggestions.append(choice);}
    help.hidden=Boolean(names.length)||!address.query.trim();
  };
  input.oninput=()=>{address.query=input.value;address.street='';address.result=null;result.hidden=true;suggest();};
  civic.oninput=()=>{address.civic=civic.value;address.result=null;result.hidden=true;};
  form.onsubmit=event=>{
    event.preventDefault();
    if(today<wasteData.validFrom||today>wasteData.validTo){wasteStep('help');return;}
    if(!address.query.trim()){showResult('Scrivi il nome della via per continuare.');input.focus();return;}
    if(!civic.value.trim()){showResult('Scrivi il numero civico per continuare.');civic.focus();return;}
    if(!address.street){const names=searchWasteStreets(wasteData,address.query);showResult(names.length?'Scegli la via corretta tra i risultati.':'Non abbiamo ancora il calendario per questo indirizzo. Puoi comunque consultare le informazioni AMIA o la sezione Dove portare.');return;}
    address.civic=civic.value.trim();address.result=resolveWasteAddress(wasteData,address.street,address.civic);
    if(address.result.status==='matched'){wasteStep(address.result.zoneId);return;}
    if(address.result.status==='missing-civic'){showResult('Scrivi il numero civico per continuare.');civic.focus();return;}
    if(address.result.status==='review')showResult(address.result.reason==='civic'?'Il civico contiene lettere o un formato da verificare. Controlla il tratto nell’elenco ufficiale.':'Questa via ha più zone o tratti delimitati da incroci. Non possiamo scegliere un colore con certezza: verifica nell’elenco ufficiale.');
    else showResult('Non abbiamo ancora il calendario per questo indirizzo: il civico non è coperto dall’elenco verificato. Consulta le informazioni AMIA o la sezione Dove portare.');
  };
  form.append(streetLabel,suggestions,searchStatus,civicLabel,submit,result,help);body.append(form,el('p','L’indirizzo resta su questo dispositivo. Salviamo solo la zona confermata.','waste-note'));const alternative=el('details','','waste-more');alternative.append(el('summary','Conosci già il colore della zona?'),wasteAction('Torna alla scelta della zona',()=>wasteStep('')));body.append(alternative);suggest();
}
function saveWasteSelection(){try{localStorage.setItem('verona-waste-v1',JSON.stringify(wasteSelection));$('waste-feedback').textContent=wasteSelection?'Zona salvata.':'Zona rimossa.';}catch{$('waste-feedback').textContent='Scelta valida per questa visita: il browser non consente il salvataggio.';}}
function renderWasteCenters(){
  const body=$('waste-centers-panel');body.replaceChildren();body.append(wasteHeading('Centri di raccolta'),el('p','Indirizzi e orari ordinari. Prima di partire, verifica sul sito AMIA i materiali ammessi, le modalità di accesso e le aperture festive.','waste-note'));
  for(const center of wasteData.centers){const card=el('article','','waste-center');card.append(el('h3',center.name),el('p',center.address));const schedule=el('details','','waste-more');schedule.append(el('summary','Orari ordinari'));for(const hours of center.hours)schedule.append(el('p',hours,'waste-hours'));card.append(schedule);
    const directions=wasteLink('Come arrivare ↗','https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(center.address));directions.className+=' waste-directions';card.append(directions);
    const info=el('details','','waste-source');info.append(el('summary','Accesso e informazioni AMIA'),wasteLink('Verifica sul sito AMIA ↗',center.sourceUrl),el('p','Orari ordinari · fonte AMIA · controllo del '+formatDay(center.checkedOn,{day:'numeric',month:'long',year:'numeric'})+'. Le aperture festive possono cambiare.'));card.append(info);body.append(card);
  }
}
$('district-waste').onclick=()=>openWaste();$('home-waste').onclick=()=>openWaste();$('waste-close').onclick=()=>$('waste-dialog').close();
for(const [id,tab]of [['waste-collection-tab','collection'],['waste-centers-tab','centers']])$(id).onclick=()=>{wasteTab=tab;$('waste-feedback').textContent='';renderWasteDialog();};
$('waste-dialog').addEventListener('close',()=>{wasteDraft=null;wasteAddress=null;if(wasteReturnFocus?.isConnected)wasteReturnFocus.focus();});
