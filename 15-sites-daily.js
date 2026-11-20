/* ===================================================================
   SITE EDITOR  —  add / edit / delete sites + crew (up to 12). Admin/engineer.
   =================================================================== */
const SITE_STATUSES=['Not Started','Mobilising','Live','At Risk','Delayed','Complete','Closed'];
const MAX_CREW=12;
const DISCIPLINES=['Mechanical','Electrical','Both'];
const PLAN_FLAGS=['On Track','At Risk','Over Plan'];
const CARD_TYPES=['CSCS','ECS','IPAF (MEWP) 3a','IPAF (MEWP) 3b','PASMA','CPCS','18th Edition (BS7671)','2391 Inspection & Testing','City & Guilds 2365','SSSTS','SMSTS','First Aid at Work','Asbestos Awareness','Confined Space','Manual Handling','PAT Testing','Gas Safe','F-Gas','Working at Height','Avetta / SafeContractor'];
function cardDatalist(){ return `<datalist id="cardTypes">${CARD_TYPES.map(c=>`<option value="${esc(c)}">`).join('')}</datalist>`; }
function cardStatus(expiry){ if(!expiry) return {c:'grey',label:''}; const d=(new Date(expiry)-Date.now())/86400000; if(isNaN(d)) return {c:'grey',label:''}; if(d<0) return {c:'red',label:'expired'}; if(d<60) return {c:'amber',label:'expiring'}; return {c:'green',label:''}; }
function discChip(d){ const c=d==='Electrical'?'amber':d==='Mechanical'?'cyan':'grey'; const i=d==='Electrical'?'⚡':d==='Mechanical'?'🔧':'🔩'; return `<span class="chip ${c}">${i} ${esc(d||'—')}</span>`; }
function planChip(p){ const c=p==='On Track'?'green':p==='At Risk'?'amber':p==='Over Plan'?'red':'grey'; return p?`<span class="chip ${c}">${esc(p)}</span>`:''; }
/* Permissions:
   - isEditor(): can MANAGE/edit/delete records — ADMINS ONLY.
   - canSubmit(): can ADD field reports (call-outs, shifts, install reports,
     check-ins) — admins AND engineers, in the internal view (never clients). */
function isEditor(){ return VIEW!=='client' && PROFILE.role==='admin'; }
function canSubmit(){ return VIEW!=='client' && (PROFILE.role==='admin' || PROFILE.role==='engineer'); }
/* canAddDocs(): who may UPLOAD documents/project files — admins (in any
   view, including "Preview as client") and clients (their own company only).
   Editing/deleting stays with admins. */
function canAddDocs(){ return PROFILE.role==='admin' || PROFILE.role==='client'; }
function crewRowHtml(n,r,p){ return `<div class="crewrow"><input class="cw-n" list="engList" placeholder="Engineer name" value="${esc(n||'')}"><input class="cw-r" placeholder="Role (e.g. Mech)" value="${esc(r||'')}"><input class="cw-p" placeholder="Phone" value="${esc(p||'')}"><button type="button" class="crew-rm" title="Remove" onclick="this.closest('.crewrow').remove();updateCrewCount()">✕</button></div>`; }
function addCrewRow(n,r,p){ const w=el('crewWrap'); if(!w) return; if(w.querySelectorAll('.crewrow').length>=MAX_CREW){return;} w.insertAdjacentHTML('beforeend',crewRowHtml(n,r,p)); updateCrewCount(); }
function updateCrewCount(){ const w=el('crewWrap'); if(!w) return; const n=w.querySelectorAll('.crewrow').length; const c=el('crewCount'); if(c)c.textContent=n+'/'+MAX_CREW; const b=el('crewAdd'); if(b){ b.disabled=n>=MAX_CREW; b.style.opacity=n>=MAX_CREW?.5:1; } }
function msRowHtml(title,date,done){ return `<div class="crewrow msrow"><input class="ms-t" placeholder="Milestone (e.g. 1st fix complete)" value="${esc(title||'')}" style="flex:2"><input class="ms-d" type="date" value="${date?String(date).slice(0,10):''}" style="flex:1"><label class="ms-done" style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);white-space:nowrap"><input class="ms-c" type="checkbox" ${done?'checked':''}> done</label><button type="button" class="crew-rm" title="Remove" onclick="this.closest('.crewrow').remove()">✕</button></div>`; }
function addMsRow(title,date,done){ const w=el('msWrap'); if(!w) return; w.insertAdjacentHTML('beforeend',msRowHtml(title,date,done)); }
function collectMilestones(){ return [...document.querySelectorAll('#msWrap .msrow')].map(r=>({title:r.querySelector('.ms-t').value.trim(),date:r.querySelector('.ms-d').value||null,done:r.querySelector('.ms-c').checked})).filter(m=>m.title); }

function openSiteForm(siteId){
  if(!CLIENT){ alert('Pick a client first.'); return; }
  const s = siteId ? (DATA.sites.find(x=>x.id===siteId)||{}) : {};
  const teamOpts = `<option value="">— unassigned —</option>`+(DATA.teams||[]).map(t=>`<option value="${t.id}" ${s.team_id===t.id?'selected':''}>${esc(t.name)}</option>`).join('');
  const statusOpts = SITE_STATUSES.map(o=>`<option ${ (s.status||'Not Started')===o?'selected':''}>${o}</option>`).join('');
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>${siteId?'Edit Site':'Add Site'} ${siteId?'· '+esc(s.code||s.city||''):''}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      ${engineerDatalist()}
      <div class="frow">
        <div class="fld"><label>Site code</label><input id="s_code" value="${esc(s.code||'')}" placeholder="e.g. DLZ1"></div>
        <div class="fld"><label>City</label><input id="s_city" value="${esc(s.city||'')}" placeholder="e.g. Rome"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Country</label><input id="s_country" value="${esc(s.country||'')}" placeholder="UK / IT / ES…"></div>
        <div class="fld"><label>Crew / Team</label><select id="s_team">${teamOpts}</select></div>
      </div>
      <div class="fld"><label>Address</label><input id="s_address" value="${esc(s.address||'')}" placeholder="Full site address"></div>
      <div class="frow">
        <div class="fld"><label>Status</label><select id="s_status">${statusOpts}</select></div>
        <div class="fld"><label>Progress %</label><input id="s_prog" type="number" min="0" max="100" value="${s.progress_pct!=null?s.progress_pct:0}"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Phase</label><input id="s_phase" type="number" min="1" value="${s.phase||1}"></div>
        <div class="fld"><label>Working hours</label><input id="s_hours" value="${esc(s.working_hours||'')}" placeholder="08:00–18:00"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Work days</label><input id="s_wd" type="number" min="0" value="${s.work_days!=null?s.work_days:''}"></div>
        <div class="fld"><label>Travel days</label><input id="s_td" type="number" min="0" value="${s.travel_days!=null?s.travel_days:''}"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Planned start</label><input id="s_start" type="date" value="${s.planned_start?String(s.planned_start).slice(0,10):''}"></div>
        <div class="fld"><label>Planned end</label><input id="s_end" type="date" value="${s.planned_end?String(s.planned_end).slice(0,10):''}"></div>
      </div>
      <div class="fld">
        <div class="crewhd"><label style="margin:0">Crew on this job <span id="crewCount" class="muted" style="font-weight:600"></span></label><button type="button" class="edit-btn" id="crewAdd" onclick="addCrewRow()">＋ Add engineer</button></div>
        <div id="crewWrap"></div>
        <div class="note">Up to ${MAX_CREW} engineers per site. Name, role and phone.</div>
      </div>
      <div class="fld">
        <div class="crewhd"><label style="margin:0">Schedule milestones</label><button type="button" class="edit-btn" id="msAdd" onclick="addMsRow()">＋ Add milestone</button></div>
        <div id="msWrap"></div>
        <div class="note">Key dates for this site (e.g. mobilise, 1st fix, 2nd fix, test &amp; commission, handover). Shown on the Schedule and to the client.</div>
      </div>
      <div class="fld"><label>Notes</label><textarea id="s_notes" placeholder="Any site notes">${esc(s.notes||'')}</textarea></div>
    </div>
    <div class="modal-foot">
      ${siteId?`<button class="btn-ghost" style="color:var(--red)" onclick="deleteSite('${siteId}')">Delete</button>`:''}
      <button class="btn-ghost" onclick="closeForm()">Cancel</button>
      <button class="btn" id="siteSave" onclick="submitSite(${siteId?`'${siteId}'`:'null'})">${siteId?'Save changes':'Add site'}</button>
    </div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
  (Array.isArray(s.crew)?s.crew:[]).forEach(c=>addCrewRow(c.name,c.role,c.phone));
  (Array.isArray(s.milestones)?s.milestones:[]).forEach(m=>addMsRow(m.title,m.date,m.done));
  updateCrewCount();
}
async function submitSite(siteId){
  const code=val('s_code'), city=val('s_city');
  if(!code && !city){ msg('Give the site at least a code or a city.','err'); return; }
  const btn=el('siteSave'); btn.disabled=true; btn.textContent='Saving…'; msg('','');
  const crew=[...document.querySelectorAll('#crewWrap .crewrow')].map(r=>({name:r.querySelector('.cw-n').value.trim(),role:r.querySelector('.cw-r').value.trim(),phone:r.querySelector('.cw-p').value.trim()})).filter(c=>c.name);
  const row={ client_id:CLIENT.id, code:code||null, city:city||null, country:val('s_country')||null, address:val('s_address')||null,
    team_id:val('s_team')||null, status:val('s_status'), progress_pct:num('s_prog')||0, phase:num('s_phase')||1,
    work_days:num('s_wd'), travel_days:num('s_td'), working_hours:val('s_hours')||null,
    planned_start:val('s_start')||null, planned_end:val('s_end')||null, crew:crew, milestones:collectMilestones(), notes:val('s_notes')||null };
  const res = siteId ? await sb.from('sites').update(row).eq('id',siteId) : await sb.from('sites').insert(row);
  if(res.error){ btn.disabled=false; btn.textContent=siteId?'Save changes':'Add site'; msg('Could not save: '+res.error.message,'err'); return; }
  msg('✓ Saved.','ok'); await loadClientData(); setTimeout(()=>{ closeForm(); go('sites'); },600);
}
async function deleteSite(siteId){
  if(!confirm('Delete this site? This permanently removes it and cannot be undone.')) return;
  const {error}=await sb.from('sites').delete().eq('id',siteId);
  if(error){ alert('Could not delete: '+error.message); return; }
  await loadClientData(); closeForm(); go('sites');
}

/* ===================================================================
   DAILY UPDATE  —  supervisor logs the day; updates the site &
   posts live to the client portal. (Admin/engineer/supervisor.)
   =================================================================== */
function openDailyUpdate(siteId){
  if(!CLIENT){ alert('Pick a client first.'); return; }
  CAPTURE={photos:[],videos:[],sig:null,gps:null};
  const siteOpts=`<option value="">— select site —</option>`+(DATA.sites||[]).map(s=>`<option value="${s.id}" ${s.id===siteId?'selected':''}>${esc(s.code||s.city||'Site')}${s.city?(' — '+esc(s.city)):''}</option>`).join('');
  const cur = siteId ? (DATA.sites.find(x=>x.id===siteId)||{}) : {};
  const statusOpts = SITE_STATUSES.map(o=>`<option ${ (cur.status||'Live')===o?'selected':''}>${o}</option>`).join('');
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>Daily Site Update</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      ${engineerDatalist()}
      <div class="box see" style="background:var(--panel2);border:1px dashed var(--line2);border-radius:10px;padding:11px 13px;font-size:12.5px;color:var(--muted);margin-bottom:14px">This updates the site's progress and posts a live update to the client's portal. Add photos to show the work.</div>
      <div class="frow">
        <div class="fld"><label>Site <span class="req">*</span></label><select id="du_site">${siteOpts}</select></div>
        <div class="fld"><label>Supervisor</label><input id="du_sup" list="engList" value="${esc(PROFILE.full_name||'')}"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Status</label><select id="du_status">${statusOpts}</select></div>
        <div class="fld"><label>Progress % today <span class="req">*</span></label><input id="du_prog" type="number" min="0" max="100" value="${cur.progress_pct!=null?cur.progress_pct:0}"></div>
      </div>
      <div class="fld"><label>Work completed today <span class="req">*</span></label><textarea id="du_done" placeholder="What was achieved on site today"></textarea></div>
      <div class="fld"><label>Planned for tomorrow</label><textarea id="du_tomorrow" placeholder="Next steps"></textarea></div>
      <div class="fld"><label>Blockers / issues</label><textarea id="du_block" placeholder="Anything holding things up (raises a risk automatically)"></textarea></div>
      <div class="frow">
        <div class="fld"><label>Hours worked</label><input id="du_hours" type="number" step="0.5" inputmode="decimal"></div>
        <div class="fld"><label>Report date</label><input id="du_date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
      </div>
      <div class="fld"><label>Photos</label><div class="photos" id="photoWrap"><label class="photo-add">＋<input type="file" accept="image/*,video/*" multiple style="display:none" id="photoInput"></label></div></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="duSave" onclick="submitDailyUpdate()">Post update</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap); setupPhoto();
}
async function submitDailyUpdate(){
  const sid=val('du_site'); if(!sid){ msg('Please choose a site.','err'); return; }
  if(!val('du_done')){ msg('Please note what was completed today.','err'); return; }
  const btn=el('duSave'); btn.disabled=true; btn.textContent='Posting…'; msg('','');
  const site=(DATA.sites||[]).find(x=>x.id===sid)||{};
  const prog=num('du_prog'); const status=val('du_status');
  const ref='PIPP-DAILY-'+Date.now();
  const row={ client_id:CLIENT.id, site_id:sid, report_date:val('du_date')||new Date().toISOString().slice(0,10),
    supervisor:val('du_sup'), status:status, progress_pct:prog, work_completed:val('du_done'),
    work_planned_tomorrow:val('du_tomorrow'), blockers:val('du_block'), hours_worked:num('du_hours'), submitted_at:new Date().toISOString() };
  const {data:ins,error}=await sb.from('daily_reports').insert(row).select().maybeSingle();
  if(error){ btn.disabled=false; btn.textContent='Post update'; msg('Could not post: '+error.message,'err'); return; }
  // update the site itself so dashboards + client portal reflect it
  try{ await sb.from('sites').update({progress_pct:prog!=null?prog:site.progress_pct, status:status}).eq('id',sid); }catch(e){}
  // photos & videos -> storage + media + link
  if(CAPTURE.photos.length || (CAPTURE.videos||[]).length){ btn.textContent='Uploading media…';
    const urls=await uploadCapture('daily', ins?ins.id:null, `${CLIENT.slug}/daily/${ref}`);
    if(urls.length){ try{ await sb.from('daily_reports').update({media_links:urls}).eq('id',ins.id); }catch(e){} }
  }
  // auto-raise a risk if there are blockers or the site is flagged
  if(val('du_block') || status==='Delayed' || status==='At Risk'){
    try{ await sb.from('risks').insert({client_id:CLIENT.id, site_id:sid, source_report_id:ins?ins.id:null,
      risk_level: status==='Delayed'?'High':'Medium', title:'Issue at '+(site.code||site.city||'site'),
      description: val('du_block')||('Site marked '+status), owner:'Programme Manager', status:'Open'}); }catch(e){}
  }
  msg('✓ Update posted — the client portal now shows '+ (prog!=null?prog+'%':'the latest')+'.','ok');
  await notifyClient(CLIENT.id,'report','New progress update'+(site.code?(' — '+site.code):''),'reports','A new site progress update is on your dashboard.');
  await loadClientData(); setTimeout(()=>{ closeForm(); go('sites'); }, 900);
}

