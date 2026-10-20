import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import WebSocket from 'ws';
import {createGameHandler,createGameService} from './briscola.mjs';
import {createGameUpdates} from './game-updates.mjs';
import {createRankedHandler,createRankedService} from './ranked.mjs';

async function fixture(t,{service,rankedService}={}){
  const updates=createGameUpdates({allowedOrigin:'https://app.example'});
  const forza4=createGameHandler({game:'forza4',service,onChange:updates.publish,allowedOrigin:'https://app.example'});
  const ranked=createRankedHandler({service:rankedService,verify:async token=>{if(!['alice','bob'].includes(token))throw Object.assign(Error('Access denied'),{status:401});return{id:token};},onChange:updates.publish,allowedOrigin:'https://app.example'});
  const server=createServer(async(req,res)=>{if(await forza4(req,res))return;if(await ranked(req,res))return;res.writeHead(404).end();});
  updates.attach(server,{forza4,ranked});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{updates.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const base='http://127.0.0.1:'+server.address().port;
  async function post(action,body={},token='',mode='forza4'){const response=await fetch(base+'/api/'+mode+'/'+action,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});return{status:response.status,data:await response.json()};}
  async function subscribe(code,token,mode='friendly'){
    const ws=new WebSocket(base.replace('http:','ws:')+'/api/games/updates',{origin:'https://app.example'});
    const messages=[];ws.on('message',raw=>messages.push(JSON.parse(raw)));
    await once(ws,'open');const ready=once(ws,'message');ws.send(JSON.stringify({game:'forza4',mode,code,token}));await ready;
    return{ws,messages};
  }
  return{base,post,subscribe};
}

test('WebSocket: solo i partecipanti autenticati ricevono gli aggiornamenti del proprio tavolo',async t=>{
  const f=await fixture(t),a=(await f.post('create',{name:'Alice'})).data;
  const b=(await f.post('join',{code:a.state.code,name:'Bob'})).data;
  const other=(await f.post('create',{name:'Altra stanza'})).data;
  const sa=await f.subscribe(a.state.code,a.token),sb=await f.subscribe(a.state.code,b.token),sc=await f.subscribe(other.state.code,other.token);
  assert.deepEqual(sa.messages,[{type:'ready'}]);
  const rejected=await f.subscribe(a.state.code,'invalid');assert.deepEqual(rejected.messages,[{type:'rejected'}]);
  const players=[sa,sb],tokens=[a.token,b.token],turn=b.state.turn,notice=once(players[1-turn].ws,'message');
  const moved=await f.post('play',{code:a.state.code,column:1,version:b.state.version,matchId:b.state.matchId},tokens[turn]);
  assert.equal(moved.status,200);assert.deepEqual(JSON.parse((await notice)[0]),{type:'changed'});
  assert.equal(players[turn].messages.length,1);assert.equal(sc.messages.length,1);
  const recovered=await f.post('state',{code:a.state.code},tokens[1-turn]);assert.equal(recovered.data.state.board.flat().filter(v=>v!==null).length,1);
  assert.equal(JSON.stringify(players[1-turn].messages).includes('token'),false);
});

test('WebSocket: origine estranea respinta e nessun avviso prima del salvataggio durevole',async t=>{
  const engine=createGameService({game:'forza4'});let release,block=false;
  const service={async forRequest(){return{identify:(...args)=>engine.identify(...args),async execute(...args){const result=engine.execute(...args);if(block&&args[0]==='play')await new Promise(resolve=>{release=resolve;});return result;}};}};
  const f=await fixture(t,{service}),a=(await f.post('create',{name:'Alice'})).data,b=(await f.post('join',{code:a.state.code,name:'Bob'})).data;
  const observer=await f.subscribe(a.state.code,[a.token,b.token][1-b.state.turn]);block=true;
  const move=f.post('play',{code:a.state.code,column:2,version:b.state.version},[a.token,b.token][b.state.turn]);
  while(!release)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(observer.messages.length,1);const changed=once(observer.ws,'message');release();assert.equal((await move).status,200);await changed;
  const denied=new WebSocket(f.base.replace('http:','ws:')+'/api/games/updates',{origin:'https://attacker.example'});
  const error=await once(denied,'error');assert.match(error[0].message,/403/);
});

test('WebSocket ranked: verifica Google riusata, separazione utenti e avviso dopo la mossa',async t=>{
  const store={profile:()=>({elo:1000,games:0,wins:0}),leaderboard:()=>[],finish:()=>[]};
  const f=await fixture(t,{rankedService:createRankedService({store})});
  const call=(action,body,token)=>f.post(action,{game:'forza4',...body},token,'ranked');
  await call('queue',{name:'Alice'},'alice');const found=(await call('queue',{name:'Bob'},'bob')).data;
  await call('ready',{matchId:found.matchId},'alice');const started=(await call('ready',{matchId:found.matchId},'bob')).data;
  const a=await f.subscribe(started.state.code,'alice','ranked'),b=await f.subscribe(started.state.code,'bob','ranked');
  const bad=await f.subscribe(started.state.code,'outsider','ranked');assert.equal(bad.messages[0].type,'rejected');
  const turn=started.state.turn,changed=once([a,b][1-turn].ws,'message');
  const response=await call('play',{code:started.state.code,column:3,version:started.state.version,matchId:started.state.matchId},['alice','bob'][turn]);assert.equal(response.status,200);await changed;
  assert.deepEqual([a,b][1-turn].messages[1],{type:'changed'});
});

test('WebSocket: un salvataggio fallito non annuncia una mossa agli altri giocatori',async t=>{
  const engine=createGameService({game:'forza4'});
  const service={async forRequest(){return{identify:(...args)=>engine.identify(...args),execute(action,...args){if(action==='play')throw Object.assign(Error('Salvataggio non disponibile'),{status:503});return engine.execute(action,...args);}};}};
  const f=await fixture(t,{service}),a=(await f.post('create',{name:'Alice'})).data,b=(await f.post('join',{code:a.state.code,name:'Bob'})).data;
  const observer=await f.subscribe(a.state.code,[a.token,b.token][1-b.state.turn]);
  const response=await f.post('play',{code:a.state.code,column:1,version:b.state.version},[a.token,b.token][b.state.turn]);
  assert.equal(response.status,503);assert.deepEqual(observer.messages,[{type:'ready'}]);
});
