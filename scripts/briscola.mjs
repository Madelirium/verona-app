import { randomInt, randomBytes } from 'node:crypto';
import {dropDisc} from './forza4.mjs';

const suits = ['denari', 'coppe', 'spade', 'bastoni'];
const points = {1:11,3:10,10:4,9:3,8:2};
const strength = [2,4,5,6,7,8,9,10,3,1];
export const cardPoints = card => points[card.rank] || 0;
export function winningPlayer(cards, trump) {
  return cards.reduce((a,b)=>b.card.suit===a.card.suit
    ? (strength.indexOf(b.card.rank)>strength.indexOf(a.card.rank)?b:a)
    : (b.card.suit===trump?b:a)).player;
}
function fail(message, status=400) { throw Object.assign(new Error(message), {status}); }
export function createGameService({game='briscola',now=Date.now, ttl=30*60*1000, maxRooms=1000,trickPauseMs=1200,initialState}={}) {
  if(!['briscola','forza4'].includes(game))throw new Error('Gioco sconosciuto');
  const rooms=new Map();
  for(const [code,room] of initialState||[])rooms.set(code,structuredClone(room));
  const name=value=>{if(typeof value!=='string'||!value.trim()||value.trim().length>24)fail('Inserisci un soprannome da 1 a 24 caratteri.');return value.trim();};
  function cleanup(){for(const [code,room] of rooms)if(now()-room.updatedAt>ttl)rooms.delete(code);}
  function player(n){return {name:name(n),token:randomBytes(32).toString('hex'),hand:[],score:0,seen:now()};}
  function snapshot(room, seat){
    const count=room.playerCount||2;
    const common={game,playerCount:count,matchId:room.matchId,rematch:room.rematch||Array(count).fill(false),visibility:room.visibility,code:room.code,seat,status:room.status,version:room.version};
    if(game==='forza4')return {...common,players:room.players.map(p=>({name:p.name,online:now()-p.seen<12000})),turn:room.turn,board:room.board,lastMove:room.lastMove,winningCells:room.winningCells||[],winner:room.winner};
    return {...common,teams:count===4?[0,1,0,1]:null,teamScores:count===4?[0,1].map(team=>room.players.reduce((sum,p,i)=>sum+(i%2===team?p.score:0),0)):null,winnerTeam:room.winnerTeam,winners:room.winners,players:room.players.map((p,i)=>({name:p.name,score:p.score,count:p.hand.length,online:now()-p.seen<12000,hand:i===seat?p.hand:undefined})),turn:room.turn,trump:room.trump,remaining:room.deck.length,table:room.table,lastTrick:room.lastTrick,trickWaitMs:Math.max(0,(room.nextPlayAt||0)-now()),winner:room.winner,expiresInMinutes:30};
  }
  function start(room){
    const count=room.playerCount||2;
    room.matchId=randomBytes(16).toString('hex');room.rematch=Array(count).fill(false);room.winner=undefined;room.winnerTeam=undefined;room.winners=undefined;room.table=[];room.lastTrick=null;room.trickCount=0;room.nextPlayAt=0;
    for(const p of room.players){p.hand=[];p.score=0;}
    if(game==='forza4'){room.board=Array.from({length:6},()=>Array(7).fill(null));room.lastMove=null;room.winningCells=[];room.status='playing';room.turn=randomInt(2);return;}
    const deck=suits.flatMap(suit=>Array.from({length:10},(_,i)=>({id:suit+'-'+(i+1),suit,rank:i+1}))).filter(card=>count!==3||card.id!=='denari-2');
    for(let i=deck.length-1;i>0;i--){const j=randomInt(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
    room.deck=deck;room.trump=deck[0];room.status='playing';room.turn=randomInt(count);
    for(let i=0;i<3;i++)for(const p of room.players)p.hand.push(deck.pop());
  }
  function collect(room){
    const winner=winningPlayer(room.table,room.trump.suit);
    room.players[winner].score+=room.table.reduce((n,c)=>n+cardPoints(c.card),0);
    room.lastTrick={id:++room.trickCount,cards:room.table,winner,points:room.table.reduce((sum,c)=>sum+cardPoints(c.card),0)};room.table=[];room.nextPlayAt=now()+trickPauseMs;
    for(let offset=0;offset<room.players.length;offset++)if(room.deck.length)room.players[(winner+offset)%room.players.length].hand.push(room.deck.pop());
    room.turn=winner;
    if(room.players.every(p=>!p.hand.length)){
      room.status='finished';
      if(room.players.length===4){const scores=[0,1].map(team=>room.players.reduce((sum,p,i)=>sum+(i%2===team?p.score:0),0));room.winnerTeam=scores[0]===scores[1]?null:scores[0]>scores[1]?0:1;room.winner=room.winnerTeam;room.winners=room.winnerTeam===null?[]:[room.winnerTeam,room.winnerTeam+2];}
      else{const best=Math.max(...room.players.map(p=>p.score));room.winners=room.players.map((p,i)=>p.score===best?i:null).filter(i=>i!==null);room.winner=room.winners.length===1?room.winners[0]:null;}
    }
  }
  return {
    exportState(){return structuredClone([...rooms]);},
    identify(body,token){const room=rooms.get(String(body.code||'').toUpperCase());if(!room||!token||now()-room.updatedAt>ttl)return null;const seat=room.players.findIndex(p=>p.token===token);return seat<0?null:room.code+':'+seat;},
    execute(action, body={}, token=''){
      cleanup();
      if(action==='list'){
        const available=[...rooms.values()].filter(room=>room.visibility==='public'&&room.status==='waiting'&&now()-room.players[0].seen<12000).sort((a,b)=>b.createdAt-a.createdAt);
        return {game,total:available.length,rooms:available.slice(0,100).map(room=>({code:room.code,hostName:room.players[0].name,game,createdAt:room.createdAt,playerCount:room.playerCount||2,occupied:room.players.length,available:(room.playerCount||2)-room.players.length}))};
      }
      if(action==='create'){
        const visibility=body.visibility??'private';
        if(!['private','public'].includes(visibility))fail('Scegli una stanza privata o pubblica.');
        const playerCount=body.playerCount??2;
        if(!Number.isInteger(playerCount)||!(game==='briscola'?[2,3,4]:[2]).includes(playerCount))fail(game==='briscola'?'Scegli 2, 3 o 4 giocatori.':'Forza 4 richiede due giocatori.');
        if(rooms.size>=maxRooms)fail('Troppe stanze attive. Riprova più tardi.',503);
        let code;do{code=Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');}while(rooms.has(code));
        const p=player(body.name),room={code,visibility,playerCount,createdAt:now(),players:[p],status:'waiting',deck:[],table:[],board:Array.from({length:6},()=>Array(7).fill(null)),lastTrick:null,version:0,updatedAt:now()};rooms.set(code,room);
        return {token:p.token,state:snapshot(room,0)};
      }
      const room=rooms.get(String(body.code||'').toUpperCase());if(!room)fail('Stanza inesistente o scaduta.',404);
      if(action==='join'){
        if(room.status!=='waiting'||room.players.length>=(room.playerCount||2))fail('La stanza è già occupata.',409);
        if((room.playerCount||2)>2&&body.clientVersion!==2)fail('Aggiorna l’app per entrare in un tavolo a tre o quattro giocatori.',409);
        const p=player(body.name);room.players.push(p);if(room.players.length===(room.playerCount||2))start(room);room.version++;room.updatedAt=now();return {token:p.token,state:snapshot(room,room.players.length-1)};
      }
      const seat=room.players.findIndex(p=>p.token===token);if(seat<0)fail('Accesso alla partita non valido.',401);
      if(action==='leave'){rooms.delete(room.code);return {left:true};}
      if(action==='rematch'){
        if(room.status!=='finished'||body.matchId!==room.matchId)fail('Questa partita non è più disponibile per la rivincita.',409);
        if(typeof body.accept!=='boolean')fail('Conferma o annulla la rivincita.');
        room.rematch[seat]=body.accept;
        if(room.rematch.every(Boolean))start(room);
        room.version++;
      }else if(action==='play'){
        if(room.status!=='playing'||room.turn!==seat)fail('Attendi il tuo turno.',409);
        if(body.version!==room.version)fail('La partita è cambiata. Attendi l’aggiornamento.',409);
        if(body.matchId&&body.matchId!==room.matchId)fail('La partita è cambiata. Attendi l’aggiornamento.',409);
        if(game==='briscola'&&now()<room.nextPlayAt)fail('La presa è conclusa: attendi un momento per leggerla.',409);
        if(game==='forza4')dropDisc(room,body.column);
        else {
        const index=room.players[seat].hand.findIndex(c=>c.id===body.card);if(index<0)fail('Carta non disponibile.');
        room.table.push({player:seat,card:room.players[seat].hand.splice(index,1)[0]});
        if(room.table.length===room.players.length)collect(room);else room.turn=(seat+1)%room.players.length;
        }
        room.version++;
      }else if(action!=='state')fail('Azione sconosciuta.',404);
      room.players[seat].seen=now();room.updatedAt=now();return {state:snapshot(room,seat)};
    }
  };
}

export function createBriscolaService(options={}){return createGameService({...options,game:'briscola'});}
export function createBriscolaHandler(options={}){return createGameHandler({...options,game:'briscola'});}
export function createGameHandler(options={}) {
  const service=options.service||createGameService(options), limits=new Map();
  return async (req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(!pathname.startsWith('/api/'+(options.game||'briscola')+'/'))return false;
    const origin=req.headers.origin;
    const sameOrigin=origin===`http://${req.headers.host}`||origin===`https://${req.headers.host}`;
    if(origin&&!sameOrigin&&origin!==options.allowedOrigin){res.writeHead(403).end();return true;}
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
    if(origin)headers['Access-Control-Allow-Origin']=origin;
    if(req.method==='OPTIONS'){res.writeHead(204,{...headers,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600'}).end();return true;}
    try{
      if(req.method!=='POST')fail('Metodo non consentito.',405);
      let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>2048)fail('Richiesta troppo grande.',413);}
      let body;try{body=JSON.parse(raw||'{}');}catch{fail('Richiesta non valida.');}
      if(!body||Array.isArray(body)||typeof body!=='object')fail('Richiesta non valida.');
      const requestService=service.forRequest?await service.forRequest():service;
      const action=pathname.split('/').at(-1),token=(req.headers.authorization||'').replace(/^Bearer /,''),identity=await requestService.identify(body,token);
      const time=Date.now(),bucket=identity?'player:'+identity:'anonymous:'+req.socket.remoteAddress;
      for(const [key,value] of limits)if(time-value.time>60000)limits.delete(key);
      const limit=limits.get(bucket)||{time,count:0};limits.set(bucket,limit);if(++limit.count>(identity?300:240))fail('Troppe richieste. Attendi un minuto.',429);
      const result=await requestService.execute(action,body,token);
      if(['create','join','play','rematch','leave'].includes(action))options.onChange?.({mode:'friendly',game:options.game||'briscola',code:result.state?.code||body.code,token});
      res.writeHead(200,headers).end(JSON.stringify(result));
    }catch(error){res.writeHead(error.status||500,headers).end(JSON.stringify({error:error.status?error.message:'Servizio temporaneamente non disponibile.'}));}
    return true;
  };
}
