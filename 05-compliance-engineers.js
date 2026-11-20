/* ================= COMPLIANCE COCKPIT (admin) =================
   Every expiry & right-to-work status across internal engineers,
   agency workers, suppliers and client documents — in one place. */
function complianceItems(){
  const out=[];
  const push=(o)=>{ const st=cardStatus(o.expiry); if(o.c==null) o.c=st.c; if(o.label==null) o.label=st.label; o.days = o.expiry? Math.ceil((new Date(o.expiry)-Date.now())/86400000) : null; out.push(o); };
  // internal competency cards (from team rosters)
  (HQDATA&&HQDATA.teams?HQDATA.teams:[]).forEach(t=>{ (Array.isArray(t.roster)?t.roster:[]).forEach(e=>{ if(!e||!e.name) return; (Array.isArray(e.cards)?e.cards:[]).forEach(c=>{ if(c&&c.type&&c.expiry) push({who:e.name,type:'Engineer',cat:'Card',subject:c.type,expiry:c.expiry,extra:''}); }); }); });
  // internal travel docs (engineer_hr)
  (ENGHR||[]).forEach(h=>{ const nm=h.full_name||'';
    if(h.a1_expiry) push({who:nm,type:'Engineer',cat:'A1 certificate',subject:'A1',expiry:h.a1_expiry,extra:''});
    if(h.medical_expiry) push({who:nm,type:'Engineer',cat:'Medical insurance',subject:h.medical_provider||'Medical',expiry:h.medical_expiry,extra:''});
    if(h.passport_expiry) push({who:nm,type:'Engineer',cat:'Passport',subject:'Passport',expiry:h.passport_expiry,extra:''});
  });
  // agency engineers (cards + travel + right-to-work)
  (SDATA.engineers||[]).forEach(e=>{ const sup=((SUPPLIERS||[]).find(s=>s.id===e.supplier_id)||{}).name||'Agency';
    (Array.isArray(e.cards)?e.cards:[]).forEach(c=>{ if(c&&c.type&&c.expiry) push({who:e.full_name,type:'Agency',cat:'Card',subject:c.type,expiry:c.expiry,extra:sup}); });
    if(e.a1_expiry) push({who:e.full_name,type:'Agency',cat:'A1 certificate',subject:'A1',expiry:e.a1_expiry,extra:sup});
    if(e.medical_expiry) push({who:e.full_name,type:'Agency',cat:'Medical insurance',subject:e.medical_provider||'Medical',expiry:e.medical_expiry,extra:sup});
    if(e.passport_expiry) push({who:e.full_name,type:'Agency',cat:'Passport',subject:'Passport',expiry:e.passport_expiry,extra:sup});
    if(e.rtw_status==='Expired') out.push({who:e.full_name,type:'Agency',cat:'Right to work',subject:'RTW expired',expiry:null,extra:sup,c:'red',label:'expired',days:null});
    else if(e.rtw_status==='Not checked') out.push({who:e.full_name,type:'Agency',cat:'Right to work',subject:'RTW not checked',expiry:null,extra:sup,c:'amber',label:'check',days:null});
  });
  // supplier company documents
  (SDATA.documents||[]).forEach(d=>{ const sup=((SUPPLIERS||[]).find(s=>s.id===d.supplier_id)||{}).name||'Supplier'; if(d.expiry) push({who:sup,type:'Supplier',cat:d.doc_type||'Document',subject:d.label,expiry:d.expiry,extra:''}); });
  // client documents
  (HQDATA&&HQDATA.documents?HQDATA.documents:[]).forEach(d=>{ if(d.expiry_date) push({who:clientName(d.client_id),type:'Client doc',cat:d.doc_type||'Document',subject:d.title,expiry:d.expiry_date,extra:''}); });
  // sort: red first, then soonest expiry
  const rank={red:0,amber:1,green:2,grey:3};
  return out.sort((a,b)=> (rank[a.c]-rank[b.c]) || ((a.days==null?9e9:a.days)-(b.days==null?9e9:b.days)));
}
/* Compliance status for a single agency engineer (used to gate assignments) */
function engComplianceStatus(engId){
  const e=(SDATA.engineers||[]).find(x=>x.id===engId); const block=[],warn=[];
  if(!e) return {block,warn};
  if(e.rtw_status==='Expired') block.push('Right to work has expired');
  else if(e.rtw_status==='Not checked') warn.push('Right to work not checked');
  (Array.isArray(e.cards)?e.cards:[]).forEach(c=>{ if(!c||!c.expiry) return; const st=cardStatus(c.expiry); if(st.c==='red') block.push((c.type||'Card')+' expired'); else if(st.c==='amber') warn.push((c.type||'Card')+' expiring soon'); });
  [['A1',e.a1_expiry],['Medical insurance',e.medical_expiry],['Passport',e.passport_expiry]].forEach(p=>{ if(!p[1]) return; const st=cardStatus(p[1]); if(st.c==='red') warn.push(p[0]+' expired'); else if(st.c==='amber') warn.push(p[0]+' expiring soon'); });
  return {block,warn};
}
function compBadge(engId){
  if(!engId) return '';
  const s=engComplianceStatus(engId);
  if(s.block.length) return `<div class="note" style="border-left:3px solid var(--red);padding-left:10px;font-size:12px;margin-top:6px">⛔ <b>Compliance issue:</b> ${s.block.map(esc).join(' · ')}${s.warn.length?(' · '+s.warn.map(esc).join(' · ')):''} <span class="muted">— you'll be asked to confirm before booking.</span></div>`;
  if(s.warn.length) return `<div class="note" style="border-left:3px solid var(--amber);padding-left:10px;font-size:12px;margin-top:6px">⚠ ${s.warn.map(esc).join(' · ')}</div>`;
  return `<div class="note" style="border-left:3px solid var(--green);padding-left:10px;font-size:12px;margin-top:6px">✓ Compliant — tickets &amp; right-to-work in date</div>`;
}
function updateAssignComp(id){ const d=el('a_comp'); if(d) d.innerHTML=compBadge(id); }
function updateFillComp(id){ const d=el('fa_comp'); if(d) d.innerHTML=compBadge(id); }
/* returns true if OK to proceed (no block, or admin confirmed the override) */
function complianceGateOk(engId, who){
  if(!engId) return true;
  const s=engComplianceStatus(engId);
  if(!s.block.length) return true;
  return confirm('⚠ Compliance issue for '+(who||'this engineer')+':\n\n• '+s.block.join('\n• ')+(s.warn.length?('\n• '+s.warn.join('\n• ')):'')+'\n\nThe system flagged this. Assign them to the job anyway?');
}
let COMP={view:'attention',type:'all'};
function pageCompliance(){
  if(PROFILE.role!=='admin') return emptyState('🔒','Admins only','This is the Mercury compliance view.');
  if(!HQDATA) return emptyState('⏳','Loading…','One moment…');
  return `<div class="sechead"><h3>🛡 Compliance — Expiries &amp; Right to Work</h3><span class="sub">Every ticket, certificate, insurance &amp; right-to-work across your team, agency &amp; suppliers</span><span class="line"></span><button class="addbtn reportbtn" onclick="loadHQ().then(()=>loadSuppliers()).then(()=>go('compliance'))">↻ Refresh</button></div><div id="compBox">${compInner()}</div>`;
}
function compSet(k,v){ COMP[k]=v; const b=el('compBox'); if(b) b.innerHTML=compInner(); }
function compInner(){
  const all=complianceItems();
  const expired=all.filter(x=>x.c==='red').length;
  const soon30=all.filter(x=>x.c==='amber'&&x.days!=null&&x.days<=30).length || all.filter(x=>x.c==='amber').length;
  const amber=all.filter(x=>x.c==='amber').length;
  const k=`<div class="grid kpis" style="margin-bottom:14px">
    ${kpi(expired?'r':'g','⛔','Expired',expired,'')}
    ${kpi(amber?'a':'g','⏳','Expiring soon',amber,'')}
    ${kpi('c','🗂','Items tracked',all.length,'')}
    ${kpi('g','✅','Valid',all.filter(x=>x.c==='green').length,'')}
  </div>`;
  let rows=all.slice();
  if(COMP.view==='attention') rows=rows.filter(x=>x.c==='red'||x.c==='amber');
  else if(COMP.view==='expired') rows=rows.filter(x=>x.c==='red');
  else if(COMP.view==='expiring') rows=rows.filter(x=>x.c==='amber');
  if(COMP.type!=='all') rows=rows.filter(x=>x.type===COMP.type);
  const vBtn=(v,l)=>`<button class="edit-btn ${COMP.view===v?'on':''}" onclick="compSet('view','${v}')">${l}</button>`;
  const tBtn=(t,l)=>`<button class="edit-btn ${COMP.type===t?'on':''}" onclick="compSet('type','${t}')">${l}</button>`;
  const controls=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${vBtn('attention','Needs attention')}${vBtn('expired','Expired')}${vBtn('expiring','Expiring')}${vBtn('all','All')}<span style="width:10px"></span>${tBtn('all','Everyone')}${tBtn('Engineer','Engineers')}${tBtn('Agency','Agency')}${tBtn('Supplier','Suppliers')}${tBtn('Client doc','Client docs')}</div>`;
  const dfmt=w=>{ if(!w) return '—'; const d=new Date(w); return isNaN(d)?'—':d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); };
  const daysTxt=x=>{ if(x.days==null) return x.label?('· '+x.label):''; if(x.days<0) return 'expired '+(-x.days)+'d ago'; if(x.days===0) return 'expires today'; return 'in '+x.days+'d'; };
  const table = rows.length ? `<div class="card" style="overflow-x:auto"><table class="tbl"><thead><tr><th>Status</th><th>Who</th><th>Item</th><th>Category</th><th>Type</th><th>Expiry</th></tr></thead><tbody>
    ${rows.slice(0,400).map(x=>`<tr><td><span class="rag rag-${x.c==='red'?'red':x.c==='amber'?'amber':'green'}"></span></td><td><b>${esc(x.who||'—')}</b>${x.extra?`<div class="muted" style="font-size:11px">${esc(x.extra)}</div>`:''}</td><td>${esc(x.subject||'—')}</td><td>${esc(x.cat||'')}</td><td><span class="chip ${x.type==='Agency'?'grey':x.type==='Supplier'?'violet':x.type==='Client doc'?'cyan':'green'}" style="font-size:10px">${esc(x.type)}</span></td><td>${dfmt(x.expiry)} <span class="muted" style="font-size:11px">${esc(daysTxt(x))}</span></td></tr>`).join('')}
    </tbody></table></div>` : `<div class="card"><div class="empty" style="padding:16px"><div class="big">✅</div><b>Nothing ${COMP.view==='expired'?'expired':COMP.view==='expiring'?'expiring':'needs attention'}</b><div style="font-size:13px;margin-top:4px">You're all compliant for this filter.</div></div></div>`;
  return k+controls+table;
}
/* Consolidated competency cards for a registry engineer — merges the
   cards stored on their record with any found live on team rosters. */
function engRegCards(e){
  const map={};
  const add=c=>{ if(!c||!c.type) return; const k=String(c.type).trim().toLowerCase(); const ex=map[k];
    if(!ex || (c.file&&!ex.file) || (c.expiry&&(!ex.expiry||String(c.expiry)>String(ex.expiry)))) map[k]={type:c.type,number:c.number||'',expiry:c.expiry||null,file:c.file||null}; };
  (Array.isArray(e.cards)?e.cards:[]).forEach(add);
  const key=String(e.full_name||'').trim().toLowerCase();
  (HQDATA&&HQDATA.teams?HQDATA.teams:[]).forEach(t=>{ (Array.isArray(t.roster)?t.roster:[]).forEach(r=>{ if(r&&String(r.name||'').trim().toLowerCase()===key){ (Array.isArray(r.cards)?r.cards:[]).forEach(add); } }); });
  return Object.values(map);
}
function engCardChips(cards){ if(!cards.length) return '<span class="muted" style="font-size:11px">No cards on record</span>'; return cards.map(c=>{ const st=cardStatus(c.expiry); return `<span class="chip ${st.c}" style="font-size:10px;margin:1px 2px 1px 0" title="${c.number?('No. '+esc(c.number)+' · '):''}${c.expiry?('expires '+String(c.expiry).slice(0,10)):''}">${esc(c.type)}${st.label?' · '+st.label:''}${c.file?` <a href="${esc(c.file)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">📄</a>`:''}</span>`; }).join(''); }
/* ---- Engineer master registry (admin) ---- */
function pageEngineers(){
  if(PROFILE.role!=='admin') return emptyState('🔒','Admins only','This is the Mercury team register.');
  const list=(ENGREG||[]).slice().sort((a,b)=> ((a.status==='Left')-(b.status==='Left')) || String(a.full_name||'').localeCompare(String(b.full_name||'')));
  const active=list.filter(e=>e.status!=='Left').length;
  const totalCards=list.reduce((a,e)=>a+engRegCards(e).length,0);
  const header=`<div class="sechead"><h3>👷 Engineers — Team Register</h3><span class="sub">${active} active · ${list.length} on record · ${totalCards} card${totalCards===1?'':'s'}/competenc${totalCards===1?'y':'ies'}</span><span class="line"></span><button class="addbtn" onclick="openEngineerRec()">＋ Add engineer</button></div>`;
  const help=`<div class="card tip" style="margin-bottom:14px;background:linear-gradient(180deg,rgba(34,197,94,.07),transparent);border:1px solid var(--line2)"><div class="csub" style="margin:0">This is the single source of truth for your engineers. Report &amp; rota name suggestions come from here, and each person's Safety &amp; travel record — plus the compliance view to come — links to them by a stable ID, not a typed name.</div></div>`;
  if(!list.length) return header+help+emptyState('👷','No engineers yet','Tap “Add engineer”, or run the setup SQL to import names already on your team rosters.');
  const rows=list.map(e=>{ const hr=(ENGHR||[]).find(h=>h.engineer_id===e.id || String(h.engineer_key||'')===String(e.full_name||'').trim().toLowerCase()); const cards=engRegCards(e);
    return `<tr${e.status==='Left'?' style="opacity:.6"':''}><td><b>${esc(e.full_name)}</b>${(e.phone||e.email)?`<div class="muted" style="font-size:11px">${esc(e.phone||'')}${e.phone&&e.email?' · ':''}${esc(e.email||'')}</div>`:''}</td><td>${esc(e.trade||'—')}</td><td style="max-width:300px"><div class="eng-cards">${engCardChips(cards)}</div></td><td>${e.status==='Left'?'<span class="chip grey">Left</span>':'<span class="chip green">Active</span>'}</td><td>${hr?'<span class="chip cyan" style="font-size:10px">On file</span>':'<span class="muted">—</span>'}</td><td style="white-space:nowrap"><button class="edit-btn" onclick="openEngineerRec('${e.id}')">Edit</button> <button class="edit-btn" onclick="openEngHr('${jss(e.full_name)}')">🔒 Safety &amp; travel</button> <button class="edit-btn" onclick="toggleEngStatus('${e.id}')">${e.status==='Left'?'Reinstate':'Mark left'}</button></td></tr>`; }).join('');
  return header+help+`<div class="card" style="overflow-x:auto"><table class="tbl"><thead><tr><th>Engineer</th><th>Trade</th><th>Cards &amp; competencies</th><th>Status</th><th>Safety / travel</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function openEngineerRec(id){
  if(PROFILE.role!=='admin') return;
  const e = id ? ((ENGREG||[]).find(x=>x.id===id)||{}) : {};
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>${id?'Edit engineer':'Add engineer'}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="fld"><label>Full name <span class="req">*</span></label><input id="er_name" value="${esc(e.full_name||'')}" placeholder="Engineer's full name"></div>
      <div class="frow">
        <div class="fld"><label>Trade / skill</label><input id="er_trade" value="${esc(e.trade||'')}" placeholder="e.g. Mechanical, Electrical, Multi-skilled"></div>
        <div class="fld"><label>Status</label><select id="er_status">${['Active','Left'].map(o=>`<option ${(e.status||'Active')===o?'selected':''}>${o}</option>`).join('')}</select></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Phone</label><input id="er_phone" value="${esc(e.phone||'')}" placeholder="Optional"></div>
        <div class="fld"><label>Email</label><input id="er_email" value="${esc(e.email||'')}" placeholder="Optional"></div>
      </div>
      <div class="fld"><label>Notes</label><textarea id="er_notes" rows="2" placeholder="Optional">${esc(e.notes||'')}</textarea></div>
      <div class="note" style="font-size:11.5px">Safety &amp; travel (next of kin, A1, passport…) is edited separately via the 🔒 button — kept private to admins.</div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="erSave" onclick="submitEngineerRec(${id?`'${id}'`:'null'})">${id?'Save changes':'Add engineer'}</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
async function submitEngineerRec(id){
  const name=val('er_name'); if(!name){ msg('Please enter the engineer name.','err'); return; }
  const btn=el('erSave'); btn.disabled=true; btn.textContent='Saving…'; msg('','');
  const row={ full_name:name, trade:val('er_trade')||null, status:val('er_status')||'Active', phone:val('er_phone')||null, email:val('er_email')||null, notes:val('er_notes')||null, engineer_type:'internal' };
  const res = id ? await sb.from('engineers').update(row).eq('id',id) : await sb.from('engineers').insert(row);
  if(res.error){ btn.disabled=false; btn.textContent=id?'Save changes':'Add engineer'; msg('Could not save: '+res.error.message,'err'); return; }
  msg('✓ Saved.','ok'); await loadEngReg(); setTimeout(()=>{ closeForm(); go('engineers'); }, 600);
}
async function toggleEngStatus(id){ const e=(ENGREG||[]).find(x=>x.id===id)||{}; const ns=e.status==='Left'?'Active':'Left'; const {error}=await sb.from('engineers').update({status:ns}).eq('id',id); if(error){ alert('Could not update: '+error.message); return; } await loadEngReg(); go('engineers'); }
function openTeamForm(teamId){
  if(!CLIENT){ alert('Pick a client first.'); return; }
  const t = teamId ? (DATA.teams.find(x=>x.id===teamId)||{}) : {};
  const colour = t.color||'#38bdf8';
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>${teamId?'Edit Team':'Add Team'} ${teamId?'· '+esc(t.name||''):''}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      ${engineerDatalist()}
      <div class="frow">
        <div class="fld"><label>Team name <span class="req">*</span></label><input id="t_name" value="${esc(t.name||'')}" placeholder="e.g. Team A / North Crew"></div>
        <div class="fld"><label>Colour</label><input id="t_color" type="color" value="${esc(colour)}" style="height:42px;padding:4px"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Team lead</label><input id="t_lead" list="engList" value="${esc(t.lead||'')}" placeholder="Lead engineer"></div>
        <div class="fld"><label>Region / route</label><input id="t_region" value="${esc(t.region||'')}" placeholder="e.g. Midlands, IE+UK"></div>
      </div>
      <div class="fld"><label>Route distance (miles)</label><input id="t_miles" type="number" min="0" step="1" value="${t.route_miles!=null?t.route_miles:''}" placeholder="optional"></div>
      ${cardDatalist()}
      <div class="fld">
        <div class="crewhd"><label style="margin:0">Engineers in this team</label><button type="button" class="edit-btn" onclick="addEngRow()">＋ Add engineer</button></div>
        <div id="rosWrap"></div>
        <div class="note">Add each engineer, then their competency cards (CSCS, MEWP/IPAF, ECS, 18th Edition…) with the expiry date — and attach a photo or PDF copy of each card/cert. Clients can see these and view the copies on the team.</div>
      </div>
    </div>
    <div class="modal-foot">
      ${teamId?`<button class="btn-ghost" style="color:var(--red)" onclick="deleteTeam('${teamId}')">Delete</button>`:''}
      <button class="btn-ghost" onclick="closeForm()">Cancel</button>
      <button class="btn" id="teamSave" onclick="submitTeam(${teamId?`'${teamId}'`:'null'})">${teamId?'Save changes':'Add team'}</button>
    </div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
  (Array.isArray(t.roster)?t.roster:[]).forEach(e=>addEngRow(e.name,e.role,e.phone,e.cards));
}
function engBlockHtml(name,role,phone){ return `<div class="engblock"><div class="frow eg-head"><input class="eg-n" list="engList" placeholder="Engineer name" value="${esc(name||'')}"><input class="eg-r" placeholder="Role e.g. Electrician" value="${esc(role||'')}"><input class="eg-p" placeholder="Phone" value="${esc(phone||'')}"><button type="button" class="crew-rm" title="Remove engineer" onclick="this.closest('.engblock').remove()">✕</button></div><div class="cardwrap"></div><button type="button" class="edit-btn cardadd" onclick="addCardRow(this)">＋ Add card / licence</button></div>`; }
function cardRowHtml(type,number,expiry,file){ return `<div class="cardrow-w" data-file="${esc(file||'')}">
  <div class="cardrow"><input class="cd-t" list="cardTypes" placeholder="Card / licence (e.g. CSCS, IPAF)" value="${esc(type||'')}"><input class="cd-n" placeholder="No. (optional)" value="${esc(number||'')}"><input class="cd-e" type="date" title="Expiry date" value="${expiry?String(expiry).slice(0,10):''}"><button type="button" class="crew-rm" title="Remove card" onclick="this.closest('.cardrow-w').remove()">✕</button></div>
  <div class="cardfile"><label class="filebtn">📎 <span>Attach copy</span><input type="file" class="cd-f" accept="image/*,application/pdf" style="display:none" onchange="cardFilePicked(this)"></label><span class="cd-fname">${file?`<a href="${esc(file)}" target="_blank" rel="noopener">📄 View current copy</a>`:'<span class="muted">No copy attached — photo or PDF of the card/cert</span>'}</span></div>
</div>`; }
function cardFilePicked(input){ const w=input.closest('.cardrow-w'); const f=input.files&&input.files[0]; const lbl=w&&w.querySelector('.cd-fname'); if(f&&lbl){ lbl.innerHTML='<span style="color:var(--cyan);font-weight:600">New: '+esc(f.name)+'</span>'; } }
function addCardTo(block,type,number,expiry,file){ const cw=block&&block.querySelector('.cardwrap'); if(cw) cw.insertAdjacentHTML('beforeend',cardRowHtml(type,number,expiry,file)); }
function addCardRow(btn){ addCardTo(btn.closest('.engblock'),'','','',''); }
function addEngRow(name,role,phone,cards){ const w=el('rosWrap'); if(!w) return; w.insertAdjacentHTML('beforeend',engBlockHtml(name,role,phone)); const block=w.lastElementChild; (Array.isArray(cards)?cards:[]).forEach(c=>addCardTo(block,c.type,c.number,c.expiry,c.file)); }
/* Async: uploads any newly-attached cert copies, then returns the roster JSON. */
async function collectRosterAsync(){
  const out=[];
  for(const b of [...document.querySelectorAll('#rosWrap .engblock')]){
    const name=b.querySelector('.eg-n').value.trim(); if(!name) continue;
    const role=b.querySelector('.eg-r').value.trim(), phone=b.querySelector('.eg-p').value.trim();
    const cards=[];
    for(const c of [...b.querySelectorAll('.cardrow-w')]){
      const type=c.querySelector('.cd-t').value.trim(); if(!type) continue;
      const number=c.querySelector('.cd-n').value.trim();
      const expiry=c.querySelector('.cd-e').value||null;
      let file=c.getAttribute('data-file')||'';
      const fi=c.querySelector('.cd-f');
      if(fi&&fi.files&&fi.files[0]){
        const f=fi.files[0];
        const ext=((f.name||'').split('.').pop()||'pdf').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,5)||'pdf';
        const sn=(name+'-'+type).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40);
        const u=await uploadBlob(f, `competency/${CLIENT.id}/${sn}_${Date.now()}.${ext}`, f.type);
        if(u) file=u;
      }
      cards.push({type,number,expiry,file:file||null});
    }
    out.push({name,role,phone,cards});
  }
  return out;
}
async function submitTeam(teamId){
  const name=val('t_name'); if(!name){ msg('Please give the team a name.','err'); return; }
  const btn=el('teamSave'); btn.disabled=true; btn.textContent='Uploading & saving…'; msg('','');
  const roster=await collectRosterAsync();
  const row={ client_id:CLIENT.id, name:name, color:val('t_color')||'#38bdf8', lead:val('t_lead')||null, region:val('t_region')||null, route_miles:num('t_miles'), roster:roster };
  const res = teamId ? await sb.from('teams').update(row).eq('id',teamId) : await sb.from('teams').insert(row);
  if(res.error){ btn.disabled=false; btn.textContent=teamId?'Save changes':'Add team'; msg('Could not save: '+res.error.message,'err'); return; }
  msg('✓ Saved.','ok'); await loadClientData(); setTimeout(()=>{ closeForm(); go('teams'); },500);
}
async function deleteTeam(teamId){
  const using=(DATA.sites||[]).filter(s=>s.team_id===teamId).length;
  const extra=using?`\n\n${using} site${using===1?'':'s'} currently use this team — they will be left unassigned (the sites are NOT deleted).`:'';
  if(!confirm('Delete this team? This cannot be undone.'+extra)) return;
  try{ await sb.from('sites').update({team_id:null}).eq('team_id',teamId); }catch(e){}
  const {error}=await sb.from('teams').delete().eq('id',teamId);
  if(error){ alert('Could not delete: '+error.message); return; }
  await loadClientData(); closeForm(); go('teams');
}
/* Draft install reports the current user can resume */
function installDraftsCard(){
  if(!canSubmit()) return '';
  const ds=(DATA.drafts||[]).filter(d=>d.report_type==='install');
  if(!ds.length) return '';
  return `<div class="card" style="margin-bottom:14px;border:1px solid var(--amber);background:linear-gradient(180deg,rgba(245,158,11,.07),transparent)">
    <h4 style="margin:0 0 8px">✍️ Your draft reports <span class="muted" style="font-weight:500;font-size:11px">· in progress — finish and submit when ready</span></h4>
    <div class="list">${ds.map(d=>{ const s=(DATA.sites||[]).find(x=>x.id===d.site_id)||{}; return `<div class="litem"><div class="bd"><div class="t">${esc(d.title||'Install report')}</div><div class="m">${esc(s.code||s.city||'No site yet')} · saved ${esc(rel(d.updated_at))}${Array.isArray(d.media)&&d.media.length?(' · '+d.media.length+' photo'+(d.media.length===1?'':'s')):''}</div></div><div class="when" style="white-space:nowrap"><button class="btn" style="padding:6px 12px" onclick="resumeInstallDraft('${d.id}')">Resume</button> <button class="edit-btn" onclick="discardDraft('${d.id}')">Discard</button></div></div>`; }).join('')}</div></div>`;
}
function pageInstalls(){
  const editor=isEditor(); const submit=canSubmit();
  const list=(DATA.progress||[]).slice().sort((a,b)=>new Date(b.report_date||b.submitted_at)-new Date(a.report_date||a.submitted_at));
  const mech=list.filter(r=>r.discipline==='Mechanical'||r.discipline==='Both');
  const elec=list.filter(r=>r.discipline==='Electrical'||r.discipline==='Both');
  const avg=arr=>arr.length?Math.round(arr.reduce((a,r)=>a+(Number(r.progress_pct)||0),0)/arr.length):0;
  const header=`<div class="sechead"><h3>🔩 Install Reports</h3><span class="sub">Daily mechanical &amp; electrical install progress — visible to the client</span><span class="line"></span>${submit?`<button class="edit-btn" onclick="openInstallForm()">＋ New install report</button>`:''}</div>`;
  const cards=`<div class="grid kpis" style="margin-bottom:14px">
    ${kpi('c','🔧','Mechanical — latest avg', (mech.length?avg(mech.slice(0,6)):0),'%')}
    ${kpi('a','⚡','Electrical — latest avg', (elec.length?avg(elec.slice(0,6)):0),'%')}
    ${kpi('g','🔩','Reports filed', list.length,'')}</div>`;
  const drafts = installDraftsCard();
  if(!list.length) return header+cards+drafts+emptyState('🔩','No install reports yet',editor?'Tap “New install report” to log today’s mechanical or electrical progress.':'Daily mechanical and electrical install updates will appear here.');
  const rows=list.map(r=>{
    const s=(DATA.sites||[]).find(x=>x.id===r.site_id)||{};
    const actions=`<td style="text-align:right;white-space:nowrap">${pdfCell('install',r)}${editor?` <button class="edit-btn" onclick="openInstallForm('${r.id}')">Edit</button> <button class="edit-btn" onclick="openMoveReport('install','${r.id}')" title="Move to the correct client">↪ Move</button>`:''}</td>`;
    return `<tr>
      <td class="muted" style="white-space:nowrap">${esc(String(r.report_date||r.submitted_at||'').slice(0,10))}</td>
      <td><span class="site-code">${esc(s.code||'—')}</span><div class="muted" style="font-size:11px">${esc(s.city||'')}</div></td>
      <td>${discChip(r.discipline)}</td>
      <td>${esc(r.engineer||'—')}</td>
      <td><div class="pcell"><div class="pbar ${Number(r.progress_pct)>=100?'green':'cyan'}"><i style="width:${Number(r.progress_pct)||0}%"></i></div><b>${Math.round(r.progress_pct||0)}%</b></div></td>
      <td>${planChip(r.plan_flag)}</td>
      <td>${esc(String(r.work_completed||'').slice(0,80))}${String(r.work_completed||'').length>80?'…':''}${(r.loto_permit||r.handback_signed)?`<div style="margin-top:4px">${r.loto_permit?'<span class="chip green" style="font-size:10px">LOTO/Permit ✓</span> ':''}${r.handback_signed?'<span class="chip green" style="font-size:10px">RME hand-back ✓</span>':''}</div>`:''}</td>
      ${actions}</tr>`;
  }).join('');
  return header+cards+drafts+`<div class="card"><table><thead><tr><th>Date</th><th>Site</th><th>Discipline</th><th>Engineer</th><th>Progress</th><th>Plan</th><th>Work completed</th><th>Report</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function openInstallForm(reportId, fromPick, draft){
  if(!CLIENT){ alert('Pick a client first.'); return; }
  CAPTURE={photos:[],videos:[],sig:null,gps:null};
  const r = reportId ? ((DATA.progress||[]).find(x=>x.id===reportId)||{}) : {};
  const siteOpts=`<option value="">— select site —</option>`+(DATA.sites||[]).map(s=>`<option value="${s.id}" ${s.id===r.site_id?'selected':''}>${esc(s.code||s.city||'Site')}${s.city?(' — '+esc(s.city)):''}</option>`).join('');
  const discOpts=DISCIPLINES.map(o=>`<option ${ (r.discipline||'Mechanical')===o?'selected':''}>${o}</option>`).join('');
  const flagOpts=`<option value="">—</option>`+PLAN_FLAGS.map(o=>`<option ${r.plan_flag===o?'selected':''}>${o}</option>`).join('');
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>${reportId?'Edit Install Report':'New Install Report'}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      ${engineerDatalist()}
      ${clientPickField('install', !!reportId || fromPick)}
      <div class="box see" style="background:var(--panel2);border:1px dashed var(--line2);border-radius:10px;padding:11px 13px;font-size:12.5px;color:var(--muted);margin-bottom:14px">Logs today’s mechanical or electrical install progress. This is shown to the client in their portal.</div>
      <div class="frow">
        <div class="fld"><label>Site <span class="req">*</span></label><select id="ir_site">${siteOpts}</select></div>
        <div class="fld"><label>Discipline <span class="req">*</span></label><select id="ir_disc">${discOpts}</select></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Engineer(s)</label>${engMultiField('ir_eng', r.engineer||PROFILE.full_name||'')}</div>
        <div class="fld"><label>Report date</label><input id="ir_date" type="date" value="${r.report_date?String(r.report_date).slice(0,10):new Date().toISOString().slice(0,10)}"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Progress % <span class="req">*</span></label><input id="ir_prog" type="number" min="0" max="100" value="${r.progress_pct!=null?r.progress_pct:0}"></div>
        <div class="fld"><label>Plan status</label><select id="ir_flag">${flagOpts}</select></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Planned days</label><input id="ir_pd" type="number" min="0" step="0.5" value="${r.planned_days!=null?r.planned_days:''}"></div>
        <div class="fld"><label>Actual days</label><input id="ir_ad" type="number" min="0" step="0.5" value="${r.actual_days!=null?r.actual_days:''}"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Hours worked</label><input id="ir_hours" type="number" min="0" step="0.5" value="${r.hours_worked!=null?r.hours_worked:''}"></div>
        <div class="fld"><label>Headcount on site</label><input id="ir_head" type="number" min="0" value="${r.headcount!=null?r.headcount:''}"></div>
      </div>
      <div class="fld"><label>Work completed today <span class="req">*</span></label><textarea id="ir_done" placeholder="What was installed / progressed today">${esc(r.work_completed||'')}</textarea></div>
      <div class="fld"><label>Materials / plant used</label><textarea id="ir_mat" placeholder="Key materials, equipment or plant on site">${esc(r.materials||'')}</textarea></div>
      <div class="fld"><label>Issues / delays</label><textarea id="ir_iss" placeholder="Anything holding progress up (records a delay reason)">${esc(r.issues||r.delay_reason||'')}</textarea></div>
      <div class="fld"><label>Planned for next visit</label><textarea id="ir_next" placeholder="Next steps">${esc(r.next_steps||'')}</textarea></div>
      ${isPipp()?`<div class="hr-sec" style="background:var(--panel2)"><h4>✅ Amazon RME safety confirmations <span class="muted" style="font-weight:500;font-size:11px">· Pipp only</span></h4>
        <div class="fld check-row"><input type="checkbox" id="ir_loto" ${r.loto_permit?'checked':''}><label style="margin:0">Amazon RME have <b>LOTO'd the equipment</b> and the <b>Permit is in place</b> prior to works starting</label></div>
        <div class="fld"><label>Permit / LOTO reference (optional)</label><input id="ir_lotoref" value="${esc(r.loto_ref||'')}" placeholder="e.g. permit number"></div>
        <div class="fld check-row" style="margin-top:6px"><input type="checkbox" id="ir_handback" ${r.handback_signed?'checked':''}><label style="margin:0">System <b>handed back and signed off by Amazon RME</b></label></div>
        <div class="fld"><label>Signed off by — Amazon RME (optional)</label><input id="ir_rme" value="${esc(r.rme_signoff||'')}" placeholder="RME name"></div>
      </div>`:''}
      <div class="fld"><label>Photos</label><div class="photos" id="photoWrap"><label class="photo-add">＋<input type="file" accept="image/*,video/*" multiple style="display:none" id="photoInput"></label></div></div>
    </div>
    <div class="modal-foot">
      ${reportId?`<button class="btn-ghost" style="color:var(--red)" onclick="deleteInstall('${reportId}')">Delete</button>`:''}
      <button class="btn-ghost" onclick="closeForm()">Cancel</button>
      ${!reportId?`<button class="btn-ghost" id="irDraft" onclick="saveInstallDraft(true)" title="Save what you have and finish later">💾 Save draft</button>`:''}
      <button class="btn" id="irSave" onclick="submitInstall(${reportId?`'${reportId}'`:'null'})">${reportId?'Save changes':'Post report'}</button>
    </div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap); setupPhoto();
  if(reportId&&Array.isArray(r.media_links)){ CAPTURE.existing=r.media_links.slice(); }
  // draft resume: prefill from a saved draft
  if(draft){ CAPTURE.draftId=draft.id; if(Array.isArray(draft.media)){ CAPTURE.existing=draft.media.slice(); renderThumbs(); } prefillInstallFromPayload(draft.payload||{}); }
  if(!reportId) startInstallAutosave();
}
/* draft helpers ---------------------------------------------------- */
function gatherInstallPayload(){
  return { site_id:val('ir_site')||null, discipline:val('ir_disc'), engineer:engMultiCollect('ir_eng')||null,
    report_date:val('ir_date')||null, progress_pct:num('ir_prog'), plan_flag:val('ir_flag')||null,
    planned_days:num('ir_pd'), actual_days:num('ir_ad'), hours_worked:num('ir_hours'), headcount:num('ir_head'),
    work_completed:val('ir_done')||null, materials:val('ir_mat')||null, issues:val('ir_iss')||null, next_steps:val('ir_next')||null,
    loto_permit: el('ir_loto')?el('ir_loto').checked:undefined, loto_ref:val('ir_lotoref')||null,
    handback_signed: el('ir_handback')?el('ir_handback').checked:undefined, rme_signoff:val('ir_rme')||null };
}
function prefillInstallFromPayload(p){
  const set=(id,v)=>{ const e=el(id); if(e&&v!=null) e.value=v; };
  set('ir_site',p.site_id); set('ir_disc',p.discipline); engMultiSet('ir_eng',p.engineer); set('ir_date',p.report_date);
  set('ir_prog',p.progress_pct); set('ir_flag',p.plan_flag); set('ir_pd',p.planned_days); set('ir_ad',p.actual_days);
  set('ir_hours',p.hours_worked); set('ir_head',p.headcount); set('ir_done',p.work_completed); set('ir_mat',p.materials);
  set('ir_iss',p.issues); set('ir_next',p.next_steps); set('ir_lotoref',p.loto_ref); set('ir_rme',p.rme_signoff);
  if(el('ir_loto')) el('ir_loto').checked=!!p.loto_permit;
  if(el('ir_handback')) el('ir_handback').checked=!!p.handback_signed;
}
function draftEmpty(p){ return !(p.work_completed||p.materials||p.issues||p.next_steps||p.site_id); }
let DRAFT_TIMER=null;
function startInstallAutosave(){ if(DRAFT_TIMER) clearInterval(DRAFT_TIMER); DRAFT_TIMER=setInterval(()=>{ try{ if(el('ir_done')) saveInstallDraft(false); }catch(e){} }, 20000); }
function stopInstallAutosave(){ if(DRAFT_TIMER){ clearInterval(DRAFT_TIMER); DRAFT_TIMER=null; } }
async function saveInstallDraft(explicit){
  if(!CLIENT || !SESSION) return;
  const p=gatherInstallPayload();
  if(draftEmpty(p) && !CAPTURE.draftId){ if(explicit) msg('Add some detail first, then save the draft.','err'); return; }
  const btn=el('irDraft'); if(explicit&&btn){ btn.disabled=true; btn.textContent='Saving…'; }
  // on an explicit save, persist any newly-taken photos so they survive too
  if(explicit && (CAPTURE.photos.length)){ try{ const base=`${CLIENT.slug}/install/DRAFT-${CAPTURE.draftId||Date.now()}`; for(let i=0;i<CAPTURE.photos.length;i++){ const u=await uploadDataUrl(CAPTURE.photos[i], `${base}/p${Date.now()}_${i}.jpg`); if(u){ CAPTURE.existing=(CAPTURE.existing||[]).concat([u]); } } CAPTURE.photos=[]; renderThumbs(); }catch(e){} }
  const title=(p.work_completed||'').slice(0,60) || 'Install report (draft)';
  const row={ created_by:SESSION.user.id, client_id:CLIENT.id, report_type:'install', site_id:p.site_id||null, title:title, payload:p, media:(CAPTURE.existing||[]), updated_at:new Date().toISOString() };
  try{
    if(CAPTURE.draftId){ await sb.from('report_drafts').update(row).eq('id',CAPTURE.draftId); }
    else { const {data,error}=await sb.from('report_drafts').insert(row).select().maybeSingle(); if(!error&&data) CAPTURE.draftId=data.id; }
    if(explicit){ msg('✓ Draft saved — resume it any time from Install Reports.','ok'); try{ await loadClientData(); }catch(e){} }
  }catch(e){ if(explicit) msg('Could not save draft: '+(e.message||e),'err'); }
  if(explicit&&btn){ btn.disabled=false; btn.textContent='💾 Save draft'; }
}
async function discardDraft(id){ if(!confirm('Discard this draft report? This cannot be undone.')) return; try{ await sb.from('report_drafts').delete().eq('id',id); }catch(e){ alert('Could not discard: '+(e.message||e)); return; } await loadClientData(); go('installs'); }
function resumeInstallDraft(id){ const d=(DATA.drafts||[]).find(x=>x.id===id); if(!d) return; openInstallForm(null,false,d); }
async function submitInstall(reportId){
  if(!val('f_client')){ msg('Please choose the client this report is for.','err'); const c=el('f_client'); if(c)c.focus(); return; }
  const sid=val('ir_site'); if(!sid){ msg('Please choose a site.','err'); return; }
  if(!val('ir_done')){ msg('Please note what was completed today.','err'); return; }
  const btn=el('irSave'); btn.disabled=true; btn.textContent='Saving…'; msg('','');
  const issues=val('ir_iss');
  const row={ client_id:CLIENT.id, site_id:sid, discipline:val('ir_disc'), engineer:engMultiCollect('ir_eng')||null,
    report_date:val('ir_date')||new Date().toISOString().slice(0,10), progress_pct:num('ir_prog')||0,
    plan_flag:val('ir_flag')||null, planned_days:num('ir_pd'), actual_days:num('ir_ad'),
    hours_worked:num('ir_hours'), headcount:num('ir_head'),
    work_completed:val('ir_done'), materials:val('ir_mat')||null, issues:issues||null,
    delay_reason:issues||null, next_steps:val('ir_next')||null };
  // Pipp-only confirmations (harmless for others; only added when present on the form)
  if(isPipp()){ row.loto_permit = el('ir_loto')?el('ir_loto').checked:null; row.loto_ref=val('ir_lotoref')||null; row.handback_signed = el('ir_handback')?el('ir_handback').checked:null; row.rme_signoff=val('ir_rme')||null; }
  const stripPipp=(o)=>{ const c=Object.assign({},o); delete c.loto_permit; delete c.loto_ref; delete c.handback_signed; delete c.rme_signoff; return c; };
  const schemaErr=(e)=>e && /find the '.*' column|schema cache|column .* does not exist/i.test(e.message||'');
  let savedId=reportId;
  if(reportId){ let {error}=await sb.from('progress_reports').update(row).eq('id',reportId);
    if(schemaErr(error)){ const r2=await sb.from('progress_reports').update(stripPipp(row)).eq('id',reportId); error=r2.error; }
    if(error){ btn.disabled=false; btn.textContent='Save changes'; msg('Could not save: '+error.message,'err'); return; } }
  else { row.submitted_at=new Date().toISOString();
    let {data:ins,error}=await sb.from('progress_reports').insert(row).select().maybeSingle();
    if(schemaErr(error)){ const r2=await sb.from('progress_reports').insert(stripPipp(row)).select().maybeSingle(); ins=r2.data; error=r2.error; }
    if(error){ btn.disabled=false; btn.textContent='Post report'; msg('Could not save: '+error.message,'err'); return; }
    savedId=ins?ins.id:null; }
  // photos & videos -> storage + media + link (best-effort, never blocks the save)
  if(CAPTURE.photos.length || (CAPTURE.videos||[]).length){ btn.textContent='Uploading media…'; const ref='INSTALL-'+(savedId||Date.now());
    const urls=await uploadCapture('install', savedId, `${CLIENT.slug}/install/${ref}`);
    if(urls.length&&savedId){ const merged=(CAPTURE.existing||[]).concat(urls); try{ await sb.from('progress_reports').update({media_links:merged}).eq('id',savedId); }catch(e){} }
  } else if((CAPTURE.existing||[]).length && savedId){ try{ await sb.from('progress_reports').update({media_links:CAPTURE.existing}).eq('id',savedId); }catch(e){} }
  // if this came from a draft, clear it now that it is submitted
  stopInstallAutosave();
  if(CAPTURE.draftId){ try{ await sb.from('report_drafts').delete().eq('id',CAPTURE.draftId); }catch(e){} CAPTURE.draftId=null; }
  msg('✓ Saved — the client portal now shows this update.','ok');
  if(!reportId) await notifyClient(CLIENT.id,'report','New install report added','installs','A new install progress report is on your dashboard.');
  await loadClientData(); setTimeout(()=>{ closeForm(); go('installs'); }, 700);
}
async function deleteInstall(reportId){
  if(!confirm('Delete this install report? This cannot be undone.')) return;
  const {error}=await sb.from('progress_reports').delete().eq('id',reportId);
  if(error){ alert('Could not delete: '+error.message); return; }
  await loadClientData(); closeForm(); go('installs');
}
function pageRisks(){
  if(!(DATA.risks||[]).length) return sectionH('Risk Register')+emptyState('✓','No risks logged','Risks raised from daily reports will appear here automatically.');
  const rows=DATA.risks.map(r=>{const s=DATA.sites.find(x=>x.id===r.site_id)||{};const lc=r.risk_level==='Critical'?'red':r.risk_level==='High'?'amber':r.risk_level==='Medium'?'cyan':'grey';return `<tr><td><span class="site-code">${esc(s.code||'—')}</span><div class="muted" style="font-size:11px">${esc(s.city||'')}</div></td><td>${esc(r.title||'')}</td><td><span class="chip ${lc}">${esc(r.risk_level||'')}</span></td><td>${esc(r.owner||'')}</td><td><span class="chip grey" style="background:var(--panel2)">${esc(r.status||'')}</span></td></tr>`;}).join('');
  return sectionH('Risk Register',`${rollups().openRisks.length} open`)+`<div class="card"><table><thead><tr><th>Site</th><th>Risk</th><th>Level</th><th>Owner</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function pageReports(){
  const feed=buildFeed();
  if(!feed.length) return sectionH('Field Reports')+emptyState('✓','No reports yet','Daily reports, call-outs and QA sign-offs submitted from site will appear here.');
  return sectionH('Field Reports','Daily · Call-out · QA — newest first')+`<div class="card"><div class="list">${feed.map(f=>`<div class="litem"><div class="av">${esc(f.who)}</div><div class="bd"><div class="t">${esc(f.title)}</div><div class="m">${esc(f.msg)}</div></div><div class="when">${esc(f.when)}</div></div>`).join('')}</div></div>`;
}
function pageQuality(){
  const R=rollups();
  return sectionH('Quality &amp; Handover','QA sign-off and handover status per site')+`<div class="row2">
    <div class="card"><h4>First-time QA pass rate</h4><div class="csub">Sites passing QA</div><div class="ringwrap">${ring(R.complete.length?100:0,'pass rate')}<div style="flex:1;min-width:200px"><div class="metrics"><div><b>${R.complete.length}</b><span>Signed off</span></div><div><b>${(DATA.qa||[]).length}</b><span>QA records</span></div><div><b>${R.active.length}</b><span>In pipeline</span></div></div></div></div></div>
    <div class="card"><h4>Handover Status</h4><div class="csub">Progress toward sign-off</div>${(DATA.sites||[]).length?`<div class="list">${(DATA.sites||[]).slice(0,8).map(s=>`<div class="litem" style="padding:10px 12px"><div class="bd"><div class="t">${flagEmoji[s.country]||''} ${esc(s.code||s.city)}</div><div class="pcell" style="margin-top:6px"><div class="pbar ${pbarClass(s.status)}"><i style="width:${Number(s.progress_pct)||0}%"></i></div><b>${Math.round(s.progress_pct||0)}%</b></div></div><div class="when"><span class="chip ${flagOf(s.status)}">${esc(s.status||'')}</span></div></div>`).join('')}</div>`:'<div class="empty"><div class="big">★</div><b>No sites yet</b></div>'}</div></div>`;
}

