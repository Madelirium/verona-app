function renderDistrictControls(){
  const chosen=currentDistrict();
  for(const id of ['district-zone','district-tabs','district-open-filters','district-open-services'])$(id).hidden=!chosen;
  $('district-updates').classList.toggle('active',districtMode!=='events');$('district-updates').setAttribute('aria-pressed',String(districtMode!=='events'));
  const active=Boolean($('district-search').value||districtSaved||['news','notices','city'].includes(districtMode));
  $('district-active-filter').hidden=!chosen||!active;
  $('district-active-filter').textContent=[districtSaved?'Solo salvati':'',({news:'Solo notizie',notices:'Solo avvisi',city:'Dal Comune · senza zona indicata'})[districtMode]||'',$('district-search').value?'Ricerca: '+$('district-search').value:''].filter(Boolean).join(' · ')+' · Azzera ×';
}
function renderDistrictPicker(){
  const query=placeSearchText($('district-picker-search').value),selectedValue=$('district-choice').value;
  const list=$('district-picker-results');list.replaceChildren();
  const choices=districtChoices.filter(choice=>choice.quarter&&placeSearchText(choice.quarter).includes(query)).sort((a,b)=>a.quarter.localeCompare(b.quarter,'it'));
  const addChoice=(container,choice)=>{const button=el('button','','district-picker-option');button.type='button';button.setAttribute('aria-pressed',String(selectedValue===choice.value));button.append(el('strong',choice.quarter||'Circoscrizione '+choice.district.id),el('span',choice.quarter?'Circoscrizione '+choice.district.id+' · '+choice.district.name:choice.district.name));button.onclick=()=>{$('district-choice').value=choice.value;renderDistrictPicker();$('apply-district').focus();};container.append(button);};
  for(const choice of choices)addChoice(list,choice);
  if(!choices.length)list.append(el('p','Nessun quartiere con questo nome. Prova una parola più breve oppure scegli la circoscrizione.','district-picker-note'));
  const all=el('details','','district-picker-all');all.append(el('summary','Preferisco seguire una circoscrizione'));
  for(const choice of districtChoices.filter(choice=>!choice.quarter))addChoice(all,choice);list.append(all);
  const selectedChoice=districtChoices.find(choice=>choice.value===selectedValue);$('district-picker-selected').textContent=selectedChoice?'Zona scelta: '+(selectedChoice.quarter||'Circoscrizione '+selectedChoice.district.id+' · '+selectedChoice.district.name):'Tocca un quartiere, poi conferma.';
  $('apply-district').disabled=!selectedChoice;$('clear-district').hidden=!currentDistrict();
}
function openDistrictFilters(){
  const event=districtMode==='events';$('district-filter-search').value=$('district-search').value;$('district-filter-type').value=event?'updates':districtMode;$('district-filter-saved').checked=districtSaved;$('district-filter-type-field').hidden=event;
  $('district-filters-dialog').showModal();$('district-filters-close').focus();
}
function clearDistrictFilters(){districtMode=districtMode==='events'?'events':'updates';districtSaved=false;$('district-search').value='';render();}
$('district-picker-search').oninput=renderDistrictPicker;
const districtChoiceChanged=$('district-choice').onchange;
$('district-choice').onchange=()=>{districtChoiceChanged();renderDistrictPicker();};
$('district-open-filters').onclick=openDistrictFilters;
$('district-filters-close').onclick=()=>$('district-filters-dialog').close();
$('district-filters-apply').onclick=()=>{$('district-search').value=$('district-filter-search').value.trim();if(districtMode!=='events')districtMode=$('district-filter-type').value;districtSaved=Boolean($('district-filter-saved').checked);$('district-filters-dialog').close();render();};
$('district-filters-reset').onclick=()=>{$('district-filters-dialog').close();clearDistrictFilters();};
$('district-filters-dialog').addEventListener('close',()=>$('district-open-filters').focus());
$('district-active-filter').onclick=clearDistrictFilters;
$('district-open-services').onclick=()=>{$('district-services-dialog').showModal();$('district-services-close').focus();};
$('district-services-close').onclick=()=>$('district-services-dialog').close();
$('district-services-dialog').addEventListener('close',()=>$('district-open-services').focus());
