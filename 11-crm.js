/* ===================================================================
   INTERNAL CRM  —  client engagement (ADMIN ONLY, never client-visible)
   Status & next follow-up · contacts · engagement log · pipeline.
   =================================================================== */
function pageCRM(){
  if(PROFILE.role!=='admin') return emptyState('🔒','Admins only','The CRM is internal to Mercury and not visible to clients.');
  if(!CLIENT) return emptyState('👈','Choose a client','Pick a client from the dropdown to see and update their engagement, contacts and pipeline.');
  const st=DATA.crmStatus||{};
  const contacts=DATA.crmContacts||[];
  const logs=(DATA.crmLog||[]).slice().sort((a,b)=>new Date(b.occurred_at||b.created_at)-new Date(a.occurred_at||a.created_at));
  const opps=DATA.crmOpps||[];
  const fs=followState(st.next_follow_up);
  const openPipe=opps.filter(o=>!['Won','Lost'].includes(String(o.stage||''))).reduce((a,o)=>a+Number(o.value||0),0);
  const wonPipe=opps.filter(o=>String(o.stage||'')==='Won').reduce((a,o)=>a+Number(o.value||0),0);
  const header=`<div class="sechead"><h3>🤝 CRM — ${esc(CLIENT.name)}</h3><span class="sub">Internal engagement record · not visible to the client</span><span class="line"></span></div>`;
  const status=`<div class="card"><div class="sechead" style="margin:0 0 10px"><h4 style="margin:0">Relationship</h4><span class="line"></span><button class="edit-btn" onclick="openCrmStatusForm()">Edit</button></div>
    <div class="crmmeta">
      <div><span>Stage</span>${crmStageChip(st.stage)}</div>
      <div><span>Next follow-up</span>${st.next_follow_up?`<span class="chip ${fs.c}">${esc(fs.label||String(st.next_follow_up).slice(0,10))}</span>`:'<span class="muted">none set</span>'}</div>
      <div><span>Account owner</span><b>${esc(st.owner||'—')}</b></div>
      <div><span>Open pipeline</span><b>${gbp(openPipe)}</b></div>
      <div><span>Won to date</span><b>${gbp(wonPipe)}</b></div>
    </div>${st.notes?`<div class="crmnote">${esc(st.notes)}</div>`:''}</div>`;
  // contacts
  const contactRows=contacts.length?contacts.map(c=>`<div class="litem"><div class="av">${esc((c.name||'·').split(' ').map(w=>w[0]).join('').slice(0,2))}</div>
      <div class="bd"><div class="t">${esc(c.name)}${c.is_primary?' <span class="chip cyan" style="margin-left:4px">Primary</span>':''}</div>
      <div class="m">${[c.role,c.phone,c.email].filter(Boolean).map(esc).join(' · ')||'—'}</div></div>
      <div class="when"><button class="edit-btn" onclick="openContactForm('${c.id}')">Edit</button></div></div>`).join('')
    :'<div class="empty"><div class="big">👤</div><b>No contacts yet</b></div>';
  const contactsCard=`<div class="card"><div class="sechead" style="margin:0 0 10px"><h4 style="margin:0">Contacts</h4><span class="line"></span><button class="edit-btn" onclick="openContactForm()">＋ Add contact</button></div><div class="list">${contactRows}</div></div>`;
  // engagement log
  const logRows=logs.length?logs.map(l=>`<div class="litem"><div class="av">${itypeIcon(l.itype)}</div>
      <div class="bd"><div class="t">${esc(l.itype||'Note')}${l.logged_by?` <span class="muted" style="font-weight:500">· ${esc(l.logged_by)}</span>`:''}</div>
      <div class="m">${esc(l.summary||'')}</div></div>
      <div class="when">${esc(String(l.occurred_at||l.created_at||'').slice(0,10))}<br><button class="edit-btn" style="color:var(--red)" onclick="deleteInteraction('${l.id}')">Delete</button></div></div>`).join('')
    :'<div class="empty"><div class="big">🗒</div><b>No engagement logged yet</b></div>';
  const logCard=`<div class="card"><div class="sechead" style="margin:0 0 10px"><h4 style="margin:0">Engagement log</h4><span class="line"></span><button class="edit-btn" onclick="openInteractionForm()">＋ Log engagement</button></div><div class="list">${logRows}</div></div>`;
  // opportunities
  const oppRows=opps.length?opps.map(o=>`<tr>
      <td><b>${esc(o.title)}</b>${o.expected_close?`<div class="muted" style="font-size:11px">close ${String(o.expected_close).slice(0,10)}</div>`:''}</td>
      <td>${oppStageChip(o.stage)}</td>
      <td>${o.value!=null?gbp(o.value):'—'}</td>
      <td style="text-align:right"><button class="edit-btn" onclick="openOppForm('${o.id}')">Edit</button></td></tr>`).join('')
    :'<tr><td colspan="4" class="muted" style="text-align:center;padding:16px">No opportunities yet.</td></tr>';
  const oppCard=`<div class="card"><div class="sechead" style="margin:0 0 10px"><h4 style="margin:0">Opportunities / pipeline</h4><span class="line"></span><button class="edit-btn" onclick="openOppForm()">＋ Add opportunity</button></div>
    <table><thead><tr><th>Opportunity</th><th>Stage</th><th>Value</th><th></th></tr></thead><tbody>${oppRows}</tbody></table></div>`;
  return header+status+`<div class="row2" style="margin-top:16px">${contactsCard}${logCard}</div><div style="margin-top:16px">${oppCard}</div>`;
}
async function refreshCRM(){ await loadClientData(); go('crm'); }
/* --- status --- */
function openCrmStatusForm(){
  const st=DATA.crmStatus||{};
  const stageOpts=`<option value="">— set stage —</option>`+CRM_STAGES.map(s=>`<option ${st.stage===s?'selected':''}>${s}</option>`).join('');
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal"><div class="modal-h"><h3>Relationship — ${esc(CLIENT.name)}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      ${engineerDatalist()}
      <div class="frow">
        <div class="fld"><label>Stage</label><select id="cs_stage">${stageOpts}</select></div>
        <div class="fld"><label>Next follow-up</label><input id="cs_follow" type="date" value="${st.next_follow_up?String(st.next_follow_up).slice(0,10):''}"></div>
      </div>
      <div class="fld"><label>Account owner</label><input id="cs_owner" list="engList" value="${esc(st.owner||PROFILE.full_name||'')}"></div>
      <div class="fld"><label>Notes</label><textarea id="cs_notes" placeholder="Relationship notes, account plan, anything useful">${esc(st.notes||'')}</textarea></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="csSave" onclick="submitCrmStatus()">Save</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div></div>`;
  document.body.appendChild(wrap);
}
async function submitCrmStatus(){
  const btn=el('csSave'); btn.disabled=true; btn.textContent='Saving…'; msg('','');
  const row={ client_id:CLIENT.id, stage:val('cs_stage')||null, next_follow_up:val('cs_follow')||null, owner:val('cs_owner')||null, notes:val('cs_notes')||null, updated_at:new Date().toISOString() };
  const {error}=await sb.from('crm_status').upsert(row,{onConflict:'client_id'});
  if(error){ btn.disabled=false; btn.textContent='Save'; msg('Could not save: '+error.message,'err'); return; }
  msg('✓ Saved.','ok'); await loadClientData(); setTimeout(()=>{ closeForm(); go('crm'); },500);
}
/* --- contacts --- */
function openContactForm(id){
  const c=id?((DATA.crmContacts||[]).find(x=>x.id===id)||{}):{};
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal"><div class="modal-h"><h3>${id?'Edit Contact':'Add Contact'}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="frow">
        <div class="fld"><label>Name <span class="req">*</span></label><input id="ct_name" value="${esc(c.name||'')}" placeholder="Full name"></div>
        <div class="fld"><label>Role / title</label><input id="ct_role" value="${esc(c.role||'')}" placeholder="e.g. Facilities Manager"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Phone</label><input id="ct_phone" value="${esc(c.phone||'')}"></div>
        <div class="fld"><label>Email</label><input id="ct_email" value="${esc(c.email||'')}"></div>
      </div>
      <label class="ms-done" style="display:flex;align-items:center;gap:7px;margin:8px 0;font-size:13px"><input type="checkbox" id="ct_primary" ${c.is_primary?'checked':''}> Primary contact</label>
      <div class="fld"><label>Notes</label><textarea id="ct_notes" placeholder="Anything useful">${esc(c.notes||'')}</textarea></div>
    </div>
    <div class="modal-foot">${id?`<button class="btn-ghost" style="color:var(--red)" onclick="deleteContact('${id}')">Delete</button>`:''}<button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="ctSave" onclick="submitContact(${id?`'${id}'`:'null'})">${id?'Save changes':'Add contact'}</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div></div>`;
  document.body.appendChild(wrap);
}
async function submitContact(id){
  const name=val('ct_name'); if(!name){ msg('Please add a name.','err'); return; }
  const btn=el('ctSave'); btn.disabled=true; btn.textContent='Saving…'; msg('','');
  const row={ client_id:CLIENT.id, name:name, role:val('ct_role')||null, phone:val('ct_phone')||null, email:val('ct_email')||null, is_primary:el('ct_primary').checked, notes:val('ct_notes')||null };
  const res=id?await sb.from('crm_contacts').update(row).eq('id',id):await sb.from('crm_contacts').insert(row);
  if(res.error){ btn.disabled=false; btn.textContent=id?'Save changes':'Add contact'; msg('Could not save: '+res.error.message,'err'); return; }
  msg('✓ Saved.','ok'); await loadClientData(); setTimeout(()=>{ closeForm(); go('crm'); },500);
}
async function deleteContact(id){
  if(!confirm('Delete this contact?')) return;
  const {error}=await sb.from('crm_contacts').delete().eq('id',id);
  if(error){ alert('Could not delete: '+error.message); return; }
  await loadClientData(); closeForm(); go('crm');
}
/* --- engagement log --- */
function openInteractionForm(){
  const typeOpts=INTERACTION_TYPES.map(t=>`<option>${t}</option>`).join('');
  const contactOpts=`<option value="">— general / no specific contact —</option>`+(DATA.crmContacts||[]).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal"><div class="modal-h"><h3>Log Engagement</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      ${engineerDatalist()}
      <div class="frow">
        <div class="fld"><label>Type</label><select id="in_type">${typeOpts}</select></div>
        <div class="fld"><label>Date</label><input id="in_date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Contact</label><select id="in_contact">${contactOpts}</select></div>
        <div class="fld"><label>Logged by</label><input id="in_by" list="engList" value="${esc(PROFILE.full_name||PROFILE.email||'')}"></div>
      </div>
      <div class="fld"><label>Summary <span class="req">*</span></label><textarea id="in_summary" placeholder="What was discussed / agreed / actioned"></textarea></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="inSave" onclick="submitInteraction()">Save</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div></div>`;
  document.body.appendChild(wrap);
}
async function submitInteraction(){
  if(!val('in_summary')){ msg('Please add a short summary.','err'); return; }
  const btn=el('inSave'); btn.disabled=true; btn.textContent='Saving…'; msg('','');
  const row={ client_id:CLIENT.id, contact_id:val('in_contact')||null, itype:val('in_type'), summary:val('in_summary'), occurred_at:val('in_date')||new Date().toISOString().slice(0,10), logged_by:val('in_by')||null };
  const {error}=await sb.from('crm_interactions').insert(row);
  if(error){ btn.disabled=false; btn.textContent='Save'; msg('Could not save: '+error.message,'err'); return; }
  msg('✓ Logged.','ok'); await loadClientData(); setTimeout(()=>{ closeForm(); go('crm'); },500);
}
async function deleteInteraction(id){
  if(!confirm('Delete this log entry?')) return;
  const {error}=await sb.from('crm_interactions').delete().eq('id',id);
  if(error){ alert('Could not delete: '+error.message); return; }
  await loadClientData(); go('crm');
}
/* --- opportunities --- */
function openOppForm(id){
  const o=id?((DATA.crmOpps||[]).find(x=>x.id===id)||{}):{};
  const stageOpts=OPP_STAGES.map(s=>`<option ${(o.stage||'Lead')===s?'selected':''}>${s}</option>`).join('');
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal"><div class="modal-h"><h3>${id?'Edit Opportunity':'Add Opportunity'}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="fld"><label>Title <span class="req">*</span></label><input id="op_title" value="${esc(o.title||'')}" placeholder="e.g. Chiller replacement — Phase 2"></div>
      <div class="frow">
        <div class="fld"><label>Estimated value (£)</label><input id="op_value" type="number" min="0" step="100" value="${o.value!=null?o.value:''}"></div>
        <div class="fld"><label>Stage</label><select id="op_stage">${stageOpts}</select></div>
      </div>
      <div class="fld"><label>Expected close</label><input id="op_close" type="date" value="${o.expected_close?String(o.expected_close).slice(0,10):''}"></div>
      <div class="fld"><label>Notes</label><textarea id="op_notes" placeholder="Scope, competition, next step">${esc(o.notes||'')}</textarea></div>
    </div>
    <div class="modal-foot">${id?`<button class="btn-ghost" style="color:var(--red)" onclick="deleteOpp('${id}')">Delete</button>`:''}<button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="opSave" onclick="submitOpp(${id?`'${id}'`:'null'})">${id?'Save changes':'Add opportunity'}</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div></div>`;
  document.body.appendChild(wrap);
}
async function submitOpp(id){
  const title=val('op_title'); if(!title){ msg('Please add a title.','err'); return; }
  const btn=el('opSave'); btn.disabled=true; btn.textContent='Saving…'; msg('','');
  const row={ client_id:CLIENT.id, title:title, value:num('op_value'), stage:val('op_stage')||'Lead', expected_close:val('op_close')||null, notes:val('op_notes')||null };
  const res=id?await sb.from('crm_opportunities').update(row).eq('id',id):await sb.from('crm_opportunities').insert(row);
  if(res.error){ btn.disabled=false; btn.textContent=id?'Save changes':'Add opportunity'; msg('Could not save: '+res.error.message,'err'); return; }
  msg('✓ Saved.','ok'); await loadClientData(); setTimeout(()=>{ closeForm(); go('crm'); },500);
}
async function deleteOpp(id){
  if(!confirm('Delete this opportunity?')) return;
  const {error}=await sb.from('crm_opportunities').delete().eq('id',id);
  if(error){ alert('Could not delete: '+error.message); return; }
  await loadClientData(); closeForm(); go('crm');
}

