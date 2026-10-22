function newsStateLabel(state){return {open:'Scadenze aperte',expired:'Scadenze / pubblicazioni concluse',unknown:'Validità da verificare',informative:'Notizie informative',withdrawn:'Revoche e annullamenti'}[state]||state;}
function deadlineLabel(deadline){return formatDay(deadline.day,{day:'numeric',month:'long',year:'numeric'})+(deadline.time?' · ore '+deadline.time:' · orario non indicato');}
function homeNewsSelection(){
  const now=new Date(),candidates=newsItems.map(item=>{const state=newsValidity(item,now),local=Boolean(currentDistrict()&&districtMatch(item)),soon=state.deadline&&state.deadline.day<=shiftDay(today,7);return {item,state,rank:(local?30:0)+(state.state==='open'?(soon?80:40):0)+(['Mobilità','Servizi'].includes(item.category)?10:0)};}).filter(({item,state})=>!['expired','withdrawn'].includes(state.state)&&!newsPastSeason(item,today)&&(state.state==='open'||item.publishedOn>=shiftDay(today,-14)));
  return candidates.sort((a,b)=>b.rank-a.rank||(a.state.deadline?.day||'9999').localeCompare(b.state.deadline?.day||'9999')||b.item.publishedOn.localeCompare(a.item.publishedOn))[0]?.item||null;
}
function validSavedDeadline(item){
  const deadline=item?.timing?.deadline,day=deadline?.day;if(typeof item?.title!=='string'||!/^comune-news-\d+$/.test(item?.id||'')||!/^\d{4}-\d{2}-\d{2}$/.test(day||'')||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day||!/^\d{4}-\d{2}-\d{2}$/.test(item.publishedOn||'')||!Number.isFinite(Date.parse(item.publishedOn))||!Number.isFinite(Date.parse(item.checkedAt)))return false;
  try{if(new URL(item.sourceUrl).origin!=='https://www.comune.verona.it')return false;}catch{return false;}
  return !deadline.time||Boolean(newsDeadlineInstant(deadline));
}
function savedNewsDeadlines(){
  return Object.values(newsDeadlineSaves).filter(validSavedDeadline).map(snapshot=>{const current=newsItems.find(item=>item.id===snapshot.id);return current?.timing?.deadline?current:current?{...snapshot,needsReview:true}:snapshot;}).sort((a,b)=>a.timing.deadline.day.localeCompare(b.timing.deadline.day)||a.title.localeCompare(b.title,'it'));
}
function deadlineDayRows(day){return savedNewsDeadlines().filter(item=>item.timing.deadline.day===day&&(!onlySaved||savedMode==='past'||!['expired','withdrawn'].includes(newsValidity(item).state)));}
function toggleNewsDeadline(item){
  if(!newsDeadlineSaves[item.id]&&newsValidity(item).state!=='open'){$('news-feedback').textContent='La scadenza non è più aperta. Controlla la fonte ufficiale.';refreshNewsValidityPanel();return;}
  if(newsDeadlineSaves[item.id])delete newsDeadlineSaves[item.id];else if(validSavedDeadline(item)&&newsValidity(item).state==='open'){
    const {id,title,summary,publishedOn,checkedAt,sourceUrl,source,kind,category,districtMatches,timing}=item;newsDeadlineSaves[id]={id,title,summary,publishedOn,checkedAt,sourceUrl,source,kind,category,districtMatches,timing};
  }
  try{localStorage.setItem('verona-news-deadlines-v1',JSON.stringify(newsDeadlineSaves));$('news-feedback').textContent=newsDeadlineSaves[item.id]?'Scadenza aggiunta alla tua agenda.':'Scadenza rimossa dall’agenda.';}
  catch{$('news-feedback').textContent='Scelta valida per questa visita: il browser non consente il salvataggio.';}
  render();
}
function appendNewsValidity(content,item){
  const status=newsValidity(item),box=el('section','','news-validity'),label=el('strong',status.label);box.setAttribute('data-state',status.state);box.append(label);activeNewsValidityPanel={item,box,label,button:null,exportButton:null};
  if(status.deadline)box.append(el('p','Termine indicato: '+deadlineLabel(status.deadline)),el('small','Riconosciuto automaticamente dal testo ufficiale: “'+status.deadline.evidence+'”. Verifica eventuali proroghe e requisiti sulla fonte.'));
  else box.append(el('p',item.timing?.ambiguous?'Il testo contiene più termini: controlla la scadenza pertinente sulla fonte.':status.state==='expired'?'La data si riferisce alla fine della pubblicazione, non necessariamente al termine di una domanda.':status.state==='unknown'?'Non è stata individuata una scadenza completa e univoca. Questo avviso non è certificato come attivo.':'Questa comunicazione non indica una scadenza operativa verificabile.'));
  if(item.needsReview)box.append(el('p','La fonte è cambiata: questa è l’ultima data salvata. Ricontrolla la pubblicazione.'));
  if(item.timing?.detailUnavailable)box.append(el('small','Il dettaglio non è stato aggiornato: lettura limitata al titolo e alla sintesi.'));
  const saved=Boolean(newsDeadlineSaves[item.id]);
  if(saved||status.state==='open'){
    const button=el('button',saved?'✓ In agenda · rimuovi':'Aggiungi scadenza alla mia agenda','dialog-save');activeNewsValidityPanel.button=button;button.setAttribute('aria-pressed',String(saved));button.onclick=()=>{toggleNewsDeadline(item);button.textContent=newsDeadlineSaves[item.id]?'✓ In agenda · rimuovi':'Aggiungi scadenza alla mia agenda';button.setAttribute('aria-pressed',String(Boolean(newsDeadlineSaves[item.id])));refreshNewsValidityPanel();};box.append(button);
  }
  content.append(box);
  if(status.deadline&&status.state==='open'&&agendaReady){const instant=newsDeadlineInstant(status.deadline),index=content.children.length;appendAgendaExport(content,{...item,id:'deadline-'+item.id,recordType:'deadline',title:'Scadenza: '+item.title,startsAt:instant||status.deadline.day,endsAt:instant||status.deadline.day,summary:'Termine indicato dalla fonte: '+deadlineLabel(status.deadline)+'. Verifica eventuali proroghe. '+(item.summary||''),location:''});activeNewsValidityPanel.exportButton=content.children[index];}
}
function refreshNewsValidityPanel(){const panel=activeNewsValidityPanel;if(!panel)return;const state=newsValidity(panel.item);panel.label.textContent=state.label;panel.box.setAttribute('data-state',state.state);if(panel.button)panel.button.hidden=!newsDeadlineSaves[panel.item.id]&&state.state!=='open';if(panel.exportButton)panel.exportButton.disabled=state.state!=='open';}
function appendPersonalDeadlines(list,days,past){
  const query=$('search').value.trim().toLocaleLowerCase('it'),items=savedNewsDeadlines().filter(item=>{const closed=['expired','withdrawn'].includes(newsValidity(item).state);return (past?closed:days.includes(item.timing.deadline.day)&&(!onlySaved||!closed))&&(!query||(item.title+' '+(item.summary||'')).toLocaleLowerCase('it').includes(query));});
  if(!items.length)return 0;list.append(el('h3',past?'Scadenze personali concluse':'Scadenze personali','agenda-group-heading'));
  for(const item of items){const card=el('article','','news-deadline-card'),open=el('button',item.title,'news-title');open.setAttribute('aria-label','Apri scadenza: '+item.title);open.onclick=()=>openNews(item);card.append(el('strong',deadlineLabel(item.timing.deadline)),open,el('p',item.needsReview?'Data salvata da ricontrollare':newsValidity(item).label));const remove=el('button','Rimuovi dall’agenda','news-bookmark');remove.setAttribute('aria-label','Rimuovi scadenza: '+item.title);remove.onclick=()=>{toggleNewsDeadline(item);$('events').focus();};card.append(remove);list.append(card);}
  return items.length;
}
function refreshNewsClock(){
  if(document.visibilityState==='hidden')return;
  refreshNewsValidityPanel();
  if(view==='home')renderHome();
  if(view==='news'&&!$('news-filters-dialog').open){const scroll=$('news-list').scrollTop||0;renderNews();$('news-list').scrollTop=scroll;}
}
if(typeof document.addEventListener==='function'){document.addEventListener('visibilitychange',refreshNewsClock);const tick=()=>setTimeout(()=>{refreshNewsClock();tick();},60000);tick();}
