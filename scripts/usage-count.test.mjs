import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createHandler} from '../supabase/functions/usage-count/handler.mjs';
import {analyticsConfig} from './analytics-config.mjs';
import {runInNewContext} from 'node:vm';

const endpoint='https://example.supabase.co/functions/v1/usage-count',key='sb_publishable_publictest';
test('Aggregate config rejects secret keys, extra URL data and unknown providers',()=>{
  const env={ANALYTICS_ENABLED:'true',ANALYTICS_PROVIDER:'supabase',ANALYTICS_SUPABASE_ENDPOINT:endpoint,ANALYTICS_SUPABASE_PUBLISHABLE_KEY:key};
  assert.equal(analyticsConfig(env).provider,'supabase');
  for(const override of [{ANALYTICS_SUPABASE_PUBLISHABLE_KEY:'sb_secret_private'},{ANALYTICS_SUPABASE_ENDPOINT:endpoint+'?token=private'},{ANALYTICS_PROVIDER:'unknown'}])assert.throws(()=>analyticsConfig({...env,...override}));
});
test('Collector only accepts authenticated, small allowlisted counters from public origins',async()=>{
  const calls=[];const handler=createHandler({publishableKeys:[key],record:async(...args)=>{calls.push(args);return true;}});
  const req=(body={section:'bus',action:'view'},headers={},method='POST')=>new Request(endpoint,{method,headers:{origin:'https://veronaintasca.it',apikey:key,'content-type':'application/json',...headers},...(method==='OPTIONS'?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
  assert.equal((await handler(req())).status,204);assert.deepEqual(calls,[['bus','view']]);
  for(const [body,headers,status]of [[{}, {},400],[{section:'bus',action:'unknown'},{},400],[{section:'bus',action:'view',email:'private'}, {},400],['{',{},400],['x'.repeat(161),{},413],[{}, {origin:'https://evil.example'},403],[{}, {apikey:'wrong'},401],[{}, {'content-type':'text/plain'},415]])assert.equal((await handler(req(body,headers))).status,status);
  assert.equal((await handler(req({}, {},'OPTIONS'))).status,204);
  assert.equal((await handler(req(undefined,{'sec-gpc':'1'}))).status,204);assert.equal(calls.length,1);
  const unavailable=createHandler({publishableKeys:[key],record:async()=>{throw Error('private details');}});
  const failure=await unavailable(req());assert.equal(failure.status,503);assert.equal(await failure.text(),'');
  assert.equal((await createHandler({publishableKeys:[key],record:async()=>false})(req())).status,429);
});
test('Private counters: atomic totals, Rome date, retention, quotas and no client read/write permissions',async t=>{
  const db=new PGlite();t.after(()=>db.close());
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(await readFile(new URL('../supabase/migrations/20261024073913_aggregate_usage_counters.sql',import.meta.url),'utf8'));
  for(const role of ['anon','authenticated']){
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query("select public.record_usage_count('bus','view')"),/permission denied/);
    await assert.rejects(db.query('select * from verona_private.usage_daily'),/permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  await db.query("insert into verona_private.usage_daily values (current_date-100,'bus','view',1)");
  await Promise.all(Array.from({length:12},()=>db.query("select public.record_usage_count('bus','view')")));
  assert.deepEqual((await db.query("select total, day=(statement_timestamp() at time zone 'Europe/Rome')::date as rome from verona_private.usage_daily")).rows,[{total:12,rome:true}]);
  await assert.rejects(db.query("select public.record_usage_count('private-name','view')"),/Invalid counter/);
  await db.query('update verona_private.usage_daily_quota set total=100000');
  assert.equal((await db.query("select public.record_usage_count('bus','view') as accepted")).rows[0].accepted,false);
  assert.equal((await db.query('select total from verona_private.usage_daily')).rows[0].total,12);
});
test('Aggregate browser sends only section/action after opt-in, no vendor script, no retries or identity',async()=>{
  const source=await readFile(new URL('../public/analytics.js',import.meta.url),'utf8');
  const nodes=new Map(),calls=[],storage=new Map();
  const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{open:false});return nodes.get(id);}};
  const ctx={payload:{analytics:{provider:'supabase',endpoint,key}},view:'home',document,location:{protocol:'https:',hostname:'veronaintasca.it'},navigator:{onLine:true},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},addEventListener(){},fetch:(...args)=>{calls.push(args);return Promise.resolve({ok:true});},AbortSignal,Promise};ctx.window=ctx;
  runInNewContext(source,ctx);assert.equal(calls.length,0);
  const choice=nodes.get('analytics-choice');choice.checked=true;choice.onchange();
  ctx.veronaAnalytics.page('home');ctx.veronaAnalytics.page('bus');ctx.veronaAnalytics.page('bus');ctx.veronaAnalytics.track('bus_journey_open');ctx.veronaAnalytics.track('email');
  assert.deepEqual(calls.map(call=>JSON.parse(call[1].body)),[{section:'home',action:'view'},{section:'bus',action:'view'},{section:'bus',action:'bus_journey_open'}]);
  for(const [,options]of calls){assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');}
  choice.checked=false;choice.onchange();ctx.veronaAnalytics.page('news');assert.equal(calls.length,3);
  choice.checked=true;ctx.navigator.globalPrivacyControl=true;choice.onchange();assert.equal(calls.length,3);
});
