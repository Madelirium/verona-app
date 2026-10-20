import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createServer} from 'node:http';
import {createGameHandler} from './briscola.mjs';
import {createRankedHandler} from './ranked.mjs';
import {createPersistentGameService,createPersistentRankedService,createSupabaseGameRepository} from './game-persistence.mjs';
const alice={id:'11111111-1111-4111-8111-111111111111'},bob={id:'22222222-2222-4222-8222-222222222222'};
const migration=await readFile(new URL('../supabase/migrations/20261020125426_games_cloud_storage.sql',import.meta.url),'utf8');
const hardening=await readFile(new URL('../supabase/migrations/20261020130120_restrict_internal_rls_trigger.sql',import.meta.url),'utf8');
async function database(t){
  const db=new PGlite();t.after(()=>db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    insert into auth.users values('${alice.id}'),('${bob.id}');`);
  await db.exec(migration);
  await db.exec('create function public.rls_auto_enable() returns event_trigger language plpgsql security definer as $$ begin return; end $$;');
  await db.exec(hardening);
  const repository={
    async load(key,user=null,game=null){return(await db.query('select public.verona_games_load($1,$2,$3) as value',[key,user,game])).rows[0].value;},
    async commit(key,revision,state,results=[]){return(await db.query('select public.verona_games_commit($1,$2,$3,$4) as value',[key,revision,JSON.stringify(state),JSON.stringify(results)])).rows[0].value;}
  };
  return{db,repository};
}
async function friendly(service,action,body={},token=''){return(await service.forRequest()).execute(action,body,token);}
async function match(service,game='forza4'){
  const queue=await service.execute('queue',{game,name:'Alice'},alice);assert.equal(queue.phase,'searching');
  const found=await service.execute('queue',{game,name:'Bob'},bob);assert.equal(found.phase,'ready');
  await service.execute('ready',{game,matchId:found.matchId},alice);
  return service.execute('ready',{game,matchId:found.matchId},bob);
}
test('SQL migration: private hands and server RPCs inaccessible to browser roles',async t=>{
  const {db}=await database(t);
  for(const role of ['anon','authenticated']){
    await db.exec('set role '+role);
    await assert.rejects(()=>db.query("select * from verona_private.game_runtime"),/permission denied/);
    await assert.rejects(()=>db.query("select public.verona_games_load('ranked')"),/permission denied/);
    await assert.rejects(()=>db.query("select public.verona_games_commit('ranked',0,'{}')"),/permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.equal((await db.query("select public.verona_games_load('ranked') as value")).rows[0].value.revision,0);
  await db.exec('reset role');
  assert.equal((await db.query("select has_function_privilege('anon','public.rls_auto_enable()','execute') as permitted")).rows[0].permitted,false);
  assert.equal((await db.query("select has_function_privilege('authenticated','public.rls_auto_enable()','execute') as permitted")).rows[0].permitted,false);
  await db.exec(migration); // Repeatable without deleting existing data.
});
test('friendly rooms, tokens, turn and cards survive a new server instance',async t=>{
  const {repository}=await database(t);
  for(const game of ['briscola','forza4']){
    let server=createPersistentGameService({repository,game});
    const host=await friendly(server,'create',{name:'Alice',visibility:'public'});
    server=createPersistentGameService({repository,game});
    assert.equal((await friendly(server,'list')).rooms[0].code,host.state.code);
    const guest=await friendly(server,'join',{name:'Bob',code:host.state.code});
    const tokens=[host.token,guest.token],turn=guest.state.turn;
    const own=await friendly(server,'state',{code:host.state.code},tokens[turn]);
    const move=game==='forza4'?{column:2}:{card:own.state.players[turn].hand[0].id};
    const played=await friendly(server,'play',{...move,code:host.state.code,version:own.state.version,matchId:own.state.matchId},tokens[turn]);
    server=createPersistentGameService({repository,game});
    const restored=await friendly(server,'state',{code:host.state.code},tokens[turn]);
    assert.deepEqual(restored.state,played.state);
    if(game==='briscola')assert.equal(restored.state.players[1-turn].hand,undefined);
    await assert.rejects(()=>friendly(server,'state',{code:host.state.code},'forged'),{status:401});
  }
});
test('concurrent duplicate moves across two servers apply once and reject stale version',async t=>{
  const {repository}=await database(t),one=createPersistentGameService({repository,game:'forza4'}),two=createPersistentGameService({repository,game:'forza4'});
  const host=await friendly(one,'create',{name:'Alice'}),guest=await friendly(one,'join',{name:'Bob',code:host.state.code});
  const token=[host.token,guest.token][guest.state.turn],body={code:host.state.code,column:3,version:guest.state.version,matchId:guest.state.matchId};
  const requests=await Promise.all([one.forRequest(),two.forRequest()]);
  const results=await Promise.allSettled(requests.map(request=>request.execute('play',body,token)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
  const saved=await friendly(two,'state',{code:host.state.code},token);
  assert.equal(saved.state.board.flat().filter(v=>v!==null).length,1);
});
test('a failed database write never acknowledges or preserves an unsaved move',async t=>{
  const {repository}=await database(t);let fail=false;
  const flaky={...repository,async commit(...args){if(fail)throw Object.assign(Error('offline'),{status:503});return repository.commit(...args);}};
  const server=createPersistentGameService({repository:flaky,game:'forza4'});
  const host=await friendly(server,'create',{name:'Alice'}),guest=await friendly(server,'join',{name:'Bob',code:host.state.code});
  const token=[host.token,guest.token][guest.state.turn];fail=true;
  await assert.rejects(()=>friendly(server,'play',{code:host.state.code,column:0,version:guest.state.version},token),{status:503});
  fail=false;const restored=await friendly(server,'state',{code:host.state.code},token);
  assert.equal(restored.state.version,guest.state.version);assert.equal(restored.state.board.flat().filter(v=>v!==null).length,0);
});
test('ranked queue, ready votes and active match survive server restarts',async t=>{
  const {repository}=await database(t);let service=createPersistentRankedService({repository});
  await service.execute('queue',{game:'forza4',name:'Alice'},alice);
  service=createPersistentRankedService({repository});assert.equal((await service.execute('status',{game:'forza4'},alice)).phase,'searching');
  const found=await service.execute('queue',{game:'forza4',name:'Bob'},bob);
  await service.execute('ready',{game:'forza4',matchId:found.matchId},alice);
  service=createPersistentRankedService({repository});assert.equal((await service.execute('status',{game:'forza4'},alice)).ready,true);
  const playing=await service.execute('ready',{game:'forza4',matchId:found.matchId},bob);
  service=createPersistentRankedService({repository});const restored=await service.execute('state',{game:'forza4',code:playing.state.code},bob);
  assert.deepEqual(restored,playing);
});
test('complete ranked Forza4 saves checkpoint, history and both Elo atomically',async t=>{
  const {db,repository}=await database(t);let service=createPersistentRankedService({repository}),result=await match(service);const winner=result.state.turn;
  for(const column of [0,1,0,1,0,1,0]){
    service=createPersistentRankedService({repository});
    result=await service.execute('play',{game:'forza4',code:result.state.code,column,version:result.state.version,matchId:result.state.matchId},[alice,bob][result.state.turn]);
  }
  assert.equal(result.state.status,'finished');assert.equal(result.state.winner,winner);
  const board=await service.execute('leaderboard',{game:'forza4'},[alice,bob][winner]);
  assert.equal(board.profile.elo,1016);assert.equal(board.rows.length,2);assert.ok(board.rows.every(row=>!('user_id' in row)));
  const history=await db.query('select * from verona_private.game_results');assert.equal(history.rows.length,1);
  for(let i=0;i<3;i++)await service.execute('state',{game:'forza4',code:result.state.code},alice);
  assert.equal((await db.query('select games from verona_private.game_ratings')).rows.reduce((n,r)=>n+r.games,0),2);
});
test('Briscola deck and private hands resume after every move and total 120 points',async t=>{
  const {repository}=await database(t);let service=createPersistentRankedService({repository,trickPauseMs:0}),result=await match(service,'briscola');
  while(result.state.status!=='finished'){
    service=createPersistentRankedService({repository,trickPauseMs:0});const user=[alice,bob][result.state.turn];
    const own=(await service.execute('state',{game:'briscola',code:result.state.code},user)).state;
    result=await service.execute('play',{game:'briscola',code:own.code,card:own.players[own.seat].hand[0].id,version:own.version,matchId:own.matchId},user);
  }
  assert.equal(result.state.players.reduce((n,p)=>n+p.score,0),120);
  assert.equal((await service.execute('leaderboard',{game:'briscola'},alice)).profile.games,1);
});
test('database rejects mismatched Elo and rolls back checkpoint, profile and history',async t=>{
  const {db,repository}=await database(t);
  const before=await repository.load('ranked');
  const result={matchId:'a'.repeat(32),game:'forza4',players:[{...alice,name:'Alice'},{...bob,name:'Bob'}],winner:0,reason:'completed',now:1000,changes:[{before:1000,after:1016,delta:16},{before:1100,after:1084,delta:-16}]};
  await assert.rejects(()=>repository.commit('ranked',before.revision,{test:true},[result]),/Rating conflict/);
  assert.deepEqual(await repository.load('ranked'),before);
  assert.equal((await db.query('select count(*) from verona_private.player_profiles')).rows[0].count,0);
});
test('expired turn is finalized after restart and stale play cannot erase the timeout',async t=>{
  const {db,repository}=await database(t);let time=1000;
  let service=createPersistentRankedService({repository,now:()=>time}),result=await match(service),turn=result.state.turn;
  time+=91000;service=createPersistentRankedService({repository,now:()=>time});
  await assert.rejects(()=>service.execute('play',{game:'forza4',code:result.state.code,version:result.state.version,column:0},[alice,bob][turn]),{status:409});
  const restored=await service.execute('state',{game:'forza4',code:result.state.code},alice);
  assert.equal(restored.state.winner,1-turn);assert.equal(restored.state.ranked.reason,'timeout');
  assert.equal((await db.query('select count(*) from verona_private.game_results')).rows[0].count,1);
});
test('database outage during a final move rolls back victory and both ratings until a retry',async t=>{
  const {db,repository}=await database(t);let offline=false;
  const flaky={...repository,async commit(...args){if(offline)throw Object.assign(Error('offline'),{status:503});return repository.commit(...args);}};
  let service=createPersistentRankedService({repository:flaky}),result=await match(service);
  for(const column of [0,1,0,1,0,1])result=await service.execute('play',{game:'forza4',code:result.state.code,column,version:result.state.version},[alice,bob][result.state.turn]);
  const move={game:'forza4',code:result.state.code,column:0,version:result.state.version},user=[alice,bob][result.state.turn];offline=true;
  await assert.rejects(()=>service.execute('play',move,user),{status:503});
  assert.equal((await db.query('select count(*) from verona_private.game_results')).rows[0].count,0);
  assert.equal((await db.query('select count(*) from verona_private.game_ratings')).rows[0].count,0);
  offline=false;service=createPersistentRankedService({repository:flaky});
  const won=await service.execute('play',move,user);assert.equal(won.state.status,'finished');
  assert.equal((await db.query('select count(*) from verona_private.game_results')).rows[0].count,1);
});
test('opening leaderboard after a deadline returns the newly committed Elo immediately',async t=>{
  const {repository}=await database(t);let time=1000;
  let service=createPersistentRankedService({repository,now:()=>time});const playing=await match(service),winner=1-playing.state.turn;
  time+=91000;service=createPersistentRankedService({repository,now:()=>time});
  const board=await service.execute('leaderboard',{game:'forza4'},[alice,bob][winner]);
  assert.equal(board.profile.elo,1016);assert.equal(board.profile.games,1);assert.equal(board.rows[0].elo,1016);
});
test('HTTP handlers await remote commits and successful REST RPC uses the SQL contract',async t=>{
  const {db}=await database(t);const calls=[];
  const repository=createSupabaseGameRepository({url:'https://test.supabase.co',key:'sb_secret_test_backend',fetchImpl:async(url,options)=>{
    calls.push(url);const body=JSON.parse(options.body),load=url.endsWith('/verona_games_load');
    const query=load?'select public.verona_games_load($1,$2,$3) as value':'select public.verona_games_commit($1,$2,$3,$4) as value';
    const params=load?[body.p_key,body.p_user,body.p_game]:[body.p_key,body.p_revision,JSON.stringify(body.p_state),JSON.stringify(body.p_results)];
    const value=(await db.query(query,params)).rows[0].value;return{ok:true,json:async()=>value};
  }});
  const friendlyHandler=createGameHandler({game:'forza4',service:createPersistentGameService({repository,game:'forza4'})});
  const rankedHandler=createRankedHandler({service:createPersistentRankedService({repository}),verify:async token=>{assert.equal(token,'signed');return alice;}});
  const server=createServer(async(req,res)=>{if(await rankedHandler(req,res))return;if(await friendlyHandler(req,res))return;res.writeHead(404).end();});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  const created=await fetch(base+'/api/forza4/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Alice'})});
  assert.equal(created.status,200);const room=await created.json();assert.equal(room.state.status,'waiting');
  const queued=await fetch(base+'/api/ranked/queue',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer signed'},body:JSON.stringify({game:'forza4',name:'Alice'})});
  assert.equal(queued.status,200);assert.equal((await queued.json()).phase,'searching');
  assert.ok(calls.some(url=>url.endsWith('/verona_games_load')));assert.ok(calls.some(url=>url.endsWith('/verona_games_commit')));
});
test('repository uses backend secret only and sanitizes database failures',async()=>{
  const calls=[];const repository=createSupabaseGameRepository({url:'https://test.supabase.co',key:'sb_secret_backend_only',fetchImpl:async(url,options)=>{calls.push({url,options});return{ok:false,json:async()=>({message:'sensitive db message'})};}});
  await assert.rejects(()=>repository.load('ranked'),error=>error.status===503&&!error.message.includes('sensitive'));
  assert.equal(calls[0].options.headers.apikey,'sb_secret_backend_only');assert.equal(calls[0].options.redirect,'error');
  assert.throws(()=>createSupabaseGameRepository({url:'https://test.supabase.co',key:'sb_publishable_wrong'}));
  assert.throws(()=>createSupabaseGameRepository({url:'http://test.supabase.co',key:'sb_secret_wrong'}));
});
