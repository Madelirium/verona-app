import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {winningCells,dropDisc} from './forza4.mjs';
import {createGameService,createGameHandler} from './briscola.mjs';

const empty=()=>Array.from({length:6},()=>Array(7).fill(null));
function game(){
  const service=createGameService({game:'forza4'}),a=service.execute('create',{name:'Anna'}),code=a.state.code;
  const b=service.execute('join',{name:'Luca',code});
  return {service,code,tokens:[a.token,b.token],state:b.state};
}
function play(g,column){const {service,code,tokens,state}=g;g.state=service.execute('play',{code,column,version:state.version},tokens[state.turn]).state;return g.state;}

test('Forza 4 rileva quattro o più pedine in tutte le direzioni e ai bordi',()=>{
  for(const positions of [
    [[5,0],[5,1],[5,2],[5,3]],[[2,6],[3,6],[4,6],[5,6]],
    [[2,0],[3,1],[4,2],[5,3]],[[5,0],[4,1],[3,2],[2,3]],
    [[0,2],[0,3],[0,4],[0,5],[0,6]]
  ])for(const player of [0,1]){
    const board=empty();for(const [r,c] of positions)board[r][c]=player;
    const [r,c]=positions[2];assert.equal(winningCells(board,r,c).length,positions.length);
  }
  const board=empty();board[5][0]=0;board[5][1]=1;board[5][2]=0;
  assert.deepEqual(winningCells(board,5,2),[]);assert.deepEqual(winningCells(board,0,0),[]);
});
test('Gravità, colonna piena, colonne non valide e turni verificati sul server',()=>{
  const g=game(),first=g.state.turn;
  assert.throws(()=>g.service.execute('play',{code:g.code,column:0,version:g.state.version},g.tokens[1-first]),/turno/);
  for(const column of [-1,7,1.2,'2',null,undefined])assert.throws(()=>play(g,column),/colonna/);
  for(let i=0;i<6;i++){play(g,0);assert.equal(g.state.board[5-i][0],i%2===0?first:1-first);}
  assert.throws(()=>play(g,0),/piena/);
  assert.equal(g.state.version,7);assert.equal(g.state.status,'playing');
  assert.throws(()=>g.service.execute('play',{code:g.code,column:1,version:0},g.tokens[g.state.turn]),/cambiata/);
});
test('Partite complete, vittoria verticale e orizzontale e stop dopo il risultato',()=>{
  for(const moves of [[0,1,0,1,0,1,0],[0,6,1,6,2,5,3]]){
    const g=game(),first=g.state.turn;for(const column of moves)play(g,column);
    assert.equal(g.state.status,'finished');assert.equal(g.state.winner,first);assert.equal(g.state.winningCells.length,4);
    assert.throws(()=>play(g,4),/turno/);
    const resumed=g.service.execute('state',{code:g.code},g.tokens[first]).state;
    assert.deepEqual(resumed.board,g.state.board);assert.equal(resumed.winner,first);
    assert.ok(!JSON.stringify(resumed).includes(g.tokens[1-first]));
  }
});
test('Pareggio dopo 42 mosse senza combinazione vincente',()=>{
  const g=game();
  for(const column of [6,1,0,6,3,5,2,2,3,6,2,3,5,4,0,0,2,2,1,1,6,1,1,4,5,5,0,4,0,3,4,2,3,4,3,6,1,6,4,5,0,5])play(g,column);
  assert.equal(g.state.status,'finished');assert.equal(g.state.winner,null);assert.deepEqual(g.state.winningCells,[]);
  assert.ok(g.state.board.flat().every(cell=>cell!==null));
});
test('Il risultato non scambia diagonali interrotte per vittorie',()=>{
  const room={board:empty(),turn:0,status:'playing'};
  for(const [r,c] of [[5,0],[4,1],[2,3]])room.board[r][c]=0;
  dropDisc(room,6);assert.equal(room.status,'playing');assert.deepEqual(room.winningCells,[]);
});
test('API Forza 4: autenticazione, inviti, isolamento dalla briscola e chiusura',async()=>{
  const four=createGameHandler({game:'forza4'}),cards=createGameHandler();
  const server=createServer(async(req,res)=>{if(await four(req,res))return;if(await cards(req,res))return;res.writeHead(404).end();});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api/`;
  const post=(game,action,body,token)=>fetch(base+game+'/'+action,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
  try{
    const a=await(await post('forza4','create',{name:'Anna'})).json(),code=a.state.code;
    assert.equal(a.state.status,'waiting');assert.equal(a.state.board.length,6);
    assert.equal((await post('briscola','state',{code},a.token)).status,404);
    assert.equal((await post('forza4','state',{code},'bad')).status,401);
    const b=await(await post('forza4','join',{code,name:'Luca'})).json();
    assert.equal((await post('forza4','join',{code,name:'Terzo'})).status,409);
    const state=b.state,tokens=[a.token,b.token];
    const moved=await(await post('forza4','play',{code,column:3,version:state.version},tokens[state.turn])).json();
    assert.equal(moved.state.lastMove.column,3);assert.equal(moved.state.board[5][3],state.turn);
    await post('forza4','leave',{code},a.token);assert.equal((await post('forza4','state',{code},b.token)).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
