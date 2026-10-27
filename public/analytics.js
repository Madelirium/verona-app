// Aggregate counters default on; saved refusals and browser privacy signals win.
// Umami remains opt-in. Fixed event names, no user/content IDs or raw URLs.
(()=>{
  const config=payload.analytics,choice=document.getElementById('analytics-choice'),status=document.getElementById('analytics-status');
  const labels={home:'Home',discover:'Scopri',calendar:'Calendario',saved:'Salvati',news:'Notizie',bus:'Autobus',explore:'Esplora',eventmap:'Mappa eventi',district:'Zona',games:'Giochi'};
  const allowed=new Set(['event_open','event_saved','event_participation','news_open','bus_timetable_open','bus_journey_open','travel_open','pharmacies_open','waste_open','parking_open','weather_open']);
  const dialogs={'detail-dialog':'event_open','news-detail-dialog':'news_open','official-bus-dialog':'bus_timetable_open','bus-journey-dialog':'bus_journey_open','event-travel-dialog':'travel_open','pharmacy-dialog':'pharmacies_open','waste-dialog':'waste_open','parking-dialog':'parking_open','weather-dialog':'weather_open'};
  if(config?.provider==='supabase'){
    let consent=false,current=Object.hasOwn(labels,view)?view:'home',last=null;
    try{const saved=localStorage.getItem('verona-analytics-consent-v1');consent=saved==null||saved==='yes';}catch{}
    const excluded=()=>navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true;
    const eligible=()=>location.protocol==='https:'&&['veronaintasca.it','www.veronaintasca.it'].includes(location.hostname)&&!excluded();
    const enabled=()=>eligible()&&consent&&navigator.onLine!==false;
    function render(){
      choice.checked=eligible()&&consent;choice.disabled=!eligible();
      status.textContent=excluded()?'Conteggi disattivati: rispettiamo la preferenza di privacy del browser.':!eligible()?'Conteggi disattivati in questa anteprima.':consent?'Conteggi aggregati attivi. Puoi disattivarli qui.':'Conteggi aggregati disattivati. Tutti i servizi restano disponibili.';
    }
    const intro=document.getElementById('analytics-intro'),details=document.getElementById('analytics-details'),link=document.getElementById('analytics-provider-link');
    if(intro)intro.textContent='I conteggi aggregati sono attivi di default e puoi disattivarli qui. Contiamo le aperture dei servizi e le azioni principali, senza creare profili dei visitatori.';
    const label=document.getElementById('analytics-choice-label');if(label)label.textContent='Attiva conteggi aggregati di utilizzo';
    if(details)details.textContent='Non inviamo nomi, account, ricerche, posizione, codici delle partite o identificatori del visitatore. Nessun conteggio delle persone uniche. I totali sono conservati per 90 giorni, con pulizia al successivo utilizzo. Supabase riceve i dati tecnici della connessione e può conservarli nei propri log operativi. La scelta resta su questo dispositivo.';
    if(link){link.href='https://supabase.com/privacy';link.textContent='Privacy del fornitore Supabase ↗';}
    function send(action){
      if(!enabled())return;
      try{Promise.resolve(fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.key},body:JSON.stringify({section:current,action}),credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:AbortSignal.timeout(5000)})).catch(()=>{});}catch{}
    }
    function page(section){if(!Object.hasOwn(labels,section))return;current=section;if(!enabled()||last===section)return;last=section;send('view');}
    window.veronaAnalytics={page,track:name=>{if(allowed.has(name))send(name);}};
    choice.onchange=()=>{
      consent=choice.checked;
      try{localStorage.setItem('verona-analytics-consent-v1',consent?'yes':'no');}catch{consent=false;render();status.textContent='Il browser non salva la scelta: conteggi lasciati disattivati.';return;}
      last=null;render();if(consent)page(current);
    };
    if(typeof MutationObserver==='function')for(const[id,name]of Object.entries(dialogs)){
      const dialog=document.getElementById(id);if(!dialog)continue;let open=dialog.open;
      new MutationObserver(()=>{const now=dialog.open;if(now&&!open)window.veronaAnalytics.track(name);open=now;}).observe(dialog,{attributes:true,attributeFilter:['open']});
    }
    addEventListener('online',()=>page(current));render();page(current);return;
  }
  let consent=false,script=null,loaded=false,failed=false,current=Object.hasOwn(labels,view)?view:'home',lastPage=null;
  try{consent=localStorage.getItem('verona-analytics-consent-v1')==='yes';}catch{}
  const excluded=()=>navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true;
  const eligible=()=>Boolean(config&&location.protocol==='https:'&&['veronaintasca.it','www.veronaintasca.it'].includes(location.hostname)&&!excluded());
  const enabled=()=>eligible()&&consent&&navigator.onLine!==false;
  function render(){
    choice.checked=consent;choice.disabled=!eligible()&&!consent;
    status.textContent=!config?'Statistiche non attive: il collegamento a Umami non è ancora configurato.':excluded()?'Statistiche disattivate: rispettiamo la preferenza di privacy del browser.':!eligible()?'Statistiche disattivate in questa anteprima.':failed?'Statistiche non disponibili. Tutti i servizi continuano a funzionare.':consent?'Hai consentito le statistiche. Puoi disattivarle in qualsiasi momento.':'Statistiche facoltative disattivate. Puoi usare tutti i servizi senza attivarle.';
  }
  function clean(name){
    const result={website:config.website,hostname:location.hostname,url:'/'+current,title:labels[current]};
    const language=(navigator.language||'').split('-')[0];if(/^[a-z]{2,3}$/i.test(language))result.language=language;
    if(name)result.name=name;
    return result;
  }
  // Also sanitise vendor automatic traffic: only our explicitly constructed
  // virtual paths and allowlisted names can pass. No URL query/hash/referrer.
  window.veronaAnalyticsBeforeSend=(type,data)=>{
    if(!enabled()||type!=='event'||!data||data.website!==config.website)return false;
    const section=String(data.url||'').replace(/^\//,'');
    if(!Object.hasOwn(labels,section)||data.name&&!allowed.has(data.name))return false;
    const result={website:config.website,hostname:location.hostname,url:'/'+section,title:labels[section]};
    if(data.name)result.name=data.name;
    if(/^[a-z]{2,3}$/i.test(data.language||''))result.language=data.language;
    return result;
  };
  function send(name){
    if(!enabled()||!loaded||typeof window.umami?.track!=='function')return;
    try{Promise.resolve(window.umami.track(clean(name))).catch(()=>{});}catch{}
  }
  function page(section){
    if(!Object.hasOwn(labels,section))return;current=section;
    if(!enabled()||!loaded||lastPage===section)return;lastPage=section;send();
  }
  function load(){
    if(!enabled()||script)return;
    script=document.createElement('script');script.defer=true;script.src=config.script;script.referrerPolicy='no-referrer';
    for(const [name,value]of Object.entries({'data-website-id':config.website,'data-auto-track':'false','data-exclude-search':'true','data-exclude-hash':'true','data-do-not-track':'true','data-before-send':'veronaAnalyticsBeforeSend','data-domains':config.domains.join(',')}))script.setAttribute(name,value);
    script.onload=()=>{loaded=true;page(current);};script.onerror=()=>{failed=true;render();};document.head.append(script);
  }
  window.veronaAnalytics={page,track:name=>{if(allowed.has(name))send(name);}};
  choice.onchange=()=>{
    consent=choice.checked;
    try{localStorage.setItem('verona-analytics-consent-v1',consent?'yes':'no');}catch{consent=false;choice.checked=false;status.textContent='Il browser non salva la scelta: statistiche lasciate disattivate.';return;}
    lastPage=null;render();if(consent){if(loaded)page(current);else load();}
  };
  addEventListener('online',load);
  if(typeof MutationObserver==='function')for(const [id,name]of Object.entries(dialogs)){
    const dialog=document.getElementById(id);if(!dialog)continue;let open=dialog.open;
    new MutationObserver(()=>{const now=dialog.open;if(now&&!open)window.veronaAnalytics.track(name);open=now;}).observe(dialog,{attributes:true,attributeFilter:['open']});
  }
  render();load();
})();
