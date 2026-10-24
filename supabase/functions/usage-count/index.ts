import {createHandler} from './handler.mjs';

function keys(name:string){try{return Object.values(JSON.parse(Deno.env.get(name)||'{}')).filter((key):key is string=>typeof key==='string');}catch{return [];}}
const secret=keys('SUPABASE_SECRET_KEYS')[0]||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const base=Deno.env.get('SUPABASE_URL');
Deno.serve(createHandler({
  publishableKeys:keys('SUPABASE_PUBLISHABLE_KEYS'),
  record:async(section:string,action:string)=>{
    if(!base||!secret)throw Error('Collector unavailable');
    const headers:Record<string,string>={apikey:secret,'Content-Type':'application/json'};
    // Legacy fallback is server-only; modern keys must not be sent as Bearer JWTs.
    if(!secret.startsWith('sb_secret_'))headers.Authorization=`Bearer ${secret}`;
    const response=await fetch(`${base}/rest/v1/rpc/record_usage_count`,{method:'POST',headers,body:JSON.stringify({p_section:section,p_action:action}),signal:AbortSignal.timeout(4000)});
    if(!response.ok)throw Error('Counter unavailable');
    return await response.json()===true;
  }
}));
