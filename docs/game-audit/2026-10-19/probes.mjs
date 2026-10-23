import {Readable} from 'node:stream';
import {createGameHandler,createGameService} from '../../../scripts/briscola.mjs';
const handler=createGameHandler();
async function call(action,body,token){
 const req=Readable.from([JSON.stringify(body)]);Object.assign(req,{url:'/api/briscola/'+action,method:'POST',headers:token?{authorization:'Bearer '+token}:{},socket:{remoteAddress:'proxy-di-prova'}});
 let status,payload;const res={writeHead(code){status=code;return this},end(raw){payload=raw?JSON.parse(raw):null;return this}};
 await handler(req,res);return {status,payload};
}
const players=[];for(let i=0;i<12;i++)players.push((await call('create',{name:'Ospite '+i})).payload);
let rejectedAt=null;for(let n=13;n<=250;n++){const player=players[(n-13)%players.length];const response=await call('state',{code:player.state.code},player.token);if(response.status===429){rejectedAt=n;break;}}
const service=createGameService({trickPauseMs:0}),a=service.execute('create',{name:'Anna'}),code=a.state.code,b=service.execute('join',{name:'Luca',code}),tokens=[a.token,b.token];let state=b.state;
function play(){const seat=state.turn;state=service.execute('state',{code},tokens[seat]).state;return service.execute('play',{code,version:state.version,card:state.players[seat].hand[0].id},tokens[seat]).state;}
state=play();state=play();const afterTrick={tableCount:state.table.length,lastTrickCards:state.lastTrick.cards.length,status:state.status};state=play();
console.log(JSON.stringify({rateLimit:{clients:12,sameProxyAddress:true,firstRejectedRequest:rejectedAt},briscola:{afterTrick,afterNextPlay:{tableCount:state.table.length,lastTrickCards:state.lastTrick.cards.length},renderedCardsAfterNextPlay:state.table.length?state.table.length:state.lastTrick.cards.length}},null,2));
