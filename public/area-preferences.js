// A district is an optional shared preference, independent of the AMIA zone.
let areaWelcomeSeen=false,areaMemoryFailed=false,areaSettingsFocus=null;
try{areaWelcomeSeen=localStorage.getItem('verona-area-welcome-v1')==='seen'||Boolean(currentDistrict())||localStorage.getItem('verona-district-v1')!=null;}catch{}
function markAreaWelcomeSeen(){areaWelcomeSeen=true;try{localStorage.setItem('verona-area-welcome-v1','seen');}catch{areaMemoryFailed=true;}}
function renderAreaPreferences(){
  const chosen=currentDistrict();$('area-settings-zone').textContent=chosen?(chosen.quarter||'Circoscrizione '+chosen.district.id+' · '+chosen.district.name):'Nessun quartiere scelto';
  $('area-settings-change').textContent=chosen?'Cambia o rimuovi quartiere':'Scegli quartiere';
  $('area-settings-memory').textContent=areaMemoryFailed?'Il browser non consente di salvare tutte le preferenze: alcune scelte valgono per questa visita.':'Le preferenze restano in questo browser.';
  const select=$('agenda-zone');let option=Array.from(select.children).find(item=>item.value==='my-zone');
  if(!option){option=el('option');option.value='my-zone';select.append(option);}
  option.textContent=chosen?'La mia zona · '+(chosen.quarter||'Circoscrizione '+chosen.district.id):'La mia zona · scegli nelle impostazioni';option.disabled=!chosen;
  if(!chosen&&select.value==='my-zone')select.value='';
}
function openAreaSettings(){areaSettingsFocus=document.activeElement;renderAreaPreferences();$('area-settings-dialog').showModal();$('area-settings-close').focus();}
function showAreaWelcome(){if(areaWelcomeSeen||currentDistrict())return;markAreaWelcomeSeen();$('area-welcome-dialog').showModal();$('area-welcome-skip').focus();}
$('open-settings').onclick=openAreaSettings;
$('area-settings-close').onclick=()=>$('area-settings-dialog').close();
$('area-settings-dialog').addEventListener('close',()=>{if(areaSettingsFocus?.isConnected)areaSettingsFocus.focus({preventScroll:true});});
$('area-settings-change').onclick=openDistrictChoice;
$('area-settings-waste').onclick=()=>openWaste();
$('area-settings-news').onclick=()=>{$('area-settings-dialog').close();newsMode='zone';setView('news');};
for(const id of ['area-welcome-skip','area-welcome-close'])$(id).onclick=()=>$('area-welcome-dialog').close();
$('area-welcome-dialog').addEventListener('close',()=>{markAreaWelcomeSeen();$('home').focus({preventScroll:true});});
$('area-welcome-choose').onclick=()=>{$('area-welcome-dialog').close();openDistrictChoice();};
// Show the alpha notice before the optional area welcome, once per browser.
function showInitialAppNotice(){
  let seen=false;try{seen=localStorage.getItem('verona-alpha-notice-v1')==='seen';}catch{}
  if(seen){showAreaWelcome();return;}
  $('alpha-notice-dialog').showModal();$('alpha-notice-continue').focus();
}
for(const id of ['alpha-notice-close','alpha-notice-continue'])$(id).onclick=()=>$('alpha-notice-dialog').close();
$('alpha-notice-dialog').addEventListener('close',()=>{
  try{localStorage.setItem('verona-alpha-notice-v1','seen');}catch{}
  $('home').focus({preventScroll:true});showAreaWelcome();
});
renderAreaPreferences();showInitialAppNotice();
