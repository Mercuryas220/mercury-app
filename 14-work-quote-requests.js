/* ===================================================================
   WORK REQUESTS / QUOTE INTAKE  —  clients request work; Mercury quotes
   =================================================================== */
const WORK_TYPES=['Planned Maintenance (PPM)','Reactive Maintenance','Breakdown / Emergency','Installation','Upgrade / Modification','Compliance Inspection','Survey','Relocation / De-install','Other'];
const REQ_DISCIPLINES=['Mechanical','Electrical','Conveyor','Combined M&E','Building Services','FM Hard Services','Other'];
const REQ_SYSTEMS=['Conveyor & Sortation','Motors / Pumps / Gearboxes','Dock Levellers','Shutters / Doors','Loading Bays','Electrical Containment & Wiring','Emergency Lighting','Racking / Mezzanine','MHE','Other'];
const REQ_PRIORITY=['Low','Normal','High','Urgent'];
const REQ_STATUS=['New','Reviewing','Quoted','Accepted','Declined'];
const reqStatusCls=s=>({'New':'cyan','Reviewing':'amber','Quoted':'violet','Accepted':'green','Declined':'red'}[s]||'grey');
function sel(id,opts,val){ return `<select id="${id}">${opts.map(o=>`<option ${o===val?'selected':''}>${o}</option>`).join('')}</select>`; }

function openRequestForm(){
  if(!CLIENT){ alert('Pick a client first.'); return; }
  CAPTURE={photos:[],videos:[],sig:null,gps:null};
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>Request Work — ${esc(CLIENT.name)}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="box see" style="background:var(--panel2);border:1px dashed var(--line2);border-radius:10px;padding:11px 13px;font-size:12.5px;color:var(--muted);margin-bottom:14px">The more detail you give, the faster and more accurately we can quote. Add photos of the equipment or site if you can.</div>
      <div class="fld"><label>What do you need? (title) <span class="req">*</span></label><input id="r_title" placeholder="e.g. Conveyor motor replacement — Line 3"></div>
      <div class="frow">
        <div class="fld"><label>Type of work</label>${sel('r_type',WORK_TYPES,'Reactive Maintenance')}</div>
        <div class="fld"><label>Discipline</label>${sel('r_disc',REQ_DISCIPLINES,'Mechanical')}</div>
      </div>
      <div class="frow">
        <div class="fld"><label>System / equipment</label>${sel('r_system',REQ_SYSTEMS,'Conveyor & Sortation')}</div>
        <div class="fld"><label>Priority</label>${sel('r_priority',REQ_PRIORITY,'Normal')}</div>
      </div>
      <div class="fld"><label>Scope of works — describe what needs doing <span class="req">*</span></label><textarea id="r_scope" style="min-height:90px" placeholder="What's the problem / what work is required? Be as specific as you can."></textarea></div>
      <div class="fld"><label>Quantity / scale</label><input id="r_qty" placeholder="e.g. 2 motors, 40m of conveyor, 6 dock levellers"></div>
      <div class="frow">
        <div class="fld"><label>Site name</label><input id="r_sitename" placeholder="Site / facility"></div>
        <div class="fld"><label>Country</label><input id="r_country" placeholder="UK"></div>
      </div>
      <div class="fld"><label>Site address</label><input id="r_address" placeholder="Full address for the works"></div>
      <div class="fld"><label>Site access &amp; working hours</label><textarea id="r_access" placeholder="Access restrictions, live site, permitted hours, inductions needed…"></textarea></div>
      <div class="frow">
        <div class="fld check-row"><input type="checkbox" id="r_ooh"><label style="margin:0">Out-of-hours / weekend work needed</label></div>
        <div class="fld check-row"><input type="checkbox" id="r_survey"><label style="margin:0">Site survey required first</label></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Required start</label><input id="r_start" type="date"></div>
        <div class="fld"><label>Deadline / by when</label><input id="r_deadline" type="date"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Drawings / specs available?</label><input id="r_drawings" placeholder="Yes / No — and how to share"></div>
        <div class="fld"><label>Budget indication (optional)</label><input id="r_budget" placeholder="If helpful"></div>
      </div>
      <div class="fld"><label>Your contact details</label><div class="frow"><input id="r_contact" placeholder="Name"><input id="r_phone" placeholder="Phone"></div><input id="r_email" placeholder="Email" style="margin-top:10px"></div>
      <div class="fld"><label>Photos / attachments</label><div class="photos" id="photoWrap"><label class="photo-add">＋<input type="file" accept="image/*,video/*" multiple style="display:none" id="photoInput"></label></div></div>
      <div class="fld"><label>Anything else</label><textarea id="r_notes" placeholder="Other useful info"></textarea></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="reqSave" onclick="submitRequest()">Submit request</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
  setupPhoto();
}
async function submitRequest(){
  if(!val('r_title')){ msg('Please add a short title.','err'); return; }
  if(!val('r_scope')){ msg('Please describe the scope of works.','err'); return; }
  const btn=el('reqSave'); btn.disabled=true; btn.textContent='Submitting…'; msg('','');
  const ref='REQ-'+Date.now();
  const row={ client_id:CLIENT.id, submitted_by:(PROFILE.full_name||PROFILE.email), title:val('r_title'),
    work_type:val('r_type'), discipline:val('r_disc'), system_type:val('r_system'), priority:val('r_priority'),
    scope:val('r_scope'), quantity_scale:val('r_qty'), site_name:val('r_sitename'), country:val('r_country'),
    site_address:val('r_address'), site_access:val('r_access'), out_of_hours:el('r_ooh').checked, survey_required:el('r_survey').checked,
    required_start:val('r_start')||null, deadline:val('r_deadline')||null, drawings_available:val('r_drawings'),
    budget_indication:val('r_budget'), contact_name:val('r_contact'), contact_phone:val('r_phone'), contact_email:val('r_email'),
    notes:val('r_notes'), status:'New' };
  // Upload photos FIRST and attach them to the insert — clients are allowed to
  // insert a request (but not update it), so the links must go in on creation.
  if(CAPTURE.photos.length || (CAPTURE.videos||[]).length){ btn.textContent='Uploading photos…';
    const urls=await uploadCapture('request', null, `${CLIENT.slug}/requests/${ref}`);
    if(urls.length) row.media_links=urls;
  }
  btn.textContent='Submitting…';
  let {data:ins,error}=await sb.from('work_requests').insert(row).select().maybeSingle();
  if(error && /find the '.*' column|schema cache|column .* does not exist/i.test(error.message||'')){ const core=Object.assign({},row); delete core.media_links; const r2=await sb.from('work_requests').insert(core).select().maybeSingle(); ins=r2.data; error=r2.error; }
  if(error){ btn.disabled=false; btn.textContent='Submit request'; msg('Could not submit: '+error.message,'err'); return; }
  msg('✓ Request submitted — we\'ll review and get back to you with a quote.','ok');
  await loadClientData();
  setTimeout(()=>{ closeForm(); go('requests'); }, 1100);
}
async function updateRequestStatus(id,status){
  try{ await sb.from('work_requests').update({status}).eq('id',id);
    if(['Quoted','Accepted','Declined'].includes(status)){ const r=(DATA.requests||[]).find(x=>x.id===id)||{}; await notifyClient(CLIENT.id,'request','Work request '+status.toLowerCase()+': '+(r.title||'your request'),'requests','We’ve updated your work request to “'+status+'”.'); }
    await loadClientData(); if(HQDATA){await loadHQ();} go('requests'); }
  catch(e){ alert('Could not update: '+(e.message||e)); }
}
function pageRequests(){
  const reqs=(DATA.requests||[]).filter(r=>(r.kind||'work')!=='quote');
  const isClient=VIEW==='client';
  const head=`<div class="sechead"><h3>${isClient?'🛠 Request Work':'📋 Work Requests'}</h3><span class="sub">${reqs.length} request${reqs.length===1?'':'s'}${reqs.filter(r=>r.status==='New').length?` · ${reqs.filter(r=>r.status==='New').length} new`:''}</span><span class="line"></span><button class="addbtn" onclick="openRequestForm()">＋ New Work Request</button></div>`;
  if(!reqs.length) return head+emptyState('🛠', isClient?'Request work from Mercury':'No work requests yet', isClient?'Tap “New Work Request”, describe the work and we\'ll come back with a quote. Add photos to speed things up.':'Requests submitted by this client will appear here for review and quoting.');
  const cards=reqs.map(r=>{
    const photos=(r.media_links||[]).length;
    const statusControl = isEditor()
      ? `<select onchange="updateRequestStatus('${r.id}',this.value)" style="padding:6px 9px;border-radius:9px;background:var(--panel);border:1px solid var(--line2);color:var(--text);font-family:inherit;font-size:12px;font-weight:700">${REQ_STATUS.map(s=>`<option ${s===r.status?'selected':''}>${s}</option>`).join('')}</select>`
      : `<span class="chip ${reqStatusCls(r.status)}">${esc(r.status||'New')}</span>`;
    const meta=[r.work_type,r.discipline,r.system_type].filter(Boolean).join(' · ');
    const detail = isClient ? '' : `<div class="m" style="margin-top:8px">${r.site_address?('📍 '+esc(r.site_address)+'<br>'):''}${r.quantity_scale?('Scale: '+esc(r.quantity_scale)+'<br>'):''}${r.site_access?('Access: '+esc(r.site_access)+'<br>'):''}${(r.out_of_hours?'⏰ Out-of-hours · ':'')}${(r.survey_required?'🔍 Survey required · ':'')}${r.required_start?('Start: '+String(r.required_start).slice(0,10)+' · '):''}${r.deadline?('Deadline: '+String(r.deadline).slice(0,10)):''}<br>${r.contact_name?('Contact: '+esc(r.contact_name)+(r.contact_phone?(' · '+esc(r.contact_phone)):'')+(r.contact_email?(' · '+esc(r.contact_email)):'')):''}${r.budget_indication?('<br>Budget: '+esc(r.budget_indication)):''}</div>`;
    return `<div class="card" style="margin-bottom:13px"><div style="display:flex;align-items:flex-start;gap:12px">
      <div style="flex:1;min-width:0"><div style="font-weight:800;font-size:14.5px">${esc(r.title||'Work request')}</div>
        <div class="muted" style="font-size:12px;margin-top:2px">${esc(meta)}${r.priority&&r.priority!=='Normal'?` · <span class="chip ${r.priority==='Urgent'||r.priority==='High'?'amber':'grey'}" style="padding:1px 7px">${esc(r.priority)}</span>`:''}</div>
        <div style="font-size:13px;margin-top:8px">${esc(r.scope||'')}</div>
        ${detail}
        ${photos?`<div class="muted" style="font-size:11px;margin-top:8px">📷 ${photos} attachment${photos===1?'':'s'} from the client</div>${reqPhotoStrip(r.media_links)}`:''}</div>
      <div style="text-align:right;white-space:nowrap"><div>${statusControl}</div>${isEditor()&&r.status!=='Accepted'?`<div style="margin-top:7px"><button class="edit-btn" onclick="openApproveSchedule('${r.id}')">✓ Approve &amp; schedule</button></div>`:''}<div style="margin-top:7px"><button class="edit-btn" onclick="downloadRecordPdf('request','${r.id}')">⬇ PDF</button></div><div class="muted" style="font-size:10.5px;margin-top:6px">${esc(String(r.created_at||'').slice(0,10))}</div></div>
    </div></div>`;
  }).join('');
  return head+cards;
}
function openApproveSchedule(reqId){
  const r=(DATA.requests||[]).find(x=>x.id===reqId)||{};
  const t=new Date(); const e=new Date(); e.setDate(e.getDate()+14);
  const startV=r.required_start?String(r.required_start).slice(0,10):ymd(t);
  const endV=r.deadline?String(r.deadline).slice(0,10):ymd(e);
  const codeV=r.site_name||r.title||'New job';
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>Approve &amp; schedule — ${esc(CLIENT.name)}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="box see" style="background:var(--panel2);border:1px dashed var(--line2);border-radius:10px;padding:11px 13px;font-size:12.5px;color:var(--muted);margin-bottom:14px">This approves <b>${esc(r.title||'the request')}</b>, adds it to ${esc(CLIENT.name)}’s schedule as a job, marks the request Accepted, and notifies the client.</div>
      <div class="frow">
        <div class="fld"><label>Job / site name <span class="req">*</span></label><input id="as_code" value="${esc(codeV)}"></div>
        <div class="fld"><label>Town / city</label><input id="as_city" value="${esc(r.site_name||'')}" placeholder="Location"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Planned start</label><input id="as_start" type="date" value="${esc(startV)}"></div>
        <div class="fld"><label>Planned end</label><input id="as_end" type="date" value="${esc(endV)}"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Country</label><input id="as_country" value="${esc(r.country||'UK')}"></div>
        <div class="fld"><label>Engineers required (optional)</label><input id="as_eng" type="number" min="0" step="1" placeholder="e.g. 4"></div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn-ghost" onclick="closeForm()">Cancel</button>
      <button class="btn" id="asSave" onclick="submitApproveSchedule('${reqId}')">✓ Approve &amp; add to schedule</button>
    </div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
async function submitApproveSchedule(reqId){
  const r=(DATA.requests||[]).find(x=>x.id===reqId)||{};
  const code=val('as_code'); if(!code){ msg('Please give the job a name.','err'); return; }
  const btn=el('asSave'); btn.disabled=true; btn.textContent='Scheduling…'; msg('','');
  const site={ client_id:CLIENT.id, code:code, city:val('as_city')||null, country:val('as_country')||'UK', status:'Mobilising', planned_start:val('as_start')||null, planned_end:val('as_end')||null, progress_pct:0 };
  const {data:ins,error}=await sb.from('sites').insert(site).select().maybeSingle();
  if(error){ btn.disabled=false; btn.textContent='✓ Approve & add to schedule'; msg('Could not schedule: '+error.message,'err'); return; }
  const eng=parseInt(val('as_eng'),10);
  if(ins && !isNaN(eng) && eng>0){ try{ await sb.from('job_readiness').insert({client_id:CLIENT.id, site_id:ins.id, site_label:code, title:code, start_date:site.planned_start, engineers_required:eng}); }catch(e){} }
  try{ await sb.from('work_requests').update({status:'Accepted'}).eq('id',reqId); }catch(e){}
  await notifyClient(CLIENT.id,'job','Job accepted & scheduled: '+(r.title||code),'schedule','We’ve approved your request and added it to your schedule.');
  msg('✓ Scheduled.','ok');
  await loadClientData(); if(HQDATA){ try{await loadHQ();}catch(e){} }
  setTimeout(()=>{ closeForm(); go('schedule'); }, 500);
}

/* ===================================================================
   QUOTE REQUESTS  —  for the client's sales team to request quotes
   from Mercury. Same pipeline as Work Requests (kind='quote').
   =================================================================== */
function pageQuotes(){
  const reqs=(DATA.requests||[]).filter(r=>(r.kind||'work')==='quote');
  const isClient=VIEW==='client';
  const head=`<div class="sechead"><h3>${isClient?'📝 Request a Quote':'📝 Quote Requests'}</h3><span class="sub">${reqs.length} quote request${reqs.length===1?'':'s'}${reqs.filter(r=>r.status==='New').length?` · ${reqs.filter(r=>r.status==='New').length} new`:''}</span><span class="line"></span><button class="addbtn" onclick="openQuoteForm()">＋ New Quote Request</button></div>`;
  if(!reqs.length) return head+emptyState('📝', isClient?'Request a quote from Mercury':'No quote requests yet', isClient?'For your sales team — tap “New Quote Request”, give us the details of the opportunity and we\'ll come back with a price.':'Quote requests submitted by this client will appear here for pricing.');
  const cards=reqs.map(r=>{
    const photos=(r.media_links||[]).length;
    const statusControl = isEditor()
      ? `<select onchange="updateQuoteStatus('${r.id}',this.value)" style="padding:6px 9px;border-radius:9px;background:var(--panel);border:1px solid var(--line2);color:var(--text);font-family:inherit;font-size:12px;font-weight:700">${REQ_STATUS.map(s=>`<option ${s===r.status?'selected':''}>${s}</option>`).join('')}</select>`
      : `<span class="chip ${reqStatusCls(r.status)}">${esc(r.status||'New')}</span>`;
    const meta=[r.work_type,r.discipline,r.system_type].filter(Boolean).join(' · ');
    const sales=[r.end_customer?('End customer: '+esc(r.end_customer)):'',r.opportunity_ref?('Ref: '+esc(r.opportunity_ref)):'',r.quote_needed_by?('Quote needed by: '+String(r.quote_needed_by).slice(0,10)):''].filter(Boolean).join(' · ');
    const detail = isClient ? (sales?`<div class="muted" style="font-size:12px;margin-top:6px">${sales}</div>`:'') : `<div class="m" style="margin-top:8px">${sales?esc(sales)+'<br>':''}${r.site_address?('📍 '+esc(r.site_address)+'<br>'):''}${r.quantity_scale?('Scale: '+esc(r.quantity_scale)+'<br>'):''}${r.required_start?('Target start: '+String(r.required_start).slice(0,10)+' · '):''}${r.deadline?('Deadline: '+String(r.deadline).slice(0,10)):''}<br>${r.contact_name?('Contact: '+esc(r.contact_name)+(r.contact_phone?(' · '+esc(r.contact_phone)):'')+(r.contact_email?(' · '+esc(r.contact_email)):'')):''}${r.budget_indication?('<br>Budget: '+esc(r.budget_indication)):''}</div>`;
    return `<div class="card" style="margin-bottom:13px"><div style="display:flex;align-items:flex-start;gap:12px">
      <div style="flex:1;min-width:0"><div style="font-weight:800;font-size:14.5px">${esc(r.title||'Quote request')}</div>
        <div class="muted" style="font-size:12px;margin-top:2px">${esc(meta)}${r.priority&&r.priority!=='Normal'?` · <span class="chip ${r.priority==='Urgent'||r.priority==='High'?'amber':'grey'}" style="padding:1px 7px">${esc(r.priority)}</span>`:''}</div>
        <div style="font-size:13px;margin-top:8px">${esc(r.scope||'')}</div>
        ${detail}
        ${photos?`<div class="muted" style="font-size:11px;margin-top:8px">📷 ${photos} attachment${photos===1?'':'s'} from the client</div>${reqPhotoStrip(r.media_links)}`:''}</div>
      <div style="text-align:right;white-space:nowrap"><div>${statusControl}</div><div style="margin-top:7px"><button class="edit-btn" onclick="downloadRecordPdf('quote','${r.id}')">⬇ PDF</button></div><div class="muted" style="font-size:10.5px;margin-top:6px">${esc(String(r.created_at||'').slice(0,10))}</div></div>
    </div></div>`;
  }).join('');
  return head+cards;
}
function openQuoteForm(){
  if(!CLIENT){ alert('Pick a client first.'); return; }
  CAPTURE={photos:[],videos:[],sig:null,gps:null};
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>Request a Quote — ${esc(CLIENT.name)}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="box see" style="background:var(--panel2);border:1px dashed var(--line2);border-radius:10px;padding:11px 13px;font-size:12.5px;color:var(--muted);margin-bottom:14px">For your sales team. Give us the opportunity details and we'll come back with a price. The more detail (drawings, quantities, deadline), the faster and sharper the quote.</div>
      <div class="fld"><label>Quote title <span class="req">*</span></label><input id="q_title" placeholder="e.g. Conveyor extension — Tender 4471"></div>
      <div class="frow">
        <div class="fld"><label>End customer (who it's for)</label><input id="q_endcust" placeholder="Your customer / site owner"></div>
        <div class="fld"><label>Your reference / opportunity no.</label><input id="q_ref" placeholder="e.g. OPP-2026-091"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Discipline</label>${sel('q_disc',REQ_DISCIPLINES,'Mechanical')}</div>
        <div class="fld"><label>System / equipment</label>${sel('q_system',REQ_SYSTEMS,'Conveyor & Sortation')}</div>
      </div>
      <div class="fld"><label>Scope — what needs pricing? <span class="req">*</span></label><textarea id="q_scope" style="min-height:90px" placeholder="Describe the works to be quoted, as specifically as you can."></textarea></div>
      <div class="fld"><label>Quantity / scale</label><input id="q_qty" placeholder="e.g. 60m conveyor, 4 motors, 1 mezzanine"></div>
      <div class="fld"><label>Site address</label><input id="q_address" placeholder="Where the works would be"></div>
      <div class="frow">
        <div class="fld"><label>Quote needed by <span class="req">*</span></label><input id="q_needed" type="date"></div>
        <div class="fld"><label>Target start (if known)</label><input id="q_start" type="date"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Drawings / specs available?</label><input id="q_drawings" placeholder="Yes / No — and how to share"></div>
        <div class="fld"><label>Budget / target price (optional)</label><input id="q_budget" placeholder="If helpful"></div>
      </div>
      <div class="fld"><label>Your contact details</label><div class="frow"><input id="q_contact" placeholder="Name"><input id="q_phone" placeholder="Phone"></div><input id="q_email" placeholder="Email" style="margin-top:10px"></div>
      <div class="fld"><label>Drawings / photos / attachments</label><div class="photos" id="photoWrap"><label class="photo-add">＋<input type="file" accept="image/*,video/*" multiple style="display:none" id="photoInput"></label></div></div>
      <div class="fld"><label>Anything else</label><textarea id="q_notes" placeholder="Other useful info"></textarea></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="qSave" onclick="submitQuote()">Submit quote request</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
  setupPhoto();
}
async function submitQuote(){
  if(!val('q_title')){ msg('Please add a short title.','err'); return; }
  if(!val('q_scope')){ msg('Please describe what needs pricing.','err'); return; }
  if(!val('q_needed')){ msg('Please add when you need the quote by.','err'); return; }
  const btn=el('qSave'); btn.disabled=true; btn.textContent='Submitting…'; msg('','');
  const ref='QUO-'+Date.now();
  const row={ client_id:CLIENT.id, kind:'quote', submitted_by:(PROFILE.full_name||PROFILE.email), title:val('q_title'),
    work_type:'Quotation', discipline:val('q_disc'), system_type:val('q_system'), priority:'Normal',
    end_customer:val('q_endcust')||null, opportunity_ref:val('q_ref')||null, quote_needed_by:val('q_needed')||null,
    scope:val('q_scope'), quantity_scale:val('q_qty'), site_address:val('q_address'),
    required_start:val('q_start')||null, deadline:val('q_needed')||null, drawings_available:val('q_drawings'),
    budget_indication:val('q_budget'), contact_name:val('q_contact'), contact_phone:val('q_phone'), contact_email:val('q_email'),
    notes:val('q_notes'), status:'New' };
  // Upload attachments FIRST and attach to the insert (clients can create a
  // request but not update it, so links must be included on creation).
  if(CAPTURE.photos.length || (CAPTURE.videos||[]).length){ btn.textContent='Uploading attachments…';
    const urls=await uploadCapture('quote', null, `${CLIENT.slug}/quotes/${ref}`);
    if(urls.length) row.media_links=urls;
  }
  btn.textContent='Submitting…';
  let {data:ins,error}=await sb.from('work_requests').insert(row).select().maybeSingle();
  if(error && /find the '.*' column|schema cache|column .* does not exist/i.test(error.message||'')){ const core=Object.assign({},row); delete core.media_links; const r2=await sb.from('work_requests').insert(core).select().maybeSingle(); ins=r2.data; error=r2.error; }
  if(error){ btn.disabled=false; btn.textContent='Submit quote request'; msg('Could not submit: '+error.message,'err'); return; }
  msg('✓ Quote request submitted — we\'ll come back to you with a price.','ok');
  await loadClientData();
  setTimeout(()=>{ closeForm(); go('quotes'); }, 1100);
}
async function updateQuoteStatus(id,status){
  try{ await sb.from('work_requests').update({status}).eq('id',id);
    if(['Quoted','Accepted','Declined'].includes(status)){ const r=(DATA.requests||[]).find(x=>x.id===id)||{}; await notifyClient(CLIENT.id,'quote','Quote '+status.toLowerCase()+': '+(r.title||'your quote request'),'quotes', status==='Quoted'?'Your quote is ready to view.':status==='Accepted'?'We’ve accepted your quote request.':'There’s an update on your quote request.'); }
    await loadClientData(); if(HQDATA){await loadHQ();} go('quotes'); }
  catch(e){ alert('Could not update: '+(e.message||e)); }
}

