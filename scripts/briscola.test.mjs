import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createBriscolaService,createBriscolaHandler,winningPlayer} from './briscola.mjs';

test('Briscola: ordine delle carte, primo seme e briscole',()=>{
  const win=(a,b,trump='denari')=>winningPlayer([{player:0,card:a},{player:1,card:b}],trump);
  assert.equal(win({rank:1,suit:'coppe'},{rank:2,suit:'denari'}),1);
  assert.equal(win({rank:3,suit:'coppe'},{rank:1,suit:'spade'}),0);
  assert.equal(win({rank:3,suit:'coppe'},{rank:1,suit:'coppe'}),1);
  assert.equal(win({rank:7,suit:'denari'},{rank:8,suit:'denari'}),1);
});
test('Partite complete: 40 carte uniche, 120 punti, mani private e rientro con token',()=>{
  for(let game=0;game<30;game++){
    const service=createBriscolaService({trickPauseMs:0});
    const a=service.execute('create',{name:'Anna'}),code=a.state.code;
    const b=service.execute('join',{name:'Luca',code});const tokens=[a.token,b.token];
    assert.throws(()=>service.execute('join',{name:'Terzo',code}),/occupata/);
    assert.throws(()=>service.execute('state',{code},'estraneo'),/non valido/);
    let state=service.execute('state',{code},a.token).state;const played=new Set();
    for(let i=0;i<40;i++){
      const seat=state.turn,token=tokens[seat];
      state=service.execute('state',{code},token).state;
      assert.equal(state.players[1-seat].hand,undefined);
      assert.ok(!JSON.stringify(state).includes(tokens[1-seat]));
      assert.throws(()=>service.execute('play',{code,version:state.version,card:'inventata'},token),/non disponibile/);
      assert.throws(()=>service.execute('play',{code,version:state.version,card:'x'},tokens[1-seat]),/turno/);
      const card=state.players[seat].hand[0].id;
      assert.ok(!played.has(card));played.add(card);
      state=service.execute('play',{code,version:state.version,card},token).state;
      if(i<39)assert.throws(()=>service.execute('play',{code,version:state.version-1,card:'x'},tokens[state.turn]),/cambiata/);
    }
    assert.equal(played.size,40);assert.equal(state.status,'finished');
    assert.equal(state.players.reduce((n,p)=>n+p.score,0),120);
    assert.equal(state.remaining,0);assert.ok(state.players.every(p=>p.count===0));
    assert.equal(service.execute('state',{code},a.token).state.status,'finished');
  }
});
test('Scadenza, nomi non validi, capienza e chiusura stanza',()=>{
  let time=0;const service=createBriscolaService({now:()=>time,ttl:100,maxRooms:1});
  assert.throws(()=>service.execute('create',{name:''}),/soprannome/);
  const {token,state:{code}}=service.execute('create',{name:'Anna'});
  assert.throws(()=>service.execute('create',{name:'Luca'}),/Troppe/);
  time=80;service.execute('state',{code},token);time=150;service.execute('state',{code},token);
  time=251;assert.throws(()=>service.execute('state',{code},token),/scaduta/);
  const next=service.execute('create',{name:'Anna'});
  service.execute('leave',{code:next.state.code},next.token);
  assert.throws(()=>service.execute('state',{code:next.state.code},next.token),/scaduta/);
});
test('API HTTP: autenticazione, CORS, JSON non valido e carte private',async()=>{
  const handler=createBriscolaHandler({allowedOrigin:'https://verona.example'});
  const server=createServer((req,res)=>handler(req,res));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/api/briscola/`;
  try{
    const post=(action,body,token,origin)=>fetch(url+action,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
    assert.equal((await post('create',{name:'Anna'},null,'https://other.example')).status,403);
    const response=await post('create',{name:'Anna'},null,'https://verona.example');
    assert.equal(response.headers.get('access-control-allow-origin'),'https://verona.example');
    const a=await response.json(),code=a.state.code;
    await post('join',{code,name:'Luca'});
    assert.equal((await post('state',{code})).status,401);
    const state=await (await post('state',{code},a.token)).json();
    assert.equal(state.state.players[0].hand.length,3);assert.equal(state.state.players[1].hand,undefined);
    assert.equal((await fetch(url+'create',{method:'POST',body:'{'})).status,400);
    assert.equal((await fetch(url+'create',{method:'POST',body:'x'.repeat(2100)})).status,413);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
