/* ===================================================================
   DOWNLOAD ANY REPORT AS PDF  — opens the stored PDF if present, else
   builds a branded one from the record (works for imported records too).
   =================================================================== */
async function downloadRecordPdf(type,id){
  const map={callout:DATA.callouts,shift:DATA.shifts,daily:DATA.daily,request:DATA.requests,quote:DATA.requests,install:DATA.progress};
  const rec=(map[type]||[]).find(r=>r.id===id); if(!rec){ alert('Report not found.'); return; }
  if(rec.pdf_url){ window.open(rec.pdf_url,'_blank'); return; }
  if(!window.jspdf){ alert('PDF tool still loading — try again in a moment.'); return; }
  const titleMap={callout:'Call-Out Report',shift:'Shift Report',daily:'Daily Site Report',request:'Work Request',install:'Install Report',quote:'Quote Request'};
  const site=(DATA.sites||[]).find(s=>s.id===rec.site_id)||{};
  const siteName=rec.site_name||site.code||site.city||'';
  const F={
    callout:[['Reference',rec.job_number],['Site',rec.site_name||site.code||site.city],['Site address',rec.site_address],['Date',rec.call_date||rec.submitted_at],['Engineer',rec.engineer],['Priority',rec.priority],['Status',rec.status],['Asset',rec.asset_reference],['Fault',rec.fault_description],['Root cause',rec.root_cause],['Work carried out',rec.work_carried_out],['Parts used',rec.parts_used],['Downtime (mins)',rec.downtime_minutes],['Notes',rec.internal_notes],['Signed by',rec.customer_sign_name]],
    shift:[['Date',rec.shift_date||rec.submitted_at],['Site',rec.site_name||site.code||site.city],['Site address',rec.site_address],['Shift',rec.shift],['Engineer',rec.engineer],['Status',rec.status],['Hours worked',rec.hours_worked],['Work completed',rec.work_completed],['Issues / handover',rec.issues],['Signed by',rec.customer_sign_name]],
    daily:[['Date',rec.report_date||rec.submitted_at],['Supervisor',rec.supervisor],['Status',rec.status],['Progress %',rec.progress_pct],['Work completed',rec.work_completed],['Planned tomorrow',rec.work_planned_tomorrow],['Blockers',rec.blockers],['Hours',rec.hours_worked]],
    request:[['Title',rec.title],['Type',rec.work_type],['Discipline',rec.discipline],['System',rec.system_type],['Priority',rec.priority],['Scope',rec.scope],['Quantity / scale',rec.quantity_scale],['Site',rec.site_address],['Access',rec.site_access],['Required start',rec.required_start],['Deadline',rec.deadline],['Drawings',rec.drawings_available],['Budget',rec.budget_indication],['Contact',[rec.contact_name,rec.contact_phone,rec.contact_email].filter(Boolean).join(' · ')],['Status',rec.status],['Notes',rec.notes]],
    install:[['Date',rec.report_date||rec.submitted_at],['Site',site.code||site.city],['Discipline',rec.discipline],['Engineer',rec.engineer],['Progress %',rec.progress_pct],['Plan status',rec.plan_flag],['Planned days',rec.planned_days],['Actual days',rec.actual_days],['Hours worked',rec.hours_worked],['Headcount',rec.headcount],['Work completed',rec.work_completed],['Materials / plant',rec.materials],['Issues / delays',rec.issues||rec.delay_reason],['Planned next visit',rec.next_steps]],
    quote:[['Quote title',rec.title],['End customer',rec.end_customer],['Reference',rec.opportunity_ref],['Discipline',rec.discipline],['System',rec.system_type],['Scope',rec.scope],['Quantity / scale',rec.quantity_scale],['Site',rec.site_address],['Quote needed by',rec.quote_needed_by||rec.deadline],['Target start',rec.required_start],['Drawings',rec.drawings_available],['Budget / target',rec.budget_indication],['Contact',[rec.contact_name,rec.contact_phone,rec.contact_email].filter(Boolean).join(' · ')],['Status',rec.status],['Notes',rec.notes]]
  }[type]||[];
  try{
    const {jsPDF}=window.jspdf; const doc=new jsPDF({unit:'pt',format:'a4'}); const W=595,H=842; let y=0;
    doc.setFillColor(10,14,22); doc.rect(0,0,W,118,'F');
    try{ doc.addImage(MLOGO,'PNG',40,30,58,58); }catch(e){}
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(19); doc.text(titleMap[type]||'Report',112,56);
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(180,200,220);
    doc.text(`${CLIENT?CLIENT.name:''}${siteName?('  ·  '+siteName):''}  ·  ${new Date(rec.submitted_at||rec.created_at||Date.now()).toLocaleDateString('en-GB')}`,112,76);
    y=150;
    const line=(k,v)=>{ if(v==null||v==='')return; doc.setFont('helvetica','bold');doc.setTextColor(90,107,128);doc.setFontSize(9);doc.text(String(k).toUpperCase(),40,y);
      doc.setFont('helvetica','normal');doc.setTextColor(15,32,51);doc.setFontSize(11); const ls=doc.splitTextToSize(textOnly(String(v)),W-80); doc.text(ls,40,y+14); y+=14+ls.length*13+8; if(y>H-90){doc.addPage();y=48;} };
    F.forEach(f=>line(f[0],f[1]));
    // photos linked to this report (images only — PDFs can't embed video).
    // Pull from BOTH the media table and the record's own media_links (client
    // request/quote uploads live in media_links).
    const fromTable=(DATA.media||[]).filter(m=>m.report_id===id && m.file_url && !isVideoMedia(m)).map(m=>m.file_url);
    const fromLinks=(rec.media_links||[]).filter(u=>u && !isVideoUrl(u));
    const photos=[...new Set([...fromTable,...fromLinks])].slice(0,6);
    if(photos.length){ if(y>H-40){doc.addPage();y=48;} doc.setFont('helvetica','bold');doc.setTextColor(90,107,128);doc.setFontSize(9);doc.text('PHOTOS',40,y); y+=14; }
    for(let i=0;i<photos.length;i++){ const du=await urlToDataUrl(photos[i]); if(!du)continue; if(y>H-150){doc.addPage();y=48;} const col=i%2; try{ doc.addImage(du, du.indexOf('png')>-1?'PNG':'JPEG', 40+col*((W-80)/2+10), y, (W-80)/2-5, 105);}catch(e){} if(col===1)y+=115; }
    if(photos.length%2===1) y+=115;
    // customer signature — stored on the record at save time, so it survives
    // into every regenerated sheet (not just the PDF built at submit).
    if(rec.signature_url){
      const sdu=await urlToDataUrl(rec.signature_url);
      if(sdu){
        if(y>H-200){doc.addPage();y=48;}
        doc.setFont('helvetica','bold');doc.setTextColor(90,107,128);doc.setFontSize(9);doc.text('CUSTOMER SIGNATURE',40,y);
        try{ doc.addImage(sdu,'PNG',40,y+10,210,84); }catch(e){}
        y+=104;
        doc.setDrawColor(210,222,234); doc.line(40,y,250,y);
        doc.setFont('helvetica','normal');doc.setTextColor(15,32,51);doc.setFontSize(10);
        doc.text(String(rec.customer_sign_name||'Signed on site'),40,y+14);
        doc.setTextColor(150,160,175);doc.setFontSize(8);
        doc.text(new Date(rec.submitted_at||rec.created_at||Date.now()).toLocaleDateString('en-GB'),40,y+26);
        y+=40;
      }
    }
    doc.setTextColor(150,160,175);doc.setFontSize(8);doc.text('Generated by Mercury Operations Platform · '+new Date().toLocaleString('en-GB'),40,H-26);
    doc.save((type)+'-'+(rec.job_number||rec.title||id).toString().replace(/[^a-z0-9]/gi,'_').slice(0,30)+'.pdf');
  }catch(e){ alert('Could not build PDF: '+(e.message||e)); }
}

/* ============ CALL-OUT REPORTS ============ */
function priChip(p){const s=String(p||'');return p?`<span class="chip ${/1/.test(s)?'red':/2/.test(s)?'amber':'cyan'}">${esc(s)}</span>`:'';}
function addBtn(type,label){ return VIEW==='client'?'':`<button class="addbtn" onclick="openForm('${type}')">＋ ${label}</button>`; }
function capHeader(title,sub,type,label){
  return `<div class="sechead"><h3>${title}</h3><span class="sub">${sub||''}</span><span class="line"></span>${addBtn(type,label)}</div>`;
}
function pdfCell(type,r){ return `<button class="edit-btn" onclick="downloadRecordPdf('${type}','${r.id}')">⬇ PDF</button>`; }
/* Customer signature on a completed sheet. Opens the stored PNG. */
function viewSig(type,id){
  const arr = type==='callout'?(DATA.callouts||[]):(DATA.shifts||[]);
  const r=arr.find(x=>x.id===id);
  if(r && r.signature_url) window.open(r.signature_url,'_blank','noopener');
  else alert('No customer signature was captured on this report.');
}
function sigCell(type,r){
  if(r.signature_url) return `<button class="edit-btn" onclick="viewSig('${type}','${r.id}')" title="View customer signature">✍ ${esc(r.customer_sign_name||'Signed')}</button>`;
  if(r.customer_sign_name) return `<span class="chip amber" style="font-size:10px" title="Name captured but no signature image on file">${esc(r.customer_sign_name)}</span>`;
  return '<span class="muted" style="font-size:11px">—</span>';
}
function siteLabel(r){ if(r.site_name) return esc(r.site_name); const s=(DATA.sites||[]).find(x=>x.id===r.site_id); return s?esc(s.code||s.city||'Site'):'<span class="muted">—</span>'; }

/* Move an incorrectly-assigned report to the correct client (admin). Works on
   past reports. Clears the site link (sites differ per client) and moves photos. */
function editReport(type,id){ const arr= type==='callout'?(DATA.callouts||[]):(DATA.shifts||[]); const rec=arr.find(x=>x.id===id); if(rec) openForm(type,false,rec); else alert('Report not found.'); }
const REPORT_TABLES={callout:'callout_reports',shift:'shift_reports',install:'progress_reports'};
function openMoveReport(kind,id){
  const table=REPORT_TABLES[kind]||kind;
  const opts=(CLIENTS||[]).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal" style="max-width:470px">
    <div class="modal-h"><h3>Move report to the correct client</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="box see" style="background:var(--panel2);border:1px dashed var(--line2);border-radius:10px;padding:11px 13px;font-size:12.5px;color:var(--muted);margin-bottom:14px">This reassigns the report away from <b>${esc(CLIENT?CLIENT.name:'this client')}</b> to the client you choose. Any linked site is cleared (sites differ per client) and attached photos move with it.</div>
      <div class="fld"><label>Move to client <span class="req">*</span></label><select id="mv_client"><option value="">— Select the correct client —</option>${opts}</select></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="mvSave" onclick="submitMoveReport('${table}','${id}')">↪ Move report</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
async function submitMoveReport(table,id){
  const target=val('mv_client'); if(!target){ msg('Please choose the client to move it to.','err'); return; }
  const btn=el('mvSave'); btn.disabled=true; btn.textContent='Moving…'; msg('','');
  try{
    const {error}=await sb.from(table).update({client_id:target, site_id:null}).eq('id',id);
    if(error){ btn.disabled=false; btn.textContent='↪ Move report'; msg('Could not move: '+error.message,'err'); return; }
    try{ await sb.from('media').update({client_id:target}).eq('report_id',id); }catch(e){}
    msg('✓ Moved to the correct client.','ok');
    await loadClientData(); if(HQDATA){ try{await loadHQ();}catch(e){} }
    setTimeout(()=>{ closeForm(); go(CURRENT); }, 500);
  }catch(e){ btn.disabled=false; btn.textContent='↪ Move report'; msg('Could not move: '+(e.message||e),'err'); }
}
function pageCallouts(){
  const rows=DATA.callouts||[];
  if(!rows.length) return capHeader('Call-Out Reports','none yet','callout','New Call-Out')+emptyState('🔧','No call-outs yet','Tap “New Call-Out” to log one from site — with photos, signature and location.');
  return capHeader('Call-Out Reports',`${rows.length} on record`,'callout','New Call-Out')+
    `<div class="card"><table><thead><tr><th>Reference</th><th>Site</th><th>Date</th><th>Engineer</th><th>Priority</th><th>Status</th><th>Fault</th><th>Signed</th><th>Report</th></tr></thead><tbody>${rows.map(r=>`
      <tr><td><span class="site-code">${esc(r.job_number||'—')}</span></td>
      <td>${siteLabel(r)}${r.site_address?`<div class="muted" style="font-size:11px">${esc(r.site_address)}</div>`:''}</td>
      <td class="muted">${esc(String(r.call_date||r.submitted_at||'').slice(0,10))}</td>
      <td>${esc(r.engineer||'')}</td>
      <td>${priChip(r.priority)}</td>
      <td><span class="chip grey" style="background:var(--panel2)">${esc(r.status||'')}</span></td>
      <td>${esc(String(r.fault_description||'').slice(0,80))}</td>
      <td>${sigCell('callout',r)}</td>
      <td style="white-space:nowrap">${pdfCell('callout',r)}${isEditor()?` <button class="edit-btn" onclick="editReport('callout','${r.id}')">Edit</button> <button class="edit-btn" onclick="openMoveReport('callout','${r.id}')" title="Move to the correct client">↪ Move</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;
}

/* ============ SHIFT REPORTS ============ */
function pageShifts(){
  const rows=DATA.shifts||[];
  if(!rows.length) return capHeader('Shift Reports','none yet','shift','New Shift Report')+emptyState('🗓','No shift reports yet','Tap “New Shift Report” to file one at the end of a shift.');
  return capHeader('Shift Reports',`${rows.length} on record`,'shift','New Shift Report')+
    `<div class="card"><table><thead><tr><th>Date</th><th>Site</th><th>Shift</th><th>Engineer</th><th>Status</th><th>Hours</th><th>Work / Issues</th><th>Signed</th><th>Report</th></tr></thead><tbody>${rows.map(r=>`
      <tr><td class="muted">${esc(String(r.shift_date||r.submitted_at||'').slice(0,10))}</td>
      <td>${siteLabel(r)}</td>
      <td>${esc(r.shift||'—')}</td>
      <td>${esc(r.engineer||'')}</td>
      <td><span class="chip ${flagOf(r.status)}">${esc(r.status||'')}</span></td>
      <td>${r.hours_worked!=null?esc(r.hours_worked):''}</td>
      <td>${esc(String(r.work_completed||r.issues||'').slice(0,80))}</td>
      <td>${sigCell('shift',r)}</td>
      <td style="white-space:nowrap">${pdfCell('shift',r)}${isEditor()?` <button class="edit-btn" onclick="editReport('shift','${r.id}')">Edit</button> <button class="edit-btn" onclick="openMoveReport('shift','${r.id}')" title="Move to the correct client">↪ Move</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;
}

