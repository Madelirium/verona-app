import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {createRankedService,createSupabaseVerifier,createRankedHandler} from './ranked.mjs';
import {openRankedStore,eloChange} from './ranked-store.mjs';
const a={id:'user-a'},b={id:'user-b'},c={id:'user-c'};
const body={game:'forza4',name:'Alice'};
async function setup(){const store=await openRankedStore(':memory:');let time=1000;return{store,service:createRankedService({store,now:()=>time,trickPauseMs:0}),advance:n=>{time+=n;}};}
function matched(s,game='forza4'){
  const args={...body,game};
  assert.equal(s.execute('queue',args,a).phase,'searching');
  const ready=s.execute('queue',{...args,name:'Bob'},b);assert.equal(ready.phase,'ready');
  assert.equal(s.execute('ready',{game,matchId:ready.matchId},a).phase,'ready');
  const playing=s.execute('ready',{game,matchId:ready.matchId},b);assert.equal(playing.phase,'playing');return playing;
}
test('Elo expected scores, draws and zero sum',()=>{
  assert.equal(eloChange(1000,1000,1),16);assert.equal(eloChange(1000,1000,0),-16);assert.equal(eloChange(1000,1000,.5),0);
  assert.ok(eloChange(1400,1000,1)<16);assert.ok(eloChange(1000,1400,1)>16);
});
test('queue deduplicates identity, rejects guests and keeps games separate',async t=>{
  const {store,service:s}=await setup();t.after(()=>store.close());
  assert.throws(()=>s.execute('queue',body,null),{status:401});
  assert.throws(()=>s.execute('queue',{...body,name:'private@email.test'},a),/soprannome/);
  s.execute('queue',body,a);assert.equal(s.execute('queue',body,a).phase,'searching');
  assert.throws(()=>s.execute('queue',{...body,game:'briscola'},a),{status:409});
  assert.equal(s.execute('queue',{game:'briscola',name:'Bob'},b).phase,'searching');
  assert.equal(s.execute('cancel',body,a).phase,'idle');assert.equal(s.execute('status',body,a).phase,'idle');
});
test('expired queue entries and unconfirmed proposals never lose Elo',async t=>{
  const {store,service:s,advance}=await setup();t.after(()=>store.close());
  s.execute('queue',body,a);advance(21000);assert.equal(s.execute('queue',{...body,name:'Bob'},b).phase,'searching');
  s.execute('queue',body,a);advance(31000);assert.equal(s.execute('status',body,a).phase,'idle');
  assert.equal(store.profile('forza4',a.id).games,0);assert.deepEqual(store.leaderboard('forza4'),[]);
});
test('ready cancellation releases both seats, a live game cannot be queue-cancelled',async t=>{
  const {store,service:s}=await setup();t.after(()=>store.close());
  s.execute('queue',body,a);s.execute('queue',{...body,name:'Bob'},b);s.execute('cancel',body,a);
  assert.equal(s.execute('status',body,b).phase,'idle');
  matched(s);assert.equal(s.execute('cancel',body,a).phase,'playing');
});
test('server owns moves and result; opponent cannot be selected by code or client winner',async t=>{
  const {store,service:s}=await setup();t.after(()=>store.close());const result=matched(s),code=result.state.code;
  assert.throws(()=>s.execute('state',{game:'forza4',code},c),{status:404});
  assert.throws(()=>s.execute('rematch',{game:'forza4',code},a),{status:404});
  let state=result.state;const winner=state.turn,users=[a,b],columns=[0,1,0,1,0,1,0];
  for(const column of columns){state=s.execute('play',{game:'forza4',code,column,version:state.version,matchId:state.matchId,winner:1-winner},users[state.turn]).state;}
  assert.equal(state.status,'finished');assert.equal(state.winner,winner);
  assert.equal(store.profile('forza4',users[winner].id).elo,1016);
  for(let i=0;i<5;i++)s.execute('state',{game:'forza4',code},a);
  assert.equal(store.profile('forza4',a.id).games,1);assert.equal(store.profile('forza4',b.id).games,1);
  assert.equal(store.profile('briscola',a.id).games,0);
});
test('timeout gives a single loss, heartbeat does not extend the turn',async t=>{
  const {store,service:s,advance}=await setup();t.after(()=>store.close());const match=matched(s),turn=match.state.turn;
  advance(85000);s.execute('state',{game:'forza4',code:match.state.code},a);advance(5000);
  const result=s.execute('state',{game:'forza4',code:match.state.code},b).state;
  assert.equal(result.ranked.reason,'timeout');assert.equal(result.winner,1-turn);
  s.execute('leave',{game:'forza4',code:match.state.code},a);s.execute('leave',{game:'forza4',code:match.state.code},b);
  assert.equal(store.profile('forza4',a.id).games,1);
});
test('Briscola ranked completes with authoritative card scoring',async t=>{
  const {store,service:s}=await setup();t.after(()=>store.close());let result=matched(s,'briscola');
  while(result.state.status!=='finished'){
    const player=[a,b][result.state.turn];
    const own=s.execute('state',{game:'briscola',code:result.state.code},player).state;
    result=s.execute('play',{game:'briscola',code:own.code,version:own.version,matchId:own.matchId,card:own.players[own.seat].hand[0].id},player);
  }
  assert.equal(result.state.players.reduce((sum,p)=>sum+p.score,0),120);
  assert.equal(store.profile('briscola',a.id).games,1);
});
test('abandonment records the result, requeue cannot overwrite the old opponent result',async t=>{
  const {store,service:s}=await setup();t.after(()=>store.close());const match=matched(s);
  s.execute('leave',{game:'forza4',code:match.state.code},a);
  s.execute('queue',body,a);
  const old=s.execute('state',{game:'forza4',code:match.state.code},b).state;
  assert.equal(old.winner,1);assert.equal(old.ranked.reason,'abandon');
  s.execute('leave',{game:'forza4',code:match.state.code},b);
  assert.equal(s.execute('status',body,a).phase,'searching');
});
test('persistent transaction is idempotent across reopen and publishes no account identifiers',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'verona-ranked-')),path=join(dir,'ranked.sqlite');let store;
  try{
    const result={matchId:'unique',game:'forza4',players:[{id:'private-a',name:'Alice'},{id:'private-b',name:'Bob'}],winner:0,reason:'completed',now:1000};
    store=await openRankedStore(path);const changes=store.finish(result);store.close();store=await openRankedStore(path);
    assert.deepEqual(store.finish(result),changes);assert.equal(store.profile('forza4','private-a').games,1);
    assert.equal(JSON.stringify(store.leaderboard('forza4')).includes('private-'),false);
  }finally{store?.close();await rm(dir,{recursive:true,force:true});}
});
test('Supabase verification requires authoritative user response and confirmed email',async()=>{
  let seen;const verify=createSupabaseVerifier({url:'https://example.supabase.co',key:'public',fetchImpl:async(url,options)=>{seen={url,options};return{ok:true,json:async()=>({id:a.id,email:'secret@example.com',email_confirmed_at:'today'})};}});
  assert.deepEqual(await verify('signed-token'),a);assert.equal(seen.options.headers.Authorization,'Bearer signed-token');assert.ok(seen.url.endsWith('/auth/v1/user'));
  await assert.rejects(()=>verify(''),{status:401});
  const unverified=createSupabaseVerifier({url:'https://example.supabase.co',key:'public',fetchImpl:async()=>({ok:true,json:async()=>({id:a.id,email:'x'})})});
  await assert.rejects(()=>unverified('token'),{status:403});
  const forged=createSupabaseVerifier({url:'https://example.supabase.co',key:'public',fetchImpl:async()=>({ok:false,status:401})});
  await assert.rejects(()=>forged('forged'),{status:401});
});
test('matchmaking expands Elo tolerance only while both players keep the queue alive',async t=>{
  const {store,advance}=await setup();t.after(()=>store.close());let time=1000;
  const s=createRankedService({store:{...store,profile:(game,id)=>({...store.profile(game,id),elo:id===a.id?1400:1000})},now:()=>time});
  s.execute('queue',body,a);assert.equal(s.execute('queue',{...body,name:'Bob'},b).phase,'searching');
  for(let step=1;step<=6;step++){
    time+=15000;advance(15000);
    const result=s.execute('status',body,a);s.execute('status',body,b);
    assert.equal(result.phase,step===6?'ready':'searching');
  }
});
test('a storage failure retries the actual winning result rather than converting it to timeout',async t=>{
  const {store}=await setup();t.after(()=>store.close());let failed=false,time=1000;
  const s=createRankedService({store:{...store,finish:value=>{if(!failed){failed=true;throw Error('disk busy');}return store.finish(value);}},now:()=>time});
  const match=matched(s);let state=match.state;const users=[a,b],winner=state.turn;
  for(const [index,column] of [0,1,0,1,0,1,0].entries()){
    const play=()=>s.execute('play',{game:'forza4',code:state.code,column,version:state.version,matchId:state.matchId},users[state.turn]);
    if(index===6)assert.throws(play,/disk busy/);else state=play().state;
  }
  time+=100000;
  const restored=s.execute('state',{game:'forza4',code:state.code},a).state;
  assert.equal(restored.winner,winner);assert.equal(restored.ranked.reason,'completed');assert.equal(store.profile('forza4',a.id).games,1);
});
test('failed Elo transaction rolls back both accounts and result',async t=>{
  const {store}=await setup();t.after(()=>store.close());
  const result={matchId:'atomic',game:'forza4',players:[{id:a.id,name:'Alice'},{id:b.id,name:null}],winner:0,reason:'completed',now:1000};
  assert.throws(()=>store.finish(result));assert.equal(store.profile('forza4',a.id).games,0);assert.deepEqual(store.leaderboard('forza4'),[]);
  result.players[1].name='Bob';store.finish(result);assert.equal(store.profile('forza4',a.id).games,1);assert.equal(store.profile('forza4',b.id).games,1);
});
test('HTTP ranked is disabled by default and rejects foreign origins before verifying',async t=>{
  let verified=0;const handler=createRankedHandler({verify:async()=>{verified++;return a;}});
  const server=createServer((req,res)=>handler(req,res));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port+'/api/ranked/';
  const availability=await fetch(base+'availability',{method:'POST'});assert.deepEqual(await availability.json(),{enabled:false});
  assert.equal((await fetch(base+'queue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).status,503);
  assert.equal((await fetch(base+'queue',{method:'POST',headers:{Origin:'https://evil.example'}})).status,403);assert.equal(verified,0);
});
