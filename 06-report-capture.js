/* ===================================================================
   REPORT CAPTURE  —  Call-Out & Shift forms (photo, signature, GPS)
   Reliability: the database row is saved FIRST and never lost; photos,
   signature and PDF are best-effort and never block the save.
   =================================================================== */
let CAPTURE = { photos:[], videos:[], sig:null, gps:null };

function engineerDatalist(){
  const set=new Set(DATA.engineers||[]);
  (ENGREG||[]).forEach(e=>{ if(e&&e.full_name&&e.status!=='Left') set.add(e.full_name); });   // master registry
  (DATA.teams||[]).forEach(t=>(Array.isArray(t.roster)?t.roster:[]).forEach(e=>{ if(e&&e.name) set.add(e.name); }));
  (DATA.sites||[]).forEach(s=>(Array.isArray(s.crew)?s.crew:[]).forEach(c=>{ if(c&&c.name) set.add(c.name); }));
  return `<datalist id="engList">${[...set].sort().map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`;
}
/* ---- multiple engineers on a report -------------------------------
   Renders a list of engineer inputs with an "add" button. The FIRST input
   keeps the base id (so existing required-field checks still work), and
   all names are joined with ", " into the single engineer field so every
   view, list, PDF and the HQ feed shows them with no schema change. */
function engRowHtml(base, name, first){
  return `<div class="engrow" style="display:flex;gap:6px;margin-bottom:5px"><input class="${base}_i" ${first?`id="${base}"`:''} list="engList" value="${esc(name||'')}" placeholder="Engineer name" style="flex:1">${first?'':`<button type="button" class="crew-rm" title="Remove" onclick="this.closest('.engrow').remove()">✕</button>`}</div>`;
}
function engMultiField(base, value){
  const names=String(value||'').split(',').map(s=>s.trim()).filter(Boolean); if(!names.length) names.push('');
  return `<div class="engmulti" id="${base}_wrap">${names.map((n,i)=>engRowHtml(base,n,i===0)).join('')}<button type="button" class="addbtn" style="margin-top:2px;font-size:12px" onclick="engMultiAdd('${base}')">＋ Add another engineer</button></div>`;
}
function engMultiAdd(base){ const w=el(base+'_wrap'); if(!w) return; const btn=w.querySelector('.addbtn'); const div=document.createElement('div'); div.className='engrow'; div.style.cssText='display:flex;gap:6px;margin-bottom:5px'; div.innerHTML=`<input class="${base}_i" list="engList" placeholder="Engineer name" style="flex:1"><button type="button" class="crew-rm" title="Remove" onclick="this.closest('.engrow').remove()">✕</button>`; w.insertBefore(div, btn); const inp=div.querySelector('input'); if(inp) inp.focus(); }
function engMultiCollect(base){ const w=el(base+'_wrap'); if(!w){ return val(base); } const names=[...w.querySelectorAll('.'+base+'_i')].map(i=>String(i.value||'').trim()).filter(Boolean); return names.join(', '); }
function engMultiSet(base, value){ const w=el(base+'_wrap'); if(!w){ const e=el(base); if(e) e.value=value||''; return; } const names=String(value||'').split(',').map(s=>s.trim()).filter(Boolean); if(!names.length) return; const btn=w.querySelector('.addbtn'); [...w.querySelectorAll('.engrow')].forEach(r=>r.remove()); names.forEach((n,i)=>{ const div=document.createElement('div'); div.className='engrow'; div.style.cssText='display:flex;gap:6px;margin-bottom:5px'; div.innerHTML=engRowHtml(base,n,i===0).replace(/^<div[^>]*>/,'').replace(/<\/div>$/,''); w.insertBefore(div, btn); }); }
function siteOptions(){
  return `<option value="">— none / general —</option>`+(DATA.sites||[]).map(s=>`<option value="${s.id}">${esc(s.code||s.city||'Site')} (${esc(s.city||'')})</option>`).join('');
}

const FORMS = {
  callout: {
    title:'New Call-Out Report', table:'callout_reports', prefix:'CO',
    fields:`
      <div class="frow">
        <div class="fld"><label>Site / location name <span class="req">*</span></label><input id="f_sitename" placeholder="e.g. Tesco RDC, Daventry"></div>
        <div class="fld"><label>Engineer(s) <span class="req">*</span></label>${engMultiField('f_engineer','')}</div>
      </div>
      <div class="frow">
        <div class="fld"><label>Site address / postcode</label><input id="f_siteaddr" placeholder="Address or postcode"></div>
        <div class="fld"><label>Link to a planned site (optional)</label><select id="f_site">${siteOptions()}</select></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Priority</label><select id="f_priority"><option>Priority 1</option><option selected>Priority 2</option><option>Priority 3</option><option>Priority 4</option></select></div>
        <div class="fld"><label>Status</label><select id="f_status"><option>Logged</option><option>On Site</option><option selected>In Progress</option><option>Temporary Repair Completed</option><option>Completed</option></select></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Asset reference</label><input id="f_asset" placeholder="e.g. Conveyor 3 / Rack A12"></div>
        <div class="fld"><label>Call-out type</label><input id="f_callout_type" placeholder="e.g. Breakdown"></div>
      </div>
      <div class="fld"><label>Fault description <span class="req">*</span></label><textarea id="f_fault" required placeholder="What's the fault?"></textarea></div>
      <div class="fld"><label>Work carried out</label><textarea id="f_work" placeholder="What did you do?"></textarea></div>
      <div class="frow">
        <div class="fld"><label>Parts used</label><input id="f_parts"></div>
        <div class="fld"><label>Downtime (mins)</label><input id="f_downtime" type="number" inputmode="numeric"></div>
      </div>
      <div class="fld check-row"><input type="checkbox" id="f_followup"><label style="margin:0">Follow-up / return visit required</label></div>
    `,
    collect(){return {
      site_id: val('f_site')||null, site_name: val('f_sitename')||null, site_address: val('f_siteaddr')||null,
      engineer: engMultiCollect('f_engineer'), priority: val('f_priority'),
      status: val('f_status'), asset_reference: val('f_asset'), callout_type: val('f_callout_type'),
      fault_description: val('f_fault'), work_carried_out: val('f_work'), parts_used: val('f_parts'),
      downtime_minutes: num('f_downtime'), follow_up_required: el('f_followup').checked,
      call_date: new Date().toISOString().slice(0,10)
    };},
    required:['f_sitename','f_engineer','f_fault']
  },
  shift: {
    title:'New Shift Report', table:'shift_reports', prefix:'SH',
    fields:`
      <div class="frow">
        <div class="fld"><label>Site / location name <span class="req">*</span></label><input id="f_sitename" placeholder="e.g. Ocado CFC, Erith"></div>
        <div class="fld"><label>Engineer(s) <span class="req">*</span></label>${engMultiField('f_engineer','')}</div>
      </div>
      <div class="frow">
        <div class="fld"><label>Site address / postcode</label><input id="f_siteaddr" placeholder="Address or postcode"></div>
        <div class="fld"><label>Link to a planned site (optional)</label><select id="f_site">${siteOptions()}</select></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Shift</label><select id="f_shift"><option selected>Day</option><option>Night</option></select></div>
        <div class="fld"><label>Hours worked</label><input id="f_hours" type="number" inputmode="decimal" step="0.5"></div>
      </div>
      <div class="fld"><label>Status</label><select id="f_status"><option selected>Complete</option><option>In Progress</option><option>Issue Raised</option></select></div>
      <div class="fld"><label>Work completed <span class="req">*</span></label><textarea id="f_work" required placeholder="Summary of the shift's work"></textarea></div>
      <div class="fld"><label>Issues / handover notes</label><textarea id="f_issues" placeholder="Anything for the next shift / office"></textarea></div>
      <div class="fld check-row"><input type="checkbox" id="f_nearmiss"><label style="margin:0">Near-miss / safety event this shift</label></div>
    `,
    collect(){return {
      site_id: val('f_site')||null, site_name: val('f_sitename')||null, site_address: val('f_siteaddr')||null,
      engineer: engMultiCollect('f_engineer'), shift: val('f_shift'),
      hours_worked: num('f_hours'), status: val('f_status'), work_completed: val('f_work'),
      issues: val('f_issues'), near_miss: el('f_nearmiss').checked?'Yes':'No',
      shift_date: new Date().toISOString().slice(0,10)
    };},
    required:['f_sitename','f_engineer','f_work']
  }
};
function val(id){const e=el(id);return e?String(e.value||'').trim():'';}
function num(id){const v=val(id);return v===''?null:Number(v);}

/* Forces the engineer to confirm the client before submitting a report, so
   reports can't go to the wrong (pre-selected) client. Choosing one switches
   the working client and reloads its sites. */
function clientPickField(formType, preselect){
  const opts=(CLIENTS||[]).map(c=>`<option value="${c.id}" ${preselect&&CLIENT&&c.id===CLIENT.id?'selected':''}>${esc(c.name)}</option>`).join('');
  return `<div class="fld clientpick"><label>Client this report is for <span class="req">*</span></label>
    <select id="f_client" onchange="repPickClient(this.value,'${formType}')"><option value="">— Select the client —</option>${opts}</select>
    <div class="note" style="margin-top:5px;color:var(--amber)">⚠ Double-check this is the right client — the report saves to whoever is selected here.</div></div>`;
}
async function repPickClient(id, formType){
  if(!id) return;
  const c=(CLIENTS||[]).find(x=>x.id===id); if(!c) return;
  CLIENT=c;
  const sel=el('cliSelect'); if(sel) sel.value=c.id;
  const crumb=document.querySelector('.crumb'); if(crumb) crumb.textContent=c.name;
  await loadClientData();
  closeForm();
  if(formType==='install') openInstallForm(null,true);
  else openForm(formType,true);
}
function openForm(type, fromPick, rec){
  if(!CLIENT){ alert('Pick a client first.'); return; }
  const f=FORMS[type]; if(!f) return;
  const editing = rec && rec.id;
  CAPTURE={photos:[],videos:[],sig:null,gps:null};
  const wrap=document.createElement('div');
  wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>${editing?('Edit '+f.title.replace('New ','')):f.title}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      ${clientPickField(type, editing||fromPick)}
      ${engineerDatalist()}
      ${f.fields}
      <div class="fld"><label>Photos</label><div class="photos" id="photoWrap">
        <label class="photo-add">＋<input type="file" accept="image/*,video/*" multiple style="display:none" id="photoInput"></label>
      </div></div>
      <div class="fld"><label>Customer signature</label><div id="sigExistingWrap"></div><canvas class="sigpad" id="sigpad"></canvas>
        <div><input id="f_signname" placeholder="Name of person signing" style="margin-top:8px"><button type="button" class="sig-clear" onclick="clearSig()">Clear signature</button></div></div>
      <div class="gps-note" id="gpsNote">📍 Capturing location…</div>
    </div>
    <div class="modal-foot">
      <button class="btn-ghost" onclick="closeForm()">Cancel</button>
      <button class="btn" id="saveBtn" onclick="submitForm('${type}',${editing?`'${rec.id}'`:'null'})">${editing?'Save changes':'Submit report'}</button>
    </div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
  setupPhoto(); setupSig(); if(!editing) captureGps();
  if(editing){
    prefillForm(type, rec);
    if(Array.isArray(rec.media_links)) CAPTURE.existing=rec.media_links.slice();
    // Show the signature already on file so an edit doesn't look like it lost it.
    if(rec.signature_url){
      const w=el('sigExistingWrap');
      if(w){
        w.innerHTML=`<div style="border:1px solid var(--line2);border-radius:10px;background:#fff;padding:6px;margin-bottom:8px">
          <img src="${esc(rec.signature_url)}" alt="Customer signature on file" style="display:block;max-width:100%;height:70px;object-fit:contain">
        </div><div class="csub" style="margin:-2px 0 8px">Signature already on file${rec.customer_sign_name?(' — '+esc(rec.customer_sign_name)):''}. Only draw below if you need to replace it.</div>`;
      }
    }
  }
}
function prefillForm(type, r){
  const map={
    callout:{f_sitename:'site_name',f_engineer:'engineer',f_siteaddr:'site_address',f_site:'site_id',f_priority:'priority',f_status:'status',f_asset:'asset_reference',f_callout_type:'callout_type',f_fault:'fault_description',f_work:'work_carried_out',f_parts:'parts_used',f_downtime:'downtime_minutes',f_signname:'customer_sign_name'},
    shift:{f_sitename:'site_name',f_engineer:'engineer',f_siteaddr:'site_address',f_site:'site_id',f_shift:'shift',f_hours:'hours_worked',f_status:'status',f_work:'work_completed',f_issues:'issues',f_signname:'customer_sign_name'}
  }[type]||{};
  Object.keys(map).forEach(id=>{ if(id==='f_engineer') return; const e=el(id); if(e && r[map[id]]!=null) e.value=r[map[id]]; });
  engMultiSet('f_engineer', r.engineer);
  if(type==='callout'){ const c=el('f_followup'); if(c) c.checked=!!r.follow_up_required; }
  if(type==='shift'){ const c=el('f_nearmiss'); if(c) c.checked=(r.near_miss==='Yes'||r.near_miss===true); }
}
function closeForm(){ try{ stopInstallAutosave(); }catch(e){} if(SIG_RESIZE){ window.removeEventListener('resize',SIG_RESIZE); SIG_RESIZE=null; } if(SIG_MOUSEUP){ window.removeEventListener('mouseup',SIG_MOUSEUP); SIG_MOUSEUP=null; } const m=el('modalBg'); if(m) m.remove(); }

/* photos */
function setupPhoto(){
  el('photoInput').addEventListener('change', e=>{
    [...e.target.files].forEach(file=>{
      if((file.type||'').startsWith('video')){
        CAPTURE.videos=CAPTURE.videos||[]; CAPTURE.videos.push(file); renderThumbs();
      } else {
        const r=new FileReader();
        r.onload=ev=>{ CAPTURE.photos.push(ev.target.result); renderThumbs(); };
        r.readAsDataURL(file);
      }
    });
    e.target.value='';
  });
}
function renderThumbs(){
  const w=el('photoWrap'); if(!w) return;
  w.querySelectorAll('.thumb,.vthumb').forEach(t=>t.remove());
  CAPTURE.photos.forEach(src=>{ const img=document.createElement('img'); img.className='thumb'; img.src=src; w.insertBefore(img, w.firstChild); });
  (CAPTURE.videos||[]).forEach(file=>{ const d=document.createElement('div'); d.className='vthumb'; let nm=esc(file.name||'video'); if(nm.length>14)nm=nm.slice(0,12)+'…'; d.innerHTML='🎬<span>'+nm+'</span>'; w.insertBefore(d, w.firstChild); });
}
/* signature */
let SIG_RESIZE=null, SIG_MOUSEUP=null;
function setupSig(){
  const c=el('sigpad'); if(!c) return;
  const ctx=c.getContext('2d');
  let drawing=false, has=false;
  /* Size the canvas backing store from the laid-out box. If the modal has not
     been laid out yet offsetWidth is 0 — a zero-width canvas silently produces
     a blank PNG, which is why some signatures came back empty. Fall back to the
     parent width, re-check on first paint, and re-size on rotate/resize
     (preserving anything already drawn). */
  const sizeCanvas=()=>{
    const w=Math.round(c.offsetWidth||(c.parentElement?c.parentElement.clientWidth:0)||320);
    const h=Math.round(c.offsetHeight||140);
    if(c.width===w*2 && c.height===h*2) return;
    const had=has?c.toDataURL('image/png'):null;
    c.width=w*2; c.height=h*2;
    ctx.setTransform(1,0,0,1,0,0); ctx.scale(2,2);
    ctx.lineWidth=2; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle='#0f2033';
    if(had){ const img=new Image(); img.onload=()=>{ try{ ctx.drawImage(img,0,0,w,h); }catch(e){} }; img.src=had; }
  };
  sizeCanvas();
  if(window.requestAnimationFrame) requestAnimationFrame(sizeCanvas);
  if(SIG_RESIZE) window.removeEventListener('resize',SIG_RESIZE);
  SIG_RESIZE=sizeCanvas; window.addEventListener('resize',SIG_RESIZE);
  const pos=e=>{const r=c.getBoundingClientRect();const t=e.touches?e.touches[0]:e;return [t.clientX-r.left, t.clientY-r.top];};
  const start=e=>{e.preventDefault();sizeCanvas();drawing=true;const[x,y]=pos(e);ctx.beginPath();ctx.moveTo(x,y);};
  /* `has` is only set once the pen actually MOVES, so a stray tap on the pad
     can no longer overwrite a real signature with a blank image. */
  const move=e=>{if(!drawing)return;e.preventDefault();has=true;const[x,y]=pos(e);ctx.lineTo(x,y);ctx.stroke();};
  const end=()=>{ if(!drawing) return; drawing=false; if(has) CAPTURE.sig=c.toDataURL('image/png'); };
  c.__sigReset=()=>{ has=false; };
  if(SIG_MOUSEUP) window.removeEventListener('mouseup',SIG_MOUSEUP);
  SIG_MOUSEUP=end;
  c.addEventListener('mousedown',start);c.addEventListener('mousemove',move);window.addEventListener('mouseup',SIG_MOUSEUP);
  c.addEventListener('touchstart',start,{passive:false});c.addEventListener('touchmove',move,{passive:false});c.addEventListener('touchend',end);c.addEventListener('touchcancel',end);
}
function clearSig(){
  const c=el('sigpad');
  if(c){ const ctx=c.getContext('2d'); ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,c.width,c.height); ctx.restore(); if(c.__sigReset) c.__sigReset(); }
  CAPTURE.sig=null;
  // If a signature was already on file, clearing means "remove it" — drop the
  // preview and flag it so the edit actually unsets signature_url.
  const w=el('sigExistingWrap');
  if(w && w.innerHTML){ w.innerHTML='<div class="csub" style="margin-bottom:8px">Stored signature will be removed when you save.</div>'; CAPTURE.sigRemove=true; }
}
/* gps */
function captureGps(){
  const n=el('gpsNote'); if(!navigator.geolocation){ if(n)n.textContent='📍 Location not available on this device'; return; }
  navigator.geolocation.getCurrentPosition(
    p=>{ CAPTURE.gps={lat:p.coords.latitude,lng:p.coords.longitude,acc:Math.round(p.coords.accuracy)}; if(n)n.textContent=`📍 Location captured (±${CAPTURE.gps.acc}m)`; },
    ()=>{ if(n)n.textContent='📍 Location permission declined (report will still save)'; },
    {enableHighAccuracy:true,timeout:8000}
  );
}

/* upload a dataURL to Supabase Storage, return public URL (or null on failure) */
async function uploadBlob(blob, path, contentType){
  try{
    const {error}=await sb.storage.from('evidence').upload(path, blob, {contentType:contentType||blob.type||'application/octet-stream', upsert:true});
    if(error){ console.warn('upload failed',error); return null; }
    return sb.storage.from('evidence').getPublicUrl(path).data.publicUrl;
  }catch(e){ console.warn('upload error',e); return null; }
}
/* Upload a sensitive file to the PRIVATE 'secure' bucket. Returns the PATH
   (not a public URL) — the file is only reachable via a short-lived signed
   link created for a permitted user. */
async function uploadSecure(blob, path, contentType){
  try{
    const {error}=await sb.storage.from('secure').upload(path, blob, {contentType:contentType||blob.type||'application/octet-stream', upsert:true});
    if(error){ console.warn('secure upload failed',error); return null; }
    return path;
  }catch(e){ console.warn('secure upload error',e); return null; }
}
/* Open a sensitive file via a short-lived signed URL (60s). RLS decides
   whether the current user is allowed — if not, they get nothing. */
async function viewSecure(path){
  if(!path) return;
  try{
    const {data,error}=await sb.storage.from('secure').createSignedUrl(path, 60);
    if(error||!data||!data.signedUrl){ alert('Sorry — that document could not be opened (you may not have access).'); return; }
    window.open(data.signedUrl,'_blank','noopener');
  }catch(e){ alert('Sorry — that document could not be opened.'); }
}
/* A green/amber/red chip for an EU-travel item based on status + expiry. */
function travelChip(label, status, expiry){
  let c='grey', txt=status||'—';
  if(status==='Not required'){ c='grey'; }
  else if(status==='Held'||status==='Valid'){ c=cardStatus(expiry).c==='red'?'red':(cardStatus(expiry).c==='amber'?'amber':'green'); if(expiry) txt=(cardStatus(expiry).label?('Held · '+cardStatus(expiry).label):'Held'); }
  else if(status==='Applied'){ c='amber'; }
  else if(status==='Expired'){ c='red'; }
  return `<span class="chip ${c}">${esc(label)}: ${esc(txt)}</span>`;
}
async function uploadDataUrl(dataUrl, path){
  try{ const blob=await (await fetch(dataUrl)).blob(); return await uploadBlob(blob, path, blob.type||'image/jpeg'); }
  catch(e){ console.warn('upload error',e); return null; }
}
/* Update a row with best-effort resilience: if the table is missing one of the
   optional columns we are writing (e.g. signature_url before the migration has
   been run), drop that key and retry so the rest of the write-back still lands
   instead of the whole patch being silently swallowed. */
async function savePatch(table, id, patch){
  const dropped=[];
  if(!id) return {error:{message:'no record id'}, dropped, ok:false};
  const body=Object.assign({}, patch||{});           // never mutate the caller's object
  if(!Object.keys(body).length) return {error:null, dropped, ok:true};
  let {error}=await sb.from(table).update(body).eq('id',id);
  let guard=0;
  while(error && guard++<5 && /find the '.*?' column|column .*? does not exist|schema cache/i.test(error.message||'')){
    // PostgREST says:  Could not find the 'signature_url' column of 'x' in the schema cache
    // Postgres says:   column "signature_url" of relation "x" does not exist
    const m=/'([\w.]+)' column/.exec(error.message||'') || /column "?([\w.]+)"?/i.exec(error.message||'');
    const bad=m?m[1].replace(/^.*\./,''):null;
    if(!bad || !(bad in body)) break;
    console.warn('savePatch: table "'+table+'" has no "'+bad+'" column — skipping it. Run signature_fix_migration.sql to enable it.');
    dropped.push(bad); delete body[bad];
    if(!Object.keys(body).length) return {error:null, dropped, ok:false};
    const r=await sb.from(table).update(body).eq('id',id); error=r.error;
  }
  if(error) console.warn('savePatch failed',table,error);
  return {error:error||null, dropped, ok:!error && !dropped.length};
}
/* Uploads all captured photos AND videos for a report, records them in the
   media gallery (with image/video type), and returns the list of URLs. */
async function uploadCapture(reportType, reportId, pathBase){
  const urls=[];
  for(let i=0;i<CAPTURE.photos.length;i++){
    const u=await uploadDataUrl(CAPTURE.photos[i], `${pathBase}/photo${i+1}.jpg`);
    if(u){ urls.push(u); try{ await sb.from('media').insert({client_id:CLIENT.id,report_type:reportType,report_id:reportId||null,file_url:u,media_type:'image'}); }catch(e){} }
  }
  const vids=CAPTURE.videos||[];
  for(let i=0;i<vids.length;i++){
    const f=vids[i]; let ext=((f.name||'').split('.').pop()||'mp4').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,5)||'mp4';
    const u=await uploadBlob(f, `${pathBase}/video${i+1}.${ext}`, f.type||'video/mp4');
    if(u){ urls.push(u); try{ await sb.from('media').insert({client_id:CLIENT.id,report_type:reportType,report_id:reportId||null,file_url:u,media_type:'video'}); }catch(e){} }
  }
  return urls;
}

/* SUBMIT — DB row first (never lost), then best-effort media + PDF */
async function submitForm(type, editId){
  const f=FORMS[type];
  if(!val('f_client')){ msg('Please choose the client this report is for.','err'); const c=el('f_client'); if(c)c.focus(); return; }
  for(const id of f.required){ if(!val(id)){ msg('Please fill in the required fields.','err'); el(id).focus(); return; } }
  const btn=el('saveBtn'); btn.disabled=true; btn.textContent='Saving…'; msg('','');
  // ---- EDIT MODE (admins): update the existing report in place ----
  if(editId){
    const erow=f.collect();
    if(type==='callout'){ erow.customer_sign_name=val('f_signname')||null; }
    const {error}=await sb.from(f.table).update(erow).eq('id',editId);
    if(error){ btn.disabled=false; btn.textContent='Save changes'; msg('Could not save: '+error.message,'err'); return; }
    const eref=(f.prefix+'-EDIT-'+editId);
    // append any newly-added photos/videos (existing media is kept)
    if(CAPTURE.photos.length || (CAPTURE.videos||[]).length){ btn.textContent='Uploading media…'; const urls=await uploadCapture(type, editId, `${CLIENT.slug}/${eref}`);
      if(type==='shift' && urls.length){ try{ const merged=(CAPTURE.existing||[]).concat(urls); await sb.from(f.table).update({media_links:merged}).eq('id',editId); }catch(e){} } }
    // A signature drawn during an edit used to be dropped on the floor. Upload
    // it and store the link.
    const existing=(type==='callout'?(DATA.callouts||[]):(DATA.shifts||[])).find(x=>x.id===editId)||{};
    const epatch={};
    if(type==='shift') epatch.customer_sign_name=val('f_signname')||null;
    let sigNote='';
    if(CAPTURE.sig){
      btn.textContent='Saving signature…';
      const su=await uploadDataUrl(CAPTURE.sig, `${CLIENT.slug}/${eref}/signature.png`);
      if(su){ epatch.signature_url=su; epatch.pdf_url=null; }
      else sigNote=' (signature could not be uploaded — please re-sign)';
    } else if(CAPTURE.sigRemove){
      epatch.signature_url=null; epatch.pdf_url=null;
    } else if(existing.signature_url){
      // Safe to rebuild: the signature is on the record, so drop the stale PDF.
      epatch.pdf_url=null;
    }
    // NOTE: for a pre-migration record with no signature_url, the stored PDF is
    // the ONLY copy of the signature — so pdf_url is deliberately left alone.
    const eres=await savePatch(f.table, editId, epatch);
    if(eres.dropped.includes('signature_url')) sigNote=' (signature not stored — run signature_fix_migration.sql)';
    msg('✓ Report updated.'+sigNote, sigNote?'err':'ok'); await loadClientData();
    setTimeout(()=>{ closeForm(); go(type==='callout'?'callouts':'shifts'); }, 700); return;
  }
  const ref=f.prefix+'-'+Date.now();
  const row=Object.assign(f.collect(), {
    client_id: CLIENT.id,
    submitted_at: new Date().toISOString(),
    latitude: CAPTURE.gps?CAPTURE.gps.lat:null,
    longitude: CAPTURE.gps?CAPTURE.gps.lng:null
  });
  if(type==='callout'){ row.job_number=ref; row.customer_sign_name=val('f_signname')||null; }
  // 1) Save the row — this is the source of truth.
  //    Resilient: if a table is missing an optional column (e.g. latitude on
  //    some report tables), strip the optional fields and retry so the
  //    engineer's report is never lost.
  let {data:ins,error}=await sb.from(f.table).insert(row).select().maybeSingle();
  if(error && /find the '.*' column|schema cache|column .* does not exist/i.test(error.message||'')){
    const core=Object.assign({},row); delete core.latitude; delete core.longitude; delete core.map_link;
    const r2=await sb.from(f.table).insert(core).select().maybeSingle(); ins=r2.data; error=r2.error;
  }
  if(error){ btn.disabled=false; btn.textContent='Submit report'; msg('Could not save: '+error.message,'err'); return; }
  const id=ins?ins.id:null;
  // 2) Best-effort: upload photos & videos + signature, generate PDF
  btn.textContent='Uploading media…';
  const photoUrls=await uploadCapture(type, id, `${CLIENT.slug}/${ref}`);
  let sigUrl=null, sigWarn=false;
  if(CAPTURE.sig) sigUrl=await uploadDataUrl(CAPTURE.sig, `${CLIENT.slug}/${ref}/signature.png`);
  // PDF
  btn.textContent='Building PDF…';
  let pdfUrl=null;
  try{ const pdfData=buildPdf(type, row, ref); if(pdfData) pdfUrl=await uploadDataUrl(pdfData, `${CLIENT.slug}/${ref}/report.pdf`); }catch(e){ console.warn('pdf failed',e); }
  // 3) write back the links — including the signature, which previously was
  //    uploaded and then discarded, so nothing on the record ever pointed at it.
  try{
    const patch={pdf_url:pdfUrl};
    if(sigUrl) patch.signature_url=sigUrl;
    if(type==='shift'){ patch.media_links=photoUrls; patch.customer_sign_name=val('f_signname')||null; }
    if(type==='callout'){ patch.map_link=CAPTURE.gps?`https://maps.google.com/?q=${CAPTURE.gps.lat},${CAPTURE.gps.lng}`:null; }
    const res=await savePatch(f.table, id, patch);
    if(sigUrl && (res.error || res.dropped.includes('signature_url'))) sigWarn=true;
  }catch(e){ console.warn('write-back failed',e); if(sigUrl) sigWarn=true; }
  // Only claim the signature is attached if it actually reached the record.
  if(CAPTURE.sig && !sigUrl) sigWarn=true;
  msg(sigWarn
    ? '✓ Report saved, but the customer signature could not be attached — open the report and re-sign.'
    : ('✓ Report saved'+(sigUrl?' — signature attached':'')+(pdfUrl?' — PDF generated':'')+'.'),
    sigWarn?'err':'ok');
  await notifyClient(CLIENT.id, 'report', (type==='callout'?'New call-out report':'New shift report')+' added', type==='callout'?'callouts':'shifts', 'A new report has been added to your dashboard.');
  await loadClientData();
  setTimeout(()=>{ closeForm(); go(type==='callout'?'callouts':'shifts'); }, 900);
}
function msg(t,c){ const m=el('saveMsg'); if(m){ m.textContent=t; m.className='savemsg '+(c||''); } }

/* branded PDF via jsPDF */
function buildPdf(type, row, ref){
  if(!window.jspdf) return null;
  const {jsPDF}=window.jspdf; const doc=new jsPDF({unit:'pt',format:'a4'});
  const W=595; let y=48;
  doc.setFillColor(10,14,22); doc.rect(0,0,W,70,'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.text('MERCURY', 40, 38);
  doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(180,200,220); doc.text('Automated Solutions — Operations', 40, 54);
  doc.setTextColor(15,32,51); doc.setFont('helvetica','bold'); doc.setFontSize(15);
  y=100; doc.text((type==='callout'?'Call-Out Report':'Shift Report'), 40, y);
  doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(90,107,128);
  doc.text(`${CLIENT.name}   ·   Ref ${ref}   ·   ${new Date().toLocaleString('en-GB')}`, 40, y+16);
  doc.setDrawColor(225,235,243); doc.line(40,y+26,W-40,y+26); y+=44;
  const line=(k,v)=>{ if(v==null||v==='')return; doc.setFont('helvetica','bold');doc.setTextColor(90,107,128);doc.setFontSize(9);doc.text(k.toUpperCase(),40,y);
    doc.setFont('helvetica','normal');doc.setTextColor(15,32,51);doc.setFontSize(11);
    const lines=doc.splitTextToSize(String(v),W-80); doc.text(lines,40,y+14); y+=14+lines.length*13+8; };
  const site=(DATA.sites.find(s=>s.id===row.site_id)||{});
  line('Site', site.code?`${site.code} — ${site.city||''}`:'General');
  line('Engineer', row.engineer);
  if(type==='callout'){ line('Priority',row.priority); line('Status',row.status); line('Asset',row.asset_reference); line('Fault',row.fault_description); line('Work carried out',row.work_carried_out); line('Parts used',row.parts_used); if(row.downtime_minutes!=null)line('Downtime (mins)',row.downtime_minutes); line('Follow-up required',row.follow_up_required?'Yes':'No'); }
  else { line('Shift',row.shift); line('Hours worked',row.hours_worked); line('Status',row.status); line('Work completed',row.work_completed); line('Issues / handover',row.issues); line('Near-miss',row.near_miss); }
  if(CAPTURE.gps) line('Location', `${CAPTURE.gps.lat.toFixed(5)}, ${CAPTURE.gps.lng.toFixed(5)} (±${CAPTURE.gps.acc}m)`);
  // photos
  CAPTURE.photos.slice(0,4).forEach((p,i)=>{ if(y>720){doc.addPage();y=48;} try{ doc.addImage(p,'JPEG',40+(i%2)*media_w(),y,media_w()-10,110); if(i%2===1)y+=120; }catch(e){} });
  if(CAPTURE.photos.length%2===1)y+=120;
  // signature
  if(CAPTURE.sig){ if(y>660){doc.addPage();y=48;} doc.setFont('helvetica','bold');doc.setTextColor(90,107,128);doc.setFontSize(9);doc.text('CUSTOMER SIGNATURE',40,y); try{doc.addImage(CAPTURE.sig,'PNG',40,y+8,200,80);}catch(e){} const sn=row.customer_sign_name||val('f_signname'); if(sn){doc.setFont('helvetica','normal');doc.setTextColor(15,32,51);doc.setFontSize(10);doc.text(String(sn),40,y+104);} }
  doc.setTextColor(150,160,175);doc.setFontSize(8);doc.text('Generated by Mercury Operations Platform',40,820);
  return doc.output('datauristring');
}
function media_w(){ return 257; }

