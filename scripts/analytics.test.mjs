import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {analyticsConfig} from './analytics-config.mjs';

const id='11111111-2222-4333-8444-555555555555';
const config=analyticsConfig({ANALYTICS_ENABLED:'true',ANALYTICS_UMAMI_WEBSITE_ID:id,ANALYTICS_UMAMI_SCRIPT_URL:'https://cloud.umami.is/script.js'});
const source=await readFile(new URL('../public/analytics.js',import.meta.url),'utf8');
function run({consent=false,hostname='veronaintasca.it',protocol='https:',dnt=false,gpc=false,online=true,configured=true,storageFails=false}={}){
  const storage=new Map(consent?[['verona-analytics-consent-v1','yes']]:[]),nodes=new Map(),scripts=[],calls=[],observers=new Map(),listeners={};
  const node=id=>{if(!nodes.has(id))nodes.set(id,{id,textContent:'',open:false});return nodes.get(id);};
  const context={payload:{analytics:configured?config:null},view:'home',location:{hostname,protocol,href:protocol+'//'+hostname+'/?code=secret&forza4=ABC234#access_token=private'},navigator:{onLine:online,doNotTrack:dnt?'1':'0',globalPrivacyControl:gpc,language:'it-IT'},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>{if(storageFails)throw Error();storage.set(key,value);}},document:{getElementById:node,createElement:()=>({attrs:{},setAttribute(key,value){this.attrs[key]=value;}}),head:{append:script=>scripts.push(script)}},addEventListener:(name,fn)=>listeners[name]=fn,MutationObserver:class{constructor(callback){this.callback=callback;}observe(target){observers.set(target.id,this.callback);}},Promise,Object,Set};
  context.window=context;runInNewContext(source,context);
  function loaded(){context.umami={track:payload=>{const safe=context.veronaAnalyticsBeforeSend('event',payload);if(safe)calls.push(JSON.parse(JSON.stringify(safe)));}};scripts[0].onload();}
  return {context,nodes,scripts,calls,storage,listeners,loaded,choice:value=>{node('analytics-choice').checked=value;node('analytics-choice').onchange();},open:id=>{node(id).open=true;observers.get(id)();},close:id=>{node(id).open=false;observers.get(id)();}};
}
test('Analytics: configurazione disabilitata di default, solo ID pubblico e origine Umami Cloud valida',()=>{
  assert.equal(analyticsConfig({}),null);
  for(const script of ['http://cloud.umami.is/script.js','https://cloud.umami.is.evil.example/script.js','https://user:pass@cloud.umami.is/script.js','https://cloud.umami.is/script.js?secret=key'])assert.throws(()=>analyticsConfig({ANALYTICS_ENABLED:'true',ANALYTICS_UMAMI_WEBSITE_ID:id,ANALYTICS_UMAMI_SCRIPT_URL:script}));
  assert.throws(()=>analyticsConfig({ANALYTICS_ENABLED:'true',ANALYTICS_UMAMI_WEBSITE_ID:'secret-api-key'}));
});
test('Analytics: nessuna richiesta prima del consenso, senza configurazione, in locale, con DNT o GPC',()=>{
  for(const options of [{},{configured:false,consent:true},{hostname:'127.0.0.1',consent:true},{hostname:'192.168.1.27',consent:true},{protocol:'http:',consent:true},{dnt:true,consent:true},{gpc:true,consent:true},{online:false,consent:true}]){const app=run(options);app.context.veronaAnalytics.page('bus');app.context.veronaAnalytics.track('event_saved');assert.equal(app.scripts.length,0);assert.equal(app.calls.length,0);}
});
test('Analytics: consenso, pagina sintetica senza duplicati, eventi ammessi e revoca immediata',()=>{
  const app=run();app.choice(true);assert.equal(app.scripts.length,1);assert.equal(app.scripts[0].attrs['data-auto-track'],'false');assert.equal(app.scripts[0].referrerPolicy,'no-referrer');app.loaded();
  app.context.veronaAnalytics.page('home');assert.equal(app.calls.length,1);
  app.context.veronaAnalytics.page('bus');app.context.veronaAnalytics.page('bus');assert.equal(app.calls.length,2);
  app.context.veronaAnalytics.track('event_saved',{email:'secret@example.org'});assert.equal(app.calls.at(-1).name,'event_saved');assert.equal(app.calls.at(-1).data,undefined);
  app.context.veronaAnalytics.track('arbitrary');assert.equal(app.calls.length,3);
  app.choice(false);app.context.veronaAnalytics.page('news');app.context.veronaAnalytics.track('event_saved');assert.equal(app.calls.length,3);assert.equal(app.context.veronaAnalyticsBeforeSend('event',{website:id,url:'/home'}),false);
  app.choice(true);assert.equal(app.calls.length,4);assert.equal(app.calls.at(-1).url,'/news');
  assert.doesNotMatch(JSON.stringify(app.calls),/secret|ABC234|access_token|email|referrer|distinct|userId/);
});
test('Analytics: pulizia di sicurezza, osservazione aperture effettive e nessun evento per ridisegni o chiusure',()=>{
  const app=run({consent:true});app.loaded();app.open('detail-dialog');app.open('detail-dialog');app.close('detail-dialog');assert.equal(app.calls.filter(call=>call.name==='event_open').length,1);
  app.open('detail-dialog');assert.equal(app.calls.filter(call=>call.name==='event_open').length,2);
  const hook=app.context.veronaAnalyticsBeforeSend;assert.equal(hook('identify',{website:id,url:'/home'}),false);assert.equal(hook('event',{website:id,url:'/?code=secret'}),false);assert.equal(hook('event',{website:id,url:'/home',name:'unknown'}),false);
  assert.deepEqual(JSON.parse(JSON.stringify(hook('event',{website:id,url:'/home',title:'Private',data:{email:'secret'},referrer:'private',language:'it'}))),{website:id,hostname:'veronaintasca.it',url:'/home',title:'Home',language:'it'});
});
test('Analytics: storage bloccato e tracker assente non interrompono i servizi né attivano la raccolta',()=>{
  const app=run({storageFails:true});app.choice(true);assert.equal(app.scripts.length,0);assert.equal(app.nodes.get('analytics-choice').checked,false);
  const failed=run({consent:true});failed.scripts[0].onerror();assert.match(failed.nodes.get('analytics-status').textContent,/continuano a funzionare/);assert.doesNotThrow(()=>failed.context.veronaAnalytics.track('event_saved'));
});
test('Analytics: build senza account resta inattiva e il workflow espone solo configurazione pubblica',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');assert.match(html,/id="analytics-choice"/);assert.match(html,/Statistiche facoltative/);
  const workflow=await readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');assert.match(workflow,/vars.ANALYTICS_UMAMI_WEBSITE_ID/);assert.doesNotMatch(workflow,/secrets.ANALYTICS/);
});
