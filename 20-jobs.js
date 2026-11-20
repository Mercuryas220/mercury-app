/* ===================================================================
   JOBS REGISTER  —  Phase 1. One record per job, numbered by its
   Q reference (Q-UK-0001 …) for life. Mercury staff only; what each
   person can do comes from their staff role's permissions.
   Jobs are never deleted, only archived (with a reason).
   =================================================================== */

let JOBREG=null, JOBREG_ERR=null, JOBREG_LOADING=false;
let JOBREG_SITES=[], JOBREG_ENTITIES=[], MYPERMS=null;
let JOBREG_F={status:'open', entity:'all', client:'all', q:'', archived:false};

TITLES.jobreg='Jobs';

const JOB_STATUSES=[
  ['created','Created','grey'], ['mobilising','Mobilising','cyan'], ['live','Live','green'],
  ['complete','Complete','violet'], ['ready_to_invoice','Ready to invoice','amber'],
  ['invoiced','Invoiced','violet'], ['closed','Closed','grey'], ['cancelled','Cancelled','red']];
const JOB_OPEN=['created','mobilising','live','complete','ready_to_invoice'];

function jobCan(p){ return !!(MYPERMS && MYPERMS.includes(p)); }
function jobStatusChip(s){ const x=JOB_STATUSES.find(r=>r[0]===s)||[s,s,'grey']; return `<span class="chip ${x[2]}">${esc(x[1])}</span>`; }
function jobMoney(v,cur){ if(v==null||v==='') return '—'; const sym=({GBP:'£',EUR:'€',USD:'$'})[cur]||(cur+' '); return sym+Number(v).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function jobDate(d){ if(!d) return ''; const p=String(d).slice(0,10).split('-'); return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:esc(d); }
function jobClientName(id){ const c=(CLIENTS||[]).find(x=>x.id===id); return c?c.name:'—'; }
function jobSiteName(id){ const s=JOBREG_SITES.find(x=>x.id===id); return s?(s.code||s.name||s.city||'Site'):''; }

// Fetch every row, 1,000 at a time, so lists are never silently cut off.
async function jobFetchAll(makeQuery){
  const out=[]; const size=1000;
  for(let from=0; ; from+=size){
    const r=await makeQuery().range(from, from+size-1);
    if(r.error) throw r.error;
    out.push(...(r.data||[]));
    if(!r.data || r.data.length<size) break;
  }
  return out;
}

async function loadJobRegister(){
  if(JOBREG_LOADING) return; JOBREG_LOADING=true; JOBREG_ERR=null;
  try{
    const perms = PROFILE.staff_role
      ? await sb.from('role_permissions').select('permission_code').eq('role_code', PROFILE.staff_role)
      : {data:[]};
    if(perms.error) throw perms.error;
    MYPERMS=(perms.data||[]).map(r=>r.permission_code);
    const [jobs, ents, sites] = await Promise.all([
      jobCan('jobs.view') ? jobFetchAll(()=>sb.from('jobs').select('*').order('created_at',{ascending:false})) : Promise.resolve([]),
      sb.from('trading_entities').select('*').order('code'),
      jobFetchAll(()=>sb.from('sites').select('id,client_id,code,name,city,country').order('code'))
    ]);
    if(ents.error) throw ents.error;
    JOBREG=jobs; JOBREG_ENTITIES=ents.data||[]; JOBREG_SITES=sites;
    if(!LOGINS || !LOGINS.length){ try{ await loadLogins(); }catch(e){} }
  }catch(e){ JOBREG_ERR=e.message||String(e); JOBREG=JOBREG||[]; }
  JOBREG_LOADING=false;
  if(CURRENT==='jobreg') go('jobreg');
}

function jobFiltered(){
  const f=JOBREG_F, q=f.q.trim().toLowerCase();
  return (JOBREG||[]).filter(j=>{
    if(!f.archived && j.archived_at) return false;
    if(f.archived && !j.archived_at) return false;
    if(f.status==='open' && !JOB_OPEN.includes(j.status)) return false;
    if(f.status!=='open' && f.status!=='all' && j.status!==f.status) return false;
    if(f.entity!=='all' && j.entity_code!==f.entity) return false;
    if(f.client!=='all' && j.client_id!==f.client) return false;
    if(q && ![j.job_ref,j.title,j.client_po_ref,j.location,jobClientName(j.client_id),jobSiteName(j.site_id)].some(v=>String(v||'').toLowerCase().includes(q))) return false;
    return true;
  });
}

function jobSetFilter(k,v){ JOBREG_F[k]=v; const t=el('jobTable'); if(t){ t.innerHTML=jobTableHtml(); const c=el('jobCount'); if(c) c.textContent=jobFiltered().length; } else go('jobreg'); }

function jobTableHtml(){
  const rows=jobFiltered(); const showVal=true;
  if(!rows.length) return `<div class="empty" style="padding:26px"><div class="big">📋</div><b>No jobs match</b><div style="margin-top:6px;font-size:13px">${(JOBREG||[]).length?'Try a different filter.':'Jobs are created by converting an accepted quote (Quotes → Convert to job).'}</div></div>`;
  return `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Q ref</th><th>Job</th><th>Client</th><th>Site</th><th>Co.</th><th>Status</th><th>Dates</th>${showVal?'<th style="text-align:right">Contract value</th>':''}<th></th></tr></thead><tbody>${
    rows.map(j=>`<tr${j.archived_at?' style="opacity:.6"':''}>
      <td><b style="white-space:nowrap">${esc(j.job_ref)}</b></td>
      <td>${esc(j.title)}${j.client_po_ref?`<div class="muted" style="font-size:11.5px">PO ${esc(j.client_po_ref)}</div>`:''}</td>
      <td>${esc(jobClientName(j.client_id))}</td>
      <td>${esc(jobSiteName(j.site_id))}</td>
      <td>${esc(j.entity_code)}</td>
      <td>${jobStatusChip(j.status)}${j.archived_at?' <span class="chip grey">Archived</span>':''}</td>
      <td style="white-space:nowrap">${jobDate(j.start_date)}${j.end_date?' – '+jobDate(j.end_date):''}</td>
      ${showVal?`<td style="text-align:right;white-space:nowrap">${jobMoney(j.contract_value,j.currency)}</td>`:''}
      <td><button class="btn-ghost" style="padding:5px 10px" onclick="openJobForm('${j.id}')">${jobCan('jobs.edit')?'Open':'View'}</button></td>
    </tr>`).join('')}</tbody></table></div>`;
}

function pageJobRegister(){
  if(PROFILE.role!=='admin') return emptyState('🔒','Mercury staff only','Jobs are only visible to the Mercury team.');
  if(JOBREG===null){ loadJobRegister(); return emptyState('⏳','Loading jobs…','One moment.'); }
  if(JOBREG_ERR) return emptyState('⚠','Could not load jobs', esc(JOBREG_ERR)+`<div style="margin-top:10px"><button class="btn-ghost" onclick="JOBREG=null;go('jobreg')">Try again</button></div>`);
  if(!jobCan('jobs.view')) return emptyState('🔒','No access to jobs','Your staff role does not include viewing jobs. Ask a Director.');
  const open=(JOBREG||[]).filter(j=>!j.archived_at && JOB_OPEN.includes(j.status));
  const count=s=>open.filter(j=>j.status===s).length;
  let valueKpi='';
  {
    const byCur={}; open.forEach(j=>{ if(j.contract_value!=null) byCur[j.currency]=(byCur[j.currency]||0)+Number(j.contract_value); });
    const txt=Object.keys(byCur).sort().map(c=>jobMoney(byCur[c],c).replace(/\.00$/,'')).join(' · ')||'—';
    valueKpi=`<div class="card kpi"><div class="spark">💷</div><div class="lbl">Open value</div><div class="val" style="font-size:20px">${txt}</div></div>`;
  }
  const header=`<div class="sechead"><h3>📋 Jobs</h3><span class="sub">Created from accepted quotes · Q reference for life · <span id="jobCount">${jobFiltered().length}</span> shown</span><span class="line"></span>${jobCan('quotes.view')?`<button class="addbtn" onclick="go('quotereg')">📝 Quotes</button>`:''}</div>`;
  const kpis=`<div class="grid kpis" style="margin-bottom:14px">
    ${kpi('','📋','Open jobs',open.length)}
    ${kpi('','🚚','Mobilising',count('mobilising'))}
    ${kpi('','🟢','Live',count('live'))}
    ${kpi('','🧾','Ready to invoice',count('ready_to_invoice'))}
    ${valueKpi}</div>`;
  const opt=(v,l,cur)=>`<option value="${esc(v)}" ${v===cur?'selected':''}>${esc(l)}</option>`;
  const clientIds=[...new Set((JOBREG||[]).map(j=>j.client_id))];
  const filters=`<div class="card fld" style="padding:12px 14px;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">
    <input placeholder="Search Q ref, job, client, PO…" value="${esc(JOBREG_F.q)}" oninput="jobSetFilter('q',this.value)" style="flex:1;min-width:200px;width:auto">
    <select style="width:auto" onchange="jobSetFilter('status',this.value)">${opt('open','Open jobs',JOBREG_F.status)}${opt('all','All statuses',JOBREG_F.status)}${JOB_STATUSES.map(s=>opt(s[0],s[1],JOBREG_F.status)).join('')}</select>
    <select style="width:auto;max-width:280px" onchange="jobSetFilter('entity',this.value)">${opt('all','All companies',JOBREG_F.entity)}${JOBREG_ENTITIES.map(e=>opt(e.code,e.code+' — '+e.legal_name,JOBREG_F.entity)).join('')}</select>
    <select style="width:auto" onchange="jobSetFilter('client',this.value)">${opt('all','All clients',JOBREG_F.client)}${clientIds.map(id=>opt(id,jobClientName(id),JOBREG_F.client)).join('')}</select>
    <label style="display:flex;gap:6px;align-items:center;font-size:13px;white-space:nowrap"><input type="checkbox" style="width:auto;padding:0" ${JOBREG_F.archived?'checked':''} onchange="jobSetFilter('archived',this.checked)"> Archived only</label>
  </div>`;
  return header+kpis+filters+`<div class="card" id="jobTable">${jobTableHtml()}</div>`;
}

/* ---- create / edit ---- */
function jobSiteOptions(clientId, selected){
  const list=JOBREG_SITES.filter(s=>s.client_id===clientId);
  return `<option value="">— no specific site —</option>`+list.map(s=>`<option value="${s.id}" ${s.id===selected?'selected':''}>${esc(s.code||s.name||s.city||'Site')}${s.city&&s.code!==s.city?' · '+esc(s.city):''}</option>`).join('');
}
function jobEntityChanged(){
  const code=el('jb_entity').value; const e=JOBREG_ENTITIES.find(x=>x.code===code);
  const lbl=el('jb_cur'); if(lbl) lbl.textContent=e?e.base_currency:'';
}

function openJobForm(id){
  const j=id?((JOBREG||[]).find(x=>x.id===id)||{}):{};
  const isNew=!id, canEdit=isNew?jobCan('jobs.create'):(jobCan('jobs.edit') && !j.archived_at);
  const dis=canEdit?'':'disabled';
  const fromQuote=j.source==='quote';
  const ent=JOBREG_ENTITIES.find(e=>e.code===j.entity_code);
  const managers=(LOGINS||[]).filter(l=>l.role==='admin');
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal"><div class="modal-h"><h3>${isNew?'New job':esc(j.job_ref)+' · '+esc(j.title)}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      ${isNew?`<div class="box" style="background:var(--panel2);border:1px dashed var(--line2);border-radius:10px;padding:10px 12px;font-size:12.5px;margin-bottom:12px">The Q reference is issued automatically when you save, and stays with this job for life. The trading company and currency cannot be changed afterwards.</div>`:''}
      ${j.archived_at?`<div class="box" style="background:var(--amber-soft);border-radius:10px;padding:10px 12px;font-size:12.5px;margin-bottom:12px"><b>Archived</b> ${jobDate(j.archived_at)} — ${esc(j.archive_reason||'')}</div>`:''}
      <div class="frow">
        <div class="fld"><label>Trading company <span class="req">*</span></label>${isNew
          ? `<select id="jb_entity" onchange="jobEntityChanged()"><option value="">— choose —</option>${JOBREG_ENTITIES.filter(e=>e.active).map(e=>`<option value="${e.code}">${esc(e.code+' — '+e.legal_name)}</option>`).join('')}</select>`
          : `<input value="${esc(j.entity_code+' — '+(ent?ent.legal_name:''))}" disabled>`}</div>
        <div class="fld"><label>Currency</label><div style="padding:11px 2px;font-weight:700" id="jb_cur">${esc(j.currency||'')}</div></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Client <span class="req">*</span></label><select id="jb_client" ${(dis||fromQuote)?'disabled':''} onchange="el('jb_site').innerHTML=jobSiteOptions(this.value,'')"><option value="">— choose —</option>${(CLIENTS||[]).map(c=>`<option value="${c.id}" ${c.id===j.client_id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
        <div class="fld"><label>Site</label><select id="jb_site" ${dis}>${jobSiteOptions(j.client_id,j.site_id)}</select></div>
      </div>
      <div class="fld"><label>Job title <span class="req">*</span></label><input id="jb_title" ${dis} value="${esc(j.title||'')}" placeholder="e.g. Conveyor install, line 3"></div>
      <div class="fld"><label>Description</label><textarea id="jb_desc" ${dis} rows="3">${esc(j.description||'')}</textarea></div>
      <div class="frow">
        <div class="fld"><label>Location</label><input id="jb_loc" ${dis} value="${esc(j.location||'')}"></div>
        <div class="fld"><label>Client PO reference</label><input id="jb_po" ${dis} value="${esc(j.client_po_ref||'')}"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Original contract value</label><input value="${esc(jobMoney(j.contract_value,j.currency))}${fromQuote?' (from the accepted quote)':''}" disabled></div>
        ${isNew?'':`<div class="fld"><label>Status</label><select id="jb_status" ${dis}>${JOB_STATUSES.map(s=>`<option value="${s[0]}" ${s[0]===j.status?'selected':''}>${s[1]}</option>`).join('')}</select></div>`}
      </div>
      <div class="frow">
        <div class="fld"><label>Start date</label><input id="jb_start" ${dis} type="date" value="${esc(String(j.start_date||'').slice(0,10))}"></div>
        <div class="fld"><label>End date</label><input id="jb_end" ${dis} type="date" value="${esc(String(j.end_date||'').slice(0,10))}"></div>
      </div>
      <div class="fld"><label>Job manager</label><select id="jb_mgr" ${dis}><option value="">— none —</option>${managers.map(m=>`<option value="${m.id}" ${m.id===j.job_manager?'selected':''}>${esc(m.email)}</option>`).join('')}</select></div>
      <div class="fld"><label>Notes</label><textarea id="jb_notes" ${dis} rows="2">${esc(j.notes||'')}</textarea></div>
      ${fromQuote?`<div class="muted" style="font-size:12.5px;margin-top:4px">From quote <a href="#" onclick="event.preventDefault();closeForm();QUOTES=null;go('quotereg')">${esc(j.job_ref)}</a>${j.client_po_ref?' · client PO '+esc(j.client_po_ref):''}</div>`:''}
      ${jobCan('margins.view')&&!isNew?`<div id="jobBudget" style="margin-top:12px"></div>`:''}
    </div>
    <div class="modal-foot">
      ${!isNew&&jobCan('history.view')?`<button class="btn-ghost" onclick="openJobHistory('${j.id}')">History</button>`:''}
      ${!isNew&&!j.archived_at&&jobCan('jobs.edit')?`<button class="btn-ghost" style="color:var(--red)" onclick="archiveJob('${j.id}')">Archive</button>`:''}
      ${j.archived_at&&jobCan('records.restore')?`<button class="btn-ghost" onclick="restoreJob('${j.id}')">Restore</button>`:''}
      <button class="btn-ghost" onclick="closeForm()">${canEdit?'Cancel':'Close'}</button>
      ${canEdit?`<button class="btn" id="jbSave" onclick="submitJob(${id?`'${id}'`:'null'})">${isNew?'Create job':'Save'}</button>`:''}
    </div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div></div>`;
  document.body.appendChild(wrap);
  if(jobCan('margins.view') && !isNew) jobLoadBudget(j);
}

async function jobLoadBudget(j){
  const box=el('jobBudget'); if(!box) return;
  const r=await sb.from('job_budget_lines').select('*').eq('job_id',j.id);
  if(r.error||!r.data||!r.data.length){ box.innerHTML=''; return; }
  let c=0,s=0; const rows=r.data.map(b=>{ c+=Number(b.original_cost); s+=Number(b.original_sell);
    return `<tr><td>${esc(b.cost_code)}</td><td style="text-align:right">${jobMoney(b.original_cost,j.currency)}</td><td style="text-align:right">${jobMoney(b.original_sell,j.currency)}</td></tr>`; }).join('');
  const gp=s-c, m=s>0?gp/s*100:0;
  box.innerHTML=`<div style="font-weight:700;margin-bottom:6px">Original budget (locked)</div><div class="card" style="padding:6px 8px"><table class="tbl"><thead><tr><th>Cost code</th><th style="text-align:right">Estimated cost</th><th style="text-align:right">Selling value</th></tr></thead><tbody>${rows}
    <tr><td><b>Total</b></td><td style="text-align:right"><b>${jobMoney(c,j.currency)}</b></td><td style="text-align:right"><b>${jobMoney(s,j.currency)}</b></td></tr></tbody></table>
    <div style="padding:8px 4px;font-size:13px">Expected gross profit <b>${jobMoney(gp,j.currency)}</b> · margin <b>${m.toFixed(1)}%</b></div></div>`;
}

async function submitJob(id){
  const v=k=>{ const e=el(k); return e?e.value.trim():''; };
  const isNew=!id;
  const payload={
    site_id:v('jb_site')||null, title:v('jb_title'),
    description:v('jb_desc')||null, location:v('jb_loc')||null, client_po_ref:v('jb_po')||null,
    start_date:v('jb_start')||null, end_date:v('jb_end')||null, job_manager:v('jb_mgr')||null, notes:v('jb_notes')||null };
  if(el('jb_status')) payload.status=v('jb_status');
  if(isNew) payload.entity_code=v('jb_entity');
  if(isNew && !payload.entity_code) return msg('Choose the trading company.','err');
  if(!payload.title) return msg('Give the job a title.','err');
  if(payload.start_date && payload.end_date && payload.end_date<payload.start_date) return msg('End date is before the start date.','err');
  const btn=el('jbSave'); if(btn) btn.disabled=true; msg('Saving…');
  try{
    const r = isNew
      ? await sb.from('jobs').insert(payload).select().single()
      : await sb.from('jobs').update(payload).eq('id',id).select();
    if(r.error) throw r.error;
    // An update that changes no rows means the database refused it silently.
    if(!isNew && (!r.data || !r.data.length)) throw new Error('The change was not saved — you may not have permission to edit this job.');
    const saved=isNew?r.data:r.data[0];
    const i=(JOBREG||[]).findIndex(x=>x.id===saved.id);
    if(i>=0) JOBREG[i]=saved; else (JOBREG=JOBREG||[]).unshift(saved);
    msg(isNew?`✓ Created ${saved.job_ref}`:'✓ Saved.','ok');
    setTimeout(()=>{ closeForm(); go('jobreg'); }, isNew?900:400);
  }catch(e){ msg('Not saved: '+(e.message||e),'err'); if(btn) btn.disabled=false; }
}

async function archiveJob(id){
  const j=(JOBREG||[]).find(x=>x.id===id); if(!j) return;
  const reason=prompt(`Archive ${j.job_ref}? It will disappear from the normal lists but is never deleted.\n\nReason:`);
  if(reason===null) return;
  if(!reason.trim()){ alert('A reason is needed to archive a job.'); return; }
  const r=await sb.from('jobs').update({archived_at:new Date().toISOString(), archive_reason:reason.trim()}).eq('id',id).select();
  if(r.error || !r.data || !r.data.length){ alert('Not archived: '+(r.error?r.error.message:'no permission')); return; }
  JOBREG[JOBREG.findIndex(x=>x.id===id)]=r.data[0]; closeForm(); go('jobreg');
}

async function restoreJob(id){
  if(!confirm('Restore this job to the normal lists?')) return;
  const r=await sb.from('jobs').update({archived_at:null}).eq('id',id).select();
  if(r.error || !r.data || !r.data.length){ alert('Not restored: '+(r.error?r.error.message:'no permission')); return; }
  JOBREG[JOBREG.findIndex(x=>x.id===id)]=r.data[0]; closeForm(); go('jobreg');
}

async function openJobHistory(id){
  const j=(JOBREG||[]).find(x=>x.id===id)||{};
  const r=await sb.from('change_history').select('changed_at,user_email,action,changes').eq('table_name','jobs').eq('record_id',id).order('changed_at',{ascending:false}).limit(200);
  const skip=['updated_at','archived_by','id','created_by','created_at'];
  const fmt=x=>x==null||x===''?'—':esc(typeof x==='object'?JSON.stringify(x):String(x));
  const rows=(r.data||[]).map(h=>{
    let detail='';
    if(h.action==='insert') detail='Job created';
    else if(h.changes && typeof h.changes==='object') detail=Object.keys(h.changes).filter(k=>!skip.includes(k)).map(k=>`<div><b>${esc(k.replace(/_/g,' '))}</b>: ${fmt(h.changes[k].from)} → ${fmt(h.changes[k].to)}</div>`).join('');
    return `<tr><td style="white-space:nowrap">${new Date(h.changed_at).toLocaleString('en-GB')}</td><td>${esc(h.user_email||'system')}</td><td>${esc(h.action)}</td><td>${detail}</td></tr>`;
  }).join('');
  closeForm();
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal"><div class="modal-h"><h3>History · ${esc(j.job_ref||'')}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">${r.error?`<div class="muted">Could not load: ${esc(r.error.message)}</div>`:`<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Changes</th></tr></thead><tbody>${rows||'<tr><td colspan="4" class="muted">No changes recorded.</td></tr>'}</tbody></table></div>`}</div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm();openJobForm('${id}')">Back to job</button></div></div>`;
  document.body.appendChild(wrap);
}
