(() => {
  const key=()=> 'verona-'+selectedGame+'-v1';
  const sessions=new Map();
  let session=null,state=null,busy=false,timer=null,signature='',epoch=0;
  let roomsTimer=null,roomsEpoch=0,roomsLoading=false,roomsSignature='',roomButtons=[];
  let selectedColumn=3,lastDiscEvent='';
  let trickUntil=0,trickTimer=null,lastReadTrick='',retryCount=0,entryReturn=null;
  const base=(payload.briscolaApi||'').replace(/\/$/,'');
  const ranks={1:'Asso',8:'Fante',9:'Cavallo',10:'Re'};
  const label=c=>(ranks[c.rank]||c.rank)+' di '+c.suit;
  function message(text){$('game-feedback').textContent=text;if($('game-entry-dialog').open)$('game-entry-feedback').textContent=text;}
  function remember(){if(session)sessions.set(selectedGame,session);else sessions.delete(selectedGame);try{if(session)localStorage.setItem(key(),JSON.stringify(session));else localStorage.removeItem(key());}catch{message('Il browser non salva la sessione: mantieni aperta questa scheda per conservare il tuo posto.');}}
  function restore(){session=sessions.get(selectedGame)||null;if(session)return;try{const saved=JSON.parse(localStorage.getItem(key())||'null');if(/^[A-Z2-9]{6}$/.test(saved?.code)&&/^[a-f0-9]{64}$/.test(saved?.token)){session=saved;sessions.set(selectedGame,saved);}}catch{}}
  function reset(){epoch++;session=null;state=null;signature='';trickUntil=0;clearTimeout(trickTimer);clearTimeout(timer);$('game-forget').hidden=true;remember();draw();}
  function applyState(next){
    if(state?.code===next.code&&state.version>next.version)return;
    if(state?.matchId!==next.matchId){selectedColumn=3;lastReadTrick='';trickUntil=0;}
    state=next;
    if(selectedGame==='briscola'&&next.lastTrick){
      const id=next.matchId+':'+next.lastTrick.id;
      if(id!==lastReadTrick){lastReadTrick=id;trickUntil=Date.now()+Math.max(1100,next.trickWaitMs||0);clearTimeout(trickTimer);const generation=epoch;trickTimer=setTimeout(()=>{if(generation===epoch){signature='';draw();}},Math.max(1100,next.trickWaitMs||0)+30);}
    }
  }
  async function request(action,body={}){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
    try{
      const ranked=session?.mode==='ranked';
      const token=ranked?await globalThis.veronaAccount?.accessToken():session?.token;
      if(ranked&&!token)throw new Error('Accedi al tuo account per riprendere la partita ranked. Il tempo della mossa continua sul server.');
      const response=await fetch(base+'/api/'+(ranked?'ranked':selectedGame)+'/'+action,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({...body,game:selectedGame,code:body.code||session?.code}),signal:controller.signal});
      let result;try{result=await response.json();}catch{throw new Error('Il servizio di gioco non è disponibile su questo indirizzo.');}
      if(!response.ok)throw Object.assign(new Error(result.error||'Servizio non disponibile.'),{status:response.status});
      return result;
    }catch(error){if(error.name==='AbortError'||error instanceof TypeError)throw new Error('Connessione interrotta. Riprova: il tuo posto resta riservato.');throw error;}
    finally{clearTimeout(timeout);}
  }
  function schedule(){clearTimeout(timer);if(session)timer=setTimeout(poll,Math.min(15000,2500*2**Math.min(retryCount,3)));}
  async function poll(){
    if(busy){schedule();return;}
    const generation=epoch;
    try{const result=await request('state');if(generation!==epoch)return;applyState(result.state);retryCount=0;$('game-forget').hidden=true;message('');draw();}
    catch(error){if(generation!==epoch)return;retryCount++;$('game-forget').hidden=false;message(error.message+(error.status===404?' Crea una nuova partita.':' Riconnessione automatica in corso…'));if([401,404].includes(error.status))reset();else{signature='';draw();}}
    finally{schedule();}
  }
  async function act(action,body={}){
    if(busy)return false;epoch++;busy=true;draw();message('');let success=false;
    try{
      const result=await request(action,body);
      if(action==='leave'){const ranked=session?.mode==='ranked';reset();message(ranked?'Sei tornato alla sala giochi. Il risultato resta nella classifica.':'Partita chiusa per entrambi i giocatori.');return true;}
      applyState(result.state);retryCount=0;
      if(result.token){session={...session,code:state.code,token:result.token};remember();}
      if(['create','join'].includes(action)&&$('game-entry-dialog').open)$('game-entry-dialog').close();
      success=true;
    }catch(error){message(error.message);if([401,404].includes(error.status)&&session)reset();}
    finally{busy=false;signature='';draw();schedule();}
    return success;
  }
  function suitIcon(suit){
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 60 72');svg.setAttribute('aria-hidden','true');
    const shapes={denari:[['circle',{cx:30,cy:36,r:23}],['circle',{cx:30,cy:36,r:15}],['path',{d:'M30 21v30M15 36h30M19 25l22 22M19 47l22-22'}]],coppe:[['path',{d:'M14 12h32v16c0 22-32 22-32 0ZM14 17H6v8c0 10 8 12 14 12M46 17h8v8c0 10-8 12-14 12M30 44v15M17 62h26'}]],spade:[['path',{d:'M30 4 19 35l11 10 11-10ZM13 44h34M30 44v18M24 65h12'}]],bastoni:[['path',{d:'M21 65 37 8M27 42 12 28M33 25l17-9M30 51l17-9M20 59l-8-7'}],['path',{d:'M12 28C5 25 5 18 12 17c8 1 10 8 0 11M50 16c8-1 9-9 2-11-8-1-11 6-2 11'}]]};
    for(const [tag,attrs] of shapes[suit]){const shape=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))shape.setAttribute(key,String(value));shape.setAttribute('fill','none');shape.setAttribute('stroke','currentColor');shape.setAttribute('stroke-width','3.5');shape.setAttribute('stroke-linecap','round');shape.setAttribute('stroke-linejoin','round');svg.append(shape);}return svg;
  }
  function card(c,playable=false){
    const node=el(playable?'button':'div','','game-card game-'+c.suit);
    const corner=el('span',c.rank===1?'A':c.rank>=8?{8:'F',9:'C',10:'R'}[c.rank]:String(c.rank),'card-corner');corner.append(suitIcon(c.suit));node.append(corner);
    if(c.rank>=8){const figure=el('div',c.rank===10?'♛':'✦','card-crown'),mark=el('div',{8:'F',9:'C',10:'R'}[c.rank],'card-figure');mark.append(el('span',ranks[c.rank]));node.append(figure,mark);}
    else{const pips=el('div','','card-pips'+(c.rank===1?' single':''));for(let i=0;i<c.rank;i++)pips.append(suitIcon(c.suit));node.append(pips);}
    node.append(el('small',c.suit));
    node.setAttribute('aria-label',label(c));
    if(playable){node.type='button';node.disabled=busy||retryCount>0||Date.now()<trickUntil||state.turn!==state.seat||state.status!=='playing';node.onclick=()=>act('play',{card:c.id,version:state.version,matchId:state.matchId});}
    return node;
  }
  function draw(){
    const four=selectedGame==='forza4',hasRoom=Boolean(session),waiting=state?.status==='waiting',finished=state?.status==='finished';
    globalThis.veronaGameSession=hasRoom;
    $('app-shell').classList.toggle('game-session-layout',view==='games'&&hasRoom);
    $('game-type').value=selectedGame;$('game-type').disabled=busy;
    $('games-view').classList.toggle('forza4-screen',four);
    $('game-lobby-title').textContent=four?'Quattro in fila. Una sfida tra voi.':'Una partita tra amici';
    $('game-lobby-description').textContent=four?'Scegli la tua colonna. Fai la prossima mossa.':'Quaranta carte, una buona compagnia.';
    $('game-lobby').hidden=hasRoom;$('game-room').hidden=!hasRoom||!state;$('game-room-info').hidden=!hasRoom;
    $('game-felt').hidden=four||waiting;$('game-hand').hidden=four||waiting||finished;$('forza4-area').hidden=!four||!state||waiting;
    $('game-create').disabled=$('game-join').disabled=busy;$('game-visibility').disabled=busy;updateRoomControls();
    if(!state)return;
    const phase=Date.now()<trickUntil;
    const seconds=state.ranked?Math.max(0,Math.ceil((state.ranked.deadline-Date.now())/1000)):null;
    const next=JSON.stringify([state,busy,phase,retryCount,seconds]);if(signature===next)return;signature=next;
    $('game-code').textContent=$('game-waiting-code').textContent=state.code;$('game-leave').disabled=busy;
    const me=state.players[state.seat],opponent=state.players[1-state.seat];
    $('game-players').hidden=waiting;$('game-score').textContent='Tu · '+me.name;$('game-score').title=me.name;
    $('game-opponent').textContent=opponent?.name||'In attesa';$('game-opponent').title=opponent?.name||'';
    $('game-me-meta').textContent=four?(state.seat===0?'Rosso ●':'Giallo ○'):me.score+' punti · '+me.count+' carte';
    $('game-opponent-meta').textContent=opponent?(opponent.online?(four?(state.seat===0?'Giallo ○':'Rosso ●'):opponent.score+' punti · '+opponent.count+' carte'):'Si riconnette…'):'';
    for(const [id,name,seat] of [['game-me-avatar',me.name,state.seat],['game-opponent-avatar',opponent?.name||'?',1-state.seat]]){const avatar=$(id);avatar.textContent=four?(seat===0?'●':'○'):name.slice(0,1).toUpperCase();avatar.classList.toggle('disc-red',four&&seat===0);avatar.classList.toggle('disc-yellow',four&&seat===1);}
    $('game-invite').hidden=!waiting;
    $('game-room-visibility').textContent=state.visibility==='public'?'Stanza pubblica · compare tra i tavoli disponibili.':'Stanza privata · si entra solo con codice o link.';
    const ranked=Boolean(state.ranked);
    $('game-copy-info').hidden=ranked;$('game-code').parentElement.hidden=ranked;
    if(ranked)$('game-room-visibility').textContent='Classificata · Elo '+state.ranked.elo[state.seat]+' contro '+state.ranked.elo[1-state.seat]+'. 90 secondi per mossa. Abbandonare comporta una sconfitta.';
    $('game-waiting-description').textContent=state.visibility==='public'?'Il tuo tavolo è visibile nelle stanze in attesa. Puoi anche invitare un amico.':'Invita un amico: bastano un link e il suo soprannome.';
    $('game-turn').hidden=waiting||finished;
    $('game-turn').classList.toggle('my-turn',state.turn===state.seat&&!retryCount);
    $('game-turn').textContent=retryCount?'Connessione interrotta · recupero la partita…':!four&&phase&&state.lastTrick?'Presa di '+state.players[state.lastTrick.winner].name+' · +'+state.lastTrick.points+' punti':state.turn===state.seat?(four?'Scegli la colonna, poi lascia cadere.':'Tocca a te · scegli una carta'):'Tocca a '+(opponent?.name||'…');
    if(state.ranked&&state.status==='playing'&&!retryCount)$('game-turn').textContent+=' · '+seconds+' s';
    $('game-result').hidden=!finished;$('game-new').hidden=!finished;
    if(finished){$('game-result-title').textContent=state.winner===null?'Pari e patta.':state.winner===state.seat?'Questa è tua!':'La spunta '+opponent.name;
      $('game-result-summary').textContent=four?(state.winner===null?'Tabellone completo. Si gioca ancora?':'Quattro in fila. Si gioca ancora?'):me.score+' a '+opponent.score+' punti. Si gioca ancora?';
      $('game-new').hidden=ranked;
      if(ranked){const change=state.ranked.changes?.[state.seat];$('game-result-summary').textContent=(state.ranked.reason==='timeout'?'Tempo per la mossa scaduto. ':state.ranked.reason==='abandon'?'Partita conclusa per abbandono. ':'')+(change?'Elo '+change.before+' → '+change.after+' ('+(change.delta>=0?'+':'')+change.delta+').':'Registrazione risultato in corso…');}
      const vote=state.rematch?.[state.seat];$('game-new').textContent=vote?'Annulla richiesta':'Rivincita';$('game-new').disabled=busy;
      $('game-rematch-status').textContent=vote?'In attesa di '+opponent.name+'…':state.rematch?.[1-state.seat]?opponent.name+' ha chiesto la rivincita.':'';
      if(ranked)$('game-rematch-status').textContent='Torna alla sala giochi per cercare un nuovo avversario.';
    }
    $('game-last-trick').hidden=four||!state.lastTrick;
    if(four){drawFour();return;}
    const trump=$('game-trump');trump.replaceChildren();
    if(state.trump)trump.append(el('span','BRISCOLA'),card(state.trump),el('small',state.remaining+' nel mazzo'));
    const backs=$('game-opponent-backs');backs.replaceChildren();for(let i=0;i<(opponent?.count||0);i++)backs.append(el('i',''));
    const table=$('game-table');table.replaceChildren();
    const showLast=phase&&state.lastTrick||!state.table.length&&state.lastTrick;
    const cards=showLast?state.lastTrick.cards:state.table;
    $('game-trick-label').textContent=showLast?'Presa di '+state.players[state.lastTrick.winner].name+' · '+state.lastTrick.points+' punti':state.table.length?'La presa è aperta':'La prima carta va qui';
    for(const played of cards){const slot=el('div','','game-played');slot.append(el('small',state.players[played.player].name),card(played.card));table.append(slot);}
    $('game-last-trick').textContent=state.lastTrick?'↺ Ultima presa · '+state.lastTrick.points+' punti':'Ultima presa';
    const hand=$('game-hand'),focused=document.activeElement?.getAttribute?.('aria-label');hand.replaceChildren();
    for(const c of me.hand||[]){const button=card(c,true);hand.append(button);if(focused===label(c))button.focus();}
  }
  function drawFour(){
    const board=$('forza4-board'),controls=$('forza4-columns');
    const focused=document.activeElement?.getAttribute?.('data-four-action');
    board.replaceChildren();controls.replaceChildren();
    const previous=el('button','‹','forza4-step'),drop=el('button','','forza4-release'),next=el('button','›','forza4-step');
    previous.id='forza4-previous';next.id='forza4-next';drop.id='forza4-release';
    previous.setAttribute('aria-label','Seleziona la colonna precedente');next.setAttribute('aria-label','Seleziona la colonna successiva');
    for(const [button,action] of [[previous,'previous'],[drop,'release'],[next,'next']]){button.type='button';button.setAttribute('data-four-action',action);controls.append(button);if(focused===action)button.focus();}
    previous.onclick=()=>selectColumn((selectedColumn+6)%7);next.onclick=()=>selectColumn((selectedColumn+1)%7);
    drop.onclick=releaseDisc;
    const status=el('span','','forza4-selection-status');status.id='forza4-selection-status';status.setAttribute('role','status');controls.append(status);
    board.tabIndex=0;board.setAttribute('aria-describedby','forza4-selection-status');
    board.onclick=event=>{const rect=board.getBoundingClientRect(),inset=6;selectColumn(Math.max(0,Math.min(6,Math.floor((event.clientX-rect.left-inset)/(rect.width-2*inset)*7))));};
    board.onkeydown=event=>{
      if(!['ArrowLeft','ArrowRight','Home','End','Enter',' '].includes(event.key))return;event.preventDefault();
      if(event.key==='Enter'||event.key===' ')releaseDisc();else selectColumn(event.key==='Home'?0:event.key==='End'?6:(selectedColumn+(event.key==='ArrowLeft'?6:1))%7);
    };
    const discEvent=state.code+':'+state.version,animate=Boolean(state.lastMove)&&discEvent!==lastDiscEvent;
    lastDiscEvent=discEvent;
    for(let row=0;row<6;row++)for(let col=0;col<7;col++){
      const value=state.board[row][col],win=state.winningCells.some(([r,c])=>r===row&&c===col);
      const cell=el('span',value===null?'':value===0?'●':'○','forza4-cell'+(value===null?'':' disc-'+value)+(win?' winning':''));
      cell.setAttribute('role','img');cell.setAttribute('aria-label','Riga '+(row+1)+', colonna '+(col+1)+': '+(value===null?'vuota':value===0?'rosso':'giallo')+(win?', combinazione vincente':''));
      if(state.lastMove?.row===row&&state.lastMove.column===col){cell.classList.add('last-disc');if(animate)cell.classList.add('disc-arrives');}
      board.append(cell);
    }
    updateFourPreview();
  }
  function selectColumn(column){
    if(busy||state?.status!=='playing')return;selectedColumn=column;updateFourPreview();
  }
  function releaseDisc(){
    if(busy||retryCount>0||state?.status!=='playing'||state.turn!==state.seat||state.board[0][selectedColumn]!==null)return;
    act('play',{column:selectedColumn,version:state.version,matchId:state.matchId});
  }
  function updateFourPreview(){
    const active=state.status==='playing',mine=active&&state.turn===state.seat,full=state.board[0][selectedColumn]!==null;
    let landing=5;while(landing>=0&&state.board[landing][selectedColumn]!==null)landing--;
    $('forza4-board').classList.toggle('preview-red',state.seat===0);$('forza4-board').classList.toggle('preview-yellow',state.seat===1);
    for(const [index,cell] of [...$('forza4-board').children].entries()){
      const row=Math.floor(index/7),col=index%7,preview=active&&mine&&col===selectedColumn&&row===landing;
      cell.classList.toggle('selected-lane',active&&col===selectedColumn&&state.board[row][col]===null);
      cell.classList.toggle('disc-preview',preview);
      cell.setAttribute('aria-label','Riga '+(row+1)+', colonna '+(col+1)+': '+(state.board[row][col]===null?'vuota':state.board[row][col]===0?'rosso':'giallo')+(preview?', anteprima della tua pedina':'')+(cell.classList.contains('winning')?', combinazione vincente':''));
    }
    $('forza4-previous').disabled=$('forza4-next').disabled=busy||!active;
    const drop=$('forza4-release');drop.disabled=busy||retryCount>0||!mine||full;
    const chip=el('span',state.seat===0?'●':'○','forza4-control-chip');chip.setAttribute('aria-hidden','true');
    drop.replaceChildren(chip,el('span',!active?'Partita conclusa':busy?'Gioco…':!mine?'Attendi il turno':full?'Colonna piena':'Lascia cadere'));
    drop.classList.toggle('release-red',state.seat===0);drop.classList.toggle('release-yellow',state.seat===1);
    drop.setAttribute('aria-label','Lascia cadere la pedina nella colonna '+(selectedColumn+1)+(full?', colonna piena':''));
    $('forza4-selection-status').textContent=!active?'Partita conclusa.':('Colonna '+(selectedColumn+1)+(full?' piena.':'.')+(mine&&!full?' Anteprima nella riga '+(landing+1)+'. Premi Lascia cadere oppure Invio sul tabellone.':' Usa le frecce per scegliere la colonna.'));
  }
  function chooseGame(game){
    if(busy)return;epoch++;clearTimeout(timer);clearTimeout(trickTimer);trickUntil=0;retryCount=0;state=null;signature='';selectedGame=game;restore();
    $('game-room-code').value='';$('game-forget').hidden=true;message(session?'Riprendo la tua partita…':'');
    try{localStorage.setItem('verona-game-choice-v1',game);}catch{}
    render();draw();if(session)poll();
  }
  function updateRoomControls(){
    $('game-rooms-refresh').disabled=busy||roomsLoading;
    $('game-rooms-name').disabled=busy;
    for(const button of roomButtons)button.disabled=busy;
  }
  function drawRooms(result){
    const next=JSON.stringify(result);if(next===roomsSignature)return;roomsSignature=next;
    const list=$('game-rooms-list'),focused=document.activeElement?.getAttribute?.('data-room');list.replaceChildren();roomButtons=[];
    for(const room of result.rooms){
      const row=el('article','','public-game-room'),info=el('div','');
      info.append(el('strong',room.hostName),el('small',(room.game==='forza4'?'Forza 4':'Briscola')+' · 1 posto libero'));
      const button=el('button','Entra');button.type='button';button.setAttribute('aria-label','Entra nella stanza di '+room.hostName);button.setAttribute('data-room',room.code);button.onclick=()=>joinPublicRoom(room.code);
      roomButtons.push(button);row.append(info,button);list.append(row);
    }
    if(focused)(roomButtons.find(button=>button.getAttribute('data-room')===focused)||$('game-rooms-refresh')).focus();
  }
  async function refreshRooms(keepMessage=false){
    if(!$('game-rooms-dialog').open||busy)return;
    clearTimeout(roomsTimer);const generation=++roomsEpoch;roomsLoading=true;updateRoomControls();
    if(!keepMessage)$('game-rooms-status').textContent='Cerco stanze disponibili…';
    try{
      const result=await request('list');if(generation!==roomsEpoch)return;
      drawRooms(result);
      if(!keepMessage)$('game-rooms-status').textContent=result.total===0?'Nessuna stanza pubblica in attesa. Puoi crearne una tu.':result.total>result.rooms.length?'Mostro '+result.rooms.length+' stanze su '+result.total+'.':result.total+' '+(result.total===1?'stanza disponibile':'stanze disponibili')+' · aggiornamento automatico';
    }catch(error){if(generation===roomsEpoch)$('game-rooms-status').textContent=error.message+' Usa Aggiorna per riprovare.';}
    finally{if(generation===roomsEpoch){roomsLoading=false;updateRoomControls();if($('game-rooms-dialog').open)roomsTimer=setTimeout(refreshRooms,5000);}}
  }
  async function joinPublicRoom(code){
    if(busy||!$('game-rooms-name').reportValidity())return;
    roomsEpoch++;clearTimeout(roomsTimer);roomsLoading=false;
    $('game-name').value=$('game-rooms-name').value;$('game-rooms-status').textContent='Entro nella stanza…';
    const joined=await act('join',{name:$('game-name').value,code});
    if(joined){if($('game-rooms-dialog').open)$('game-rooms-dialog').close();}
    else if($('game-rooms-dialog').open){$('game-rooms-status').textContent=$('game-feedback').textContent;refreshRooms(true);}
  }
  $('game-browse').onclick=()=>{
    $('game-rooms-title').textContent='Stanze · '+(selectedGame==='forza4'?'Forza 4':'Briscola');
    $('game-rooms-name').value=$('game-name').value;roomsSignature='';roomButtons=[];$('game-rooms-list').replaceChildren();
    $('game-rooms-dialog').showModal();refreshRooms();
  };
  $('game-rooms-refresh').onclick=()=>refreshRooms();
  $('game-rooms-close').onclick=()=>$('game-rooms-dialog').close();
  $('game-rooms-dialog').addEventListener('close',()=>{
    roomsEpoch++;roomsLoading=false;clearTimeout(roomsTimer);
    if(session){const action=state?.status==='playing'?$(selectedGame==='forza4'?'forza4-columns':'game-hand').querySelector('button:enabled'):null;(action||$('game-leave')).focus();}
    else $('game-browse').focus();
  });
  $('game-type').onchange=()=>chooseGame($('game-type').value);
  $('games').onclick=()=>{setView('games');draw();};
  const params=typeof location!=='undefined'?new URL(location.href).searchParams:null;
  const invitation=params?.get('forza4')||params?.get('briscola');
  if(invitation){selectedGame=params.has('forza4')?'forza4':'briscola';$('game-room-code').value=invitation.toUpperCase().slice(0,6);setView('games');}
  $('game-create').onclick=()=>{if($('game-name').reportValidity())act('create',{name:$('game-name').value,visibility:$('game-visibility').value});};
  $('game-join-form').onsubmit=event=>{event.preventDefault();if($('game-name').reportValidity())act('join',{name:$('game-name').value,code:$('game-room-code').value.trim().toUpperCase()});};
  async function copyInvitation(){
    const url=new URL(location.href);url.searchParams.delete('briscola');url.searchParams.delete('forza4');url.searchParams.set(selectedGame,session.code);
    try{if(navigator.share&&document.activeElement===$('game-copy'))await navigator.share({title:'Una partita a '+(selectedGame==='forza4'?'Forza 4':'Briscola'),url:url.href});else{await navigator.clipboard.writeText(url.href);message('Link d’invito copiato.');}}catch(error){if(error.name!=='AbortError')message('Condividi questo codice: '+session.code);}
  }
  $('game-copy').onclick=$('game-copy-info').onclick=copyInvitation;
  $('game-room-info').onclick=()=>$('game-info-dialog').showModal();
  $('game-info-close').onclick=()=>$('game-info-dialog').close();
  $('game-info-dialog').addEventListener('close',()=>$('game-room-info').focus());
  $('game-leave').onclick=$('game-end-back').onclick=()=>{if($('game-info-dialog').open)$('game-info-dialog').close();if(state?.ranked&&state.status==='finished'){act('leave');return;}$('game-leave-dialog').querySelector('p').textContent=state?.ranked?'Abbandonando perderai la partita e il relativo punteggio Elo.':'La partita verrà chiusa anche per l’altra persona.';$('game-leave-dialog').showModal();};
  $('game-cancel-leave').onclick=()=>$('game-leave-dialog').close();
  $('game-confirm-leave').onclick=()=>{$('game-leave-dialog').close();act('leave');};
  $('game-leave-dialog').addEventListener('close',()=>$('game-room-info').focus());
  $('game-new').onclick=()=>act('rematch',{matchId:state.matchId,accept:!state.rematch?.[state.seat]});
  function openEntry(mode){
    entryReturn=document.activeElement;$('game-create-fields').hidden=mode!=='create';$('game-join-form').hidden=mode!=='join';
    $('game-entry-title').textContent=mode==='create'?'Invita un amico':'Hai un posto al tavolo';
    $('game-entry-description').textContent=mode==='create'?'Scegli un nome e crea il tuo tavolo.':'Scrivi il codice ricevuto e scegli il tuo nome.';
    $('game-entry-feedback').textContent='';$('game-entry-dialog').showModal();$('game-name').focus();
  }
  $('game-create-open').onclick=()=>openEntry('create');$('game-join-open').onclick=()=>openEntry('join');
  $('game-entry-close').onclick=()=>$('game-entry-dialog').close();
  $('game-entry-dialog').addEventListener('close',()=>{if(session)$('game-room-info').focus();else if(entryReturn?.isConnected)entryReturn.focus();else $('game-create-open').focus();});
  $('game-last-trick').onclick=()=>{
    if(!state?.lastTrick)return;
    const last=state.lastTrick;$('game-trick-summary').textContent='Presa '+last.id+' · '+state.players[last.winner].name+' ha raccolto '+last.points+' punti.';
    const content=$('game-trick-cards');content.replaceChildren();for(const move of last.cards){const slot=el('div','','game-played');slot.append(el('small',state.players[move.player].name),card(move.card));content.append(slot);}
    $('game-trick-dialog').showModal();
  };
  $('game-trick-close').onclick=()=>$('game-trick-dialog').close();$('game-trick-dialog').addEventListener('close',()=>$('game-last-trick').focus());
  $('game-rules').onclick=()=>$(selectedGame==='forza4'?'forza4-rules-dialog':'game-rules-dialog').showModal();
  $('forza4-close-rules').onclick=()=>$('forza4-rules-dialog').close();
  $('forza4-rules-dialog').addEventListener('close',()=>$('game-rules').focus());
  $('game-close-rules').onclick=()=>$('game-rules-dialog').close();
  $('game-rules-dialog').addEventListener('close',()=>$('game-rules').focus());
  $('game-forget').onclick=()=>{reset();message('Sessione rimossa da questo browser. La stanza scadrà per inattività.');};
  globalThis.veronaGames={
    enterRanked(result){
      if(busy)return false;
      epoch++;clearTimeout(timer);selectedGame=result.game;signature='';state=null;retryCount=0;
      session={mode:'ranked',code:result.state.code,token:result.token};remember();applyState(result.state);setView('games');draw();schedule();return true;
    }
  };
  restore();
  draw();if(session){message('Riprendo la tua partita…');poll();}else if(invitation)openEntry('join');
})();
