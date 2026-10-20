import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createGameService,createGameHandler} from './briscola.mjs';

for(const game of ['briscola','forza4']){
  test(`${game}: solo stanze pubbliche libere e con ospite collegato, senza dati privati`,()=>{
    let time=0;const service=createGameService({game,now:()=>time});
    const privateRoom=service.execute('create',{name:'Privato'});
    assert.equal(privateRoom.state.visibility,'private');
    assert.deepEqual(service.execute('list').rooms,[]);
    const a=service.execute('create',{name:'Anna',visibility:'public'});
    time=1;const b=service.execute('create',{name:'Luca',visibility:'public'});
    const list=service.execute('list');
    assert.equal(list.total,2);assert.deepEqual(list.rooms.map(r=>r.hostName),['Luca','Anna']);
    assert.equal(list.rooms[0].game,game);
    assert.deepEqual(Object.keys(list.rooms[0]).sort(),['code','createdAt','game','hostName']);
    const json=JSON.stringify(list);assert.ok(!json.includes(a.token));assert.ok(!json.includes(privateRoom.state.code));assert.ok(!json.includes('hand'));
    time=12002;assert.equal(service.execute('list').total,0);
    service.execute('state',{code:a.state.code},a.token);assert.equal(service.execute('list').total,1);
    service.execute('join',{code:a.state.code,name:'Ospite'});assert.equal(service.execute('list').total,0);
    service.execute('state',{code:b.state.code},b.token);assert.equal(service.execute('list').total,1);
    service.execute('leave',{code:b.state.code},b.token);assert.equal(service.execute('list').total,0);
    assert.throws(()=>service.execute('create',{name:'Anna',visibility:'other'}),/privata o pubblica/);
    // Le stanze private restano raggiungibili con il codice.
    assert.equal(service.execute('join',{code:privateRoom.state.code,name:'Invitato'}).state.status,'playing');
  });
  test(`${game}: leggere l'elenco non prolunga la vita della stanza`,()=>{
    let time=0;const service=createGameService({game,now:()=>time,ttl:1000});
    const created=service.execute('create',{name:'Anna',visibility:'public'});
    time=800;assert.equal(service.execute('list').total,1);
    time=1001;assert.equal(service.execute('list').total,0);
    assert.throws(()=>service.execute('state',{code:created.state.code},created.token),/scaduta/);
  });
}
test('Elenco limitato a 100 stanze e conteggio totale esplicito',()=>{
  const service=createGameService();
  for(let i=0;i<105;i++)service.execute('create',{name:'Ospite '+i,visibility:'public'});
  const result=service.execute('list');assert.equal(result.total,105);assert.equal(result.rooms.length,100);
});
test('API: elenco senza account e ingressi concorrenti ammettono una sola persona',async()=>{
  const briscola=createGameHandler(),forza4=createGameHandler({game:'forza4'});
  const server=createServer(async(req,res)=>{if(await briscola(req,res))return;await forza4(req,res);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api/`;
  const post=(game,action,body={})=>fetch(base+game+'/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try{
    for(const game of ['briscola','forza4']){
      const created=await(await post(game,'create',{name:'Anna',visibility:'public'})).json(),code=created.state.code;
      const list=await(await post(game,'list')).json();assert.equal(list.total,1);assert.equal(list.rooms[0].code,code);
      assert.equal((await(await post(game==='briscola'?'forza4':'briscola','list')).json()).total,0);
      const responses=await Promise.all(['Luca','Carlo'].map(name=>post(game,'join',{name,code})));
      assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
      assert.equal((await(await post(game,'list')).json()).total,0);
    }
  }finally{await new Promise(resolve=>server.close(resolve));}
});
