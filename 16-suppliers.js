/* ============ ROUTER ============ */
/* =====================================================================
   SUPPLIERS MODULE — admin hub + supplier self-service portal
   ===================================================================== */
const RTW_STATES=['Not checked','Verified','Expired'];
function statusChip(s){ const c=(s==='Approved'||s==='Active'||s==='Paid')?'green':(s==='Suspended'||s==='Rejected'||s==='Cancelled')?'red':(s==='Pending'||s==='Submitted'||s==='Booked')?'amber':'cyan'; return `<span class="chip ${c}">${esc(s||'—')}</span>`; }
function engFlagFor(eng){ return engFlag(eng, (SDATA.ratings||[])); }
async function supRefresh(page){ if(PROFILE.role==='admin'){ await loadSuppliers(); if(SUPPREVIEW){ ALLSUP=SDATA; SUPPLIER=SUPPLIERS.find(s=>s.id===SUPPREVIEW)||SUPPLIER; SDATA=filterSup(SDATA,SUPPREVIEW); } } else { await loadSupplierData(); } closeForm(); renderShell(); go(page||CURRENT); }
// upload any newly-attached card copies inside a container, return cards JSON
async function collectCardsAsync(wrapId, whoName){
  const out=[]; const wrap=el(wrapId); if(!wrap) return out;
  const sid=(PROFILE.role==='admin'?(window.__manageSup||'admin'):(SUPPLIER&&SUPPLIER.id))||'sup';
  for(const c of [...wrap.querySelectorAll('.cardrow-w')]){
    const type=c.querySelector('.cd-t').value.trim(); if(!type) continue;
    const number=c.querySelector('.cd-n').value.trim();
    const expiry=c.querySelector('.cd-e').value||null;
    let file=c.getAttribute('data-file')||'';
    const fi=c.querySelector('.cd-f');
    if(fi&&fi.files&&fi.files[0]){
      const f=fi.files[0];
      const ext=((f.name||'').split('.').pop()||'pdf').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,5)||'pdf';
      const sn=((whoName||'eng')+'-'+type).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40);
      const u=await uploadBlob(f, `supplier/${sid}/${sn}_${Date.now()}.${ext}`, f.type);
      if(u) file=u;
    }
    out.push({type,number,expiry,file:file||null});
  }
  return out;
}
function cardsWrapHtml(cards){ return `<div id="supCards" class="cardwrap">${(Array.isArray(cards)?cards:[]).map(c=>cardRowHtml(c.type,c.number,c.expiry,c.file)).join('')}</div>
  <button type="button" class="addbtn" style="margin-top:6px" onclick="el('supCards').insertAdjacentHTML('beforeend', cardRowHtml('','','',''))">＋ Add card / certificate</button>`; }
function cardsView(cards){ const a=Array.isArray(cards)?cards:[]; if(!a.length) return '<span class="muted">No cards uploaded</span>'; return a.map(c=>`<span class="chip ${cardStatus(c.expiry).c}" style="margin:2px 3px 2px 0">${esc(c.type)}${c.expiry?' · exp '+esc(String(c.expiry).slice(0,10)):''}${c.file?` <a href="${esc(c.file)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">📄</a>`:''}</span>`).join(''); }

/* ---------- ADMIN: Suppliers hub ---------- */
function supScore(sid){
  const engs=(SDATA.engineers||[]).filter(e=>e.supplier_id===sid);
  const flags={green:0,amber:0,red:0,grey:0}; engs.forEach(e=>{ flags[engFlagFor(e)]++; });
  const asgActive=(SDATA.assignments||[]).filter(a=>a.supplier_id===sid && ['Booked','On site'].includes(a.status)).length;
  const tsPending=(SDATA.timesheets||[]).filter(t=>t.supplier_id===sid && t.status==='Submitted').length;
  const rs=(SDATA.ratings||[]).filter(r=>r.supplier_id===sid);
  const sc=[]; rs.forEach(r=>['quality','safety','timekeeping','attitude'].forEach(k=>{ if(r[k]!=null) sc.push(Number(r[k])); }));
  const avg=sc.length?(sc.reduce((a,b)=>a+b,0)/sc.length):null;
  return {engs:engs.length, flags, asgActive, tsPending, avg};
}
function pageSuppliers(){
  if(PROFILE.role!=='admin') return emptyState('🔒','Admins only','This area is for the Mercury team.');
  const header=`<div class="sechead"><h3>Suppliers</h3><span class="sub">${SUPPLIERS.length} labour partner${SUPPLIERS.length===1?'':'s'} · manage engineers, assignments, timesheets &amp; performance</span><span class="line"></span><button class="edit-btn" style="margin-right:8px" onclick="openRateCard()">💷 Rate card</button><button class="addbtn" onclick="openSupplierForm()">＋ Add supplier</button></div>`;
  const help=`<div class="card tip" style="margin-bottom:14px;background:linear-gradient(180deg,rgba(56,189,248,.08),rgba(34,197,94,.05));border:1px solid var(--line2)"><h4 style="margin-bottom:6px">🚚 How suppliers work — 3 simple steps</h4><div class="csub" style="margin:0">1. Tap <b>＋ Add supplier</b>. &nbsp; 2. In Supabase → Authentication → Users, <b>Add user</b> (their email + a password). &nbsp; 3. Tap <b>🔗 Link login</b> on the supplier and paste that email. They then log in and see only their own engineers, jobs, timesheets &amp; feedback.</div></div>`;
  const totEng=(SDATA.engineers||[]).length;
  const totAsg=(SDATA.assignments||[]).filter(a=>['Booked','On site'].includes(a.status)).length;
  const totPend=(SDATA.timesheets||[]).filter(t=>t.status==='Submitted').length;
  const k=`<div class="grid kpis" style="margin-bottom:14px">
    ${kpi('cyan','🚚','Suppliers',SUPPLIERS.length,'')}
    ${kpi('','👷','Supplier engineers',totEng,'')}
    ${kpi('green','🗓','Active assignments',totAsg,'')}
    ${kpi(totPend?'amber':'','⏱','Timesheets to approve',totPend,'')}
  </div>`;
  const cards = !SUPPLIERS.length ? emptyState('🚚','No suppliers yet','Tap “Add supplier” to create your first labour partner.') :
    `<div class="teamgrid">${SUPPLIERS.map(s=>{
      const sc=supScore(s.id);
      const logins=(LOGINS||[]).filter(l=>l.supplier_id===s.id);
      const loginHtml=`<div class="meta" style="align-items:flex-start"><span>Login</span><b style="text-align:right">${logins.length?logins.map(l=>`<span class="chip green" style="margin:1px 0 1px 4px">${esc(l.email)}</span>`).join('<br>'):'<span class="chip amber">none linked yet</span>'}</b></div>`;
      const lights=`<span title="Performing well">${flagDot('green')} ${sc.flags.green}</span> &nbsp; <span title="Watch">${flagDot('amber')} ${sc.flags.amber}</span> &nbsp; <span title="At risk">${flagDot('red')} ${sc.flags.red}</span>`;
      return `<div class="teamcard">
        <div class="th"><div class="nm"><span class="tdot" style="background:#38bdf8"></span>${esc(s.name)}</div>${statusChip(s.status)}</div>
        ${s.contact_name?`<div class="meta"><span>Contact</span><b>${esc(s.contact_name)}</b></div>`:''}
        ${s.contact_email?`<div class="meta"><span>Email</span><b>${esc(s.contact_email)}</b></div>`:''}
        <div class="meta"><span>Engineers</span><b>${sc.engs}</b></div>
        <div class="meta"><span>Traffic light</span><b>${lights}</b></div>
        <div class="meta"><span>Active jobs</span><b>${sc.asgActive}</b></div>
        <div class="meta"><span>Avg rating</span><b>${sc.avg!=null?sc.avg.toFixed(1)+' / 5':'<span class="muted">—</span>'}</b></div>
        ${sc.tsPending?`<div class="meta"><span>Timesheets</span><b><span class="chip amber">${sc.tsPending} to approve</span></b></div>`:''}
        ${loginHtml}
        <div style="margin-top:11px"><button class="btn" style="width:100%;padding:9px" onclick="openSupManage('${s.id}')">Manage supplier →</button></div>
        <div style="display:flex;gap:8px;margin-top:8px"><button class="edit-btn" style="flex:1" onclick="openSupplierForm('${s.id}')">Edit</button><button class="edit-btn" style="flex:1" onclick="openSupLinkLogin('${s.id}')">🔗 Link login</button><button class="edit-btn" style="flex:none;color:var(--red)" onclick="deleteSupplier('${s.id}')" title="Delete supplier">🗑</button></div>
      </div>`;}).join('')}</div>`;
  // pending timesheets across all suppliers
  const pend=(SDATA.timesheets||[]).filter(t=>t.status==='Submitted').sort((a,b)=>String(b.work_date||'').localeCompare(String(a.work_date||'')));
  const supName=id=>{ const s=SUPPLIERS.find(x=>x.id===id); return s?s.name:'—'; };
  const engName=id=>{ const e=(SDATA.engineers||[]).find(x=>x.id===id); return e?e.full_name:'—'; };
  const pendHtml = pend.length ? `<div class="card" style="margin-top:16px;overflow-x:auto"><h4 style="margin:0 0 10px">⏱ Timesheets awaiting approval</h4>
    <table class="tbl"><thead><tr><th>Date</th><th>Supplier</th><th>Engineer</th><th>Hours</th><th>Cost</th><th></th></tr></thead><tbody>
    ${pend.map(t=>`<tr><td>${esc(String(t.work_date||'').slice(0,10))}</td><td>${esc(supName(t.supplier_id))}</td><td>${esc(engName(t.engineer_id))}</td><td>${tsHours(t)} h${t.hours_ot?` <span class="muted">(${t.hours_ot} OT)</span>`:''}</td><td>${gbp(tsCost(t))}</td><td style="white-space:nowrap"><button class="edit-btn" style="color:var(--green)" onclick="approveTimesheet('${t.id}')">✓ Approve</button> <button class="edit-btn" style="color:var(--red)" onclick="rejectTimesheet('${t.id}')">✕ Reject</button></td></tr>`).join('')}
    </tbody></table></div>` : '';
  return header+help+k+cards+pendHtml;
}
function openSupplierForm(id){
  const s = id ? (SUPPLIERS.find(x=>x.id===id)||{}) : {};
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>${id?'Edit supplier':'Add supplier'}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="fld"><label>Supplier name <span class="req">*</span></label><input id="s_name" value="${esc(s.name||'')}" placeholder="e.g. Mercury Hampton Contracts"></div>
      <div class="frow">
        <div class="fld"><label>Contact name</label><input id="s_cname" value="${esc(s.contact_name||'')}" placeholder="Main contact"></div>
        <div class="fld"><label>Status</label><select id="s_status">${['Active','On hold','Archived'].map(o=>`<option ${(s.status||'Active')===o?'selected':''}>${o}</option>`).join('')}</select></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Contact email</label><input id="s_email" value="${esc(s.contact_email||'')}" placeholder="ops@supplier.co.uk"></div>
        <div class="fld"><label>Contact phone</label><input id="s_phone" value="${esc(s.contact_phone||'')}" placeholder="Optional"></div>
      </div>
      <div class="fld"><label>Notes</label><textarea id="s_notes" rows="2" placeholder="Optional">${esc(s.notes||'')}</textarea></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="supSave" onclick="submitSupplier(${id?`'${id}'`:'null'})">${id?'Save changes':'Add supplier'}</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
async function submitSupplier(id){
  const name=val('s_name'); if(!name){ msg('Please enter a supplier name.','err'); return; }
  const btn=el('supSave'); btn.disabled=true; btn.textContent='Saving…'; msg('','');
  const row={ name:name, contact_name:val('s_cname')||null, contact_email:val('s_email')||null, contact_phone:val('s_phone')||null, status:val('s_status')||'Active', notes:val('s_notes')||null };
  const res = id ? await sb.from('suppliers').update(row).eq('id',id) : await sb.from('suppliers').insert(row);
  if(res.error){ btn.disabled=false; btn.textContent=id?'Save changes':'Add supplier'; msg('Could not save: '+res.error.message,'err'); return; }
  msg('✓ Saved.','ok'); await supRefresh('suppliers');
}
function openSupLinkLogin(id){
  const s=SUPPLIERS.find(x=>x.id===id)||{};
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal" style="max-width:520px">
    <div class="modal-h"><h3>Link a login to ${esc(s.name)}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="box see" style="background:var(--panel2);border:1px dashed var(--line2);border-radius:10px;padding:12px 14px;font-size:12.5px;color:var(--muted);margin-bottom:14px">
        <b>First</b>, create the login in Supabase → <b>Authentication → Users → Add user</b> (their email &amp; a password).<br><b>Then</b> paste that exact email below and tap Link. That login will only ever see ${esc(s.name)}.</div>
      <div class="fld"><label>Login email <span class="req">*</span></label><input id="sll_email" placeholder="e.g. ops@supplier.co.uk"></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="sllSave" onclick="submitSupLinkLogin('${id}')">🔗 Link login</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
async function submitSupLinkLogin(id){
  const email=val('sll_email').trim(); if(!email){ msg('Please enter the login email.','err'); return; }
  const btn=el('sllSave'); btn.disabled=true; btn.textContent='Linking…'; msg('','');
  let prof=null;
  try{ const r=await sb.from('profiles').select('id,email').ilike('email',email).limit(1); prof=(r.data&&r.data[0])||null; }catch(e){}
  if(!prof){ btn.disabled=false; btn.textContent='🔗 Link login'; msg('No account found for that email yet. Create it first in Supabase → Authentication → Users, then try again.','err'); return; }
  const {error}=await sb.from('profiles').update({role:'supplier', supplier_id:id, client_id:null}).eq('id',prof.id);
  if(error){ btn.disabled=false; btn.textContent='🔗 Link login'; msg('Could not link: '+error.message,'err'); return; }
  msg('✓ Linked. That login now sees only this supplier.','ok');
  await loadLogins(); setTimeout(()=>{ closeForm(); go('suppliers'); }, 800);
}
async function deleteSupplier(id){
  const s=SUPPLIERS.find(x=>x.id===id)||{};
  if(!confirm('Delete "'+(s.name||'this supplier')+'" and ALL of their engineers, assignments, timesheets and ratings?\n\nThis cannot be undone. Any login attached will be unlinked (the Supabase account itself stays — delete that in Supabase if you no longer need it).')) return;
  try{
    await sb.from('profiles').update({supplier_id:null}).eq('supplier_id',id);
    const {error}=await sb.from('suppliers').delete().eq('id',id);
    if(error){ alert('Could not delete: '+error.message); return; }
  }catch(e){ alert('Could not delete: '+(e.message||e)); return; }
  await supRefresh('suppliers');
}
/* Admin: manage a single supplier (engineers, flags, assign, rate) */
function openSupManage(id){
  window.__manageSup=id;
  const s=SUPPLIERS.find(x=>x.id===id)||{};
  const engs=(SDATA.engineers||[]).filter(e=>e.supplier_id===id).sort((a,b)=>String(a.full_name||'').localeCompare(String(b.full_name||'')));
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal" style="max-width:760px">
    <div class="modal-h"><h3>${esc(s.name)} — engineers &amp; performance</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap"><button class="btn" onclick="openAssign('${id}')">🗓 Assign labour to a job</button></div>
      ${engs.length? `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Light</th><th>Engineer</th><th>Trade</th><th>RTW</th><th>Cards</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${engs.map(e=>{ const f=engFlagFor(e); return `<tr>
        <td>${flagDot(f)}${e.flag_override?' <span class="muted" style="font-size:10px">(manual)</span>':''}</td>
        <td><b>${esc(e.full_name)}</b>${(function(){const d=engPlacementDesc(e.id);return d?`<div class="muted" style="font-size:11px">📍 ${esc(d)}</div>`:'';})()}</td><td>${esc(e.trade||'—')}</td>
        <td><span class="chip ${e.rtw_status==='Verified'?'green':e.rtw_status==='Expired'?'red':'amber'}">${esc(e.rtw_status||'Not checked')}</span></td>
        <td>${(Array.isArray(e.cards)?e.cards.length:0)}</td>
        <td>${statusChip(e.status)}</td>
        <td style="white-space:nowrap">
          <span class="muted" style="font-size:11px">Flag:</span>
          <button class="lite g" title="Green" onclick="setEngFlag('${e.id}','green')">🟢</button>
          <button class="lite a" title="Amber" onclick="setEngFlag('${e.id}','amber')">🟠</button>
          <button class="lite r" title="Red" onclick="setEngFlag('${e.id}','red')">🔴</button>
          <button class="lite" title="Auto (clear override)" onclick="setEngFlag('${e.id}','')">↺</button>
          &nbsp;<button class="edit-btn" onclick="openRate('${id}','${e.id}')">⭐ Rate</button>
          <button class="edit-btn" onclick="setEngStatus('${e.id}','${e.status==='Approved'?'Suspended':'Approved'}')">${e.status==='Approved'?'Suspend':'Approve'}</button>
        </td></tr>`; }).join('')}
      </tbody></table></div>` : '<div class="empty" style="padding:14px">This supplier has not added any engineers yet. They add them from their own portal.</div>'}
      ${supAssignTable(id)}
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Close</button></div>
  </div>`;
  document.body.appendChild(wrap);
}
/* Assignments for a supplier, with Edit / Cancel (internal control) */
function supAssignTable(id){
  const asgs=(SDATA.assignments||[]).filter(a=>a.supplier_id===id).sort((a,b)=>String(b.start_date||'').localeCompare(String(a.start_date||'')));
  if(!asgs.length) return '<h4 style="margin:16px 0 6px">Allocations</h4><div class="empty" style="padding:12px">No allocations yet. Use “Assign labour to a job”.</div>';
  const rows=asgs.map(a=>{ const live=['Booked','On site'].includes(a.status);
    return `<tr${a.status==='Cancelled'?' style="opacity:.55"':''}><td>${esc(String(a.start_date||'').slice(0,10))||'—'}${a.end_date?' → '+esc(String(a.end_date).slice(0,10)):''}</td>
      <td>${a.engineer_id?esc(supEngName(a.engineer_id)):'<span class="chip amber">To fill</span>'}</td>
      <td>${esc(a.title||'—')}</td>
      <td>${esc([supClientName(a.client_id),a.site_label].filter(Boolean).join(' · ')||'—')}</td>
      <td>${esc(a.shift||'—')}</td>
      <td>${a.charge_rate!=null?gbp(a.charge_rate)+'/hr':'—'}</td>
      <td>${statusChip(a.status)}</td>
      <td style="white-space:nowrap"><button class="edit-btn" onclick='openAssignEdit("${a.id}")'>Edit</button>${live?` <button class="edit-btn" style="color:var(--red)" onclick="cancelAssign('${a.id}')">Cancel</button>`:''}</td></tr>`; }).join('');
  return `<h4 style="margin:16px 0 8px">Allocations <span class="muted" style="font-weight:500;font-size:11px">· edit or cancel here — the supplier is notified</span></h4>
    <div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Dates</th><th>Engineer</th><th>Job</th><th>Where</th><th>Shift</th><th>Rate</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function openAssignEdit(assignmentId){ const a=(SDATA.assignments||[]).find(x=>x.id===assignmentId); if(!a) return; openAssign(a.supplier_id, a.engineer_id, a); }
async function setEngFlag(engId, flag){ const {error}=await sb.from('supplier_engineers').update({flag_override:flag||null}).eq('id',engId); if(error){ alert('Could not update: '+error.message); return; } const e=(SDATA.engineers||[]).find(x=>x.id===engId); if(e) e.flag_override=flag||null; const sid=window.__manageSup; closeForm(); await loadSuppliers(); openSupManage(sid); }
async function setEngStatus(engId, status){ const {error}=await sb.from('supplier_engineers').update({status:status}).eq('id',engId); if(error){ alert('Could not update: '+error.message); return; } const sid=window.__manageSup; closeForm(); await loadSuppliers(); openSupManage(sid); }
/* Admin: assign a supplier engineer to a job */
function supSites(clientId, selId){ const sites=(HQDATA&&HQDATA.sites?HQDATA.sites:[]).filter(s=>s.client_id===clientId); return `<option value="">— optional: link to a site —</option>`+sites.map(s=>`<option value="${s.id}" ${selId===s.id?'selected':''}>${esc((s.code?s.code+' · ':'')+(s.city||s.title||'Site'))}</option>`).join(''); }
/* Create OR edit an assignment. Pass `rec` (an existing assignment) to edit. */
function openAssign(supplierId, engId, rec){
  window.__manageSup=supplierId;
  const r=rec||{}; const editId=r.id||null;
  if(editId) engId=r.engineer_id;
  const engs=(SDATA.engineers||[]).filter(e=>e.supplier_id===supplierId);
  const shifts=['Days','Nights','Weekend','Flexible'];
  const stat=['Booked','On site','Complete','Cancelled'];
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>${editId?'Edit allocation':'Assign labour to a job'}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="fld"><label>Engineer</label><select id="a_eng" onchange="const e=(SDATA.engineers||[]).find(x=>x.id===this.value); if(e&&el('a_rate')&&!el('a_rate').value){const c=resolveRates(e).cost; if(c!=null) el('a_rate').value=c;} updateAssignComp(this.value);"><option value="">— To be filled by the supplier —</option>${engs.map(e=>`<option value="${e.id}" ${engId===e.id?'selected':''}>${esc(e.full_name)}${e.trade?' — '+esc(e.trade):''}</option>`).join('')}</select><div id="a_comp">${compBadge(engId)}</div><div class="note" style="font-size:11px;margin-top:3px">Leave as “to be filled” to send it to the supplier as an open job they staff.</div></div>
      <div class="fld"><label>Job title</label><input id="a_title" value="${esc(r.title||'')}" placeholder="e.g. Conveyor install — nights"></div>
      <div class="frow">
        <div class="fld"><label>Client</label><select id="a_client" onchange="const s=el('a_site'); if(s) s.innerHTML=supSites(this.value)"><option value="">— select client —</option>${(CLIENTS||[]).map(c=>`<option value="${c.id}" ${r.client_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
        <div class="fld"><label>Site (optional)</label><select id="a_site">${supSites(r.client_id||'', r.site_id)}</select></div>
      </div>
      <div class="fld"><label>Or location (free text)</label><input id="a_loc" value="${esc(r.site_label||'')}" placeholder="If not a listed site"></div>
      <div class="frow">
        <div class="fld"><label>Start date</label><input id="a_start" type="date" value="${esc(String(r.start_date||'').slice(0,10))}"></div>
        <div class="fld"><label>End date</label><input id="a_end" type="date" value="${esc(String(r.end_date||'').slice(0,10))}"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Shift</label><select id="a_shift">${shifts.map(o=>`<option ${r.shift===o?'selected':''}>${o}</option>`).join('')}</select></div>
        <div class="fld"><label>Cost rate — we pay (£/hr)</label><input id="a_rate" type="number" min="0" step="0.01" value="${r.charge_rate!=null?esc(String(r.charge_rate)):(function(){const e0=engId?engs.find(x=>x.id===engId):engs[0]; const c=e0?resolveRates(e0).cost:null; return c!=null?c:'';})()}" placeholder="auto-fills from rate card"></div>
      </div>
      ${editId?`<div class="fld"><label>Status</label><select id="a_status">${stat.map(o=>`<option ${(r.status||'Booked')===o?'selected':''}>${o}</option>`).join('')}</select></div>`:''}
      <div class="note" style="font-size:11.5px">Cost auto-fills from the rate card for the engineer’s trade — edit it here for this job if needed. The sell rate &amp; margin are set on the rate card and never shown to the supplier.</div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="asgSave" onclick="submitAssign('${supplierId}'${editId?`,'${editId}'`:''})">${editId?'Save changes':'🗓 Create assignment'}</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
async function submitAssign(supplierId, editId){
  const engId=val('a_eng')||null;   // optional — blank means "supplier to fill"
  if(engId && !complianceGateOk(engId, supEngName(engId))) return;   // gate on tickets/right-to-work
  const btn=el('asgSave'); btn.disabled=true; btn.textContent='Saving…'; msg('','');
  const title=val('a_title')||null;
  const row={ supplier_id:supplierId, engineer_id:engId, client_id:val('a_client')||null, site_id:val('a_site')||null, site_label:val('a_loc')||null, title:title, start_date:val('a_start')||null, end_date:val('a_end')||null, shift:val('a_shift')||null, charge_rate:num('a_rate') };
  let error;
  if(editId){ row.status=val('a_status')||'Booked'; const rr=await sb.from('supplier_assignments').update(row).eq('id',editId); error=rr.error; }
  else { row.status='Booked'; const rr=await sb.from('supplier_assignments').insert(row); error=rr.error; }
  if(error){ btn.disabled=false; btn.textContent=editId?'Save changes':'🗓 Create assignment'; msg('Could not save: '+error.message,'err'); return; }
  // notify the supplier on their portal
  const where=[val('a_loc'), val('a_start')].filter(Boolean).join(' · ');
  await notifySupplier(supplierId, 'assignment',
    editId?('Job updated: '+(title||'Job')):(engId?('New job assigned: '+(title||'Job')):('New job to fill: '+(title||'Job'))),
    'sup_jobs',
    (engId?'Booked for '+supEngName(engId):'Please assign one of your engineers')+(where?(' — '+where):''));
  msg('✓ Saved & supplier notified.','ok');
  await loadSuppliers(); await reconcilePlacements(supplierId); await loadSuppliers();
  setTimeout(()=>{ closeForm(); openSupManage(supplierId); }, 800);
}
/* Cancel an allocation from the internal side */
async function cancelAssign(id){
  const a=(SDATA.assignments||[]).find(x=>x.id===id)||{};
  if(!confirm('Cancel this allocation'+(a.title?' ('+a.title+')':'')+'?\n\nThe supplier is notified. If the engineer has no other live job for that client, they are also removed from the Mercury team the client sees.')) return;
  const sid=window.__manageSup||a.supplier_id;
  const {error}=await sb.from('supplier_assignments').update({status:'Cancelled'}).eq('id',id);
  if(error){ alert('Could not cancel: '+error.message); return; }
  await notifySupplier(sid,'assignment','Job cancelled: '+(a.title||'Job'),'sup_jobs','This allocation has been cancelled by Mercury.');
  await loadSuppliers(); await reconcilePlacements(sid); await loadSuppliers();
  closeForm(); openSupManage(sid);
}
/* Tidy up: drop internal team placements for engineers with no live allocation */
async function reconcilePlacements(supplierId){
  const active=(SDATA.assignments||[]).filter(a=>['Booked','On site'].includes(a.status));
  const engIds=new Set((SDATA.engineers||[]).filter(e=>e.supplier_id===supplierId).map(e=>e.id));
  for(const p of (PLACEMENTS||[]).filter(x=>engIds.has(x.engineer_id))){
    const still=active.some(a=>a.engineer_id===p.engineer_id && a.client_id===p.client_id);
    if(still) continue;
    try{
      if(p.team_id){ const r=await sb.from('teams').select('id,roster').eq('id',p.team_id).maybeSingle(); if(r&&r.data){ const key=String(p.engineer_name||'').trim().toLowerCase(); const nros=(Array.isArray(r.data.roster)?r.data.roster:[]).filter(x=>String(x.name||'').trim().toLowerCase()!==key); await sb.from('teams').update({roster:nros}).eq('id',p.team_id); } }
      await sb.from('agency_placement').delete().eq('id',p.id);
    }catch(e){ console.warn('reconcile',e&&e.message); }
  }
}
/* Admin: rate an engineer */
function openRate(supplierId, engId){
  const e=(SDATA.engineers||[]).find(x=>x.id===engId)||{};
  const asgs=(SDATA.assignments||[]).filter(a=>a.engineer_id===engId);
  const stars=id=>`<select id="${id}"><option value="">—</option>${[5,4,3,2,1].map(n=>`<option value="${n}">${'★'.repeat(n)} (${n})</option>`).join('')}</select>`;
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>Rate ${esc(e.full_name||'engineer')}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      ${asgs.length?`<div class="fld"><label>Against assignment (optional)</label><select id="r_asg"><option value="">— general —</option>${asgs.map(a=>`<option value="${a.id}">${esc((a.title||'Job')+' · '+(a.start_date||''))}</option>`).join('')}</select></div>`:''}
      <div class="frow"><div class="fld"><label>Quality</label>${stars('r_q')}</div><div class="fld"><label>Safety</label>${stars('r_s')}</div></div>
      <div class="frow"><div class="fld"><label>Timekeeping</label>${stars('r_t')}</div><div class="fld"><label>Attitude</label>${stars('r_a')}</div></div>
      <div class="frow"><div class="fld"><label><input type="checkbox" id="r_noshow"> No-show</label></div><div class="fld"><label><input type="checkbox" id="r_incident"> Safety incident</label></div></div>
      <div class="fld"><label>Comment</label><textarea id="r_comment" rows="2" placeholder="What went well / needs improvement"></textarea></div>
      <div class="fld"><label><input type="checkbox" id="r_share" checked> Share this feedback with the supplier</label></div>
      <div class="note" style="font-size:11.5px">A no-show or safety incident automatically turns the engineer’s light red.</div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="rateSave" onclick="submitRate('${supplierId}','${engId}')">⭐ Save rating</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
async function submitRate(supplierId, engId){
  const btn=el('rateSave'); btn.disabled=true; btn.textContent='Saving…'; msg('','');
  const g=v=>{ const x=val(v); return x===''?null:Number(x); };
  const row={ supplier_id:supplierId, engineer_id:engId, assignment_id:(val('r_asg')||null), quality:g('r_q'), safety:g('r_s'), timekeeping:g('r_t'), attitude:g('r_a'), no_show:!!(el('r_noshow')&&el('r_noshow').checked), incident:!!(el('r_incident')&&el('r_incident').checked), comment:val('r_comment')||null, visible_to_supplier:!!(el('r_share')&&el('r_share').checked) };
  const {error}=await sb.from('supplier_ratings').insert(row);
  if(error){ btn.disabled=false; btn.textContent='⭐ Save rating'; msg('Could not save: '+error.message,'err'); return; }
  msg('✓ Rating saved.','ok'); await loadSuppliers(); setTimeout(()=>{ closeForm(); openSupManage(supplierId); }, 700);
}
async function approveTimesheet(id){ const {error}=await sb.from('supplier_timesheets').update({status:'Approved'}).eq('id',id); if(error){ alert('Could not approve: '+error.message); return; } await supRefresh('suppliers'); }
async function rejectTimesheet(id){ const note=prompt('Reason for rejection (optional):')||null; const {error}=await sb.from('supplier_timesheets').update({status:'Rejected',approver_note:note}).eq('id',id); if(error){ alert('Could not reject: '+error.message); return; } await supRefresh('suppliers'); }

/* ---------- SUPPLIER PORTAL ---------- */
function pageSupHome(){
  if(!SUPPLIER) return emptyState('🚚','Setting up your account','Your supplier login is not linked to a company yet. Mercury will link it shortly — please check back soon.');
  const engs=SDATA.engineers||[]; const approved=engs.filter(e=>e.status==='Approved').length;
  const today=new Date(); today.setHours(0,0,0,0);
  const active=(SDATA.assignments||[]).filter(a=>['Booked','On site'].includes(a.status));
  const tsSub=(SDATA.timesheets||[]).filter(t=>t.status==='Submitted').length;
  const flagged=engs.filter(e=>['amber','red'].includes(engFlagFor(e)));
  const k=`<div class="grid kpis" style="margin-bottom:14px">
    ${kpi('cyan','👷','My engineers',engs.length,'',  'sup_engineers')}
    ${kpi('green','✓','Approved',approved,'','sup_engineers')}
    ${kpi('','🗓','Active assignments',active.length,'','sup_jobs')}
    ${kpi(tsSub?'amber':'','⏱','Timesheets submitted',tsSub,'','sup_timesheets')}
  </div>`;
  const flagHtml = flagged.length ? `<div class="card" style="margin-bottom:14px;border:1px solid var(--line2)"><h4 style="margin:0 0 8px">⚠ Performance flags</h4>${flagged.map(e=>`<div class="meta"><span>${flagDot(engFlagFor(e))} ${esc(e.full_name)}</span><b>${engFlagFor(e)==='red'?'At risk':'Watch'}</b></div>`).join('')}<div class="note" style="font-size:11.5px;margin-top:6px">Based on Mercury’s site ratings. Open <b>Performance</b> for detail.</div></div>` : '';
  const upcoming = active.slice().sort((a,b)=>String(a.start_date||'').localeCompare(String(b.start_date||''))).slice(0,8);
  const asgHtml = upcoming.length ? `<div class="card" style="overflow-x:auto"><h4 style="margin:0 0 10px">🗓 Current &amp; upcoming assignments</h4>
    <table class="tbl"><thead><tr><th>Dates</th><th>Engineer</th><th>Job</th><th>Where</th><th>Shift</th><th>Status</th></tr></thead><tbody>
    ${upcoming.map(a=>`<tr><td>${esc(String(a.start_date||'').slice(0,10))}${a.end_date?' → '+esc(String(a.end_date).slice(0,10)):''}</td><td>${esc(supEngName(a.engineer_id))}</td><td>${esc(a.title||'—')}</td><td>${esc(a.site_label||supClientName(a.client_id)||'—')}</td><td>${esc(a.shift||'—')}</td><td>${statusChip(a.status)}</td></tr>`).join('')}
    </tbody></table></div>` : emptyState('🗓','No active assignments','When Mercury books your engineers onto a job, it appears here.');
  return `<div class="sechead"><h3>Welcome, ${esc(SUPPLIER.name)}</h3><span class="sub">Your live view of engineers, jobs, timesheets &amp; performance</span><span class="line"></span></div>`+k+flagHtml+asgHtml;
}
function pageSupEngineers(){
  if(!SUPPLIER) return pageSupHome();
  const engs=(SDATA.engineers||[]).slice().sort((a,b)=>String(a.full_name||'').localeCompare(String(b.full_name||'')));
  const header=`<div class="sechead"><h3>My Engineers</h3><span class="sub">${engs.length} on your books · add their certificates, cards &amp; right-to-work</span><span class="line"></span><button class="addbtn" onclick="openSupEngineerForm()">＋ Add engineer</button></div>`;
  if(!engs.length) return header+emptyState('👷','No engineers yet','Tap “Add engineer” to register your first worker and upload their cards.');
  return header+`<div class="teamgrid">${engs.map(e=>{ const f=engFlagFor(e); return `<div class="teamcard">
    <div class="th"><div class="nm">${flagDot(f)} ${esc(e.full_name)}</div>${statusChip(e.status)}</div>
    ${e.trade?`<div class="meta"><span>Trade</span><b>${esc(e.trade)}</b></div>`:''}
    ${e.phone?`<div class="meta"><span>Phone</span><b>${esc(e.phone)}</b></div>`:''}
    <div class="meta"><span>Right to work</span><b><span class="chip ${e.rtw_status==='Verified'?'green':e.rtw_status==='Expired'?'red':'amber'}">${esc(e.rtw_status||'Not checked')}</span></b></div>
    ${e.nok_name?`<div class="meta"><span>Next of kin</span><b>${esc(e.nok_name)}${e.nok_phone?' · '+esc(e.nok_phone):''}</b></div>`:''}
    ${(e.a1_status||e.passport_number||e.passport_file||e.medical_provider)?`<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap">${e.a1_status?travelChip('A1',e.a1_status,e.a1_expiry):''}${(e.passport_number||e.passport_file)?`<span class="chip ${cardStatus(e.passport_expiry).c}">Passport${e.passport_expiry?' · '+esc(String(e.passport_expiry).slice(0,10)):''}</span>`:''}${e.medical_provider?`<span class="chip ${cardStatus(e.medical_expiry).c}">${esc(e.medical_provider)}</span>`:''}</div>`:''}
    <div style="margin-top:8px">${cardsView(e.cards)}</div>
    <div style="display:flex;gap:8px;margin-top:10px"><button class="edit-btn" style="flex:1" onclick="openSupEngineerForm('${e.id}')">Edit</button><button class="edit-btn" style="flex:none;color:var(--red)" onclick="deleteSupEngineer('${e.id}')" title="Remove">🗑</button></div>
  </div>`;}).join('')}</div>`;
}
/* Shared sensitive-details fields (personal, next-of-kin, EU travel).
   Used by both the supplier engineer form and the admin Mercury-engineer
   HR editor. `prefix` keeps input ids unique. */
const A1_STATES=['','Held','Applied','Not required','Expired'];
function secureFileField(id,label,existingPath){
  return `<div class="fld"><label>${label}</label><input id="${id}" type="file" accept="image/*,application/pdf" data-path="${esc(existingPath||'')}">${existingPath?`<div style="margin-top:4px"><button type="button" class="edit-btn" onclick="viewSecure('${jss(existingPath)}')">🔒 View current (secure)</button></div>`:''}</div>`;
}
function hrFieldsHtml(prefix,o,whoLabel){
  o=o||{};
  return `
    <div class="hr-sec"><h4>📇 Contact &amp; personal</h4>
      <div class="fld"><label>Home address</label><textarea id="${prefix}_addr" rows="2" placeholder="Optional">${esc(o.home_address||'')}</textarea></div>
      <div class="frow"><div class="fld"><label>Date of birth</label><input id="${prefix}_dob" type="date" value="${esc(String(o.date_of_birth||'').slice(0,10))}"></div>
      <div class="fld"><label>Nationality</label><input id="${prefix}_nat" value="${esc(o.nationality||'')}" placeholder="e.g. British"></div></div>
    </div>
    <div class="hr-sec"><h4>🆘 Next of kin (emergency contact)</h4>
      <div class="frow"><div class="fld"><label>Name</label><input id="${prefix}_nokn" value="${esc(o.nok_name||'')}" placeholder="Full name"></div>
      <div class="fld"><label>Relationship</label><input id="${prefix}_nokr" value="${esc(o.nok_relationship||'')}" placeholder="e.g. Spouse, Parent"></div></div>
      <div class="fld"><label>Contact number</label><input id="${prefix}_nokp" value="${esc(o.nok_phone||'')}" placeholder="Emergency phone"></div>
    </div>
    <div class="hr-sec"><h4>✈️ EU travel</h4>
      <div class="frow"><div class="fld"><label>A1 status</label><select id="${prefix}_a1s">${A1_STATES.map(s=>`<option value="${s}" ${(o.a1_status||'')===s?'selected':''}>${s||'—'}</option>`).join('')}</select></div>
      <div class="fld"><label>A1 expiry</label><input id="${prefix}_a1e" type="date" value="${esc(String(o.a1_expiry||'').slice(0,10))}"></div></div>
      ${secureFileField(prefix+'_a1f','A1 portable document (copy)',o.a1_file)}
      <div class="frow"><div class="fld"><label>Medical insurance (GHIC / EHIC / insurer)</label><input id="${prefix}_medp" value="${esc(o.medical_provider||'')}" placeholder="e.g. GHIC"></div>
      <div class="fld"><label>Card / policy no.</label><input id="${prefix}_medn" value="${esc(o.medical_number||'')}" placeholder="Optional"></div></div>
      <div class="fld"><label>Medical card expiry</label><input id="${prefix}_mede" type="date" value="${esc(String(o.medical_expiry||'').slice(0,10))}"></div>
      ${secureFileField(prefix+'_medf','Medical insurance card (copy)',o.medical_file)}
      <div class="frow"><div class="fld"><label>Passport number</label><input id="${prefix}_passn" value="${esc(o.passport_number||'')}" placeholder="Optional"></div>
      <div class="fld"><label>Passport expiry</label><input id="${prefix}_passe" type="date" value="${esc(String(o.passport_expiry||'').slice(0,10))}"></div></div>
      ${secureFileField(prefix+'_passf','Passport (copy)',o.passport_file)}
    </div>
    <div class="fld"><label>HR / safety notes</label><textarea id="${prefix}_hrnotes" rows="2" placeholder="Optional">${esc(o.hr_notes||'')}</textarea></div>
    <div class="note" style="font-size:11.5px">🔒 Private — visible only to Mercury${whoLabel?(' '+whoLabel):''}. Never shown to clients. Document copies are stored in a private area and opened with a short-lived secure link.</div>`;
}
async function collectHrFields(prefix, secureDir, whoName){
  async function up(inputId, tag){
    const fi=el(inputId); let path=fi?(fi.getAttribute('data-path')||''):'';
    if(fi&&fi.files&&fi.files[0]){ const f=fi.files[0]; const ext=((f.name||'').split('.').pop()||'pdf').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,5)||'pdf'; const sn=((whoName||'eng')+'-'+tag).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40); const p=await uploadSecure(f, `${secureDir}/${sn}_${Date.now()}.${ext}`, f.type); if(p) path=p; }
    return path||null;
  }
  return {
    home_address:val(prefix+'_addr')||null, date_of_birth:val(prefix+'_dob')||null, nationality:val(prefix+'_nat')||null,
    nok_name:val(prefix+'_nokn')||null, nok_relationship:val(prefix+'_nokr')||null, nok_phone:val(prefix+'_nokp')||null,
    a1_status:val(prefix+'_a1s')||null, a1_expiry:val(prefix+'_a1e')||null, a1_file:await up(prefix+'_a1f','a1'),
    medical_provider:val(prefix+'_medp')||null, medical_number:val(prefix+'_medn')||null, medical_expiry:val(prefix+'_mede')||null, medical_file:await up(prefix+'_medf','medical'),
    passport_number:val(prefix+'_passn')||null, passport_expiry:val(prefix+'_passe')||null, passport_file:await up(prefix+'_passf','passport'),
    hr_notes:val(prefix+'_hrnotes')||null
  };
}
function openSupEngineerForm(id){
  const e = id ? ((SDATA.engineers||[]).find(x=>x.id===id)||{}) : {};
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>${id?'Edit engineer':'Add engineer'}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="fld"><label>Full name <span class="req">*</span></label><input id="e_name" value="${esc(e.full_name||'')}" placeholder="Engineer’s full name"></div>
      <div class="frow">
        <div class="fld"><label>Trade / skill</label><input id="e_trade" value="${esc(e.trade||'')}" placeholder="e.g. Mechanical, Electrical, Multi-skilled"></div>
        <div class="fld"><label>Right to work</label><select id="e_rtw">${RTW_STATES.map(o=>`<option ${(e.rtw_status||'Not checked')===o?'selected':''}>${o}</option>`).join('')}</select></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Phone</label><input id="e_phone" value="${esc(e.phone||'')}" placeholder="Optional"></div>
        <div class="fld"><label>Email</label><input id="e_email" value="${esc(e.email||'')}" placeholder="Optional"></div>
      </div>
      <div class="fld"><label>Certificates, accreditation &amp; training cards</label>${cardsWrapHtml(e.cards)}</div>
      <datalist id="cardTypes"><option>CSCS</option><option>IPAF</option><option>PASMA</option><option>ECS</option><option>SSSTS</option><option>SMSTS</option><option>First Aid</option><option>Asbestos Awareness</option><option>18th Edition</option></datalist>
      ${hrFieldsHtml('e',e,'and you (the supplier)')}
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="engSave" onclick="submitSupEngineer(${id?`'${id}'`:'null'})">${id?'Save changes':'Add engineer'}</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
async function submitSupEngineer(id){
  const name=val('e_name'); if(!name){ msg('Please enter the engineer’s name.','err'); return; }
  const btn=el('engSave'); btn.disabled=true; btn.textContent='Saving…'; msg('Uploading…','');
  const cards=await collectCardsAsync('supCards', name);
  const hr=await collectHrFields('e', `supplier/${SUPPLIER.id}/hr`, name);
  const row=Object.assign({ supplier_id:SUPPLIER.id, full_name:name, trade:val('e_trade')||null, phone:val('e_phone')||null, email:val('e_email')||null, rtw_status:val('e_rtw')||'Not checked', cards:cards }, hr);
  const res = id ? await sb.from('supplier_engineers').update(row).eq('id',id) : await sb.from('supplier_engineers').insert(row);
  if(res.error){ btn.disabled=false; btn.textContent=id?'Save changes':'Add engineer'; msg('Could not save: '+res.error.message,'err'); return; }
  msg('✓ Saved.','ok'); await supRefresh('sup_engineers');
}
async function deleteSupEngineer(id){ const e=(SDATA.engineers||[]).find(x=>x.id===id)||{}; if(!confirm('Remove '+(e.full_name||'this engineer')+' from your books?')) return; const {error}=await sb.from('supplier_engineers').delete().eq('id',id); if(error){ alert('Could not remove: '+error.message); return; } await supRefresh('sup_engineers'); }
function pageSupJobs(){
  if(!SUPPLIER) return pageSupHome();
  const asgs=(SDATA.assignments||[]).slice().sort((a,b)=>String(b.start_date||'').localeCompare(String(a.start_date||'')));
  const toFill=asgs.filter(a=>!a.engineer_id && a.status!=='Cancelled');
  const header=`<div class="sechead"><h3>My Assignments</h3><span class="sub">Jobs Mercury has booked your engineers onto</span><span class="line"></span></div>`;
  if(!asgs.length) return header+emptyState('🗓','No assignments yet','When Mercury assigns your engineers to a job it will appear here with dates, location and shift.');
  const fillBanner = toFill.length ? `<div class="card" style="margin-bottom:12px;border:1px solid var(--amber);background:linear-gradient(180deg,rgba(245,158,11,.08),transparent)"><b>🗓 ${toFill.length} job${toFill.length===1?'':'s'} to fill</b> — Mercury has sent you ${toFill.length===1?'a job':'jobs'} to staff. Tap <b>Fill</b> to assign one of your engineers.</div>` : '';
  return header+fillBanner+`<div class="card" style="overflow-x:auto"><table class="tbl"><thead><tr><th>Dates</th><th>Engineer</th><th>Job</th><th>Client</th><th>Where</th><th>Shift</th><th>Rate</th><th>Status</th><th></th></tr></thead><tbody>
    ${asgs.map(a=>{ const open=!a.engineer_id; return `<tr${open?' style="background:rgba(245,158,11,.06)"':''}><td>${esc(String(a.start_date||'').slice(0,10))}${a.end_date?' → '+esc(String(a.end_date).slice(0,10)):''}</td><td>${open?'<span class="chip amber">To fill</span>':esc(supEngName(a.engineer_id))}</td><td>${esc(a.title||'—')}</td><td>${esc(supClientName(a.client_id)||'—')}</td><td>${esc(a.site_label||'—')}</td><td>${esc(a.shift||'—')}</td><td>${a.charge_rate!=null?gbp(a.charge_rate)+'/hr':'—'}</td><td>${statusChip(a.status)}</td><td>${open?`<button class="btn" style="padding:5px 10px" onclick="openFillAssign('${a.id}')">Fill</button>`:`<button class="edit-btn" onclick="openFillAssign('${a.id}')">Change</button>`}</td></tr>`;}).join('')}
    </tbody></table></div>`;
}
function openFillAssign(assignmentId){
  const a=(SDATA.assignments||[]).find(x=>x.id===assignmentId)||{};
  const engs=(SDATA.engineers||[]).filter(e=>e.status==='Approved');
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>Fill this job</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="card" style="margin-bottom:12px"><b>${esc(a.title||'Job')}</b><div class="muted" style="font-size:12px">${esc([supClientName(a.client_id),a.site_label,a.start_date,a.shift].filter(Boolean).join(' · '))}</div></div>
      ${engs.length?`<div class="fld"><label>Assign your engineer <span class="req">*</span></label><select id="fa_eng" onchange="updateFillComp(this.value)"><option value="">— choose —</option>${engs.map(e=>`<option value="${e.id}" ${a.engineer_id===e.id?'selected':''}>${esc(e.full_name)}${e.trade?' — '+esc(e.trade):''}</option>`).join('')}</select><div id="fa_comp">${compBadge(a.engineer_id)}</div></div>
      <div class="fld"><label>Status</label><select id="fa_status">${['Booked','On site','Complete'].map(o=>`<option ${(a.status||'Booked')===o?'selected':''}>${o}</option>`).join('')}</select></div>`
      :`<div class="empty" style="padding:12px">You have no approved engineers yet. Add and get an engineer approved first.</div>`}
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button>${engs.length?`<button class="btn" id="faSave" onclick="submitFillAssign('${assignmentId}')">Confirm</button>`:''}</div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
async function submitFillAssign(assignmentId){
  const eng=val('fa_eng'); if(!eng){ msg('Please choose an engineer.','err'); return; }
  if(!complianceGateOk(eng, supEngName(eng))) return;   // gate on tickets/right-to-work
  const btn=el('faSave'); btn.disabled=true; btn.textContent='Saving…'; msg('','');
  const {error}=await sb.from('supplier_assignments').update({engineer_id:eng, status:val('fa_status')||'Booked'}).eq('id',assignmentId);
  if(error){ btn.disabled=false; btn.textContent='Confirm'; msg('Could not save: '+error.message,'err'); return; }
  msg('✓ Job filled.','ok'); await supRefresh('sup_jobs');
}
function pageSupTimesheets(){
  if(!SUPPLIER) return pageSupHome();
  const ts=(SDATA.timesheets||[]).slice().sort((a,b)=>String(b.work_date||'').localeCompare(String(a.work_date||'')));
  const header=`<div class="sechead"><h3>Timesheets</h3><span class="sub">Submit hours &amp; track approval and cost</span><span class="line"></span><button class="addbtn" onclick="openSupTimesheetForm()">＋ Submit timesheet</button></div>`;
  const totApproved=ts.filter(t=>t.status==='Approved'||t.status==='Paid').reduce((a,t)=>a+tsCost(t),0);
  const k=`<div class="grid kpis" style="margin-bottom:14px">
    ${kpi('','⏱','Submitted',ts.filter(t=>t.status==='Submitted').length,'')}
    ${kpi('green','✓','Approved',ts.filter(t=>t.status==='Approved').length,'')}
    ${kpi('cyan','£','Approved value',gbp(totApproved).replace('£',''),'')}
  </div>`;
  if(!ts.length) return header+k+emptyState('⏱','No timesheets yet','Tap “Submit timesheet” to log hours for one of your engineers.');
  return header+k+`<div class="card" style="overflow-x:auto"><table class="tbl"><thead><tr><th>Date</th><th>Engineer</th><th>Std</th><th>OT</th><th>Miles</th><th>Rate</th><th>Cost</th><th>Status</th><th></th></tr></thead><tbody>
    ${ts.map(t=>{ const editable=['Submitted','Rejected'].includes(t.status); return `<tr><td>${esc(String(t.work_date||'').slice(0,10))}</td><td>${esc(supEngName(t.engineer_id))}</td><td>${t.hours_normal||0}</td><td>${t.hours_ot||0}</td><td>${t.travel_miles||0}</td><td>${t.charge_rate!=null?gbp(t.charge_rate):'—'}</td><td><b>${gbp(tsCost(t))}</b></td><td>${statusChip(t.status)}${t.approver_note?` <span class="muted" title="${esc(t.approver_note)}">ⓘ</span>`:''}</td><td>${editable?`<button class="edit-btn" onclick="openSupTimesheetForm('${t.id}')">Edit</button>`:''}</td></tr>`; }).join('')}
    </tbody></table></div>`;
}
function openSupTimesheetForm(id){
  const t = id ? ((SDATA.timesheets||[]).find(x=>x.id===id)||{}) : {};
  const engs=(SDATA.engineers||[]).filter(e=>e.status!=='Suspended');
  const asgs=(SDATA.assignments||[]);
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>${id?'Edit timesheet':'Submit timesheet'}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="fld"><label>Engineer <span class="req">*</span></label><select id="t_eng">${engs.map(e=>`<option value="${e.id}" ${t.engineer_id===e.id?'selected':''}>${esc(e.full_name)}</option>`).join('')}</select></div>
      <div class="fld"><label>Against assignment (optional — sets the rate)</label><select id="t_asg" onchange="const a=(SDATA.assignments||[]).find(x=>x.id===this.value); if(a&&a.charge_rate!=null&&el('t_rate')&&!el('t_rate').value) el('t_rate').value=a.charge_rate"><option value="">— none —</option>${asgs.map(a=>`<option value="${a.id}" ${t.assignment_id===a.id?'selected':''}>${esc((a.title||'Job')+' · '+(a.start_date||''))}</option>`).join('')}</select></div>
      <div class="frow">
        <div class="fld"><label>Work date <span class="req">*</span></label><input id="t_date" type="date" value="${esc(String(t.work_date||'').slice(0,10))}"></div>
        <div class="fld"><label>Charge rate (£/hr)</label><input id="t_rate" type="number" min="0" step="0.01" value="${t.charge_rate!=null?esc(String(t.charge_rate)):''}" placeholder="e.g. 32.50"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Standard hours</label><input id="t_hn" type="number" min="0" step="0.25" value="${t.hours_normal!=null?esc(String(t.hours_normal)):''}" placeholder="e.g. 10"></div>
        <div class="fld"><label>Overtime hours</label><input id="t_ho" type="number" min="0" step="0.25" value="${t.hours_ot!=null?esc(String(t.hours_ot)):''}" placeholder="e.g. 2"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>OT rate (£/hr, optional)</label><input id="t_otr" type="number" min="0" step="0.01" value="${t.ot_rate!=null?esc(String(t.ot_rate)):''}" placeholder="defaults to 1.5×"></div>
        <div class="fld"><label>Travel miles</label><input id="t_miles" type="number" min="0" step="1" value="${t.travel_miles!=null?esc(String(t.travel_miles)):''}" placeholder="Optional"></div>
      </div>
      <div class="fld"><label>Notes</label><input id="t_notes" value="${esc(t.notes||'')}" placeholder="Optional"></div>
      <div class="note" style="font-size:11.5px">Cost = standard × rate + overtime × OT rate + miles × £0.45. Mercury approves before payment.</div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="tsSave" onclick="submitSupTimesheet(${id?`'${id}'`:'null'})">${id?'Save changes':'Submit'}</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
async function submitSupTimesheet(id){
  const eng=val('t_eng'); const date=val('t_date');
  if(!eng){ msg('Please choose an engineer.','err'); return; }
  if(!date){ msg('Please enter the work date.','err'); return; }
  const btn=el('tsSave'); btn.disabled=true; btn.textContent='Saving…'; msg('','');
  const row={ supplier_id:SUPPLIER.id, engineer_id:eng, assignment_id:(val('t_asg')||null), work_date:date, hours_normal:num('t_hn')||0, hours_ot:num('t_ho')||0, ot_rate:num('t_otr'), travel_miles:num('t_miles')||0, charge_rate:num('t_rate'), notes:val('t_notes')||null, status:'Submitted' };
  const res = id ? await sb.from('supplier_timesheets').update(row).eq('id',id) : await sb.from('supplier_timesheets').insert(row);
  if(res.error){ btn.disabled=false; btn.textContent=id?'Save changes':'Submit'; msg('Could not save: '+res.error.message,'err'); return; }
  msg('✓ Submitted for approval.','ok'); await supRefresh('sup_timesheets');
}
function pageSupFeedback(){
  if(!SUPPLIER) return pageSupHome();
  const engs=(SDATA.engineers||[]).slice().sort((a,b)=>String(a.full_name||'').localeCompare(String(b.full_name||'')));
  const ratings=(SDATA.ratings||[]).slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  const board=`<div class="card" style="margin-bottom:14px"><h4 style="margin:0 0 10px">🚦 Engineer traffic light</h4><div class="teamgrid">${engs.map(e=>{ const f=engFlagFor(e); const rs=ratings.filter(r=>r.engineer_id===e.id); const sc=[]; rs.forEach(r=>['quality','safety','timekeeping','attitude'].forEach(k=>{ if(r[k]!=null) sc.push(Number(r[k])); })); const avg=sc.length?(sc.reduce((a,b)=>a+b,0)/sc.length):null; return `<div class="teamcard" style="padding:12px"><div class="th"><div class="nm">${flagDot(f)} ${esc(e.full_name)}</div></div><div class="meta"><span>Rating</span><b>${avg!=null?avg.toFixed(1)+' / 5':'<span class="muted">—</span>'}</b></div><div class="meta"><span>Reviews</span><b>${rs.length}</b></div></div>`; }).join('')}</div><div class="note" style="font-size:11.5px;margin-top:8px">Lights are set by Mercury from site performance. Green = performing well, amber = watch, red = at risk.</div></div>`;
  const feedList = ratings.length ? `<div class="card"><h4 style="margin:0 0 10px">💬 Recent feedback</h4>${ratings.slice(0,30).map(r=>{ const parts=[['Quality',r.quality],['Safety',r.safety],['Timekeeping',r.timekeeping],['Attitude',r.attitude]].filter(p=>p[1]!=null).map(p=>`${p[0]} ${'★'.repeat(p[1])}`).join(' · '); return `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px"><b>${esc(supEngName(r.engineer_id))}</b><span class="muted" style="font-size:12px">${esc(String(r.created_at||'').slice(0,10))}</span></div>${parts?`<div style="font-size:12.5px;color:var(--cyan);margin-top:2px">${parts}</div>`:''}${(r.no_show||r.incident)?`<div style="margin-top:3px">${r.no_show?'<span class="chip red">No-show</span> ':''}${r.incident?'<span class="chip red">Safety incident</span>':''}</div>`:''}${r.comment?`<div style="margin-top:4px">${esc(r.comment)}</div>`:''}</div>`; }).join('')}</div>` : emptyState('💬','No feedback yet','Mercury’s ratings of your engineers will appear here.');
  return `<div class="sechead"><h3>Performance &amp; Feedback</h3><span class="sub">How your engineers are rated on site</span><span class="line"></span></div>`+board+feedList;
}
function pageSupDocs(){
  if(!SUPPLIER) return pageSupHome();
  const docs=(SDATA.documents||[]).slice().sort((a,b)=>String(a.label||'').localeCompare(String(b.label||'')));
  const header=`<div class="sechead"><h3>Company Documents</h3><span class="sub">Insurance, accreditations &amp; policies</span><span class="line"></span><button class="addbtn" onclick="openSupDocForm()">＋ Add document</button></div>`;
  if(!docs.length) return header+emptyState('📁','No documents yet','Upload your insurance, accreditations and key policies here.');
  return header+`<div class="card"><table class="tbl"><thead><tr><th>Document</th><th>Type</th><th>Expiry</th><th></th><th></th></tr></thead><tbody>
    ${docs.map(d=>`<tr><td><b>${esc(d.label)}</b></td><td>${esc(d.doc_type||'—')}</td><td>${d.expiry?`<span class="chip ${cardStatus(d.expiry).c}">${esc(String(d.expiry).slice(0,10))}</span>`:'—'}</td><td>${d.file_path?`<a href="${esc(d.file_path)}" target="_blank" rel="noopener">📄 View</a>`:'<span class="muted">no file</span>'}</td><td><button class="edit-btn" style="color:var(--red)" onclick="deleteSupDoc('${d.id}')">🗑</button></td></tr>`).join('')}
    </tbody></table></div>`;
}
function openSupDocForm(){
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>Add company document</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="fld"><label>Document name <span class="req">*</span></label><input id="d_label" placeholder="e.g. Employers Liability Insurance"></div>
      <div class="frow">
        <div class="fld"><label>Type</label><select id="d_type">${['Insurance','Accreditation','Policy','Certificate','Other'].map(o=>`<option>${o}</option>`).join('')}</select></div>
        <div class="fld"><label>Expiry (optional)</label><input id="d_exp" type="date"></div>
      </div>
      <div class="fld"><label>File (PDF or image)</label><input id="d_file" type="file" accept="image/*,application/pdf"></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="docSave" onclick="submitSupDoc()">Add document</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
async function submitSupDoc(){
  const label=val('d_label'); if(!label){ msg('Please enter a document name.','err'); return; }
  const btn=el('docSave'); btn.disabled=true; btn.textContent='Saving…'; msg('Uploading…','');
  let fileUrl=null; const fi=el('d_file');
  if(fi&&fi.files&&fi.files[0]){ const f=fi.files[0]; const ext=((f.name||'').split('.').pop()||'pdf').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,5)||'pdf'; const sn=label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40); fileUrl=await uploadBlob(f, `supplier/${SUPPLIER.id}/docs/${sn}_${Date.now()}.${ext}`, f.type); }
  const row={ supplier_id:SUPPLIER.id, label:label, doc_type:val('d_type')||null, expiry:val('d_exp')||null, file_path:fileUrl };
  const {error}=await sb.from('supplier_documents').insert(row);
  if(error){ btn.disabled=false; btn.textContent='Add document'; msg('Could not save: '+error.message,'err'); return; }
  msg('✓ Saved.','ok'); await supRefresh('sup_docs');
}
async function deleteSupDoc(id){ if(!confirm('Delete this document?')) return; const {error}=await sb.from('supplier_documents').delete().eq('id',id); if(error){ alert('Could not delete: '+error.message); return; } await supRefresh('sup_docs'); }

