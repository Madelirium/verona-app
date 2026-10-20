import {Readable} from 'node:stream';
import {WebSocketServer,WebSocket} from 'ws';

// Only room invalidations travel here. Cards, tokens and results never get broadcast.
// The existing state handler authenticates each subscription with the same rules as HTTP.
export function createGameUpdates({allowedOrigin,maxConnections=2048,maxPerIp=64}={}){
  const wss=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
  let revision=0;
  const scope=(mode,game,code)=>[mode,game,code].join(':');
  const send=(ws,data)=>{try{if(ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>8192)ws.terminate();else ws.send(JSON.stringify(data));}}catch{ws.terminate();}};
  function publish({mode='friendly',game,code,token}){
    if(!code)return;
    revision++;
    for(const ws of wss.clients)if(ws.scope===scope(mode,game,code)&&ws.token!==token)send(ws,{type:'changed'});
  }
  function attach(server,handlers){
    server.on('upgrade',(req,socket,head)=>{
      const origin=req.headers.origin,sameOrigin=origin===`https://${req.headers.host}`||origin===`http://${req.headers.host}`;
      if(req.url!=='/api/games/updates'||(origin&&!sameOrigin&&origin!==allowedOrigin)){
        socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;
      }
      const ip=req.socket.remoteAddress;
      if(wss.clients.size>=maxConnections||[...wss.clients].filter(ws=>ws.ip===ip).length>=maxPerIp){socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');return;}
      wss.handleUpgrade(req,socket,head,ws=>{
        ws.ip=ip;ws.alive=true;
        const timeout=setTimeout(()=>ws.close(1008,'Subscription required'),20000);timeout.unref();
        const expiry=setTimeout(()=>ws.close(1000,'Renew subscription'),300000);expiry.unref();
        ws.on('error',()=>{});
        ws.on('pong',()=>{ws.alive=true;});
        ws.on('close',()=>{clearTimeout(timeout);clearTimeout(expiry);ws.token=null;});
        let received=false;
        ws.on('message',async(raw,binary)=>{
          if(received||binary){ws.close(1008,'Invalid subscription');return;}received=true;
          try{
            const data=JSON.parse(raw.toString());
            if(!['friendly','ranked'].includes(data.mode)||!['briscola','forza4'].includes(data.game)||!/^[A-Z2-9]{6}$/.test(data.code)||typeof data.token!=='string'||data.token.length>7000)throw Error();
            const handler=handlers[data.mode==='ranked'?'ranked':data.game];
            const check=Readable.from([JSON.stringify({game:data.game,code:data.code})]);
            Object.assign(check,{method:'POST',url:'/api/'+(data.mode==='ranked'?'ranked':data.game)+'/state',headers:{...req.headers,authorization:'Bearer '+data.token},socket:req.socket});
            let status=500;const before=revision;
            await handler(check,{writeHead(code){status=code;return this;},end(){return this;}});
            if(status!==200){send(ws,{type:'rejected'});ws.close(1008,'Access denied');return;}
            if(ws.readyState!==WebSocket.OPEN)return;
            ws.scope=scope(data.mode,data.game,data.code);ws.token=data.token;clearTimeout(timeout);
            send(ws,{type:'ready'});
            if(before!==revision)send(ws,{type:'changed'});
          }catch{ws.close(1008,'Invalid subscription');}
        });
      });
    });
  }
  const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},30000);heartbeat.unref();
  function close(){clearInterval(heartbeat);for(const ws of wss.clients)ws.terminate();wss.close();}
  return{attach,publish,close};
}
