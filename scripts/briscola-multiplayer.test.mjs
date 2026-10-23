import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameService,winningPlayer} from './briscola.mjs';

test('Una presa a tre o quattro considera tutte le carte, il primo seme e la briscola',()=>{
  const cards=[{player:2,card:{suit:'coppe',rank:3}},{player:3,card:{suit:'spade',rank:1}},{player:0,card:{suit:'coppe',rank:1}},{player:1,card:{suit:'denari',rank:2}}];
  assert.equal(winningPlayer(cards.slice(0,3),'bastoni'),0);
  assert.equal(winningPlayer(cards,'denari'),1);
  cards[2].card={suit:'denari',rank:3};assert.equal(winningPlayer(cards,'denari'),0);
});

for(const count of [3,4])test(`Briscola in ${count}: posti, partita completa, carte private, pesca e rivincita unanime`,()=>{
  for(let round=0;round<15;round++){
    const service=createGameService({trickPauseMs:0}),first=service.execute('create',{name:'Alice',playerCount:count,visibility:'public'}),code=first.state.code,tokens=[first.token];
    let state=first.state;assert.equal(state.playerCount,count);assert.equal(state.status,'waiting');
    for(let seat=1;seat<count;seat++){
      const rooms=service.execute('list').rooms;assert.equal(rooms[0].available,count-seat);assert.equal(rooms[0].occupied,seat);assert.equal(rooms[0].playerCount,count);
      const joined=service.execute('join',{clientVersion:2,code,name:'Player '+seat});tokens.push(joined.token);state=joined.state;
      assert.equal(state.seat,seat);assert.equal(state.status,seat===count-1?'playing':'waiting');
      if(seat<count-1)assert.ok(state.players.every(p=>p.count===0));
    }
    assert.equal(service.execute('list').total,0);assert.throws(()=>service.execute('join',{clientVersion:2,code,name:'Extra'}),/occupata/);
    const played=new Set(),total=count===3?39:40;
    for(let turn=0;turn<total;turn++){
      const seat=state.turn;state=service.execute('state',{code},tokens[seat]).state;
      for(let other=0;other<count;other++)if(other!==seat){assert.equal(state.players[other].hand,undefined);assert.ok(!JSON.stringify(state).includes(tokens[other]));}
      const card=state.players[seat].hand[0];assert.ok(!played.has(card.id));played.add(card.id);
      const trick=state.table.length,deck=state.remaining;
      state=service.execute('play',{code,card:card.id,version:state.version,matchId:state.matchId},tokens[seat]).state;
      if(trick<count-1){assert.equal(state.turn,(seat+1)%count);assert.equal(state.table.length,trick+1);assert.equal(state.remaining,deck);}
      else{assert.equal(state.table.length,0);assert.equal(state.lastTrick.cards.length,count);assert.equal(state.turn,state.lastTrick.winner);assert.equal(state.remaining,Math.max(0,deck-count));}
    }
    assert.equal(played.size,total);assert.equal(played.has('denari-2'),count!==3);assert.equal(state.status,'finished');assert.equal(state.remaining,0);
    assert.equal(state.players.reduce((sum,p)=>sum+p.score,0),120);assert.ok(state.players.every(p=>p.count===0));
    if(count===4){assert.deepEqual(state.teams,[0,1,0,1]);assert.deepEqual(state.teamScores,[state.players[0].score+state.players[2].score,state.players[1].score+state.players[3].score]);assert.equal(state.winnerTeam,state.teamScores[0]===60?null:state.teamScores[0]>60?0:1);}
    else{const top=Math.max(...state.players.map(p=>p.score));assert.ok(state.winners.every(seat=>state.players[seat].score===top));assert.equal(state.winner,state.winners.length===1?state.winners[0]:null);}
    const matchId=state.matchId;
    for(let seat=0;seat<count;seat++){state=service.execute('rematch',{code,matchId,accept:true},tokens[seat]).state;assert.equal(state.status,seat===count-1?'playing':'finished');}
    assert.notEqual(state.matchId,matchId);assert.deepEqual(state.rematch,Array(count).fill(false));
    const restored=createGameService({initialState:service.exportState()});for(let seat=0;seat<count;seat++)assert.equal(restored.execute('state',{code},tokens[seat]).state.players[seat].hand.length,3);
    restored.execute('leave',{code},tokens.at(-1));assert.throws(()=>restored.execute('state',{code},tokens[0]),/scaduta/);
  }
});

test('Capienza non valida rifiutata e vecchi checkpoint senza playerCount restano a due',()=>{
  const service=createGameService();for(const value of [0,1,5,'3',null,2.5])if(value!==null)assert.throws(()=>service.execute('create',{name:'Alice',playerCount:value}),/2, 3 o 4/);
  assert.throws(()=>createGameService({game:'forza4'}).execute('create',{name:'Alice',playerCount:4}),/due giocatori/);
  const first=service.execute('create',{name:'Alice'}),saved=service.exportState();delete saved[0][1].playerCount;
  const restored=createGameService({initialState:saved}),joined=restored.execute('join',{clientVersion:2,name:'Bob',code:first.state.code});assert.equal(joined.state.playerCount,2);assert.equal(joined.state.status,'playing');
});

test('Tre giocatori: parità al primo posto senza dichiarare un vincitore arbitrario',()=>{
  const service=createGameService({trickPauseMs:0}),first=service.execute('create',{name:'Alice',playerCount:3});service.execute('join',{clientVersion:2,code:first.state.code,name:'Bob'});service.execute('join',{clientVersion:2,code:first.state.code,name:'Carla'});
  const saved=service.exportState(),room=saved[0][1];room.deck=[];room.turn=0;room.trump={id:'denari-1',suit:'denari',rank:1};
  room.players.forEach((p,i)=>{p.score=40;p.hand=[{id:'coppe-'+(i+4),suit:'coppe',rank:i+4}];});const restored=createGameService({trickPauseMs:0,initialState:saved});
  for(let i=0;i<3;i++){const state=restored.execute('state',{code:room.code},room.players[i].token).state;restored.execute('play',{code:room.code,version:state.version,card:'coppe-'+(i+4)},room.players[i].token);}
  const state=restored.execute('state',{code:room.code},first.token).state;assert.equal(state.winner,null);assert.deepEqual(state.winners,[0,1,2]);
});

test('I client precedenti ricevono un invito ad aggiornare senza occupare un posto multiplayer',()=>{
 const service=createGameService(),room=service.execute('create',{name:'Alice',playerCount:4});
 assert.throws(()=>service.execute('join',{code:room.state.code,name:'Vecchia app'}),/Aggiorna l’app/);
 assert.equal(service.execute('state',{code:room.state.code},room.token).state.players.length,1);
});
