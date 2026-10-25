import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../public/briscola.js',import.meta.url),'utf8');
function ui(storage=new Map(),blocked=false){
  class Node {
    constructor(){this.children=[];this.dataset={};this.attributes={};this.textContent='';this.parentElement={};this.style={setProperty:(k,v)=>this.style[k]=v};const classes=new Set();this.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c)};}
    append(...nodes){this.children.push(...nodes)}
    replaceChildren(...nodes){this.children=nodes}
    get firstChild(){return this.children[0]}
    setAttribute(k,v){this.attributes[k]=v}
    getAttribute(k){return this.attributes[k]}
    removeAttribute(k){delete this.attributes[k]}
    addEventListener(){}
    focus(){}
    showModal(){this.open=true}
    close(){this.open=false}
    getBoundingClientRect(){return {x:10,y:20,width:60,height:90}}
    querySelector(selector){const seat=selector.match(/data-seat="(\d+)"/);return seat?this.children.find(n=>n.dataset.seat===seat[1]):null}
  }
  const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id)};
  let now=1000,nextTimer=0;const timers=new Map();
  const context={payload:{},selectedGame:'briscola',view:'games',$:get,el:(tag,text,cls)=>{const n=new Node();n.textContent=text;n.className=cls;return n},document:{querySelectorAll:()=>[],createElementNS:()=>new Node()},localStorage:{getItem:key=>{if(blocked)throw Error('blocked');return storage.get(key)},setItem(key,value){if(blocked)throw Error('blocked');storage.set(key,value)},removeItem:key=>storage.delete(key)},Date:class extends Date{static now(){return now}},setTimeout:(fn,ms)=>{timers.set(++nextTimer,{fn,ms});return nextTimer},clearTimeout:id=>timers.delete(id),URL};
  const instrumented=source.replace(/  restore\(\);\r?\n  setInterval/,`  globalThis.probe={show(next){session={code:next.code};applyState(next);draw();},redraw:draw,reset,card};return;\n  restore();\n  setInterval`);
  runInNewContext(instrumented,context);
  return {get,probe:context.probe,timers,storage,advance(ms){now+=ms;for(const {fn} of [...timers.values()])fn()}};
}
const card={id:'denari-1',rank:1,suit:'denari'};
function state(count=2){return {code:'ABC234',matchId:'one',version:1,status:'playing',playerCount:count,seat:0,turn:0,visibility:'private',players:Array.from({length:count},(_,i)=>({name:['Anna','Luca','Marta','Leo'][i],score:20+i,count:3,online:true,hand:i===0?[card]:undefined})),table:[],lastTrick:null,trickWaitMs:0,remaining:30,trump:card,teamScores:[40,42],rematch:Array(count).fill(false)}}
function trick(s,winner=0){s.version++;s.turn=winner;s.lastTrick={id:1,winner,points:21,cards:s.players.map((p,player)=>({player,card}))};s.trickWaitMs=1200;return s}

test('Turno e conferma della carta senza mostrare punti, anche a coppie',()=>{
  for(const count of [2,3,4]){const app=ui(),s=state(count);app.probe.show(s);
    assert.match(app.get('game-turn').textContent,/Tocca a te/);assert.equal(app.get('game-hand').children[0].disabled,false);
    assert.doesNotMatch(app.get('game-me-meta').textContent,/punti/);assert.equal(app.get('game-team-score').hidden,true);
    for(const row of app.get('game-multiplayer-players').children)assert.doesNotMatch(row.children[1].children[2].textContent,/punti/);
    s.version++;s.turn=1;s.table=[{player:0,card}];app.probe.show(s);
    assert.match(app.get('game-turn').textContent,/Carta giocata.*Luca/);assert.equal(app.get('game-hand').children[0].disabled,true);
  }
});
test('Raccolta verso il vincitore, blocco della mano e nessun replay al polling',()=>{
  for(const count of [2,3,4]){const app=ui(),s=trick(state(count),count-1);app.probe.show(s);
    assert.match(app.get('game-turn').textContent,/Prende/);assert.equal(app.get('game-hand').children[0].disabled,true);
    assert.equal(app.get('game-table').children.filter(n=>n.classList.contains('trick-winner')).length,1);
    assert.equal(app.get('game-table').children[0].style['--collect-duration'],'1200ms');
    app.get('game-last-trick').onclick();assert.doesNotMatch(app.get('game-trick-summary').textContent,/punti|21/);
    app.advance(500);s.version++;app.probe.show(s);assert.equal(app.get('game-table').children[0].style['--collect-delay'],'-500ms');
    app.advance(750);assert.equal(app.get('game-table').children.length,0);
    s.version++;app.probe.show(s);assert.equal(app.get('game-table').children.length,0);
  }
});
test('Risultato dopo la raccolta finale, poi nuova partita senza vecchie prese',()=>{
  const app=ui(),s=trick(state());s.status='finished';s.winner=0;app.probe.show(s);
  assert.equal(app.get('game-result').hidden,true);assert.doesNotMatch(app.get('game-me-meta').textContent,/punti/);
  app.advance(1250);assert.equal(app.get('game-result').hidden,false);assert.match(app.get('game-result-summary').textContent,/punti/);
  const next=state();next.matchId='two';next.version=3;app.probe.show(next);assert.equal(app.get('game-table').children.length,0);assert.equal(app.get('game-hand').children[0].disabled,false);
});
test('Una presa già conclusa ricevuta alla riconnessione non viene animata',()=>{
  const app=ui(),s=trick(state());s.trickWaitMs=0;app.probe.show(s);assert.equal(app.get('game-table').children.length,0);assert.equal(app.get('game-hand').children[0].disabled,false);
});

function pick(app,id,save=true){app.get('game-deck-open').onclick();app.get('game-deck-'+id).checked=true;app.get('game-deck-'+id).onchange();app.get(save?'game-deck-save':'game-deck-cancel').onclick()}
const art=node=>node.children.find(n=>n.className==='card-art');
test('Mazzo: annullamento, scelta personale persistente, cambio durante la presa e ritorno a Essenziale',()=>{
  const app=ui(),s=state();app.probe.show(s);
  pick(app,'venete',false);assert.equal(app.storage.has('verona-briscola-deck-v1'),false);assert.equal(art(app.get('game-hand').children[0]),undefined);
  pick(app,'venete');assert.equal(app.storage.get('verona-briscola-deck-v1'),'venete');assert.match(art(app.get('game-hand').children[0]).src,/denari-1.webp$/);
  assert.equal(s.version,1);const restored=ui(app.storage);restored.probe.show(s);assert.ok(art(restored.get('game-hand').children[0]));
  app.probe.show(trick(s));pick(app,'essential');assert.equal(art(app.get('game-hand').children[0]),undefined);assert.equal(app.get('game-hand').children[0].disabled,true);assert.equal(app.get('game-table').children.length,2);
  assert.equal(app.get('game-deck-preview-essential').children.length,3);assert.equal(app.get('game-deck-preview-venete').children.length,3);
  assert.equal(ui().probe.card(card).children.some(n=>n.className==='card-art'),false);
});
test('Mazzo: memoria bloccata, preferenza sconosciuta e immagine non disponibile hanno un recupero utilizzabile',()=>{
  const invalid=ui(new Map([['verona-briscola-deck-v1','unknown']]));assert.equal(art(invalid.probe.card(card)),undefined);
  const app=ui(new Map(),true);app.probe.show(state());pick(app,'venete');assert.match(app.get('game-feedback').textContent,/questa visita/);
  const node=app.get('game-hand').children[0],img=art(node);img.onload();assert.equal(node.classList.contains('card-art-ready'),true);
  img.onerror();assert.equal(node.classList.contains('card-art-ready'),false);assert.equal(img.hidden,true);assert.equal(node.getAttribute('aria-label'),'Asso di denari');assert.equal(node.disabled,false);
});
test('Mazzo: tutte le 40 identità mantengono seme, rango e nome accessibile',()=>{
  const app=ui(new Map([['verona-briscola-deck-v1','venete']]));
  for(const suit of ['denari','coppe','spade','bastoni'])for(let rank=1;rank<=10;rank++){
    const node=app.probe.card({rank,suit});const file=art(node).src;assert.equal(file,`assets/cards/venete/${suit}-${rank}.webp`);
    assert.ok(readFileSync(new URL('../public/'+file,import.meta.url)).length>1000);assert.match(node.getAttribute('aria-label'),new RegExp(suit));
  }
});
