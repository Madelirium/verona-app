(() => {
  const $=id=>document.getElementById(id),dialog=$('ranked-dialog');
  const base=(payload.briscolaApi||'').replace(/\/$/,'');
  let game='briscola',phase='idle',timer,busy=false,enabled=false,generation=0;
  const message=text=>{$('ranked-status').textContent=text;};
  async function api(action,body={}){
    const token=await globalThis.veronaAccount?.accessToken();
    const response=await fetch(base+'/api/ranked/'+action,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({...body,game}),signal:AbortSignal.timeout(12000)});
    let data;try{data=await response.json();}catch{throw new Error('Server ranked non raggiungibile.');}
    if(!response.ok)throw Object.assign(new Error(data.error||'Servizio ranked non disponibile.'),{status:response.status});return data;
  }
  function controls(){
    const active=phase!=='idle';
    $('ranked-start').hidden=active;$('ranked-start').disabled=busy||!enabled;
    $('ranked-name').disabled=active||busy;
    $('ranked-cancel').hidden=!active;$('ranked-cancel').disabled=busy;
    $('ranked-ready').hidden=phase!=='ready';$('ranked-ready').disabled=busy;
    $('ranked-close').disabled=busy||active;
    $('ranked-refresh').disabled=busy||active||!enabled;
  }
  function schedule(){clearTimeout(timer);if(dialog.open&&phase!=='idle')timer=setTimeout(()=>action('status'),2500);}
  function accept(data){
    if(data.game)game=data.game;
    phase=data.phase;
    if(phase==='playing'){
      if(globalThis.veronaGames.enterRanked(data)){
        phase='idle';clearTimeout(timer);dialog.close();return;
      }
      phase='ready';message('Partita pronta. Attendi un momento…');
    }else if(phase==='searching')message('Cerco un avversario · Elo '+data.elo+'. La ricerca si amplia gradualmente. Puoi annullare.');
    else if(phase==='ready'){
      $('ranked-ready').dataset.matchId=data.matchId;
      $('ranked-ready').hidden=data.ready;
      $('ranked-ready').textContent=data.ready?'Confermato':'Accetta la sfida';
      message(data.ready?'Hai confermato. Aspetto l’altro giocatore…':'Sfida con '+data.opponent+'! Conferma entro '+Math.max(0,Math.ceil((data.readyUntil-Date.now())/1000))+' secondi.');
    }else message('Nessuna ricerca attiva. Puoi cercare un nuovo avversario.');
    controls();if(data.phase==='ready'&&data.ready)$('ranked-ready').hidden=true;schedule();
  }
  async function action(kind){
    if(busy)return;busy=true;controls();
    try{accept(await api(kind,{name:$('ranked-name').value,matchId:$('ranked-ready').dataset.matchId}));if(kind==='queue')try{localStorage.setItem('verona-ranked-name-v1',$('ranked-name').value);}catch{}}
    catch(error){
      if(kind==='queue'&&phase==='idle'&&!error.status)phase='searching';
      if([401,403].includes(error.status)){phase='idle';enabled=false;}
      if(kind==='cancel'){phase='idle';message(error.message+' Annullamento non confermato: riapri Classificate per recuperare lo stato.');}
      else message(error.name==='TimeoutError'||error instanceof TypeError?'Connessione interrotta. Riprovo a recuperare lo stato…':error.message);
      schedule();
    }
    finally{busy=false;controls();if($('ranked-ready').textContent==='Confermato')$('ranked-ready').hidden=true;}
  }
  async function leaderboard(){
    const result=await api('leaderboard');
    $('ranked-profile').textContent='Il tuo Elo: '+result.profile.elo+' · '+result.profile.games+' partite'+(result.profile.games<5?' · In piazzamento':'');
    const list=$('ranked-list');list.replaceChildren();
    if(!result.rows.length){list.append(el('p','La classifica si popolerà con le prime partite concluse.'));return;}
    for(const [index,row] of result.rows.entries()){
      const item=el('li','','ranked-row');item.append(el('span',String(index+1)),el('strong',row.name),el('span',row.elo+' Elo'),el('small',row.games+' partite'+(row.games<5?' · Piazzamento':'')));list.append(item);
    }
  }
  $('game-ranked-open').onclick=async()=>{
    if(busy)return;
    game=selectedGame;phase='idle';enabled=false;const revision=++generation;
    $('ranked-title').textContent='Classificate · '+(game==='forza4'?'Forza 4':'Briscola');
    let savedName='';try{savedName=localStorage.getItem('verona-ranked-name-v1')||'';}catch{}
    $('ranked-name').value=savedName||$('ranked-name').value||$('game-name').value||'';$('ranked-list').replaceChildren();$('ranked-profile').textContent='';
    message('Verifico disponibilità e account…');dialog.showModal();busy=true;controls();
    try{
      const availability=await api('availability');if(revision!==generation||!dialog.open)return;
      if(!availability.enabled){message('Classificate in preparazione. Il login Google e il server ranked devono essere attivati.');return;}
      if(!await globalThis.veronaAccount?.accessToken()){message('Accedi con il tuo account per cercare avversari e partecipare alla classifica.');return;}
      enabled=true;await leaderboard();if(revision===generation&&dialog.open)accept(await api('status'));
    }catch(error){message(error.message);}
    finally{busy=false;controls();}
  };
  $('ranked-start').onclick=()=>{if($('ranked-name').reportValidity())action('queue');};
  $('ranked-ready').onclick=()=>action('ready');$('ranked-cancel').onclick=()=>action('cancel');
  $('ranked-close').onclick=()=>{if(!busy&&phase==='idle')dialog.close();};
  $('ranked-refresh').onclick=async()=>{if(busy)return;busy=true;controls();try{await leaderboard();}catch(error){message(error.message);}finally{busy=false;controls();}};
  $('ranked-account').onclick=()=>{if(!busy&&phase==='idle'){dialog.close();$('open-account').click();}};
  dialog.addEventListener('cancel',event=>{if(busy||phase!=='idle'){event.preventDefault();message('Usa Annulla ricerca per lasciare la coda.');}});
  dialog.addEventListener('close',()=>{generation++;clearTimeout(timer);$(globalThis.veronaGameSession?'game-room-info':'game-ranked-open').focus();});
})();
