/* ===================================================================
   QUOTES  —  Phase 2. Every piece of work starts here.
   Quote (Q ref issued) → priced lines → issued as PDF → revised if
   needed (same Q ref, previous version kept) → accepted with the
   client's PO or written confirmation → converted into a job by an admin.
   Internal costs and margins are only shown to staff with margins.view.
   =================================================================== */

let QUOTES=null, QUOTES_ERR=null, QUOTES_LOADING=false, COSTCODES=[];
let QUOTE_F={status:'open', entity:'all', client:'all', q:''};
let QEDIT=null;   // the quote open in the editor: {q, lines, versions}

TITLES.quotereg='Quotes';

const Q_STATUSES=[['pending','Being prepared','grey'],['issued','Issued','cyan'],['accepted','Accepted','green'],['rejected','Rejected','red'],['expired','Expired','amber']];
const LINE_TYPES=[['labour','Labour','LAB'],['materials','Materials','MAT'],['subcontract','Subcontractor','SUB'],['plant','Plant','PLT'],['equipment','Equipment','PLT'],['other','Other','OTH']];
const Q_DEFAULT_TERMS='All prices exclude VAT. This quotation is valid until the date shown and is subject to Mercury Automated Solutions’ Terms of Business, available on request.';

function qStatusChip(q){
  if(q.job_id) return `<span class="chip violet">Converted to job</span>`;
  if(q.status==='accepted') return `<span class="chip green">Accepted · awaiting job</span>`;
  const x=Q_STATUSES.find(r=>r[0]===q.status)||[q.status,q.status,'grey'];
  return `<span class="chip ${x[2]}">${esc(x[1])}</span>`;
}
function qRef(q){ return esc(q.quote_ref)+(q.revision>1?` <span class="muted" style="font-weight:600">rev ${q.revision}</span>`:''); }
function qAddDays(n){ const d=new Date(); d.setDate(d.getDate()+n); return ymd(d); }
function qNum(v){ const n=Number(v); return isFinite(n)?n:0; }
function qRound(n){ return Math.round(n*100)/100; }
// Same formula as the database (the database figure is the one that counts)
function qUnitSell(l){
  const c=qNum(l.unit_cost), p=qNum(l.pricing_pct);
  if(l.pricing_basis==='markup') return qRound(c*(1+p/100));
  if(l.pricing_basis==='margin') return p<100?qRound(c/(1-p/100)):NaN;
  return qRound(qNum(l.unit_sell));
}

async function loadQuotes(){
  if(QUOTES_LOADING) return; QUOTES_LOADING=true; QUOTES_ERR=null;
  try{
    if(MYPERMS===null){
      const perms = PROFILE.staff_role ? await sb.from('role_permissions').select('permission_code').eq('role_code', PROFILE.staff_role) : {data:[]};
      if(perms.error) throw perms.error; MYPERMS=(perms.data||[]).map(r=>r.permission_code);
    }
    const [qs, ents, sites, codes] = await Promise.all([
      jobCan('quotes.view') ? jobFetchAll(()=>sb.from('quotes').select('*').order('created_at',{ascending:false})) : Promise.resolve([]),
      sb.from('trading_entities').select('*').order('code'),
      jobFetchAll(()=>sb.from('sites').select('id,client_id,code,name,city,country').order('code')),
      sb.from('cost_codes').select('*').eq('active',true).order('sort_order')
    ]);
    if(ents.error) throw ents.error; if(codes.error) throw codes.error;
    QUOTES=qs; JOBREG_ENTITIES=ents.data||[]; JOBREG_SITES=sites; COSTCODES=codes.data||[];
    if(!LOGINS || !LOGINS.length){ try{ await loadLogins(); }catch(e){} }
  }catch(e){ QUOTES_ERR=e.message||String(e); QUOTES=QUOTES||[]; }
  QUOTES_LOADING=false;
  if(CURRENT==='quotereg') go('quotereg');
}

function quoteFiltered(){
  const f=QUOTE_F, q=f.q.trim().toLowerCase();
  return (QUOTES||[]).filter(x=>{
    if(f.status==='archived') { if(!x.archived_at) return false; }
    else if(x.archived_at) return false;
    if(f.status==='open' && (x.job_id || !['pending','issued','accepted'].includes(x.status))) return false;
    if(f.status==='awaiting' && !(x.status==='accepted' && !x.job_id)) return false;
    if(f.status==='converted' && !x.job_id) return false;
    if(Q_STATUSES.some(s=>s[0]===f.status) && (x.status!==f.status || x.job_id)) return false;
    if(f.entity!=='all' && x.entity_code!==f.entity) return false;
    if(f.client!=='all' && x.client_id!==f.client) return false;
    if(q && ![x.quote_ref,x.title,x.client_po_ref,x.contact_name,jobClientName(x.client_id),jobSiteName(x.site_id)].some(v=>String(v||'').toLowerCase().includes(q))) return false;
    return true;
  });
}
function quoteSetFilter(k,v){ QUOTE_F[k]=v; const t=el('quoteTable'); if(t){ t.innerHTML=quoteTableHtml(); const c=el('quoteCount'); if(c) c.textContent=quoteFiltered().length; } else go('quotereg'); }

function quoteTableHtml(){
  const rows=quoteFiltered();
  if(!rows.length) return `<div class="empty" style="padding:26px"><div class="big">📝</div><b>No quotes match</b><div style="margin-top:6px;font-size:13px">${(QUOTES||[]).length?'Try a different filter.':(jobCan('quotes.create')?'Tap “＋ New quote” to create the first one.':'No quotes yet.')}</div></div>`;
  return `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Q ref</th><th>Quote</th><th>Client</th><th>Co.</th><th>Status</th><th>Valid until</th><th style="text-align:right">Value</th><th></th></tr></thead><tbody>${
    rows.map(x=>`<tr${x.archived_at?' style="opacity:.6"':''}>
      <td style="white-space:nowrap"><b>${qRef(x)}</b></td>
      <td>${esc(x.title)}${x.client_po_ref?`<div class="muted" style="font-size:11.5px">PO ${esc(x.client_po_ref)}</div>`:''}</td>
      <td>${esc(jobClientName(x.client_id))}${x.site_id?`<div class="muted" style="font-size:11.5px">${esc(jobSiteName(x.site_id))}</div>`:''}</td>
      <td>${esc(x.entity_code)}</td>
      <td>${qStatusChip(x)}${x.archived_at?' <span class="chip grey">Archived</span>':''}</td>
      <td style="white-space:nowrap">${jobDate(x.valid_until)}</td>
      <td style="text-align:right;white-space:nowrap">${jobMoney(x.total_sell,x.currency)}</td>
      <td><button class="btn-ghost" style="padding:5px 10px" onclick="openQuote('${x.id}')">Open</button></td></tr>`).join('')}</tbody></table></div>`;
}

function pageQuoteRegister(){
  if(PROFILE.role!=='admin') return emptyState('🔒','Mercury staff only','Quotes are only visible to the Mercury team.');
  if(QUOTES===null){ loadQuotes(); return emptyState('⏳','Loading quotes…','One moment.'); }
  if(QUOTES_ERR) return emptyState('⚠','Could not load quotes', esc(QUOTES_ERR)+`<div style="margin-top:10px"><button class="btn-ghost" onclick="QUOTES=null;go('quotereg')">Try again</button></div>`);
  if(!jobCan('quotes.view')) return emptyState('🔒','No access to quotes','Your staff role does not include quotes. Ask a Director.');
  const live=(QUOTES||[]).filter(x=>!x.archived_at);
  const n=f=>live.filter(f).length;
  const header=`<div class="sechead"><h3>📝 Quotes</h3><span class="sub">Every job starts as a quote · <span id="quoteCount">${quoteFiltered().length}</span> shown</span><span class="line"></span>${jobCan('quotes.create')?`<button class="addbtn" onclick="openQuote()">＋ New quote</button>`:''}</div>`;
  const kpis=`<div class="grid kpis" style="margin-bottom:14px">
    ${kpi('','✏️','Being prepared',n(x=>x.status==='pending'))}
    ${kpi('','📤','Issued',n(x=>x.status==='issued'))}
    <div class="card kpi kpi-link" role="button" tabindex="0" onclick="quoteSetFilter('status','awaiting');go('quotereg')"><div class="spark">✅</div><div class="lbl">Accepted · awaiting job</div><div class="val">${n(x=>x.status==='accepted'&&!x.job_id)}</div><div class="kpi-go">→</div></div>
    ${kpi('','⌛','Expired',n(x=>x.status==='expired'))}</div>`;
  const opt=(v,l,cur)=>`<option value="${esc(v)}" ${v===cur?'selected':''}>${esc(l)}</option>`;
  const clientIds=[...new Set((QUOTES||[]).map(x=>x.client_id))];
  const filters=`<div class="card fld" style="padding:12px 14px;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">
    <input placeholder="Search Q ref, quote, client, contact, PO…" value="${esc(QUOTE_F.q)}" oninput="quoteSetFilter('q',this.value)" style="flex:1;min-width:200px;width:auto">
    <select style="width:auto" onchange="quoteSetFilter('status',this.value)">${opt('open','Open quotes',QUOTE_F.status)}${opt('awaiting','Accepted · awaiting job',QUOTE_F.status)}${Q_STATUSES.map(s=>opt(s[0],s[1],QUOTE_F.status)).join('')}${opt('converted','Converted to job',QUOTE_F.status)}${opt('all','All',QUOTE_F.status)}${opt('archived','Archived',QUOTE_F.status)}</select>
    <select style="width:auto;max-width:280px" onchange="quoteSetFilter('entity',this.value)">${opt('all','All companies',QUOTE_F.entity)}${JOBREG_ENTITIES.map(e=>opt(e.code,e.code+' — '+e.legal_name,QUOTE_F.entity)).join('')}</select>
    <select style="width:auto" onchange="quoteSetFilter('client',this.value)">${opt('all','All clients',QUOTE_F.client)}${clientIds.map(id=>opt(id,jobClientName(id),QUOTE_F.client)).join('')}</select>
  </div>`;
  return header+kpis+filters+`<div class="card" id="quoteTable">${quoteTableHtml()}</div>`;
}

/* ---------- the quote editor ---------- */
async function openQuote(id){
  if(!id){
    QEDIT={q:{status:'pending',revision:1,valid_until:qAddDays(30),terms:Q_DEFAULT_TERMS}, lines:[], versions:[]};
    return renderQuoteModal();
  }
  const q=(QUOTES||[]).find(x=>x.id===id); if(!q) return;
  let lines=[], versions=[];
  if(jobCan('margins.view')){
    const [l,v]=await Promise.all([
      sb.from('quote_lines').select('*').eq('quote_id',id).order('sort_order'),
      sb.from('quote_versions').select('revision,saved_at,snapshot').eq('quote_id',id).order('revision')]);
    if(l.error){ alert('Could not load the quote lines: '+l.error.message); return; }
    lines=l.data||[]; versions=v.data||[];
  } else {
    const l=await sb.rpc('quote_lines_for_view',{p_quote:id});
    if(l.error){ alert('Could not load the quote lines: '+l.error.message); return; }
    lines=l.data||[];
  }
  QEDIT={q:{...q}, lines:lines.map(x=>({...x})), versions, origLineIds:lines.map(x=>x.id)};
  renderQuoteModal();
}

function qEditable(){ const q=QEDIT.q; return !q.job_id && !q.archived_at && q.status==='pending' && jobCan('quotes.create') && jobCan('margins.view'); }

function qLineRow(l,i,editable,showCost){
  const codeOpts=COSTCODES.map(c=>`<option value="${c.code}" ${c.code===l.cost_code?'selected':''}>${esc(c.code)}</option>`).join('');
  const typeOpts=LINE_TYPES.map(t=>`<option value="${t[0]}" ${t[0]===l.line_type?'selected':''}>${t[1]}</option>`).join('');
  const us=qUnitSell(l), ls=isNaN(us)?NaN:qRound(us*qNum(l.quantity));
  const money=v=>isNaN(v)?'<span style="color:var(--red)">margin must be &lt; 100%</span>':jobMoney(v,QEDIT.q.currency||qCur());
  if(!editable){
    return `<tr><td>${esc((LINE_TYPES.find(t=>t[0]===l.line_type)||[,l.line_type])[1])}</td><td>${esc(l.description)}</td><td style="text-align:right">${esc(qNum(l.quantity))} ${esc(l.unit||'')}</td>
      ${showCost?`<td>${esc(l.cost_code||'')}</td><td style="text-align:right">${jobMoney(l.unit_cost,QEDIT.q.currency)}</td><td>${esc(l.pricing_basis==='fixed'?'fixed':(qNum(l.pricing_pct)+'% '+l.pricing_basis))}</td>`:''}
      <td style="text-align:right">${jobMoney(l.unit_sell,QEDIT.q.currency)}</td><td style="text-align:right"><b>${jobMoney(l.line_sell,QEDIT.q.currency)}</b></td></tr>`;
  }
  const inp=(f,val,extra)=>`<input data-i="${i}" data-f="${f}" value="${esc(val==null?'':val)}" oninput="qLineInput(this)" ${extra||''}>`;
  return `<tr>
    <td><select data-i="${i}" data-f="line_type" style="min-width:130px" onchange="qLineInput(this,true)">${typeOpts}</select></td>
    <td style="min-width:170px">${inp('description',l.description,'placeholder="Description (shown to the client)"')}</td>
    <td>${inp('quantity',l.quantity,'type="number" min="0" step="0.001" style="width:74px"')}</td>
    <td>${inp('unit',l.unit,'placeholder="day / m / lot" style="width:66px"')}</td>
    <td><select data-i="${i}" data-f="cost_code" style="min-width:86px" title="Cost code" onchange="qLineInput(this)">${codeOpts}</select></td>
    <td>${inp('unit_cost',l.unit_cost,'type="number" min="0" step="0.01" style="width:90px"')}</td>
    <td><select data-i="${i}" data-f="pricing_basis" style="min-width:132px" onchange="qLineInput(this,true)"><option value="markup" ${l.pricing_basis==='markup'?'selected':''}>Markup %</option><option value="margin" ${l.pricing_basis==='margin'?'selected':''}>Margin %</option><option value="fixed" ${l.pricing_basis==='fixed'?'selected':''}>Fixed price</option></select></td>
    <td>${l.pricing_basis==='fixed'?inp('unit_sell',l.unit_sell,'type="number" min="0" step="0.01" style="width:100px" placeholder="unit price"'):inp('pricing_pct',l.pricing_pct,'type="number" min="0" step="0.1" style="width:80px"')}</td>
    <td style="text-align:right;white-space:nowrap" id="qls${i}">${money(ls)}</td>
    <td><button class="btn-ghost" style="padding:4px 8px;color:var(--red)" title="Remove line" onclick="qRemoveLine(${i})">✕</button></td></tr>`;
}
function qCur(){ const e=JOBREG_ENTITIES.find(x=>x.code===(QEDIT.q.entity_code||(el('qe_entity')||{}).value)); return e?e.base_currency:'GBP'; }

function qSummaryHtml(){
  const showCost=jobCan('margins.view'); const cur=QEDIT.q.currency||qCur();
  let cost=0, sell=0, bad=false;
  QEDIT.lines.forEach(l=>{ const us=qEditable()?qUnitSell(l):qNum(l.unit_sell); if(isNaN(us)) bad=true; cost+=qNum(l.unit_cost)*qNum(l.quantity); sell+=(isNaN(us)?0:us)*qNum(l.quantity); });
  cost=qRound(cost); sell=qRound(sell);
  const gp=sell-cost, m=sell>0?(gp/sell*100):0;
  return `<div style="display:flex;gap:18px;justify-content:flex-end;flex-wrap:wrap;font-size:13.5px;padding:10px 4px">
    ${showCost?`<div>Cost <b>${jobMoney(cost,cur)}</b></div><div>Gross profit <b style="color:${gp<0?'var(--red)':'var(--green)'}">${jobMoney(gp,cur)}</b></div><div>Margin <b>${m.toFixed(1)}%</b></div>`:''}
    <div style="font-size:15px">Total (excl. VAT) <b>${bad?'—':jobMoney(sell,cur)}</b></div></div>`;
}

function renderQuoteModal(){
  const q=QEDIT.q, isNew=!q.id, ed=isNew?jobCan('quotes.create'):qEditable();
  const showCost=jobCan('margins.view'), cur=q.currency||'';
  const dis=ed?'':'disabled';
  const ent=JOBREG_ENTITIES.find(e=>e.code===q.entity_code);
  const old=el('modalBg'); if(old) old.remove();
  const editLines=ed && showCost;
  const head=editLines
    ? `<tr><th>Type</th><th>Description</th><th>Qty</th><th>Unit</th><th>Code</th><th>Unit cost</th><th>Pricing</th><th>% / price</th><th style="text-align:right">Line total</th><th></th></tr>`
    : `<tr><th>Type</th><th>Description</th><th style="text-align:right">Qty</th>${showCost?'<th>Code</th><th style="text-align:right">Unit cost</th><th>Pricing</th>':''}<th style="text-align:right">Unit price</th><th style="text-align:right">Total</th></tr>`;
  const lines=QEDIT.lines.map((l,i)=>qLineRow(l,i,editLines,showCost)).join('') || `<tr><td colspan="10" class="muted" style="padding:14px">No lines yet${editLines?' — add the first one below.':'.'}</td></tr>`;
  const acc=q.status==='accepted'||q.job_id ? `<div class="box" style="background:var(--green-soft);border-radius:10px;padding:10px 12px;font-size:12.5px;margin-bottom:12px"><b>Accepted</b> ${jobDate(q.accepted_on)} by ${esc(q.accepted_by_name||'client')} — ${q.acceptance_method==='purchase_order'?'PO '+esc(q.client_po_ref||''):'written confirmation'}${q.acceptance_note?' · '+esc(q.acceptance_note):''}${q.job_id?` · <b>converted into job ${esc(q.quote_ref)}</b>`:''}</div>` : '';
  const rej=q.status==='rejected'?`<div class="box" style="background:var(--red-soft,rgba(239,68,68,.12));border-radius:10px;padding:10px 12px;font-size:12.5px;margin-bottom:12px"><b>Rejected</b> — ${esc(q.rejected_reason||'')}</div>`:'';
  const arch=q.archived_at?`<div class="box" style="background:var(--amber-soft);border-radius:10px;padding:10px 12px;font-size:12.5px;margin-bottom:12px"><b>Archived</b> ${jobDate(q.archived_at)} — ${esc(q.archive_reason||'')}</div>`:'';
  const vers=(QEDIT.versions||[]).length?`<div class="muted" style="font-size:12px;margin-top:8px">Previous versions: ${QEDIT.versions.map(v=>`<a href="#" onclick="event.preventDefault();qShowVersion(${v.revision})">rev ${v.revision}</a> (${jobDate(v.saved_at)})`).join(' · ')}</div>`:'';
  // action buttons by status
  const b=[];
  if(!isNew && jobCan('history.view')) b.push(`<button class="btn-ghost" onclick="qHistory()">History</button>`);
  if(!isNew && q.status!=='pending') b.push(`<button class="btn-ghost" onclick="qDownloadPdf()">⬇ PDF</button>`);
  if(!isNew && q.status==='pending' && QEDIT.lines.length) b.push(`<button class="btn-ghost" onclick="qPreviewPdf()">Preview PDF</button>`);
  if(!isNew && !q.job_id && !q.archived_at && jobCan('quotes.create')){
    if(['issued','rejected','expired'].includes(q.status) || (q.status==='accepted' && jobCan('quotes.approve'))) b.push(`<button class="btn-ghost" onclick="qRevise()">Revise</button>`);
    if(q.status==='issued') b.push(`<button class="btn-ghost" style="color:var(--red)" onclick="qReject()">Rejected</button>`);
    if(['issued','expired'].includes(q.status)) b.push(`<button class="btn" onclick="qAcceptForm()">Record acceptance</button>`);
  }
  if(!isNew && !q.job_id && !q.archived_at && jobCan('quotes.create') && q.status!=='accepted') b.push(`<button class="btn-ghost" style="color:var(--red)" onclick="qArchive()">Archive</button>`);
  if(q.archived_at && jobCan('records.restore')) b.push(`<button class="btn-ghost" onclick="qRestore()">Restore</button>`);
  if(q.status==='accepted' && !q.job_id && !q.archived_at && jobCan('jobs.convert')) b.push(`<button class="btn" onclick="qConvertForm()">Convert to job →</button>`);
  if(q.job_id) b.push(`<button class="btn-ghost" onclick="closeForm();JOBREG=null;go('jobreg')">Open jobs</button>`);
  b.push(`<button class="btn-ghost" onclick="closeForm()">${ed?'Cancel':'Close'}</button>`);
  if(ed) b.push(`<button class="btn-ghost" id="qeSave" onclick="saveQuote(false)">${isNew?'Create quote':'Save'}</button>`);
  if(ed && !isNew) b.push(`<button class="btn" id="qeIssue" onclick="saveQuote(true)">Issue quote</button>`);

  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal" style="max-width:1180px;width:96vw"><div class="modal-h"><h3>${isNew?'New quote':qRef(q)+' · '+esc(q.title)} ${isNew?'':qStatusChip(q)}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      ${isNew?`<div class="box" style="background:var(--panel2);border:1px dashed var(--line2);border-radius:10px;padding:10px 12px;font-size:12.5px;margin-bottom:12px">The Q reference is issued when you create the quote and stays with the work for life, through to the job and invoice. The trading company can’t be changed afterwards.</div>`:''}
      ${acc}${rej}${arch}
      <div class="frow">
        <div class="fld"><label>Trading company <span class="req">*</span></label>${isNew
          ? `<select id="qe_entity" onchange="qEntityChanged()"><option value="">— choose —</option>${JOBREG_ENTITIES.filter(e=>e.active).map(e=>`<option value="${e.code}" ${e.code===q.entity_code?'selected':''}>${esc(e.code+' — '+e.legal_name)}</option>`).join('')}</select>`
          : `<input value="${esc(q.entity_code+' — '+(ent?ent.legal_name:''))} · ${esc(cur)}" disabled>`}</div>
        <div class="fld"><label>Client <span class="req">*</span></label><select id="qe_client" ${dis} onchange="el('qe_site').innerHTML=jobSiteOptions(this.value,'')"><option value="">— choose —</option>${(CLIENTS||[]).map(c=>`<option value="${c.id}" ${c.id===q.client_id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Quote title <span class="req">*</span></label><input id="qe_title" ${dis} value="${esc(q.title||'')}" placeholder="e.g. Conveyor install, line 3"></div>
        <div class="fld"><label>Site</label><select id="qe_site" ${dis}>${jobSiteOptions(q.client_id,q.site_id)}</select></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Client contact</label><input id="qe_cname" ${dis} value="${esc(q.contact_name||'')}" placeholder="Name"></div>
        <div class="fld"><label>Contact email</label><input id="qe_cemail" ${dis} type="email" value="${esc(q.contact_email||'')}"></div>
      </div>
      <div class="fld"><label>Scope / description (printed)</label><textarea id="qe_desc" ${dis} rows="3">${esc(q.description||'')}</textarea></div>
      <div class="frow">
        <div class="fld"><label>Location</label><input id="qe_loc" ${dis} value="${esc(q.location||'')}"></div>
        <div class="fld"><label>Valid until <span class="req">*</span></label><input id="qe_valid" ${dis} type="date" value="${esc(String(q.valid_until||'').slice(0,10))}"></div>
      </div>
      ${isNew?'':`<div style="margin:6px 0 4px;font-weight:700">Lines</div>
      <div class="card fld" style="padding:6px 8px;overflow-x:auto"><table class="tbl"><thead>${head}</thead><tbody id="qLines">${lines}</tbody></table>
        ${editLines?`<div style="padding:8px 4px"><button class="btn-ghost" onclick="qAddLine()">＋ Add line</button></div>`:''}
        <div id="qSummary">${qSummaryHtml()}</div></div>${vers}`}
      <div class="frow" style="margin-top:12px">
        <div class="fld"><label>Notes for the client (printed)</label><textarea id="qe_cnotes" ${dis} rows="2">${esc(q.client_notes||'')}</textarea></div>
        <div class="fld"><label>Terms (printed)</label><textarea id="qe_terms" ${dis} rows="2">${esc(q.terms||'')}</textarea></div>
      </div>
      ${showCost?`<div class="fld"><label>Internal notes (never printed)</label><textarea id="qe_inotes" ${(!isNew&&(q.job_id||q.archived_at||!jobCan('quotes.create')))?'disabled':''} rows="2">${esc(q.internal_notes||'')}</textarea></div>`:''}
      ${isNew?'<div class="muted" style="font-size:12.5px">Create the quote first, then add its lines.</div>':''}
    </div>
    <div class="modal-foot" style="flex-wrap:wrap">${b.join('')}</div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div></div>`;
  document.body.appendChild(wrap);
}

function qEntityChanged(){ /* currency follows the company; shown after creation */ }
function qLineInput(inp,redraw){
  const i=+inp.dataset.i, f=inp.dataset.f, l=QEDIT.lines[i]; l[f]=inp.value;
  if(f==='line_type'){ const t=LINE_TYPES.find(x=>x[0]===inp.value); if(t && COSTCODES.some(c=>c.code===t[2])) l.cost_code=t[2]; }
  if(redraw){ el('qLines').innerHTML=QEDIT.lines.map((x,j)=>qLineRow(x,j,true,true)).join(''); }
  else { const us=qUnitSell(l); const c=el('qls'+i); if(c) c.innerHTML=isNaN(us)?'<span style="color:var(--red)">margin must be &lt; 100%</span>':jobMoney(qRound(us*qNum(l.quantity)),QEDIT.q.currency); }
  el('qSummary').innerHTML=qSummaryHtml();
}
function qAddLine(){
  QEDIT.lines.push({line_type:'labour',cost_code:COSTCODES.some(c=>c.code==='LAB')?'LAB':(COSTCODES[0]||{}).code,description:'',quantity:1,unit:'',unit_cost:'',pricing_basis:'markup',pricing_pct:'',unit_sell:''});
  el('qLines').innerHTML=QEDIT.lines.map((x,j)=>qLineRow(x,j,true,true)).join('');
  el('qSummary').innerHTML=qSummaryHtml();
}
function qRemoveLine(i){ QEDIT.lines.splice(i,1); el('qLines').innerHTML=QEDIT.lines.map((x,j)=>qLineRow(x,j,true,true)).join('')||`<tr><td colspan="10" class="muted" style="padding:14px">No lines yet — add the first one below.</td></tr>`; el('qSummary').innerHTML=qSummaryHtml(); }

function qStore(saved){ const i=(QUOTES||[]).findIndex(x=>x.id===saved.id); if(i>=0) QUOTES[i]=saved; else (QUOTES=QUOTES||[]).unshift(saved); }

async function saveQuote(issue){
  const v=k=>{ const e=el(k); return e?e.value.trim():''; };
  const q=QEDIT.q, isNew=!q.id;
  const head={ client_id:v('qe_client')||null, site_id:v('qe_site')||null, title:v('qe_title'),
    contact_name:v('qe_cname')||null, contact_email:v('qe_cemail')||null, description:v('qe_desc')||null,
    location:v('qe_loc')||null, valid_until:v('qe_valid')||null, client_notes:v('qe_cnotes')||null, terms:v('qe_terms')||null };
  if(el('qe_inotes')) head.internal_notes=v('qe_inotes')||null;
  if(isNew) head.entity_code=v('qe_entity');
  if(isNew && !head.entity_code) return msg('Choose the trading company.','err');
  if(!head.client_id) return msg('Choose the client.','err');
  if(!head.title) return msg('Give the quote a title.','err');
  // lines
  const lines=QEDIT.lines.map((l,i)=>({...l, sort_order:i+1}));
  for(const [i,l] of lines.entries()){
    if(!String(l.description||'').trim()) return msg(`Line ${i+1}: add a description.`,'err');
    if(!(qNum(l.quantity)>0)) return msg(`Line ${i+1}: quantity must be more than 0.`,'err');
    if(l.unit_cost===''||qNum(l.unit_cost)<0) return msg(`Line ${i+1}: enter the unit cost (0 or more).`,'err');
    if(l.pricing_basis!=='fixed' && (l.pricing_pct===''||qNum(l.pricing_pct)<0)) return msg(`Line ${i+1}: enter the markup or margin %.`,'err');
    if(l.pricing_basis==='margin' && qNum(l.pricing_pct)>=100) return msg(`Line ${i+1}: a margin must be below 100%.`,'err');
    if(l.pricing_basis==='fixed' && (l.unit_sell===''||qNum(l.unit_sell)<0)) return msg(`Line ${i+1}: enter the unit price.`,'err');
  }
  if(issue){
    if(!lines.length) return msg('Add at least one line before issuing.','err');
    if(!head.valid_until || head.valid_until<ymd(new Date())) return msg('Set a “valid until” date (today or later) before issuing.','err');
    if(!confirm(`Issue ${q.quote_ref} rev ${q.revision}? It will be locked; to change it later you would create a revision.`)) return;
  }
  ['qeSave','qeIssue'].forEach(b=>{ const x=el(b); if(x) x.disabled=true; }); msg('Saving…');
  try{
    let saved;
    if(isNew){
      const r=await sb.from('quotes').insert(head).select().single(); if(r.error) throw r.error; saved=r.data;
    } else {
      const r=await sb.from('quotes').update(head).eq('id',q.id).select(); if(r.error) throw r.error;
      if(!r.data||!r.data.length) throw new Error('The change was not saved — you may not have permission.'); saved=r.data[0];
      // lines: remove deleted, update existing, add new
      const keep=lines.filter(l=>l.id).map(l=>l.id);
      const gone=(QEDIT.origLineIds||[]).filter(id=>!keep.includes(id));
      if(gone.length){ const d=await sb.from('quote_lines').delete().in('id',gone); if(d.error) throw d.error; }
      for(const l of lines){
        const row={quote_id:q.id, sort_order:l.sort_order, line_type:l.line_type, cost_code:l.cost_code, description:String(l.description).trim(),
          quantity:qNum(l.quantity), unit:l.unit||null, unit_cost:qNum(l.unit_cost), pricing_basis:l.pricing_basis,
          pricing_pct:l.pricing_basis==='fixed'?null:qNum(l.pricing_pct), unit_sell:l.pricing_basis==='fixed'?qNum(l.unit_sell):0};
        const r2=l.id ? await sb.from('quote_lines').update(row).eq('id',l.id).select() : await sb.from('quote_lines').insert(row).select();
        if(r2.error) throw r2.error; if(!r2.data||!r2.data.length) throw new Error('A line was not saved — you may not have permission.');
      }
      const fresh=await sb.from('quotes').select('*').eq('id',q.id).single(); if(fresh.error) throw fresh.error; saved=fresh.data;
      if(issue){
        const r3=await sb.from('quotes').update({status:'issued'}).eq('id',q.id).select(); if(r3.error) throw r3.error;
        if(!r3.data||!r3.data.length) throw new Error('Not issued — you may not have permission.');
        saved=r3.data[0]; qStore(saved);
        msg('Issued. Saving the PDF…');
        const path=await qMakeAndStorePdf(saved);
        if(path){ const r4=await sb.from('quotes').update({pdf_path:path}).eq('id',q.id).select(); if(!r4.error&&r4.data&&r4.data.length) saved=r4.data[0]; }
      }
    }
    qStore(saved);
    msg(isNew?`✓ Created ${saved.quote_ref} — now add its lines.`:(issue?`✓ ${saved.quote_ref} issued.`:'✓ Saved.'),'ok');
    setTimeout(()=>{ openQuote(saved.id).then(()=>{ if(CURRENT==='quotereg'){ const t=el('quoteTable'); if(t) t.innerHTML=quoteTableHtml(); } }); }, isNew?700:400);
  }catch(e){ msg('Not saved: '+(e.message||e),'err'); ['qeSave','qeIssue'].forEach(b=>{ const x=el(b); if(x) x.disabled=false; }); }
}

/* ---------- PDF ---------- */
function qPdfDoc(q, lines){
  const {jsPDF}=window.jspdf; const doc=new jsPDF({unit:'pt',format:'a4'});
  const W=595, H=842, L=40, R=W-40; let y=0;
  const ent=JOBREG_ENTITIES.find(e=>e.code===q.entity_code)||{};
  const client=(CLIENTS||[]).find(c=>c.id===q.client_id)||{};
  const site=JOBREG_SITES.find(s=>s.id===q.site_id);
  const cur=q.currency, money=v=>jobMoney(v,cur);
  doc.setFillColor(10,14,22); doc.rect(0,0,W,78,'F');
  try{ doc.addImage(MLOGO,'PNG',L,16,44,44); }catch(e){}
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.text(ent.legal_name||'Mercury Automated Solutions', L+56, 36);
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(180,200,220);
  const addr=ent.registered_address&&!/TBC/.test(ent.registered_address)?ent.registered_address:'';
  const reg=[ent.registration_no&&!/TBC/.test(ent.registration_no)?'Company no. '+ent.registration_no:'', ent.tax_no&&!/TBC/.test(ent.tax_no)?(q.entity_code==='UK'?'VAT no. ':'Tax no. ')+ent.tax_no:''].filter(Boolean).join('   ·   ');
  if(addr) doc.text(doc.splitTextToSize(addr,R-L-56)[0],L+56,50);
  if(reg) doc.text(reg,L+56,62);
  y=112; doc.setTextColor(15,32,51); doc.setFont('helvetica','bold'); doc.setFontSize(20); doc.text('QUOTATION', L, y);
  doc.setFontSize(11); doc.text(`${q.quote_ref}${q.revision>1?'  rev '+q.revision:''}`, R, y, {align:'right'});
  doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(90,107,128);
  doc.text(`Date: ${jobDate((q.issued_at||new Date().toISOString()).slice(0,10))}    Valid until: ${jobDate(q.valid_until)}`, R, y+15, {align:'right'});
  y+=40;
  const block=(label,text)=>{ if(!text) return; doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(90,107,128); doc.text(label.toUpperCase(),L,y);
    doc.setFont('helvetica','normal'); doc.setFontSize(10.5); doc.setTextColor(15,32,51); const t=doc.splitTextToSize(String(text),R-L); doc.text(t,L,y+13); y+=13+t.length*13+8; };
  block('To', [client.name, q.contact_name, q.contact_email].filter(Boolean).join('\n'));
  block('Site / location', [site?(site.code||site.name||site.city):'', q.location].filter(Boolean).join(' — '));
  block('Project', q.title);
  block('Scope', q.description);
  // lines table
  const cols=[L, L+300, L+360, L+430]; // description, qty, unit price, total(right edge R)
  const header=()=>{ doc.setFillColor(236,242,248); doc.rect(L,y,R-L,20,'F'); doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(60,76,96);
    doc.text('DESCRIPTION',L+6,y+13); doc.text('QTY',cols[1]+40,y+13,{align:'right'}); doc.text('UNIT PRICE',cols[2]+60,y+13,{align:'right'}); doc.text('TOTAL',R-6,y+13,{align:'right'}); y+=26; };
  header();
  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(15,32,51);
  let total=0;
  lines.forEach(l=>{
    const d=doc.splitTextToSize(String(l.description||''), cols[1]-L-12);
    const h=Math.max(16, d.length*12+4);
    if(y+h>H-120){ doc.addPage(); y=48; header(); doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(15,32,51); }
    doc.text(d,L+6,y+10);
    doc.text(`${qNum(l.quantity)}${l.unit?' '+l.unit:''}`,cols[1]+40,y+10,{align:'right'});
    doc.text(money(l.unit_sell),cols[2]+60,y+10,{align:'right'});
    doc.text(money(l.line_sell),R-6,y+10,{align:'right'});
    total+=qNum(l.line_sell); y+=h; doc.setDrawColor(230,236,242); doc.line(L,y-2,R,y-2);
  });
  y+=8; doc.setFont('helvetica','bold'); doc.setFontSize(11.5);
  doc.text('Total (excluding VAT)',cols[2]-20,y+6); doc.text(money(qRound(total)),R-6,y+6,{align:'right'}); y+=30;
  block('Notes', q.client_notes);
  block('Terms', q.terms);
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(140,150,165);
  const pages=doc.getNumberOfPages();
  for(let p=1;p<=pages;p++){ doc.setPage(p); doc.text(`${q.quote_ref}${q.revision>1?' rev '+q.revision:''} · page ${p} of ${pages}`, W/2, H-24, {align:'center'}); }
  return doc;
}
async function qLinesForPdf(id){
  const r=await sb.rpc('quote_lines_for_view',{p_quote:id}); if(r.error) throw r.error; return r.data||[];
}
async function qMakeAndStorePdf(q){
  if(!window.jspdf) return null;
  try{
    const doc=qPdfDoc(q, await qLinesForPdf(q.id));
    const blob=doc.output('blob'); const path=`quotes/${q.quote_ref}/${q.quote_ref}-rev${q.revision}.pdf`;
    const up=await sb.storage.from('commercial').upload(path, blob, {contentType:'application/pdf', upsert:true});
    if(up.error){ console.warn('quote pdf upload',up.error); return null; }
    return path;
  }catch(e){ console.warn('quote pdf',e); return null; }
}
async function qPreviewPdf(){
  if(!window.jspdf){ alert('PDF tool still loading — try again in a moment.'); return; }
  try{ const q=QEDIT.q; const doc=qPdfDoc(q, await qLinesForPdf(q.id)); doc.save(`${q.quote_ref}-rev${q.revision}-DRAFT.pdf`); }
  catch(e){ alert('Could not build the PDF: '+(e.message||e)); }
}
async function qDownloadPdf(path){
  const q=QEDIT.q; path=path||q.pdf_path;
  if(path){
    const r=await sb.storage.from('commercial').createSignedUrl(path, 60);
    if(!r.error && r.data && r.data.signedUrl){ window.open(r.data.signedUrl,'_blank'); return; }
  }
  // no stored copy: rebuild from the quote as it stands
  if(!window.jspdf){ alert('PDF tool still loading — try again in a moment.'); return; }
  try{ const doc=qPdfDoc(q, await qLinesForPdf(q.id)); doc.save(`${q.quote_ref}-rev${q.revision}.pdf`); }
  catch(e){ alert('Could not build the PDF: '+(e.message||e)); }
}
function qShowVersion(rev){
  const v=(QEDIT.versions||[]).find(x=>x.revision===rev); if(!v) return;
  const s=v.snapshot||{}, q=s.quote||{};
  if(q.pdf_path) return qDownloadPdf(q.pdf_path);
  if(!window.jspdf){ alert('PDF tool still loading.'); return; }
  qPdfDoc(q, s.lines||[]).save(`${q.quote_ref}-rev${rev}.pdf`);
}

/* ---------- status actions ---------- */
async function qUpdate(patch, okText){
  const q=QEDIT.q;
  const r=await sb.from('quotes').update(patch).eq('id',q.id).select();
  if(r.error){ msg('Not saved: '+r.error.message,'err'); return false; }
  if(!r.data||!r.data.length){ msg('Not saved — you may not have permission.','err'); return false; }
  qStore(r.data[0]); await openQuote(q.id); msg(okText,'ok');
  if(CURRENT==='quotereg'){ const t=el('quoteTable'); if(t) t.innerHTML=quoteTableHtml(); }
  return true;
}
async function qReject(){
  const reason=prompt(`Record ${QEDIT.q.quote_ref} as rejected by the client.\n\nReason:`); if(reason===null) return;
  if(!reason.trim()){ alert('A reason is needed.'); return; }
  await qUpdate({status:'rejected', rejected_reason:reason.trim()}, '✓ Recorded as rejected.');
}
async function qRevise(){
  const q=QEDIT.q;
  if(!confirm(`Create revision ${q.revision+1} of ${q.quote_ref}? The current version (rev ${q.revision}) is kept and the quote reopens for editing.`)) return;
  const r=await sb.rpc('revise_quote',{p_quote:q.id});
  if(r.error){ msg('Not revised: '+r.error.message,'err'); return; }
  const f=await sb.from('quotes').select('*').eq('id',q.id).single(); if(!f.error) qStore(f.data);
  await openQuote(q.id); msg(`✓ Now on rev ${r.data}. Edit and issue again.`,'ok');
  if(CURRENT==='quotereg'){ const t=el('quoteTable'); if(t) t.innerHTML=quoteTableHtml(); }
}
function qAcceptForm(){
  const q=QEDIT.q; closeForm();
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal"><div class="modal-h"><h3>Record acceptance · ${esc(q.quote_ref)}${q.revision>1?' rev '+q.revision:''}</h3><button class="modal-x" onclick="closeForm();openQuote('${q.id}')">✕</button></div>
    <div class="modal-b">
      <div class="box" style="background:var(--panel2);border:1px dashed var(--line2);border-radius:10px;padding:10px 12px;font-size:12.5px;margin-bottom:12px">A quote is accepted only with the client’s purchase order or written confirmation. Value accepted: <b>${jobMoney(q.total_sell,q.currency)}</b> (excl. VAT).</div>
      <div class="fld"><label>Accepted by <span class="req">*</span></label><select id="qa_method" onchange="el('qa_po_row').style.display=this.value==='purchase_order'?'':'none'"><option value="purchase_order">Purchase order</option><option value="written_confirmation">Written confirmation (e.g. email)</option></select></div>
      <div class="fld" id="qa_po_row"><label>Client PO number <span class="req">*</span></label><input id="qa_po"></div>
      <div class="frow"><div class="fld"><label>Date received <span class="req">*</span></label><input id="qa_date" type="date" value="${ymd(new Date())}"></div>
      <div class="fld"><label>Client contact who accepted</label><input id="qa_name" value="${esc(q.contact_name||'')}"></div></div>
      <div class="fld"><label>Note (e.g. where the PO or email is filed)</label><input id="qa_note"></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm();openQuote('${q.id}')">Cancel</button><button class="btn" id="qaSave" onclick="qAcceptSave()">Record acceptance</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div></div>`;
  document.body.appendChild(wrap);
}
async function qAcceptSave(){
  const v=k=>el(k).value.trim(); const method=v('qa_method');
  if(method==='purchase_order' && !v('qa_po')) return msg('Enter the client’s PO number.','err');
  if(!v('qa_date')) return msg('Enter the date it was received.','err');
  if(method==='written_confirmation' && !v('qa_note')) return msg('Add a note saying where the written confirmation is filed.','err');
  const q=QEDIT.q;
  const r=await sb.from('quotes').update({status:'accepted', acceptance_method:method, client_po_ref:method==='purchase_order'?v('qa_po'):null,
    accepted_on:v('qa_date'), accepted_by_name:v('qa_name')||null, acceptance_note:v('qa_note')||null}).eq('id',q.id).select();
  if(r.error) return msg('Not saved: '+r.error.message,'err');
  if(!r.data||!r.data.length) return msg('Not saved — you may not have permission.','err');
  qStore(r.data[0]); closeForm(); await openQuote(q.id); msg('✓ Accepted. It can now be converted into a job.','ok');
  if(CURRENT==='quotereg'){ const t=el('quoteTable'); if(t) t.innerHTML=quoteTableHtml(); }
}
function qConvertForm(){
  const q=QEDIT.q; closeForm();
  const managers=(LOGINS||[]).filter(l=>l.role==='admin');
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal"><div class="modal-h"><h3>Convert to job · ${esc(q.quote_ref)}</h3><button class="modal-x" onclick="closeForm();openQuote('${q.id}')">✕</button></div>
    <div class="modal-b">
      <div class="box" style="background:var(--panel2);border:1px dashed var(--line2);border-radius:10px;padding:10px 12px;font-size:12.5px;margin-bottom:12px">
        Job <b>${esc(q.quote_ref)}</b> will be created for <b>${esc(jobClientName(q.client_id))}</b> with a contract value of <b>${jobMoney(q.total_sell,q.currency)}</b>${q.client_po_ref?` and PO <b>${esc(q.client_po_ref)}</b>`:''}. The quote’s costs become the job’s original budget, which is then locked. This can’t be undone.</div>
      <div class="fld"><label>Job manager</label><select id="qc_mgr"><option value="">— choose later —</option>${managers.map(m=>`<option value="${m.id}">${esc(m.email)}</option>`).join('')}</select></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm();openQuote('${q.id}')">Cancel</button><button class="btn" id="qcGo" onclick="qConvert()">Create job ${esc(q.quote_ref)}</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div></div>`;
  document.body.appendChild(wrap);
}
async function qConvert(){
  const q=QEDIT.q; const b=el('qcGo'); if(b) b.disabled=true; msg('Creating the job…');
  const r=await sb.rpc('convert_quote_to_job',{p_quote:q.id, p_job_manager:el('qc_mgr').value||null});
  if(r.error){ msg('Not converted: '+r.error.message,'err'); if(b) b.disabled=false; return; }
  const f=await sb.from('quotes').select('*').eq('id',q.id).single(); if(!f.error) qStore(f.data);
  JOBREG=null;
  msg(`✓ Job ${q.quote_ref} created.`,'ok');
  setTimeout(()=>{ closeForm(); go('jobreg'); }, 900);
}
async function qArchive(){
  const q=QEDIT.q; const reason=prompt(`Archive ${q.quote_ref}? It leaves the normal lists but is never deleted.\n\nReason:`); if(reason===null) return;
  if(!reason.trim()){ alert('A reason is needed to archive a quote.'); return; }
  if(await qUpdate({archived_at:new Date().toISOString(), archive_reason:reason.trim()}, '✓ Archived.')){ closeForm(); go('quotereg'); }
}
async function qRestore(){ if(!confirm('Restore this quote to the normal lists?')) return; await qUpdate({archived_at:null}, '✓ Restored.'); }
async function qHistory(){
  const q=QEDIT.q;
  const r=await sb.from('change_history').select('changed_at,user_email,action,changes').eq('table_name','quotes').eq('record_id',q.id).order('changed_at',{ascending:false}).limit(200);
  const skip=['updated_at','archived_by','id','created_by','created_at','total_sell','issued_by','accepted_recorded_by','converted_by'];
  const fmt=x=>x==null||x===''?'—':esc(typeof x==='object'?JSON.stringify(x):String(x));
  const rows=(r.data||[]).map(h=>{ let d=''; if(h.action==='insert') d='Quote created';
    else if(h.changes&&typeof h.changes==='object') d=Object.keys(h.changes).filter(k=>!skip.includes(k)).map(k=>`<div><b>${esc(k.replace(/_/g,' '))}</b>: ${fmt(h.changes[k].from)} → ${fmt(h.changes[k].to)}</div>`).join('')||'<span class="muted">totals updated</span>';
    return `<tr><td style="white-space:nowrap">${new Date(h.changed_at).toLocaleString('en-GB')}</td><td>${esc(h.user_email||'system')}</td><td>${esc(h.action)}</td><td>${d}</td></tr>`; }).join('');
  closeForm();
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal"><div class="modal-h"><h3>History · ${esc(q.quote_ref)}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">${r.error?`<div class="muted">Could not load: ${esc(r.error.message)}</div>`:`<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Changes</th></tr></thead><tbody>${rows||'<tr><td colspan="4" class="muted">No changes recorded.</td></tr>'}</tbody></table></div>`}</div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm();openQuote('${q.id}')">Back to quote</button></div></div>`;
  document.body.appendChild(wrap);
}
