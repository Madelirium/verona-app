import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createGameService,createGameHandler} from './briscola.mjs';

function create(game,options={}){
  const service=createGameService({game,...options}),a=service.execute('create',{name:'Anna'}),code=a.state.code,b=service.execute('join',{code,name:'Luca'});
  return {service,code,tokens:[a.token,b.token],state:b.state};
}
function move(g,body){g.state=g.service.execute('play',{code:g.code,version:g.state.version,matchId:g.state.matchId,...body},g.tokens[g.state.turn]).state;}
function cardMove(g){g.state=g.service.execute('state',{code:g.code},g.tokens[g.state.turn]).state;move(g,{card:g.state.players[g.state.turn].hand[0].id});}

test('La presa resta leggibile, ha punti e identificativo e blocca solo il tempo previsto',()=>{
  let time=0;const g=create('briscola',{now:()=>time,trickPauseMs:1200});cardMove(g);cardMove(g);
  assert.equal(g.state.lastTrick.id,1);assert.equal(g.state.lastTrick.cards.length,2);assert.equal(g.state.trickWaitMs,1200);
  assert.equal(g.state.lastTrick.points,g.state.players.reduce((n,p)=>n+p.score,0));
  assert.throws(()=>cardMove(g),/attendi un momento/);time=1199;assert.throws(()=>cardMove(g),/attendi un momento/);
  time=1200;cardMove(g);assert.equal(g.state.table.length,1);assert.equal(g.state.lastTrick.id,1);
});
for(const game of ['briscola','forza4'])test(`${game}: rivincita consensuale e annullabile, stato azzerato e vecchie mosse rifiutate`,()=>{
  const g=create(game,{trickPauseMs:0});
  assert.throws(()=>g.service.execute('rematch',{code:g.code,matchId:g.state.matchId,accept:true},g.tokens[0]),/non è più disponibile/);
  if(game==='forza4')for(const column of [0,1,0,1,0,1,0])move(g,{column});else for(let i=0;i<40;i++)cardMove(g);
  assert.equal(g.state.status,'finished');const original=g.state.matchId,version=g.state.version;
  const vote=(seat,accept)=>{g.state=g.service.execute('rematch',{code:g.code,matchId:original,accept},g.tokens[seat]).state;};
  vote(0,true);assert.equal(g.state.status,'finished');assert.deepEqual(g.state.rematch,[true,false]);vote(0,false);assert.deepEqual(g.state.rematch,[false,false]);
  vote(1,true);assert.equal(g.state.status,'finished');vote(0,true);
  assert.equal(g.state.status,'playing');assert.equal(g.state.code,g.code);assert.notEqual(g.state.matchId,original);assert.ok(g.state.version>version);assert.deepEqual(g.state.rematch,[false,false]);
  assert.throws(()=>g.service.execute('rematch',{code:g.code,matchId:original,accept:true},g.tokens[1]),/non è più disponibile/);
  assert.throws(()=>g.service.execute('play',{code:g.code,version,matchId:original,column:0,card:'x'},g.tokens[g.state.turn]),/cambiata/);
  if(game==='forza4'){assert.ok(g.state.board.flat().every(cell=>cell===null));assert.deepEqual(g.state.winningCells,[]);}
  else {assert.equal(g.state.remaining,34);assert.equal(g.state.lastTrick,null);assert.equal(g.state.table.length,0);assert.ok(g.state.players.every(p=>p.score===0&&p.count===3));}
});

test('Più identità valide sullo stesso proxy non condividono la quota; token inventati restano nella quota anonima',async()=>{
  const handler=createGameHandler();
  async function call(action,body,token=''){
    const req=Readable.from([JSON.stringify(body)]);Object.assign(req,{url:'/api/briscola/'+action,method:'POST',headers:{authorization:'Bearer '+token},socket:{remoteAddress:'stesso-proxy'}});
    let status,result;const res={writeHead(code){status=code;return this;},end(raw){result=JSON.parse(raw);return this;}};await handler(req,res);return {status,result};
  }
  const players=[];for(let i=0;i<12;i++)players.push((await call('create',{name:'Ospite '+i})).result);
  for(let i=0;i<300;i++){const p=players[i%12];assert.equal((await call('state',{code:p.state.code},p.token)).status,200);}
  let limited=false;for(let i=0;i<241;i++){const response=await call('state',{code:players[0].state.code},'inventato-'+i);if(response.status===429){limited=true;break;}}
  assert.ok(limited);assert.equal((await call('state',{code:players[0].state.code},players[0].token)).status,200);
});
