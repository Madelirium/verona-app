import {loadEnvFile} from 'node:process';
import {createSupabaseGameRepository} from './game-persistence.mjs';
try{loadEnvFile(new URL('../.env',import.meta.url));}catch(error){if(error.code!=='ENOENT')throw error;}
try{
  const repository=createSupabaseGameRepository({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY});
  for(const key of ['friendly:briscola','friendly:forza4','ranked']){
    const loaded=await repository.load(key);
    if(!Number.isInteger(loaded.revision)||loaded.revision<0)throw Error('Checkpoint non valido.');
  }
  if(!process.env.SUPABASE_PUBLISHABLE_KEY)throw Error('Configurare la chiave publishable per verificare i permessi del browser.');
  const response=await fetch(new URL('/rest/v1/rpc/verona_games_load',process.env.SUPABASE_URL),{method:'POST',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_key:'ranked'}),signal:AbortSignal.timeout(8000),redirect:'error'});
  if(![401,403,404].includes(response.status))throw Error('Controllare i permessi: il ruolo pubblico non deve accedere ai checkpoint.');
  console.log('Supabase pronto: tre archivi raggiungibili dal backend, accesso pubblico negato. Nessun dato modificato.');
}catch(error){console.error(error.status?error.message:'Configurazione Supabase incompleta o verifica non riuscita. Controllare migrazione, URL, chiavi e permessi.');process.exitCode=1;}
