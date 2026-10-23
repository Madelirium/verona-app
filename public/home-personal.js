// Personal suggestions use only existing local choices and verified source fields.
var homePersonalReady=true;
function homePersonalItems(){
  const rows=[],now=new Date(),chosen=currentDistrict(),add=(kind,rank,label,title,note,open)=>rows.push({kind,rank,label,title,note,open});
  const saved=savedEvents().filter(e=>eventDay(e.endsAt)>=today&&(e.endsAt.length===10||Date.parse(e.endsAt)<=Date.parse(e.startsAt)||Date.parse(e.endsAt)>now.getTime())).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
  if(saved[0]){const item=saved[0];add('event',90,'Il tuo prossimo evento',item.title,eventWhen(item),()=>openDetails(item));}
  const deadlines=new Map(savedNewsDeadlines().map(item=>[item.id,item]));
  if(chosen)for(const item of newsItems)if(districtMatch(item)&&item.timing?.deadline&&!deadlines.has(item.id))deadlines.set(item.id,item);
  const due=[...deadlines.values()].filter(item=>!item.needsReview&&newsValidity(item,now).state==='open').sort((a,b)=>a.timing.deadline.day.localeCompare(b.timing.deadline.day)||(a.timing.deadline.time||'23:59').localeCompare(b.timing.deadline.time||'23:59'))[0];
  if(due){const soon=due.timing.deadline.day<=shiftDay(today,7);add('news',soon?100:60,newsDeadlineSaves[due.id]?'La tua scadenza':'Scadenza nella tua zona',due.title,'Entro '+deadlineLabel(due.timing.deadline),()=>openNews(due));}
  const line=busCatalogLines().find(busCatalogFavorite);
  if(line){const health=officialArchiveStatus();add('bus',70,'Una tua linea preferita','Linea '+line.number+' · '+busDisplayName(line.name),health.state==='current'?'Fermate e partenze · orari programmati':'Verifica la validità degli orari',()=>officialBus.lines.some(item=>item.number===line.number)?openOfficialBus(line.number):openTimetable(line.sheets[0]));}
  if(!due){const local=chosen&&newsItems.filter(item=>districtMatch(item)&&!['expired','withdrawn'].includes(newsValidity(item,now).state)&&!newsPastSeason(item,today)&&(newsValidity(item,now).state==='open'||item.publishedOn>=shiftDay(today,-14))).sort((a,b)=>b.publishedOn.localeCompare(a.publishedOn))[0];
    const item=local||homeNewsSelection();if(item)add('news',local?65:30,local?'Dalla tua zona':'Dal Comune',item.title,'Pubblicata il '+formatDay(item.publishedOn,{day:'numeric',month:'long'}),()=>openNews(item));}
  if(!saved.length){const item=events.filter(e=>e.localVerified&&eventDay(e.endsAt)>=today&&(e.endsAt.length===10||Date.parse(e.endsAt)<=Date.parse(e.startsAt)||Date.parse(e.endsAt)>now.getTime())).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt))[0];
    if(item)add('event',25,'Un’idea per uscire',item.title,eventWhen(item),()=>openDetails(item));}
  return rows.sort((a,b)=>b.rank-a.rank).slice(0,3);
}
function renderHomePersonal(){
  $('home-personal-legacy').hidden=true;
  const feed=$('home-personal-feed');feed.replaceChildren();
  for(const row of homePersonalItems()){const button=el('button','','home-personal-row home-smart-row');button.setAttribute('data-focus-key','home-smart-'+row.kind);button.setAttribute('aria-label',row.label+': '+row.title+'. '+row.note);button.append(el('span',row.label,'home-row-label'),el('strong',row.title),el('span',row.note,'home-row-note'));button.onclick=row.open;feed.append(button);}
}
const previousHomeWasteEntry=renderWasteEntry;
renderWasteEntry=()=>{previousHomeWasteEntry();if(view==='home')renderHomePersonal();};
if(view==='home')renderHome();
