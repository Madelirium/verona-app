(()=>{
  const install=document.getElementById('pwa-install'),help=document.getElementById('pwa-help'),update=document.getElementById('pwa-update'),note=document.getElementById('pwa-update-note'),offline=document.getElementById('pwa-offline');
  let prompt=null,registration=null,reloading=false,cachedCopy=false;
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  function render(){
    const installed=standalone();
    install.hidden=installed||!prompt;
    help.textContent=installed?'L’app è aperta dalla schermata Home.':!window.isSecureContext?'Per installare l’app, apri https://veronaintasca.it dopo la pubblicazione. La prova Wi-Fi in HTTP non consente l’installazione completa.':/iPad|iPhone|iPod/.test(navigator.userAgent)?'Su iPhone: apri in Safari, tocca Condividi e poi Aggiungi alla schermata Home.':'Dal menu del browser scegli Installa app o Aggiungi alla schermata Home, se disponibile.';
    offline.hidden=navigator.onLine&&!cachedCopy;
    offline.textContent=navigator.onLine?'Stai consultando una copia salvata. Riprova più tardi per dati aggiornati.':'Sei offline · dati salvati. Mappe, aggiornamenti e giochi online richiedono Internet.';
  }
  addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;render();});
  addEventListener('appinstalled',()=>{prompt=null;install.hidden=true;help.textContent='App installata. La trovi nella schermata Home del dispositivo.';});
  addEventListener('offline',render);addEventListener('online',()=>{render();registration?.update().catch(()=>{});});
  install.onclick=async()=>{if(!prompt)return;const pending=prompt;prompt=null;render();try{await pending.prompt();await pending.userChoice;}catch{}render();};
  update.onclick=()=>{if(registration?.waiting){reloading=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});}else location.reload();};
  render();
  if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
  navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='OFFLINE_COPY'){cachedCopy=true;render();}});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)location.reload();});
  navigator.serviceWorker.controller?.postMessage({type:'CHECK_OFFLINE'});
  function waiting(){if(registration.waiting){update.hidden=false;note.hidden=false;}}
  navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'}).then(value=>{
    registration=value;waiting();
    navigator.serviceWorker.ready.then(()=>{document.getElementById('pwa-ready').textContent='Copia offline pronta. Sono disponibili i dati essenziali e le linee autobus già consultate.';});
    registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')waiting();});});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')registration.update().catch(()=>{});});
  }).catch(()=>{help.textContent+=' La preparazione offline non è riuscita: puoi continuare a usare il sito e riprovare più tardi.';});
})();
