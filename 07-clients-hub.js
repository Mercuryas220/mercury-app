/* ============ CLIENTS HUB (admin landing) ============ */
let LOGINS=[], ENGHR=[], ENGREG=[];
async function loadEngHr(){ if(PROFILE.role!=='admin'){ ENGHR=[]; return; } try{ const r=await sb.from('engineer_hr').select('*'); ENGHR=r.data||[]; }catch(e){ ENGHR=[]; } }
/* Master engineer registry (the canonical Mercury team list) */
async function loadEngReg(){ if(PROFILE.role!=='admin'){ ENGREG=[]; return; } try{ const r=await sb.from('engineers').select('*').order('full_name'); ENGREG=(r.data||[]).filter(e=>String(e.engineer_type||'internal')!=='agency'); }catch(e){ ENGREG=[]; } }
function engRegFor(name){ const k=String(name||'').trim().toLowerCase(); return (ENGREG||[]).find(e=>String(e.full_name||'').trim().toLowerCase()===k)||null; }
async function loadLogins(){ if(PROFILE.role!=='admin'){ LOGINS=[]; return; } try{ const r=await sb.from('profiles').select('id,email,role,client_id,supplier_id'); LOGINS=r.data||[]; }catch(e){ LOGINS=[]; } }

/* ===== SUPPLIERS: data loaders ===== */
// Admin: pull every supplier + all their engineers/assignments/timesheets/ratings for the hub & Job Status.
async function loadSuppliers(){
  if(PROFILE.role!=='admin'){ SUPPLIERS=[]; SDATA=emptySup(); RATECARD=[]; PROJFIN=[]; PLACEMENTS=[]; ALLTEAMS=[]; return; }
  try{
    const [s,e,a,t,r,d,rc,pf,pl,tm]=await Promise.all([
      sb.from('suppliers').select('*').order('name'),
      sb.from('supplier_engineers').select('*'),
      sb.from('supplier_assignments').select('*'),
      sb.from('supplier_timesheets').select('*'),
      sb.from('supplier_ratings').select('*'),
      sb.from('supplier_documents').select('*'),
      sb.from('rate_card').select('*'),
      sb.from('project_finance').select('*'),
      sb.from('agency_placement').select('*'),
      sb.from('teams').select('id,name,client_id')
    ]);
    SUPPLIERS=s.data||[];
    SDATA={engineers:e.data||[], assignments:a.data||[], timesheets:t.data||[], ratings:r.data||[], documents:d.data||[]};
    RATECARD=rc.data||[]; PROJFIN=pf.data||[]; PLACEMENTS=pl.data||[]; ALLTEAMS=tm.data||[];
  }catch(err){ SUPPLIERS=[]; SDATA=emptySup(); RATECARD=[]; PROJFIN=[]; PLACEMENTS=[]; ALLTEAMS=[]; console.warn('loadSuppliers failed',err&&err.message); }
}
// Supplier login: RLS returns only this supplier's rows.
async function loadSupplierData(){
  SDATA=emptySup(); SUPPLIER=null;
  try{
    const s=await sb.from('suppliers').select('*').maybeSingle();
    SUPPLIER=s.data||null;
    if(!SUPPLIER){ return; }
    const [e,a,t,r,d]=await Promise.all([
      sb.from('supplier_engineers').select('*').order('full_name'),
      sb.from('supplier_assignments').select('*').order('start_date',{ascending:false}),
      sb.from('supplier_timesheets').select('*').order('work_date',{ascending:false}),
      sb.from('supplier_ratings').select('*').order('created_at',{ascending:false}),
      sb.from('supplier_documents').select('*')
    ]);
    SDATA={engineers:e.data||[], assignments:a.data||[], timesheets:t.data||[], ratings:r.data||[], documents:d.data||[]};
    await loadSupNotifs();
  }catch(err){ console.warn('loadSupplierData failed',err&&err.message); }
}
// resolve a client/site/engineer name for display
function supClientName(id){ const c=(CLIENTS||[]).find(x=>x.id===id); return c?c.name:''; }
function supEngName(id){ const e=(SDATA.engineers||[]).find(x=>x.id===id); return e?e.full_name:'—'; }
function pageClients(){
  const isAdmin=PROFILE.role==='admin';
  const header=`<div class="sechead"><h3>Clients</h3><span class="sub">${CLIENTS.length} client${CLIENTS.length===1?'':'s'} · open one, or add a new one</span><span class="line"></span>${isAdmin?`<button class="addbtn" onclick="openClientForm()">＋ Add client</button>`:''}</div>`;
  const help = isAdmin ? `<div class="card tip" style="margin-bottom:14px;background:linear-gradient(180deg,rgba(34,197,94,.08),rgba(56,189,248,.05));border:1px solid var(--line2)"><h4 style="margin-bottom:6px">➕ Adding a new client — 3 simple steps</h4><div class="csub" style="margin:0">1. Tap <b>＋ Add client</b> and give it a name. &nbsp; 2. In Supabase → Authentication → Users, <b>Add user</b> (their email + a password). &nbsp; 3. Back here, tap <b>🔗 Link login</b> on the client and paste that email. Done — no SQL.</div></div>` : '';
  if(!CLIENTS.length) return header+help+emptyState('🗂','No clients yet','Tap “Add client” to create your first one.');
  return header + help +
    `<div class="teamgrid">${CLIENTS.map(c=>{
      const logins=(LOGINS||[]).filter(l=>l.client_id===c.id);
      const loginHtml = isAdmin ? `<div class="meta" style="align-items:flex-start"><span>Login</span><b style="text-align:right">${logins.length?logins.map(l=>`<span class="chip green" style="margin:1px 0 1px 4px">${esc(l.email)}</span>`).join('<br>'):'<span class="chip amber">none linked yet</span>'}</b></div>` : '';
      return `<div class="teamcard">
        <div class="th"><div class="nm"><span class="tdot" style="background:${esc(c.brand_color||'#38bdf8')}"></span>${esc(c.name)}</div>${isAdmin?`<button class="edit-btn" onclick="event.stopPropagation();openClientForm('${c.id}')">Edit</button>`:''}</div>
        ${c.programme_title?`<div class="meta"><span>Programme</span><b>${esc(c.programme_title)}</b></div>`:''}
        ${loginHtml}
        <div style="margin-top:11px"><button class="btn" style="width:100%;padding:9px" onclick="enterClient('${c.id}')">Open dashboard →</button></div>
        ${isAdmin?`<div style="display:flex;gap:8px;margin-top:8px"><button class="edit-btn" style="flex:1" onclick="openLinkLogin('${c.id}')">🔗 Link login</button><button class="edit-btn" style="flex:none;color:var(--red)" onclick="deleteClient('${c.id}')" title="Delete client">🗑</button></div>`:''}
      </div>`;}).join('')}</div>
     <div class="note" style="margin-top:14px">Tip: you can also switch client any time using the dropdown at the top of the screen.</div>`;
}
function openLinkLogin(clientId){
  const c=CLIENTS.find(x=>x.id===clientId)||{};
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal" style="max-width:520px">
    <div class="modal-h"><h3>Link a login to ${esc(c.name)}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="box see" style="background:var(--panel2);border:1px dashed var(--line2);border-radius:10px;padding:12px 14px;font-size:12.5px;color:var(--muted);margin-bottom:14px">
        <b>First</b>, create the login in Supabase → <b>Authentication → Users → Add user</b> (their email &amp; a password).<br><b>Then</b> paste that exact email below and tap Link. That login will only ever see ${esc(c.name)}.</div>
      <div class="fld"><label>Login email <span class="req">*</span></label><input id="ll_email" placeholder="e.g. as@portal.mercuryas.co.uk"></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="llSave" onclick="submitLinkLogin('${clientId}')">🔗 Link login</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
async function submitLinkLogin(clientId){
  const email=val('ll_email').trim(); if(!email){ msg('Please enter the login email.','err'); return; }
  const btn=el('llSave'); btn.disabled=true; btn.textContent='Linking…'; msg('','');
  let prof=null;
  try{ const r=await sb.from('profiles').select('id,email').ilike('email',email).limit(1); prof=(r.data&&r.data[0])||null; }catch(e){}
  if(!prof){ btn.disabled=false; btn.textContent='🔗 Link login'; msg('No account found for that email yet. Create it first in Supabase → Authentication → Users, then try again.','err'); return; }
  const {error}=await sb.from('profiles').update({role:'client', client_id:clientId}).eq('id',prof.id);
  if(error){ btn.disabled=false; btn.textContent='🔗 Link login'; msg('Could not link: '+error.message,'err'); return; }
  msg('✓ Linked. That login now sees only this client.','ok');
  await loadLogins(); setTimeout(()=>{ closeForm(); renderShell(); go('clients'); }, 800);
}
async function deleteClient(clientId){
  const c=CLIENTS.find(x=>x.id===clientId)||{};
  if(!confirm('Delete "'+(c.name||'this client')+'" and ALL of its sites, reports, photos, documents and schedule?\n\nThis cannot be undone. Any login attached will be unlinked (the Supabase account itself stays — delete that in Supabase if you no longer need it).')) return;
  try{
    await sb.from('profiles').update({client_id:null}).eq('client_id',clientId);
    const {error}=await sb.from('clients').delete().eq('id',clientId);
    if(error){ alert('Could not delete: '+error.message); return; }
  }catch(e){ alert('Could not delete: '+(e.message||e)); return; }
  if(CLIENT && CLIENT.id===clientId) CLIENT=CLIENTS.find(x=>x.id!==clientId)||null;
  await refreshClients(); await loadLogins(); closeForm(); renderShell(); go('clients');
}
function slugify(n){return String(n||'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
async function refreshClients(){ try{ const r=await sb.from('clients').select('*').order('name'); CLIENTS=r.data||[]; }catch(e){} }
function openClientForm(clientId){
  if(PROFILE.role!=='admin'){ return; }
  const c = clientId ? (CLIENTS.find(x=>x.id===clientId)||{}) : {};
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>${clientId?'Edit Client':'Add Client'}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="fld"><label>Client name <span class="req">*</span></label><input id="c_name" value="${esc(c.name||'')}" placeholder="e.g. Boplan UK" oninput="if(!${clientId?'true':'false'})document.getElementById('c_slug').value=window.slugify(this.value)"></div>
      <div class="frow">
        <div class="fld"><label>Short code (slug)</label><input id="c_slug" value="${esc(c.slug||'')}" placeholder="auto" ${clientId?'readonly':''}></div>
        <div class="fld"><label>Brand colour</label><input id="c_color" type="color" value="${esc(c.brand_color||'#38bdf8')}" style="height:44px;padding:4px"></div>
      </div>
      <div class="fld"><label>Programme title (optional)</label><input id="c_prog" value="${esc(c.programme_title||'')}" placeholder="e.g. EU Deployment 2026"></div>
      <div class="fld"><label>System reference (optional)</label><input id="c_sys" value="${esc(c.system_ref||'')}" placeholder="e.g. AMZ-EU-7:3-V12"></div>
      <div class="fld"><label>Logo image URL (optional)</label><input id="c_logo" value="${esc(c.logo_url||'')}" placeholder="https://… (or upload below)"></div>
      <div class="fld"><label>…or upload a logo</label><input id="c_logofile" type="file" accept="image/*"></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="cliSave" onclick="submitClient(${clientId?`'${clientId}'`:'null'})">${clientId?'Save changes':'Add client'}</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
async function submitClient(clientId){
  const name=val('c_name'); if(!name){ msg('Please enter a client name.','err'); return; }
  let slug=val('c_slug')||slugify(name);
  const btn=el('cliSave'); btn.disabled=true; btn.textContent='Saving…'; msg('','');
  let logo=val('c_logo')||null;
  const lf=el('c_logofile');
  if(lf && lf.files && lf.files[0]){ btn.textContent='Uploading logo…'; try{ const f=lf.files[0]; const path='logos/'+slug+'_'+Date.now()+'.'+(f.name.split('.').pop()||'png'); const {error}=await sb.storage.from('evidence').upload(path,f,{upsert:true}); if(!error) logo=sb.storage.from('evidence').getPublicUrl(path).data.publicUrl; }catch(e){} }
  const row={ name:name, slug:slug, brand_color:val('c_color')||'#38bdf8', programme_title:val('c_prog')||null, system_ref:val('c_sys')||null, logo_url:logo, is_active:true };
  const res = clientId ? await sb.from('clients').update(row).eq('id',clientId) : await sb.from('clients').insert(row);
  if(res.error){ btn.disabled=false; btn.textContent=clientId?'Save changes':'Add client'; msg('Could not save: '+res.error.message+(res.error.message.includes('duplicate')?' (that short code is taken — change the slug)':''),'err'); return; }
  msg('✓ Saved.','ok'); await refreshClients(); setTimeout(()=>{ closeForm(); renderShell(); go('clients'); },600);
}

