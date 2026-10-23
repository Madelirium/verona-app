import {readFile,writeFile,mkdir,rename,unlink,open} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const runIdPattern=/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/;
export async function readJSON(path){
  try{return JSON.parse(await readFile(path,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}
}
export async function atomicJSON(path,value){
  await mkdir(dirname(path),{recursive:true});
  const temporary=path+'.'+randomUUID()+'.tmp';
  try{await writeFile(temporary,JSON.stringify(value,null,2)+'\n',{flag:'wx'});await rename(temporary,path);}
  finally{await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
}

export async function withJobLock(root,action){
  await mkdir(root,{recursive:true});const path=join(root,'job.lock');
  let lock;
  try{lock=await open(path,'wx');}catch(error){
    if(error.code!=='EEXIST')throw error;
    const previous=await readJSON(path);
    if(!Number.isInteger(previous?.pid)||previous.pid<=0)throw new Error('Blocco del lavoro non valido: controllare job.lock');
    let alive=true;try{process.kill(previous.pid,0);}catch(probe){if(probe.code==='ESRCH')alive=false;else throw probe;}
    if(alive)throw new Error('Raccolta già in esecuzione: lo stesso lavoro non può partire due volte');
    await unlink(path);lock=await open(path,'wx');
  }
  try{await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));return await action();}
  finally{await lock.close();await unlink(path);}
}

export async function checkpoint(root,identity,{resume=false}={}){
  const path=join(root,'checkpoint.json'),previous=await readJSON(path);
  const fingerprint=digest(identity);
  if(resume&&!previous)throw new Error('Checkpoint da riprendere non trovato');
  if(previous&&previous.fingerprint!==fingerprint)throw new Error('Il checkpoint appartiene a parametri o manifest diversi');
  if(previous&&!resume)throw new Error('Lavoro già esistente: usare --resume oppure creare una nuova esecuzione');
  const state=previous??{schemaVersion:1,fingerprint,identity,createdAt:new Date().toISOString(),completed:{}};
  async function save(){state.updatedAt=new Date().toISOString();await atomicJSON(path,state);}
  await save();
  return {state,async put(key,value){state.completed[key]=value;await save();}};
}

function requestIdentity(url,options){
  const endpoint=new URL(url);
  if(endpoint.origin!=='https://www.mycicero.it'||endpoint.pathname!=='/OTPProxy/host.ashx')throw new Error('Fonte cache non consentita');
  const method=endpoint.searchParams.get('url');
  if(!['momoservice/json/GetArriviPartenzePalina2','momoservice/json/GetFermateCorsa2'].includes(method))throw new Error('Metodo cache non consentito');
  const payload=JSON.parse(options.body);delete payload.SecurityToken;
  const headers=new Headers(options.headers);
  return {version:1,url,method:options.method,client:headers.get('Client'),culture:headers.get('Culture'),payload};
}
function validResponse(data,identity){
  const object=data?.Oggetto,payload=identity.payload;
  return data?.Tipo===0&&data?.StatusCode===200&&(identity.url.endsWith('GetFermateCorsa2')?
    Array.isArray(object?.Fermate)&&object.Fermate.length>0&&(object.Corsa?.ID_Corsa??object.Corsa?.Codice)===payload.IdCorsa:
    Array.isArray(object?.Passaggi)&&String(object.Fermata?.Codice)===payload.CodFermata);
}

// Import old raw responses without pretending they were freshly fetched.
export async function importPublicResponse(root,url,options,data,{collectedAt,source}={}){
  if(!Number.isFinite(Date.parse(collectedAt))||!source)throw new Error('Data e provenienza richieste per importare la cache');
  const identity=requestIdentity(url,options),key=digest(identity),path=join(root,key+'.json');
  if(!validResponse(data,identity))throw new Error('Risposta da importare non valida');
  const previous=await readJSON(path);
  if(previous&&Date.parse(previous.collectedAt)>=Date.parse(collectedAt))return false;
  await atomicJSON(path,{key,identity,collectedAt,importedAt:new Date().toISOString(),importedFrom:source,dataHash:digest(data),data});return true;
}

// Request identities omit the public token, which changes every minute.
// Independent stop scans MUST use separate directories; trip data can be shared.
export function cachedPublicFetcher(root,{fetcher=fetch,delayMs=1500,refresh=false,freshSince=null,rateState={lastRequest:0}}={}){
  const stats={network:0,hits:0,saved:0};
  const refreshed=new Set();let tail=Promise.resolve();
  async function execute(url,options){
    const identity=requestIdentity(url,options);
    const key=digest(identity),path=join(root,key+'.json');
    const cached=await readJSON(path);
    if(cached&&(!refresh||refreshed.has(key)||(freshSince&&Date.parse(cached.collectedAt)>=Date.parse(freshSince)))){
      if(cached.key!==key||digest(cached.identity)!==key||digest(cached.data)!==cached.dataHash)throw new Error('Cache non integra: '+key);
      stats.hits++;return new Response(JSON.stringify(cached.data),{status:200,headers:{'Content-Type':'application/json'}});
    }
    const wait=Math.max(0,delayMs-(Date.now()-rateState.lastRequest));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
    rateState.lastRequest=Date.now();stats.network++;
    const response=await fetcher(url,options);
    if(response.ok){
      const data=await response.clone().json();
      if(validResponse(data,identity)){await atomicJSON(path,{key,identity,collectedAt:new Date().toISOString(),dataHash:digest(data),data});stats.saved++;refreshed.add(key);}
    }
    return response;
  }
  const wrapped=(url,options)=>{
    const result=tail.then(()=>execute(url,options));tail=result.catch(()=>{});return result;
  };
  wrapped.stats=stats;return wrapped;
}
