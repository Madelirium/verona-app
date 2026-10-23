// Keep rebuilt lists and browser navigation in step with the app shell.
function captureNavigationFocus(){
  if(typeof document.querySelectorAll!=='function')return null;
  const active=document.activeElement;
  const lists=['events','news-list','district-list','places-list','bus-list','saved-list','places-map','home-personal-body'];
  const container=lists.map(id=>$(id)).find(node=>node?.contains(active));
  return {view,active,id:active?.id,key:active?.getAttribute?.('data-focus-key'),container,
    index:container?Array.from(container.querySelectorAll('[data-focus-key]')).indexOf(active):-1,
    scroll:lists.map(id=>({node:$(id),top:$(id)?.scrollTop||0}))};
}
function restoreNavigationFocus(memory,{returning=false}={}){
  if(!memory||memory.view!==view)return;
  for(const {node,top}of memory.scroll)if(node)node.scrollTop=top;
  if(!returning&&memory.active?.isConnected)return;
  if(returning&&memory.active?.closest?.('.view-nav'))return;
  let target=memory.active?.isConnected?memory.active:memory.id?$(memory.id):null;
  if(!target&&memory.key)target=Array.from((memory.container||document).querySelectorAll('[data-focus-key]')).find(node=>node.getAttribute('data-focus-key')===memory.key);
  if(!target&&memory.container){const controls=Array.from(memory.container.querySelectorAll('[data-focus-key]'));target=controls[Math.min(Math.max(memory.index,0),controls.length-1)]||memory.container;}
  const top=typeof navigationTopDialog==='function'?navigationTopDialog():null;
  if(target&&(!top||top.contains(target))&&target.getClientRects().length)target.focus({preventScroll:true});
}
var navigationTopDialog=null;
(function installVeronaNavigation(){
  if(typeof document.querySelectorAll!=='function')return;
  for(const [id,label]of [['news-list','Notizie e comunicazioni'],['places-list','Luoghi e attività'],['bus-list','Linee e avvisi autobus']]){const node=$(id);node?.setAttribute('tabindex','0');node?.setAttribute('aria-label',label);}
  for(const name of ['render','renderNews','renderHome']){
    const original=name==='render'?render:name==='renderNews'?renderNews:renderHome;
    const preserved=(...args)=>{const memory=captureNavigationFocus();const result=original(...args);restoreNavigationFocus(memory);return result;};
    if(name==='render')render=preserved;else if(name==='renderNews')renderNews=preserved;else renderHome=preserved;
  }
  const dialogs=Array.from(document.querySelectorAll('dialog'));
  const stack=[],returns=new WeakMap();let schedule=()=>{};
  const openDialogs=()=>stack.filter(dialog=>dialog.open);
  navigationTopDialog=()=>openDialogs().at(-1);
  for(const dialog of dialogs){
    const show=dialog.showModal.bind(dialog),close=dialog.close.bind(dialog);
    dialog.showModal=(...args)=>{const memory=captureNavigationFocus(),result=show(...args);returns.set(dialog,memory);const index=stack.indexOf(dialog);if(index>=0)stack.splice(index,1);stack.push(dialog);schedule();return result;};
    dialog.close=(...args)=>{const result=close(...args);schedule();return result;};
    dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();});
    dialog.addEventListener('close',()=>{restoreNavigationFocus(returns.get(dialog),{returning:true});schedule();});
  }
  if(typeof history==='undefined'||typeof addEventListener!=='function'||typeof queueMicrotask!=='function')return;
  const session='verona-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  let serial=0,current={session,id:serial,view,overlay:false},queued=false,applying=false,pending=false,pendingView=null;
  const snapshots=new Map();
  const inputs=['search','source','period','collection','news-search','district-search','explore-search','explore-category','bus-search','bus-service','event-map-date','event-map-period','saved-category','saved-search',...(typeof agendaFilterIds==='undefined'?[]:agendaFilterIds)];
  function snapshot(){return {view,selected,month,savedMode,newsMode,newsFilters:{...newsFilters},districtMode,districtSaved,exploreMode,exploreSaved,
    exploreContext:{bounds:exploreBounds,nearby:exploreNearbyPoint,focus:placeMapFocus,shown:placesShown},
    range:typeof agendaRange==='undefined'?null:agendaRange,showAll:typeof agendaShowAll==='undefined'?null:agendaShowAll,
    inputs:inputs.map(id=>[id,$(id)?.value]),focus:captureNavigationFocus()};}
  function remember(){snapshots.set(current.id,snapshot());}
  function replace(entry){current=entry;history.replaceState({veronaNavigation:entry},'');}
  function push(overlay=false){for(const id of snapshots.keys())if(id>current.id)snapshots.delete(id);const entry={session,id:++serial,view,overlay,...overlay?{base:current.id}:{previous:current.id}};current=entry;history.pushState({veronaNavigation:entry},'');remember();}
  const originalSetView=setView;
  function focusScreen(){const target=view==='bus'?$('network-line-toggle'):$('page-title');if(target&&!target.hidden){if(target===$('page-title'))target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}}
  function apply(entry){
    const saved=snapshots.get(entry.id);applying=true;
    try{
      if(saved){selected=saved.selected;month=saved.month;savedMode=saved.savedMode;newsMode=saved.newsMode;newsFilters={...saved.newsFilters};districtMode=saved.districtMode;districtSaved=saved.districtSaved;exploreMode=saved.exploreMode;exploreSaved=saved.exploreSaved;
        if(saved.exploreContext){exploreBounds=saved.exploreContext.bounds;exploreNearbyPoint=saved.exploreContext.nearby;placeMapFocus=saved.exploreContext.focus;placesShown=saved.exploreContext.shown;}
        if(saved.range!==null)agendaRange=saved.range;if(saved.showAll!==null)agendaShowAll=saved.showAll;
        for(const [id,value]of saved.inputs)if($(id)&&value!==undefined)$(id).value=value;
        if(entry.view==='saved')savedVisited=true;
      }
      originalSetView(entry.view);focusScreen();if(saved){restoreNavigationFocus(saved.focus,{returning:true});}
    }finally{applying=false;}
  }
  replace(current);remember();
  setView=next=>{
    if(applying||next===view)return originalSetView(next);
    if(pending){pendingView=next;return;}
    remember();const wasOverlay=current.overlay;originalSetView(next);focusScreen();
    if(wasOverlay){replace({...current,view:next,overlay:false,previous:current.base});remember();}else push();
  };
  for(const [id,destination]of [['district-back',()=> 'home'],['explore-back',()=> 'home'],['bus-back',()=> 'home'],['event-map-back',()=>eventMapReturn?.view||'calendar']]){
    const button=$(id),original=button.onclick;
    button.onclick=event=>{if(!pending&&snapshots.get(current.previous)?.view===destination()){remember();history.back();}else original?.call(button,event);};
  }
  function syncDialogs(){
    queued=false;if(applying||pending)return;
    if(openDialogs().length){if(!current.overlay){remember();push(true);}}
    else if(current.overlay){remember();pending=true;history.back();}
  }
  schedule=()=>{if(!queued){queued=true;queueMicrotask(syncDialogs);}};
  addEventListener('popstate',event=>{
    let target=event.state?.veronaNavigation;
    if(!target||!['home','discover','news','calendar','saved','bus','eventmap','explore','district','games'].includes(target.view))return;
    // After a reload the previous document's DOM and modal state no longer exist.
    if(target.session!==session)target={session,id:++serial,view:target.view,overlay:false};
    remember();
    if(pending){pending=false;current=target;remember();const next=pendingView;pendingView=null;if(next)setView(next);else schedule();return;}
    const opened=openDialogs();
    if(current.overlay&&!target.overlay&&current.base===target.id&&opened.length){
      applying=true;opened.at(-1).close();applying=false;current=target;remember();if(openDialogs().length)push(true);return;
    }
    applying=true;for(const dialog of opened.reverse())dialog.close();applying=false;
    // Forward never resurrects a dismissed modal with stale data or a removed map.
    replace({...target,overlay:false});apply(current);
  });
})();
