import { createServer } from 'node:http';
import { readFile,mkdir } from 'node:fs/promises';
import {loadEnvFile} from 'node:process';
import {resolve,dirname} from 'node:path';
import { networkInterfaces } from 'node:os';
import { createBriscolaHandler,createGameHandler } from './briscola.mjs';
import {createRankedHandler,createRankedService,createSupabaseVerifier} from './ranked.mjs';
import {openRankedStore} from './ranked-store.mjs';
import {createSupabaseGameRepository,createPersistentGameService,createPersistentRankedService} from './game-persistence.mjs';
try{loadEnvFile(new URL('../.env',import.meta.url));}catch(error){if(error.code!=='ENOENT')throw error;}
const storage=process.env.GAME_STORAGE||'memory';
if(!['memory','supabase'].includes(storage))throw new Error('GAME_STORAGE deve essere memory o supabase.');
const repository=storage==='supabase'?createSupabaseGameRepository({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY}):null;
if(repository)await repository.load('friendly:briscola'); // Fail startup if migration/access is missing.
let rankedOptions={allowedOrigin:process.env.BRISCOLA_ALLOWED_ORIGIN};
if(process.env.RANKED_ENABLED==='true'){
  if(process.env.SUPABASE_AUTH_ENABLED!=='true'||!process.env.SUPABASE_URL||!process.env.SUPABASE_PUBLISHABLE_KEY)throw new Error('Ranked richiede login Supabase attivo.');
  let service;
  if(repository)service=createPersistentRankedService({repository});
  else{
    const file=resolve(process.env.RANKED_DB_PATH||'.local/ranked.sqlite');
    await mkdir(dirname(file),{recursive:true});
    service=createRankedService({store:await openRankedStore(file)});
  }
  rankedOptions={...rankedOptions,service,verify:createSupabaseVerifier({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_PUBLISHABLE_KEY})};
}
const ranked=createRankedHandler(rankedOptions);
const options=game=>({game,allowedOrigin:process.env.BRISCOLA_ALLOWED_ORIGIN,...(repository?{service:createPersistentGameService({repository,game})}:{})});
const briscola = createBriscolaHandler(options('briscola'));
const forza4 = createGameHandler(options('forza4'));
const lan = process.argv.includes('--lan');
const wifi = Object.entries(networkInterfaces()).filter(([name]) => /wi-?fi|wireless|wlan/i.test(name)).flatMap(([,values]) => values).find(i => i.family === 'IPv4' && !i.internal);
if (lan && !wifi) throw new Error('Nessuna interfaccia Wi-Fi IPv4 disponibile. Collegare il computer al Wi-Fi e riprovare.');
const host = process.env.HOST || (process.env.RENDER==='true'?'0.0.0.0':lan?wifi.address:'127.0.0.1');
const routes = { '/': ['public/index.html', 'text/html; charset=utf-8'], '/data/events.json': ['data/events.json', 'application/json'], '/data/import-report.json': ['data/import-report.json', 'application/json'] };
createServer(async (req,res) => {
  if(req.url==='/healthz'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({ok:true,storage}));return;}
  if(await ranked(req,res))return;
  if(await briscola(req,res))return;
  if(await forza4(req,res))return;
  const pathname=new URL(req.url,'http://localhost').pathname;
  const route = routes[pathname]||(/^\/bus-official\/[A-Za-z0-9]+\.json$/.test(pathname)?['public'+pathname,'application/json']:null)||(/^\/bus-routes\/atv-(urban|holiday|evening)-[0-9]+\.json$/.test(pathname)?['public'+pathname,'application/json']:null);
  if (!route || req.method !== 'GET') { res.writeHead(404).end(); return; }
  try { const body = await readFile(new URL('../'+route[0],import.meta.url)); res.writeHead(200, { 'Content-Type': route[1], 'Cache-Control': 'no-store' }).end(body); }
  catch { res.writeHead(503).end('Calendario temporaneamente non disponibile. Riprova tra poco.'); }
}).listen(Number(process.env.PORT || 4173), host, () => console.log(`${lan ? 'Accesso Wi-Fi' : 'Anteprima'}: http://${host}:${process.env.PORT || 4173}`));
