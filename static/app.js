let spools=[],scanner=null;const $=s=>document.querySelector(s),form=$('#form');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(s){$('#toast').textContent=s;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',5000)}
async function api(path,obj){const r=await fetch(path,obj?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)}:{});const data=await r.json();if(!r.ok)throw Error(data.error||'Server error');return data}
async function refresh(){try{spools=await api('/api/spools');render();$('#sync').textContent='● Synced'}catch(e){$('#sync').textContent='Connection lost';toast(e.message)}}
const locationLabel=value=>String(value||'').replace(/^Armoire ([1-5])$/, 'Cabinet $1');
const cabinets=Array.from({length:5},(_,i)=>'Armoire '+(i+1));
let inventoryView='groups',stockLevel='all';
const weightLabel=n=>n>=1000?(n/1000).toLocaleString('en-US',{maximumFractionDigits:2})+' kg':n.toLocaleString('en-US')+' g';
const statusLabel=s=>({Neuve:'New',Ouverte:'Opened',Terminée:'Finished'})[s]||s;
function spoolLine(s){const weight=Stock.available(s)?s.weight:0;return `<div class="spool-line"><div class="spool-line-heading"><span class="tag">${esc(statusLabel(s.status))}</span><strong>${weightLabel(weight)}</strong></div><div class="progress"><i style="width:${Math.min(100,weight/10)}%"></i></div><div class="spool-line-footer"><span>${esc(locationLabel(s.location)||'No location')} · #${s.id}</span><button data-edit="${s.id}" aria-label="Edit spool ${s.id}">Update ↗</button></div></div>`}
function render(){
 const expanded=new Set([...document.querySelectorAll('details[open][data-group]')].map(d=>d.dataset.group));
 const allGroups=Stock.groupStock(spools),available=spools.filter(Stock.available);
 const weight=available.reduce((n,s)=>n+s.weight,0),low=allGroups.filter(g=>g.low);
 $('#count').textContent=available.length;$('#grams').textContent=weightLabel(weight);$('#colors').textContent=allGroups.filter(g=>!g.empty).length;$('#low-count').textContent=low.length;
 $('#spool-summary').textContent=available.filter(s=>s.status==='Neuve').length+' new · '+available.filter(s=>s.status==='Ouverte').length+' opened';
 const selectedMaterial=$('#material-filter').value,materials=[...new Set(spools.map(s=>s.material))].sort();
 $('#material-filter').innerHTML='<option value="">All materials</option>'+materials.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('');$('#material-filter').value=materials.includes(selectedMaterial)?selectedMaterial:'';
 const totals=materials.map(m=>({material:m,weight:available.filter(s=>s.material===m).reduce((n,s)=>n+s.weight,0)})).sort((a,b)=>b.weight-a.weight);
 $('#materials-summary').innerHTML=totals.map(m=>`<button class="material-tile" data-material="${esc(m.material)}" aria-pressed="${selectedMaterial===m.material}"><span>${esc(m.material)}</span><strong>${weightLabel(m.weight)}</strong><div class="progress"><i style="width:${weight?m.weight/weight*100:0}%"></i></div><small>${weight?Math.round(m.weight/weight*100):0}% of available weight</small></button>`).join('')||'<p class="section-note">Add your first spool to see your materials here.</p>';
 const selectedCabinet=$('#cabinet-filter').value;
 $('#cabinet-summary').innerHTML=cabinets.map(name=>{const stored=spools.filter(s=>s.location===name),usable=stored.filter(Stock.available);return `<button class="cabinet-tile" data-cabinet="${esc(name)}" aria-pressed="${selectedCabinet===name}"><span>▤ ${esc(locationLabel(name))}</span><strong>${weightLabel(usable.reduce((n,s)=>n+s.weight,0))}</strong><small>${usable.length} available · ${stored.length} total spools</small></button>`}).join('');
 const cabinetRows=spools.filter(s=>s.location===selectedCabinet);
 $('#cabinet-content').innerHTML=selectedCabinet?`<h2>${esc(locationLabel(selectedCabinet))}</h2><p class="section-note">${cabinetRows.length} spool${cabinetRows.length===1?'':'s'} stored here</p><div class="cabinet-stock-list">${cabinetRows.map(s=>`<article class="cabinet-stock-row"><div><strong>${esc(s.color)}</strong><p>${esc(s.material)}</p></div><button data-edit="${s.id}">Edit #${s.id} ↗</button></article>`).join('')||'<p class="empty">No spools in this cabinet yet.</p>'}</div>`:'<p class="section-note">Select one of your five cabinets to view its contents.</p>';
 const q=$('#search').value.trim().toLowerCase(),status=$('#filter').value,material=$('#material-filter').value;
 const cabinet=$('#cabinet-filter').value;
 const filtered=spools.filter(s=>(!status||s.status===status)&&(!material||s.material===material)&&(!cabinet||(cabinet==='__unassigned'?!s.location:cabinet==='__other'?s.location&&!cabinets.includes(s.location):s.location===cabinet))&&[s.color,s.material,s.barcode,s.location,locationLabel(s.location)].some(v=>v.toLowerCase().includes(q)));
 const levelKeys=new Set(Stock.groupStock(filtered).filter(g=>stockLevel==='all'||(stockLevel==='low'?g.low:g.empty)).flatMap(g=>g.rows.map(r=>r.id)));
 const rows=filtered.filter(s=>levelKeys.has(s.id));
 const sort=$('#sort').value;
 function compare(a,b){return sort==='name'?a.color.localeCompare(b.color):sort==='weight-asc'?a.weight-b.weight:b.weight-a.weight}
 const groups=Stock.groupStock(rows).sort(compare);
 $('#total').textContent=`/ ${groups.length} color${groups.length===1?'':'s'} · ${rows.length} spool${rows.length===1?'':'s'}`;
 $('#results-note').textContent=inventoryView==='groups'?'Grouped by material + color. Expand a card to update individual spools.':'Individual spools. Update the remaining weight after printing.';
 const empty=`<div class="empty"><strong>${spools.length?'Nothing here right now':'Your next print starts here'}</strong>${spools.length?'No stock matches these filters.':'Add a spool or scan its barcode to get started.'}</div>`;
 if(inventoryView==='groups')$('#cards').innerHTML=groups.map(g=>`<article class="card stock-card ${g.empty?'is-empty':g.low?'is-low':''}"><div class="card-body"><div class="stock-card-top"><span class="material-label">${esc(g.material)}</span><span class="availability ${g.empty?'empty':g.low?'low':''}">${g.empty?'OUT OF STOCK':g.low?'RUNNING LOW':'IN STOCK'}</span></div><h3>${esc(g.color)}</h3><div class="remaining-number">${g.count}<span class="spool-unit-label"> spool${g.count===1?'':'s'}</span></div><p class="stock-caption">available · ${g.rows.length} recorded in total</p><div class="group-quantity"><div class="group-quantity-heading"><span>${g.count} spool${g.count===1?'':'s'} available</span><span>${g.sealed} new · ${g.opened} opened</span></div><div class="quantity-track" role="img" aria-label="${esc(g.material)} ${esc(g.color)}: ${g.count} available spools">${g.rows.filter(Stock.available).map(r=>`<span class="quantity-segment spool-unit" title="Spool #${r.id} · ${esc(statusLabel(r.status))}"><i style="width:100%"></i></span>`).join('')||'<span class="quantity-none">No spools left</span>'}</div></div><div class="stock-counts"><span><b>${g.count}</b> usable spool${g.count===1?'':'s'}</span><span>${g.sealed} new · ${g.opened} opened</span></div><details data-group="${esc(JSON.stringify([g.material,g.color]))}" ${expanded.has(JSON.stringify([g.material,g.color]))?'open':''}><summary>View ${g.rows.length} spool${g.rows.length===1?'':'s'} <span>＋</span></summary>${g.rows.sort((a,b)=>a.id-b.id).map(spoolLine).join('')}</details></div></article>`).join('')||empty;
 else $('#cards').innerHTML=rows.sort((a,b)=>compare({...a,weight:Stock.available(a)?a.weight:0},{...b,weight:Stock.available(b)?b.weight:0})).map(s=>`<article class="card stock-card"><div class="card-body"><span class="material-label">${esc(s.material)}</span><h3>${esc(s.color)}</h3>${spoolLine(s)}<p class="meta">Barcode ${esc(s.barcode)}</p></div></article>`).join('')||empty;
}
$('#group-view').onclick=()=>{inventoryView='groups';$('#group-view').setAttribute('aria-pressed','true');$('#spool-view').setAttribute('aria-pressed','false');render()};
$('#spool-view').onclick=()=>{inventoryView='spools';$('#group-view').setAttribute('aria-pressed','false');$('#spool-view').setAttribute('aria-pressed','true');render()};
document.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{stockLevel=b.dataset.level;document.querySelectorAll('[data-level]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render()});
$('#cabinet-filter').onchange=render;$('#cabinet-summary').onclick=e=>{const b=e.target.closest('[data-cabinet]');if(b){$('#cabinet-filter').value=$('#cabinet-filter').value===b.dataset.cabinet?'':b.dataset.cabinet;render()}};
$('#material-filter').onchange=render;$('#sort').onchange=render;$('#materials-summary').onclick=e=>{const b=e.target.closest('[data-material]');if(b){$('#material-filter').value=$('#material-filter').value===b.dataset.material?'':b.dataset.material;render()}};
function updateProductPreview(){
 const color=form.elements.color.value.trim(),material=form.elements.material.value.trim();
 const palette={black:'#171717',white:'#f4f3ee',red:'#ce3337',blue:'#2473c5',green:'#369b53',yellow:'#f1d931',orange:'#f58a32',purple:'#8956b0',pink:'#e892bd',grey:'#999b9d',gray:'#999b9d',brown:'#805635',silver:'#bfc2c5',gold:'#c5a553','lime green':'#a1c632','light cyan':'#70cad6','flesh':'#e7b49c','grape jelly':'#70408b','crystal blue':'#418ad4'};
 $('#product-color').textContent=color||'Your filament';$('#product-material').textContent=material||'Enter product details';
 const swatch=palette[color.toLowerCase()];$('#product-circle').style.background=swatch||'repeating-linear-gradient(45deg,#777 0 8px,#444 8px 16px)';$('#product-circle').title=swatch?'Illustrative color preview':'Color preview unavailable';
}
function selectCabinet(value){form.elements.location.value=value;document.querySelectorAll('[data-choose-cabinet]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.chooseCabinet===value)));$('#cabinet-selection').textContent=value?locationLabel(value):'Choose a cabinet'}
document.querySelectorAll('[data-choose-cabinet]').forEach(b=>b.onclick=()=>selectCabinet(b.dataset.chooseCabinet));
$('#quantity-minus').onclick=()=>{form.elements.quantity.value=Math.max(1,(Number(form.elements.quantity.value)||1)-1)};
$('#quantity-plus').onclick=()=>{form.elements.quantity.value=Math.min(100,(Number(form.elements.quantity.value)||1)+1)};
form.elements.color.oninput=updateProductPreview;form.elements.material.oninput=updateProductPreview;
form.addEventListener('invalid',()=>{$('#product-details').open=true},true);
function openEditor(row){
 matchRequest++;autoCode=null;form.reset();form.elements.id.value='';form.elements.quantity.value=1;
 $('#quantity-field').hidden=!!row?.id;$('#edit-title').textContent=row?.id?'Edit spool':'Add spools';$('#save-spools').textContent=row?.id?'Save changes':'Add spools';$('#delete').hidden=!row?.id;
 if(row)for(const k of ['id','barcode','material','color','weight','location','status'])if(row[k]!=null)form.elements[k].value=row[k];
 selectCabinet(row?.location||(cabinets.includes($('#cabinet-filter').value)?$('#cabinet-filter').value:''));
 $('#product-details').open=!row?.material;$('#match').textContent=row?.id?'':'Scan or enter a barcode to recognize your filament.';updateProductPreview();$('#editor').showModal();
}
let matchRequest=0,autoCode=null;
async function match(){
 const request=++matchRequest,code=form.elements.barcode.value.trim();
 if(form.elements.id.value)return;
 if(autoCode!==null&&autoCode!==code){form.elements.material.value='';form.elements.color.value='';autoCode=null}
 if(!code){$('#match').textContent='Scan or enter a barcode to recognize your filament.';return}
 $('#match').textContent='Looking up your local catalogue…';
 try{
  const row=await api('/api/lookup?code='+encodeURIComponent(code));
  if(request!==matchRequest||form.elements.barcode.value.trim()!==code||!$('#editor').open)return;
  if(row.found){form.elements.material.value=row.material;form.elements.color.value=row.color;autoCode=code;updateProductPreview();$('#product-details').open=false;$('#match').textContent='✓ Product recognized'}
  else{$('#product-details').open=true;$('#match').textContent=row.conflict?'Conflicting entries for this barcode. Check the packaging and enter the material and color.':'Not in the local catalogue yet. Enter the material and color once; future scans will recognize them.'}
 }catch(e){if(request===matchRequest)$('#match').textContent='Catalogue unavailable. You can enter the material and color manually.'}
}
$('#add').onclick=()=>openEditor();$('.close').onclick=()=>$('#editor').close();form.elements.barcode.onchange=match;let lookupTimer;form.elements.barcode.oninput=()=>{matchRequest++;clearTimeout(lookupTimer);lookupTimer=setTimeout(match,300)};$('#cards').onclick=e=>{const b=e.target.closest('[data-edit]');if(b)openEditor(spools.find(s=>s.id===Number(b.dataset.edit)))};$('#search').oninput=render;$('#filter').onchange=render;
form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('[type=submit]');b.disabled=true;try{const obj=Object.fromEntries(new FormData(form));obj.weight=Number(obj.weight);obj.quantity=obj.id?1:Number(obj.quantity);await api('/api/save',obj);$('#editor').close();await refresh();toast(obj.id?'Spool saved':obj.quantity+' spool'+(obj.quantity===1?'':'s')+' added')}catch(e){toast(e.message)}finally{b.disabled=false}};
$('#delete').onclick=async()=>{if(!confirm('Permanently delete this spool?'))return;try{await api('/api/delete',{id:form.elements.id.value});$('#editor').close();await refresh()}catch(e){toast(e.message)}};
async function stop(){photoToken++;if(scanner){try{await scanner.stop();scanner.clear()}catch{}scanner=null}$('#scanner').close()}
let scanHandled=false,scanMode='add',removeBusy=false,removeRequest=0;
async function findRemoval(code){
 const request=++removeRequest;$('#remove-message').textContent='Finding matching spools…';$('#remove-matches').innerHTML='';
 try{const latest=await api('/api/spools');if(request!==removeRequest||!$('#remove-dialog').open)return;spools=latest;render();
 const matches=Stock.matchingSpools(latest,code);
 const usable=matches.filter(Stock.available);
 $('#remove-message').textContent=matches.length?`${matches.length} spool${matches.length===1?'':'s'} in stock for this barcode · ${usable.length} available to print · ${weightLabel(usable.reduce((n,s)=>n+s.weight,0))} remaining. Select one to remove.`:'No spools left in stock for this barcode.';
 $('#remove-matches').innerHTML=matches.map(s=>`<article class="removal-match"><h3>${esc(s.material)} · ${esc(s.color)}</h3><p>${esc(locationLabel(s.location)||'Not assigned')} · ${weightLabel(s.weight)} · ${esc(statusLabel(s.status))} · #${s.id}</p><button class="danger" data-remove="${s.id}">Remove spool #${s.id}</button></article>`).join('');
 }catch(e){if(request===removeRequest)$('#remove-message').textContent='Could not load stock: '+e.message}
}
function openRemoval(code=''){$('#remove-code').value=code;$('#remove-message').textContent='Scan or enter the barcode to find a spool.';$('#remove-matches').innerHTML='';$('#remove-dialog').showModal();if(code)findRemoval(code);else $('#remove-code').focus()}
async function improveFocus(){
 if(!scanner)return;
 try{const caps=scanner.getRunningTrackCapabilities();if(caps.focusMode?.includes('continuous'))await scanner.applyVideoConstraints({advanced:[{focusMode:'continuous'}]})}catch{}
}
$('#refocus').onclick=async()=>{if(!scanner)return;try{const caps=scanner.getRunningTrackCapabilities();if(caps.focusMode?.includes('single-shot')){await scanner.applyVideoConstraints({advanced:[{focusMode:'single-shot'}]});await improveFocus()}else{await improveFocus();toast('Hold the barcode 20–30 cm away in good light. Move slightly farther back if blurry.')}}catch{toast('Move slightly farther from the barcode to help the camera focus.')}};
let photoBusy=false,photoUrl=null,photoToken=0;
function resetPhoto(){photoToken++;document.querySelector('.scanner-options').open=false;if(photoUrl){URL.revokeObjectURL(photoUrl);photoUrl=null}$('#scan-photo-preview').hidden=true;$('#photo-status').textContent='';$('#retry-live').hidden=true;$('#take-photo').disabled=false;$('#reader').hidden=false}
$('#take-photo').onclick=async()=>{
 if(photoBusy||!scanner)return;
 const video=$('#reader video');if(!video||!video.videoWidth){toast('Wait for the camera to start.');return}
 photoBusy=true;scanHandled=true;$('#take-photo').disabled=true;
 const mode=scanMode,live=scanner,token=photoToken;
 try{
  const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Could not capture photo');
  if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=URL.createObjectURL(blob);$('#scan-photo-preview').src=photoUrl;$('#scan-photo-preview').hidden=false;$('#reader').hidden=true;$('#photo-status').textContent='Photo captured. Reading barcode…';
  await live.stop();live.clear();scanner=null;
  const code=await PhotoBarcode.read(canvas,message=>{$('#photo-status').textContent=message},()=>token!==photoToken||!$('#scanner').open);
  if(token!==photoToken||!$('#scanner').open)return;
  $('#photo-status').textContent='Barcode found. Loading stock…';
  if(mode==='remove'){
   // Keep the captured image visible until the stock request completes.
   const latest=await api('/api/spools');spools=latest;render();
   if(token!==photoToken||!$('#scanner').open)return;$('#scanner').close();openRemoval(code);
  }else{
   $('#scanner').close();openEditor({barcode:code});await match();
  }
 }catch(e){if($('#scanner').open){$('#photo-status').textContent='No readable barcode found. Keep the entire barcode sharp and well lit, then try again.';$('#retry-live').hidden=false}}
 finally{photoBusy=false}
};
$('#retry-live').onclick=async()=>{const mode=scanMode;await stop();resetPhoto();startScan(mode)};
async function startScan(mode){resetPhoto();scanMode=mode;scanHandled=false;$('#scan-title').textContent=mode==='remove'?'Scan to remove':'Scan to add';$('#scanner').showModal();try{scanner=new Html5Qrcode('reader');await scanner.start({facingMode:'environment'},{fps:12,disableFlip:true,videoConstraints:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},qrbox:(w,h)=>({width:Math.floor(w*0.9),height:Math.floor(Math.min(h*0.65,220))})},async code=>{if(scanHandled)return;scanHandled=true;await stop();if(mode==='remove'){openRemoval(code)}else{openEditor({barcode:code});await match();toast('Barcode scanned. Check the details and save your new spool.')}});await improveFocus()}catch(e){toast('Camera unavailable. Check camera permissions and the HTTPS certificate, or enter the barcode manually.')}}
$('#scan').onclick=()=>startScan('add');$('#scan-remove').onclick=()=>startScan('remove');
$('#stop').onclick=stop;$('#scanner').addEventListener('cancel',e=>{e.preventDefault();stop()});$('#manual').onclick=async()=>{const mode=scanMode;await stop();if(mode==='remove')openRemoval();else openEditor()};
$('#remove-close').onclick=()=>{removeRequest++;$('#remove-dialog').close()};$('#remove-dialog').addEventListener('cancel',()=>removeRequest++);
$('#remove-search').onsubmit=e=>{e.preventDefault();if(!removeBusy)findRemoval($('#remove-code').value)};
$('#remove-code').oninput=()=>{removeRequest++;$('#remove-matches').innerHTML='';$('#remove-message').textContent='Press Find matching spools to search this barcode.'};
$('#remove-matches').onclick=async e=>{
 const b=e.target.closest('[data-remove]');if(!b||removeBusy)return;
 const spool=spools.find(s=>s.id===Number(b.dataset.remove));if(!spool)return;
 const matching=Stock.matchingSpools(spools,spool.barcode);
 if(!confirm(`Permanently remove spool #${spool.id}?\n${spool.material} · ${spool.color}\n${locationLabel(spool.location)||'Not assigned'} · ${weightLabel(spool.weight)}\nOnly this spool will be deleted.\n${matching.length-1} spool${matching.length-1===1?'':'s'} will remain for this barcode.`))return;
 removeBusy=true;document.querySelectorAll('[data-remove]').forEach(x=>x.disabled=true);
 try{await api('/api/delete',{id:spool.id});await refresh();const remaining=Stock.matchingSpools(spools,spool.barcode);toast('Spool removed · '+remaining.length+' spool'+(remaining.length===1?'':'s')+' left for this barcode');if($('#remove-dialog').open)await findRemoval($('#remove-code').value)}catch(e){toast(e.message)}finally{removeBusy=false;document.querySelectorAll('[data-remove]').forEach(x=>x.disabled=false)}
};
$('#restore').onclick=()=>$('#file').click();$('#file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const obj=JSON.parse(await file.text());if(!confirm('Replace your entire current inventory with this backup?'))return;await api('/api/import',obj);await refresh();toast('Backup restored')}catch(e){toast('Could not restore backup: '+e.message)}finally{e.target.value=''}};refresh();setInterval(()=>{if(!document.hidden)refresh()},15000);

function showPage(section,updateUrl=true){
 if(!['stock','cabinets','scan'].includes(section))section='stock';
 document.querySelectorAll('[data-page]').forEach(el=>el.hidden=el.dataset.page!==section);
 document.querySelectorAll('[data-nav]').forEach(b=>{if(b.dataset.nav===section)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
 if(updateUrl&&location.hash!=='#'+section)location.hash=section;
 window.scrollTo({top:0,behavior:'instant'});
}
document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>showPage(b.dataset.nav));
window.addEventListener('hashchange',()=>showPage(location.hash.slice(1),false));
showPage(location.hash.slice(1)||'stock',false);
$('#cabinet-content').onclick=e=>{const b=e.target.closest('[data-edit]');if(b)openEditor(spools.find(s=>s.id===Number(b.dataset.edit)))};
