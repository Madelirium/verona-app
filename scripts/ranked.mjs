import {createGameService} from './briscola.mjs';
const games=['briscola','forza4'];
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function createSupabaseVerifier({url,key,fetchImpl=fetch}){
  const origin=new URL(url).origin;
  if(!origin.startsWith('https://'))throw new Error('Supabase richiede HTTPS.');
  return async token=>{
    if(!token||token.length>8192)fail('Accedi per giocare in ranked.',401);
    let response;
    try{response=await fetchImpl(origin+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(8000)});}catch{fail('Verifica account temporaneamente non disponibile.',503);}
    if(!response.ok)fail(response.status===401||response.status===403?'Accedi di nuovo al tuo account.':'Verifica account temporaneamente non disponibile.',response.status===401||response.status===403?401:503);
    const user=await response.json();
    if(!user.id||!user.email_confirmed_at||!user.email)fail('È necessario un account con email verificata.',403);
    return {id:user.id};
  };
}
export function createRankedService({store,now=Date.now,turnMs=90000,readyMs=30000,queueTtl=20000,maxPlayers=1000,trickPauseMs=1200,initialState}={}){
  // Lifecycle belongs to this service, including deadlines and finished-result retention.
  const engines=Object.fromEntries(games.map(game=>[game,createGameService({game,now,trickPauseMs,ttl:Infinity,initialState:initialState?.engines?.[game]})]));
  const queue=new Map(),active=new Map(),matches=new Set();
  for(const [id,player] of initialState?.queue||[])queue.set(id,structuredClone(player));
  const restored=new Map();
  for(const value of initialState?.matches||[]){const match=structuredClone(value);matches.add(match);restored.set(match.matchId,match);}
  for(const [id,matchId] of initialState?.active||[]){if(restored.has(matchId))active.set(id,restored.get(matchId));}
  function remove(match){for(const p of match.players)if(active.get(p.id)===match)active.delete(p.id);matches.delete(match);try{engines[match.game].execute('leave',{code:match.code},match.tokens[0]);}catch{}}
  function finish(match,winner,reason){
    if(match.result)return;
    match.pendingResult={winner,reason};
    // Commit before exposing a final result; the unique match ID makes retries safe.
    match.changes=store.finish({matchId:match.matchId,game:match.game,players:match.players,winner,reason,now:now()});
    match.result={winner,reason};match.finishedAt=now();
  }
  function sweep(){
    for(const [id,p] of queue)if(now()-p.seen>queueTtl)queue.delete(id);
    for(const match of matches){
      if(match.phase==='ready'&&now()>match.readyUntil){remove(match);continue;}
      if(match.pendingResult&&!match.result)finish(match,match.pendingResult.winner,match.pendingResult.reason);
      if(match.phase==='playing'&&!match.result&&now()>=match.deadline)finish(match,1-match.turn,'timeout');
      if(match.result&&now()-match.finishedAt>30*60*1000)remove(match);
    }
  }
  function pair(){
    const waiting=[...queue.values()].sort((a,b)=>a.joined-b.joined);
    for(const a of waiting){
      if(!queue.has(a.id))continue;
      const window=p=>Math.min(600,100+50*Math.floor((now()-p.joined)/15000));
      const b=waiting.filter(p=>p.id!==a.id&&queue.has(p.id)&&p.game===a.game&&Math.abs(p.elo-a.elo)<=Math.min(window(a),window(p))).sort((x,y)=>Math.abs(x.elo-a.elo)-Math.abs(y.elo-a.elo)||x.joined-y.joined)[0];
      if(!b)continue;
      const first=engines[a.game].execute('create',{name:a.name});
      const second=engines[a.game].execute('join',{code:first.state.code,name:b.name});
      const match={game:a.game,code:first.state.code,matchId:second.state.matchId,tokens:[first.token,second.token],players:[a,b],phase:'ready',ready:[false,false],readyUntil:now()+readyMs};
      queue.delete(a.id);queue.delete(b.id);for(const p of match.players)active.set(p.id,match);matches.add(match);
    }
  }
  function snapshot(match,id){
    const seat=match.players.findIndex(p=>p.id===id);
    if(match.phase==='ready')return{phase:'ready',game:match.game,matchId:match.matchId,opponent:match.players[1-seat].name,ready:match.ready[seat],readyUntil:match.readyUntil};
    const {state}=engines[match.game].execute('state',{code:match.code},match.tokens[seat]);
    if(match.result){state.status='finished';state.winner=match.result.winner;}
    state.ranked={elo:match.players.map(p=>p.elo),deadline:match.deadline,reason:match.result?.reason,changes:match.changes};
    return{phase:'playing',game:match.game,token:match.tokens[seat],state};
  }
  return {
    exportState(){return structuredClone({queue:[...queue],active:[...active].map(([id,match])=>[id,match.matchId]),matches:[...matches],engines:Object.fromEntries(games.map(game=>[game,engines[game].exportState()]))});},
    execute(action,body,user){
    if(!user?.id)fail('Accedi per giocare in ranked.',401);
    if(!games.includes(body.game))fail('Gioco sconosciuto.');
    sweep();
    if(action==='leaderboard')return{rows:store.leaderboard(body.game),profile:store.profile(body.game,user.id)};
    let match=active.get(user.id);
    if(action==='cancel'){
      queue.delete(user.id);
      if(match?.phase==='ready'){remove(match);return{phase:'idle'};}
      if(match)return snapshot(match,user.id); // A paired game cannot be silently cancelled.
      return{phase:'idle'};
    }
    if(action==='queue'){
      if(match)return snapshot(match,user.id);
      const previous=queue.get(user.id);
      if(previous&&previous.game!==body.game)fail('Annulla prima la ricerca in corso.',409);
      if(!previous){
        if(queue.size+active.size>=maxPlayers)fail('Coda piena. Riprova tra poco.',503);
        if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>24)fail('Scegli un soprannome da 1 a 24 caratteri.');
        const name=body.name.trim();if(name.includes('@'))fail('Usa un soprannome, senza indirizzo email.');
        queue.set(user.id,{id:user.id,name,game:body.game,elo:store.profile(body.game,user.id).elo,joined:now(),seen:now()});
      }else previous.seen=now();
      pair();match=active.get(user.id);
    }else if(action==='status'){
      const p=queue.get(user.id);if(p)p.seen=now();pair();match=active.get(user.id);
    }else if(action==='ready'){
      if(!match||match.phase!=='ready'||body.matchId!==match.matchId)fail('La proposta di partita è scaduta.',409);
      match.ready[match.players.findIndex(p=>p.id===user.id)]=true;
      if(match.ready.every(Boolean)){
        match.phase='playing';match.turn=engines[match.game].execute('state',{code:match.code},match.tokens[0]).state.turn;match.deadline=now()+turnMs;
      }
    }else if(['state','play','leave'].includes(action)){
      if(!match||match.game!==body.game||match.code!==body.code||match.phase!=='playing')fail('Partita non disponibile. Torna alle classificate.',404);
      const seat=match.players.findIndex(p=>p.id===user.id);
      if(action==='leave'){
        if(!match.result)finish(match,1-seat,'abandon');
        // Release this player only; their opponent can still retrieve the result.
        active.delete(user.id);return{left:true};
      }
      if(action==='play'){
        if(match.result)fail('La partita è terminata.',409);
        const result=engines[match.game].execute('play',{...body,code:match.code},match.tokens[seat]);
        match.turn=result.state.turn;match.deadline=now()+turnMs;
        if(result.state.status==='finished')finish(match,result.state.winner,'completed');
      }
    }else fail('Azione sconosciuta.',404);
    if(match)return snapshot(match,user.id);
    const p=queue.get(user.id);return p?{phase:'searching',game:p.game,elo:p.elo,joined:p.joined}:{phase:'idle'};
  }};
}
export function createRankedHandler({service,verify,allowedOrigin,onChange}={}){
  const limits=new Map();
  return async(req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    if(!path.startsWith('/api/ranked/'))return false;
    const origin=req.headers.origin;
    if(origin&&origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`&&origin!==allowedOrigin){res.writeHead(403).end();return true;}
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',...(origin?{'Access-Control-Allow-Origin':origin}:{})};
    if(req.method==='OPTIONS'){res.writeHead(204,{...headers,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600'}).end();return true;}
    try{
      if(req.method!=='POST')fail('Metodo non consentito.',405);
      let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>2048)fail('Richiesta troppo grande.',413);}
      let body;try{body=JSON.parse(raw||'{}');}catch{fail('Richiesta non valida.');}
      if(!body||typeof body!=='object'||Array.isArray(body))fail('Richiesta non valida.');
      const time=Date.now();for(const [key,value] of limits)if(time-value.time>60000)limits.delete(key);
      const ip=req.socket.remoteAddress,limit=limits.get(ip)||{time,count:0};limits.set(ip,limit);if(++limit.count>600)fail('Troppe richieste. Attendi un minuto.',429);
      const action=path.slice('/api/ranked/'.length);
      if(action==='availability'){res.writeHead(200,headers).end(JSON.stringify({enabled:Boolean(service&&verify)}));return true;}
      if(!service||!verify)fail('Classificate in preparazione: occorre attivare login e server ranked.',503);
      const user=await verify((req.headers.authorization||'').replace(/^Bearer /,''));
      const result=await service.execute(action,body,user);
      if(['ready','play','leave'].includes(action))onChange?.({mode:'ranked',game:result.game||body.game,code:result.state?.code||body.code,token:(req.headers.authorization||'').replace(/^Bearer /,'')});
      res.writeHead(200,headers).end(JSON.stringify(result));
    }catch(error){res.writeHead(error.status||500,headers).end(JSON.stringify({error:error.status?error.message:'Servizio ranked temporaneamente non disponibile.'}));}
    return true;
  };
}
