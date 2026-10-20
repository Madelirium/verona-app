import {createGameService} from './briscola.mjs';
import {createRankedService} from './ranked.mjs';
import {eloChange} from './ranked-store.mjs';
const unavailable=()=>Object.assign(new Error('Salvataggio non disponibile. Nessuna mossa è stata confermata: attendi la riconnessione.'),{status:503});

// This credential belongs exclusively to the Node server, never to browser config.
export function createSupabaseGameRepository({url,key,fetchImpl=fetch}){
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash||!['','/'].includes(parsed.pathname))throw new Error('SUPABASE_URL deve essere un’origine HTTPS.');
  if(!/^sb_secret_[A-Za-z0-9_-]+$/.test(key||''))throw new Error('Configurare SUPABASE_SECRET_KEY solo sul backend.');
  async function rpc(name,body){
    try{
      const response=await fetchImpl(parsed.origin+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000),redirect:'error'});
      if(!response.ok)throw unavailable();
      return await response.json();
    }catch{throw unavailable();} // Never forward database messages or credentials.
  }
  return{
    load(key,user=null,game=null){return rpc('verona_games_load',{p_key:key,p_user:user,p_game:game});},
    commit(key,revision,state,results=[]){return rpc('verona_games_commit',{p_key:key,p_revision:revision,p_state:state,p_results:results});}
  };
}

// A fresh engine per transaction prevents an unsuccessful save from changing live state.
// Database CAS protects concurrent requests and separate server instances.
export function createPersistentGameService({repository,game,now=Date.now,...options}){
  const key='friendly:'+game;
  return{
    async forRequest(){
      let loaded=await repository.load(key);
      const engine=()=>createGameService({...options,game,now,initialState:loaded.state});
      return{
        identify(body,token){return engine().identify(body,token);},
        async execute(action,body,token){
          for(let attempt=0;attempt<5;attempt++){
            const service=engine();
            const result=service.execute(action,body,token);
            if(await repository.commit(key,loaded.revision,service.exportState()))return result;
            loaded=await repository.load(key);
          }
          throw Object.assign(new Error('Il tavolo si sta aggiornando. Riprova tra un momento.'),{status:409});
        }
      };
    }
  };
}

function transactionRankedStore(loaded){
  const ratings=new Map((loaded.ratings||[]).map(row=>[row.game+':'+row.user_id,row]));
  const pending=[];
  const profile=(game,id)=>ratings.get(game+':'+id)||{elo:1000,games:0,wins:0};
  return{
    pending,profile,
    leaderboard(){return loaded.leaderboard||[];},
    finish(result){
      const {game,players,winner}=result,before=players.map(p=>profile(game,p.id));
      const delta=eloChange(before[0].elo,before[1].elo,winner===null?.5:winner===0?1:0);
      const changes=players.map((p,i)=>({before:before[i].elo,after:before[i].elo+(i===0?delta:-delta),delta:i===0?delta:-delta}));
      for(const [i,p] of players.entries())ratings.set(game+':'+p.id,{...before[i],name:p.name,elo:changes[i].after,games:before[i].games+1,wins:before[i].wins+(winner===i?1:0)});
      pending.push({...result,changes});return changes;
    }
  };
}
export function createPersistentRankedService({repository,now=Date.now,...options}){
  return{async execute(action,body,user){
    for(let attempt=0;attempt<5;attempt++){
      const loaded=await repository.load('ranked',user.id,action==='leaderboard'?body.game:null);
      const store=transactionRankedStore(loaded);
      const service=createRankedService({...options,store,now,initialState:loaded.state});
      let result,error;
      try{result=service.execute(action,body,user);}catch(value){error=value;}
      // A timeout discovered while rejecting a stale move must still be recorded.
      if(error&&!error.status)throw error;
      if(await repository.commit('ranked',loaded.revision,service.exportState(),store.pending)){
        if(error)throw error;
        if(action==='leaderboard'&&store.pending.length){
          const updated=await repository.load('ranked',user.id,body.game);
          const current=transactionRankedStore(updated);return{rows:current.leaderboard(),profile:current.profile(body.game,user.id)};
        }
        return result;
      }
    }
    throw Object.assign(new Error('Le partite si stanno aggiornando. Riprova tra un momento.'),{status:409});
  }};
}
