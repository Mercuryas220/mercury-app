/* ===================================================================
   SHIFT ROTA  —  plan engineers across custom shifts & days.
   Weekly grid (engineers x 7 days), client-visible, admin-editable.
   =================================================================== */
let ROTA_WEEK = mondayOf(new Date());
function mondayOf(d){ const x=new Date(d); const day=(x.getDay()+6)%7; x.setHours(0,0,0,0); x.setDate(x.getDate()-day); return x; }
/* LOCAL date formatting/parsing — avoids UTC off-by-one (e.g. in BST). */
function ymd(d){ const x=new Date(d); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); }
function parseYmd(s){ const p=String(s).slice(0,10).split('-').map(Number); return new Date(p[0],(p[1]||1)-1,p[2]||1); }
function jss(s){ return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
function rotaShiftEngineers(){ return [...new Set((DATA.teams||[]).flatMap(t=>Array.isArray(t.roster)?t.roster.map(e=>e&&e.name):[]).filter(Boolean).concat(DATA.engineers||[]))]; }
function rotaWeekDates(){ const a=[]; for(let i=0;i<7;i++){ const d=new Date(ROTA_WEEK); d.setDate(d.getDate()+i); a.push(d); } return a; }
function rotaMove(n){ ROTA_WEEK.setDate(ROTA_WEEK.getDate()+n*7); go('rota'); }
function rotaToday(){ ROTA_WEEK=mondayOf(new Date()); go('rota'); }
function pageRota(){
  const editor=isEditor();
  const week=rotaWeekDates(); const wk=week.map(ymd);
  const shifts=(DATA.rota||[]).filter(r=>wk.includes(String(r.shift_date||'').slice(0,10)));
  // engineers shown = those rostered to teams + any appearing in this week's rota
  let engs=[...new Set(rotaShiftEngineers().concat(shifts.map(s=>s.engineer).filter(Boolean)))].sort();
  const dayNames=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const todayStr=ymd(new Date());
  const controls=`<div class="rota-bar">
    <div class="rota-nav"><button class="edit-btn" onclick="rotaMove(-1)">‹ Prev</button><button class="edit-btn" onclick="rotaToday()">This week</button><button class="edit-btn" onclick="rotaMove(1)">Next ›</button></div>
    <div class="rota-range">${week[0].toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – ${week[6].toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</div>
    ${editor?`<div class="rota-actions"><button class="edit-btn" onclick="openShiftTypes()">⚙ Shift types</button> <button class="edit-btn" onclick="openPatternsList()">🗂 Patterns</button> <button class="edit-btn" onclick="openPatternFill()">⟳ Pattern fill</button> <button class="addbtn" onclick="openShiftForm()">＋ Add shift</button></div>`:''}
  </div>`;
  if(!engs.length){
    return sectionH('Shift Rota')+controls+emptyState('📆','No engineers to roster yet',editor?'Add engineers to a Team (Teams & Routes), then build the rota — or just tap “Add shift”.':'Your shift cover will appear here.');
  }
  // header row
  let head=`<th class="rota-eng">Engineer</th>`+week.map((d,i)=>`<th class="${ymd(d)===todayStr?'rota-today':''}">${dayNames[i]}<div class="rota-dnum">${d.getDate()}/${d.getMonth()+1}</div></th>`).join('');
  const cell=(eng,d)=>{
    const ds=ymd(d);
    const items=shifts.filter(s=>s.engineer===eng && String(s.shift_date||'').slice(0,10)===ds);
    const chips=items.map(s=>{
      const site=(DATA.sites||[]).find(x=>x.id===s.site_id);
      const tm=(s.start_time||s.end_time)?`<span class="rs-time">${esc((s.start_time||'').slice(0,5))}${s.end_time?('–'+esc(String(s.end_time).slice(0,5))):''}</span>`:'';
      const where=site?` · ${esc(site.code||site.city||'')}`:(s.notes?` · ${esc(String(s.notes).slice(0,12))}`:'');
      const click=editor?`onclick="openShiftForm('${s.id}')"`:'';
      return `<div class="rshift" ${click} style="background:${esc(s.color||'#38bdf8')}22;border-color:${esc(s.color||'#38bdf8')}66"><b>${esc(s.shift_name||'Shift')}</b>${tm}<span class="rs-where">${where}</span></div>`;
    }).join('');
    const add=editor?`<button class="radd" title="Add shift" onclick="openShiftForm(null,'${jss(eng)}','${ds}')">＋</button>`:'';
    return `<td class="rota-cell ${ds===todayStr?'rota-today':''}">${chips}${add}</td>`;
  };
  const engCell=eng=>`<td class="rota-eng"><span>${esc(eng)}</span>${editor?`<button class="reng-del" title="Remove this engineer from the rota" onclick="deleteEngineerShifts('${jss(eng)}')">✕</button>`:''}</td>`;
  const rows=engs.map(eng=>`<tr>${engCell(eng)}${week.map(d=>cell(eng,d)).join('')}</tr>`).join('');
  const legend=(DATA.shiftTypes||[]).length?`<div class="rota-legend">${(DATA.shiftTypes||[]).map(t=>`<span><i style="background:${esc(t.color||'#38bdf8')}"></i> ${esc(t.name)} ${t.start_time?`<span class="muted">${esc(String(t.start_time).slice(0,5))}–${esc(String(t.end_time||'').slice(0,5))}</span>`:''}</span>`).join('')}</div>`:'';
  return sectionH('Shift Rota','Plan cover across shifts &amp; days'+(VIEW==='client'?' · provided by Mercury':''))+controls+
    `<div class="card rota-card"><div class="rota-scroll"><table class="rota"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>${legend}</div>`;
}
/* ---- add / edit a single shift ---- */
function shiftTypeOptions(sel){ return `<option value="">— custom —</option>`+(DATA.shiftTypes||[]).map(t=>`<option value="${t.id}" ${sel===t.id?'selected':''}>${esc(t.name)}${t.start_time?` (${String(t.start_time).slice(0,5)}–${String(t.end_time||'').slice(0,5)})`:''}</option>`).join(''); }
function rotaEngOptions(sel){ return `<option value="">— select —</option>`+rotaShiftEngineers().sort().map(n=>`<option ${sel===n?'selected':''}>${esc(n)}</option>`).join(''); }
function openShiftForm(id, presetEng, presetDate){
  if(!CLIENT){ alert('Pick a client first.'); return; }
  const r=id?((DATA.rota||[]).find(x=>x.id===id)||{}):{};
  const siteOpts=`<option value="">— no specific site —</option>`+(DATA.sites||[]).map(s=>`<option value="${s.id}" ${s.id===r.site_id?'selected':''}>${esc(s.code||s.city||'Site')}</option>`).join('');
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal"><div class="modal-h"><h3>${id?'Edit Shift':'Add Shift'}</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      ${engineerDatalist()}
      <div class="frow">
        <div class="fld"><label>Engineer <span class="req">*</span></label><input id="sh_eng" list="engList" value="${esc(r.engineer||presetEng||'')}"></div>
        <div class="fld"><label>Date <span class="req">*</span></label><input id="sh_date" type="date" value="${r.shift_date?String(r.shift_date).slice(0,10):(presetDate||ymd(new Date()))}"></div>
      </div>
      <div class="fld"><label>Shift type</label><select id="sh_type" onchange="applyShiftType()">${shiftTypeOptions(r.shift_type_id)}</select></div>
      <div class="frow">
        <div class="fld"><label>Shift name <span class="req">*</span></label><input id="sh_name" value="${esc(r.shift_name||'')}" placeholder="e.g. Night"></div>
        <div class="fld"><label>Colour</label><input id="sh_color" type="color" value="${esc(r.color||'#38bdf8')}" style="height:42px;padding:4px"></div>
      </div>
      <div class="frow">
        <div class="fld"><label>Start</label><input id="sh_start" type="time" value="${esc((r.start_time||'').slice(0,5))}"></div>
        <div class="fld"><label>End</label><input id="sh_end" type="time" value="${esc((r.end_time||'').slice(0,5))}"></div>
      </div>
      <div class="fld"><label>Site (optional)</label><select id="sh_site">${siteOpts}</select></div>
      <div class="fld"><label>Notes</label><input id="sh_notes" value="${esc(r.notes||'')}" placeholder="optional"></div>
    </div>
    <div class="modal-foot">${id?`<button class="btn-ghost" style="color:var(--red)" onclick="deleteShift('${id}')">Delete</button>`:''}<button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="shSave" onclick="submitShift(${id?`'${id}'`:'null'})">${id?'Save':'Add shift'}</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div></div>`;
  document.body.appendChild(wrap);
}
function applyShiftType(){
  const id=val('sh_type'); const t=(DATA.shiftTypes||[]).find(x=>x.id===id); if(!t) return;
  if(el('sh_name')) el('sh_name').value=t.name||'';
  if(el('sh_start')) el('sh_start').value=(t.start_time||'').slice(0,5);
  if(el('sh_end')) el('sh_end').value=(t.end_time||'').slice(0,5);
  if(el('sh_color')) el('sh_color').value=t.color||'#38bdf8';
}
async function submitShift(id){
  const eng=val('sh_eng'), date=val('sh_date'), name=val('sh_name');
  if(!eng){ msg('Please choose an engineer.','err'); return; }
  if(!date){ msg('Please choose a date.','err'); return; }
  if(!name){ msg('Please give the shift a name.','err'); return; }
  const btn=el('shSave'); btn.disabled=true; btn.textContent='Saving…'; msg('','');
  const row={ client_id:CLIENT.id, engineer:eng, shift_date:date, shift_type_id:val('sh_type')||null,
    shift_name:name, start_time:val('sh_start')||null, end_time:val('sh_end')||null, color:val('sh_color')||'#38bdf8',
    site_id:val('sh_site')||null, notes:val('sh_notes')||null };
  const res=id?await sb.from('rota_shifts').update(row).eq('id',id):await sb.from('rota_shifts').insert(row);
  if(res.error){ btn.disabled=false; btn.textContent=id?'Save':'Add shift'; msg('Could not save: '+res.error.message,'err'); return; }
  msg('✓ Saved.','ok'); await loadClientData(); setTimeout(()=>{ closeForm(); go('rota'); },400);
}
async function deleteShift(id){
  if(!confirm('Remove this shift from the rota?')) return;
  const {error}=await sb.from('rota_shifts').delete().eq('id',id);
  if(error){ alert('Could not delete: '+error.message); return; }
  await loadClientData(); closeForm(); go('rota');
}
/* ---- patterns: list & delete a whole pattern at once ---- */
function rotaPatterns(){
  const groups={};
  (DATA.rota||[]).forEach(r=>{ if(!r.pattern_id) return; const g=groups[r.pattern_id]||(groups[r.pattern_id]={pid:r.pattern_id,engineer:r.engineer,shift_name:r.shift_name,site_id:r.site_id,count:0,min:r.shift_date,max:r.shift_date}); g.count++; if(r.shift_date<g.min)g.min=r.shift_date; if(r.shift_date>g.max)g.max=r.shift_date; });
  return Object.values(groups).sort((a,b)=>new Date(b.max)-new Date(a.max));
}
function openPatternsList(){
  const pats=rotaPatterns();
  const body=pats.length?pats.map(p=>{ const site=(DATA.sites||[]).find(x=>x.id===p.site_id);
    return `<div class="litem" style="padding:10px 12px"><div class="bd"><div class="t">${esc(p.engineer||'—')} · ${esc(p.shift_name||'Shift')}</div>
      <div class="m">${esc(String(p.min).slice(0,10))} → ${esc(String(p.max).slice(0,10))} · ${p.count} shift${p.count===1?'':'s'}${site?(' · '+esc(site.code||site.city||'')):''}</div></div>
      <div class="when"><button class="edit-btn" style="color:var(--red)" onclick="deleteShiftPattern('${p.pid}')">Delete pattern</button></div></div>`; }).join('')
    : '<div class="muted" style="padding:8px">No saved patterns yet. Use “Pattern fill” to create one — they’ll appear here so you can remove a whole run in one go.</div>';
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal"><div class="modal-h"><h3>Shift Patterns</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b"><div class="box see" style="background:var(--panel2);border:1px dashed var(--line2);border-radius:10px;padding:11px 13px;font-size:12.5px;color:var(--muted);margin-bottom:12px">Deleting a pattern removes every shift it created. Shifts you added by hand aren’t affected.</div><div class="list">${body}</div></div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Close</button></div></div>`;
  document.body.appendChild(wrap);
}
async function deleteEngineerShifts(eng){
  const n=(DATA.rota||[]).filter(r=>r.engineer===eng).length;
  if(!n){ alert('No shifts to remove for '+eng+'.'); return; }
  if(!confirm(`Remove ALL of ${eng}'s shifts from the rota? (${n} shift${n===1?'':'s'} across every week). This cannot be undone.`)) return;
  const {error}=await sb.from('rota_shifts').delete().eq('client_id',CLIENT.id).eq('engineer',eng);
  if(error){ alert('Could not delete: '+error.message); return; }
  await loadClientData(); go('rota');
}
async function deleteShiftPattern(pid){
  const n=(DATA.rota||[]).filter(r=>r.pattern_id===pid).length;
  if(!confirm(`Delete this whole pattern — ${n} shift${n===1?'':'s'}? This cannot be undone.`)) return;
  const {error}=await sb.from('rota_shifts').delete().eq('pattern_id',pid);
  if(error){ alert('Could not delete: '+error.message); return; }
  await loadClientData(); closeForm(); go('rota');
}
/* ---- manage shift types ---- */
function openShiftTypes(){
  const list=(DATA.shiftTypes||[]).map(t=>`<div class="litem" style="padding:9px 12px"><div class="bd"><div class="t"><span class="tdot" style="background:${esc(t.color||'#38bdf8')}"></span> ${esc(t.name)}</div><div class="m">${t.start_time?esc(String(t.start_time).slice(0,5))+'–'+esc(String(t.end_time||'').slice(0,5)):'no set time'}</div></div><div class="when"><button class="edit-btn" style="color:var(--red)" onclick="deleteShiftType('${t.id}')">Delete</button></div></div>`).join('')||'<div class="muted" style="padding:6px">No shift types yet.</div>';
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal"><div class="modal-h"><h3>Shift Types</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="list" style="margin-bottom:14px">${list}</div>
      <div class="sechead" style="margin:0 0 8px"><h4 style="margin:0">Add a shift type</h4><span class="line"></span></div>
      <div class="frow"><div class="fld"><label>Name <span class="req">*</span></label><input id="st_name" placeholder="e.g. Early / Late / Night"></div><div class="fld"><label>Colour</label><input id="st_color" type="color" value="#38bdf8" style="height:42px;padding:4px"></div></div>
      <div class="frow"><div class="fld"><label>Start</label><input id="st_start" type="time" value="06:00"></div><div class="fld"><label>End</label><input id="st_end" type="time" value="14:00"></div></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Close</button><button class="btn" id="stSave" onclick="addShiftType()">＋ Add type</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div></div>`;
  document.body.appendChild(wrap);
}
async function addShiftType(){
  const name=val('st_name'); if(!name){ msg('Give the shift type a name.','err'); return; }
  const btn=el('stSave'); btn.disabled=true; btn.textContent='Adding…';
  const {error}=await sb.from('shift_types').insert({client_id:CLIENT.id, name:name, start_time:val('st_start')||null, end_time:val('st_end')||null, color:val('st_color')||'#38bdf8'});
  if(error){ btn.disabled=false; btn.textContent='＋ Add type'; msg('Could not add: '+error.message,'err'); return; }
  await loadClientData(); closeForm(); openShiftTypes();
}
async function deleteShiftType(id){
  if(!confirm('Delete this shift type? (Shifts already on the rota are not removed.)')) return;
  const {error}=await sb.from('shift_types').delete().eq('id',id);
  if(error){ alert('Could not delete: '+error.message); return; }
  await loadClientData(); closeForm(); openShiftTypes();
}
/* ---- pattern auto-fill ---- */
function openPatternFill(){
  if(!CLIENT){ alert('Pick a client first.'); return; }
  const dows=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal"><div class="modal-h"><h3>Pattern Fill</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      ${engineerDatalist()}
      <div class="box see" style="background:var(--panel2);border:1px dashed var(--line2);border-radius:10px;padding:11px 13px;font-size:12.5px;color:var(--muted);margin-bottom:14px">Create the same shift across a date range. Choose specific weekdays, or an on/off cycle (e.g. 4 on, 4 off).</div>
      <div class="frow">
        <div class="fld"><label>Engineer <span class="req">*</span></label><input id="pf_eng" list="engList" placeholder="Engineer name"></div>
        <div class="fld"><label>Shift type <span class="req">*</span></label><select id="pf_type">${shiftTypeOptions()}</select></div>
      </div>
      <div class="fld"><label>Site (optional — applied to every shift)</label><select id="pf_site"><option value="">— no specific site —</option>${(DATA.sites||[]).map(s=>`<option value="${s.id}">${esc(s.code||s.city||'Site')}</option>`).join('')}</select></div>
      <div class="frow">
        <div class="fld"><label>From <span class="req">*</span></label><input id="pf_from" type="date" value="${ymd(ROTA_WEEK)}"></div>
        <div class="fld"><label>To <span class="req">*</span></label><input id="pf_to" type="date" value="${ymd(new Date(ROTA_WEEK.getTime()+27*86400000))}"></div>
      </div>
      <div class="fld"><label>Pattern</label><select id="pf_mode" onchange="pfModeChange()"><option value="weekdays">Specific weekdays</option><option value="cycle">On / off cycle</option></select></div>
      <div class="fld" id="pf_weekdays"><label>Days</label><div class="rota-dows">${dows.map((d,i)=>`<label class="dow"><input type="checkbox" class="pf_dow" value="${i}" ${i<5?'checked':''}> ${d}</label>`).join('')}</div></div>
      <div class="frow" id="pf_cycle" style="display:none">
        <div class="fld"><label>Days ON</label><input id="pf_on" type="number" min="1" value="4"></div>
        <div class="fld"><label>Days OFF</label><input id="pf_off" type="number" min="0" value="4"></div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="pfSave" onclick="runPatternFill()">Create shifts</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div></div>`;
  document.body.appendChild(wrap);
}
function pfModeChange(){ const m=val('pf_mode'); el('pf_weekdays').style.display=m==='weekdays'?'':'none'; el('pf_cycle').style.display=m==='cycle'?'flex':'none'; }
async function runPatternFill(){
  const eng=val('pf_eng'), typeId=val('pf_type'), from=val('pf_from'), to=val('pf_to'), mode=val('pf_mode');
  if(!eng){ msg('Choose an engineer.','err'); return; }
  if(!typeId){ msg('Choose a shift type.','err'); return; }
  if(!from||!to){ msg('Choose a date range.','err'); return; }
  const t=(DATA.shiftTypes||[]).find(x=>x.id===typeId); if(!t){ msg('Shift type not found.','err'); return; }
  const start=parseYmd(from), end=parseYmd(to);
  if(end<start){ msg('“To” must be after “From”.','err'); return; }
  const dows=[...document.querySelectorAll('.pf_dow:checked')].map(c=>Number(c.value));
  const onN=num('pf_on')||0, offN=num('pf_off')||0;
  const pid=(self.crypto&&crypto.randomUUID)?crypto.randomUUID():('pat-'+Date.now()+'-'+Math.random().toString(36).slice(2,8));
  const siteId=val('pf_site')||null;
  const rows=[]; let idx=0;
  for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)){
    let include=false;
    if(mode==='weekdays'){ include=dows.includes((d.getDay()+6)%7); }
    else { const cyc=onN+offN; include = cyc>0 ? (idx%cyc)<onN : false; idx++; }
    if(include) rows.push({ client_id:CLIENT.id, engineer:eng, shift_date:ymd(d), shift_type_id:typeId,
      shift_name:t.name, start_time:t.start_time||null, end_time:t.end_time||null, color:t.color||'#38bdf8',
      site_id:siteId, pattern_id:pid });
  }
  if(!rows.length){ msg('That pattern produced no shifts — check your selection.','err'); return; }
  if(rows.length>400){ msg('That would create '+rows.length+' shifts — please narrow the range.','err'); return; }
  const btn=el('pfSave'); btn.disabled=true; btn.textContent=`Creating ${rows.length}…`;
  const {error}=await sb.from('rota_shifts').insert(rows);
  if(error){ btn.disabled=false; btn.textContent='Create shifts'; msg('Could not create: '+error.message,'err'); return; }
  msg(`✓ Created ${rows.length} shifts.`,'ok'); await loadClientData(); setTimeout(()=>{ closeForm(); go('rota'); },500);
}
function pageTeams(){
  const editor=isEditor();
  const teams=DATA.teams||[];
  const header=`<div class="sechead"><h3>Teams &amp; Routes</h3><span class="sub">${teams.length} crew${teams.length===1?'':'s'}</span><span class="line"></span>${editor?`<button class="edit-btn" onclick="openTeamForm()">＋ Add team</button>`:''}</div>`;
  if(!teams.length) return header+emptyState('⛺','No teams yet',editor?'Tap “Add team” to create your first crew for this client.':'No teams for this client yet.');
  const cards=teams.map(t=>{
    const ts=DATA.sites.filter(s=>s.team_id===t.id);
    const done=ts.filter(s=>s.status==='Complete').length;
    const live=ts.find(s=>['Live','At Risk','Delayed','Mobilising'].includes(s.status));
    const roster=Array.isArray(t.roster)?t.roster:[];
    const engHtml = roster.length ? `<div class="eng-disp"><span class="meta" style="display:block;margin:0 0 4px"><span>Engineers</span><b>${roster.length}</b></span>${roster.map(e=>`
        <div class="eng-disp"><div class="nm">${esc(e.name)}${e.role?` <span class="muted" style="font-weight:500">· ${esc(e.role)}</span>`:''}</div>
        <div class="eng-cards">${(e.cards||[]).length?(e.cards||[]).map(c=>{const st=cardStatus(c.expiry);return `<span class="chip ${st.c}" title="${esc(c.number?('No. '+c.number):'')}${c.expiry?(' · expires '+String(c.expiry).slice(0,10)):''}">${esc(c.type)}${st.label?` · ${st.label}`:''}${c.file?` <a href="${esc(c.file)}" target="_blank" rel="noopener" class="cardview" title="View uploaded copy">📄</a>`:''}</span>`;}).join(''):'<span class="muted" style="font-size:11px">No cards recorded</span>'}</div></div>`).join('')}</div>` : (editor?`<div class="eng-disp muted" style="font-size:12px">No engineers yet — tap Edit to add names &amp; competency cards.</div>`:'');
    return `<div class="teamcard"><div class="th"><div class="nm"><span class="tdot" style="background:${esc(t.color||'#38bdf8')}"></span>${esc(t.name)}</div>${editor?`<button class="edit-btn" onclick="openTeamForm('${t.id}')">Edit</button>`:`<span class="chip ${live?'cyan':'green'}">${live?'On site':'Standby'}</span>`}</div>
      <div class="meta"><span>Route</span><b>${esc(t.region||'—')}</b></div>
      <div class="meta"><span>Lead</span><b>${esc(t.lead||'—')}</b></div>
      <div class="meta"><span>Sites</span><b>${done}/${ts.length} done</b></div>
      <div class="meta"><span>Route distance</span><b>${t.route_miles?Number(t.route_miles).toLocaleString()+' mi':'—'}</b></div>
      <div class="meta"><span>Currently</span><b>${live?(flagEmoji[live.country]||'')+' '+esc(live.city):'—'}</b></div>
      ${engHtml}</div>`;
  }).join('');
  return header+engineerRegister()+agencyOnSiteCard()+`<div class="teamgrid">${cards}</div>`;
}
/* Admin-only card: agency engineers assigned to this client, ready to be
   placed into (or moved between) internal teams. Clients never see this. */
function agencyOnSiteCard(){
  if(!(PROFILE.role==='admin' && VIEW!=='client' && CLIENT)) return '';
  const ps=(PLACEMENTS||[]).filter(p=>p.client_id===CLIENT.id);
  if(!ps.length) return '';
  const teams=DATA.teams||[];
  const rows=ps.map(p=>{
    const eng=(SDATA.engineers||[]).find(e=>e.id===p.engineer_id)||{};
    const sup=(SUPPLIERS||[]).find(s=>s.id===p.supplier_id);
    const cur=p.team_id?teamName(p.team_id):'';
    const sel=`<select id="plc_${p.id}"><option value="">— choose team —</option>${teams.map(t=>`<option value="${t.id}" ${p.team_id===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select>`;
    return `<tr><td><b>${esc(p.engineer_name)}</b>${eng.trade?`<div class="muted" style="font-size:11px">${esc(eng.trade)}</div>`:''}</td>
      <td><span class="chip grey" style="font-size:10px">${esc(sup?sup.name:'Agency')}</span></td>
      <td>${p.team_id?`<span class="chip green">${esc(cur||'Placed')}</span>`:'<span class="chip amber">Not placed</span>'}</td>
      <td>${teams.length?sel:'<span class="muted" style="font-size:11px">No teams yet</span>'}</td>
      <td style="white-space:nowrap">${teams.length?`<button class="btn" style="padding:5px 10px" onclick="placeAgency('${p.id}')">${p.team_id?'Move':'Place'}</button>`:''}${p.team_id?` <button class="edit-btn" onclick="unplaceAgency('${p.id}')">Remove</button>`:''}</td></tr>`;
  }).join('');
  return `<div class="card" style="margin-bottom:16px;border:1px solid var(--line2)"><h4>🚚 Agency engineers on site <span class="muted" style="font-weight:500;font-size:11px">· admin only — clients never see this</span></h4>
    <div class="csub" style="margin-bottom:8px">Assigned from an agency for this client. Drop them into a team and they appear to the client as a Mercury engineer.</div>
    <div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Engineer</th><th>Agency</th><th>Team</th><th>Place / move</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
async function placeAgency(placementId){ const sel=el('plc_'+placementId); const teamId=sel?sel.value:''; if(!teamId){ alert('Choose a team first.'); return; } await syncAgencyPlacement(placementId, teamId); }
async function unplaceAgency(placementId){ if(!confirm('Remove this agency engineer from the team? They stay assigned to the job.')) return; await syncAgencyPlacement(placementId, null); }
async function syncAgencyPlacement(placementId, teamId){
  const p=(PLACEMENTS||[]).find(x=>x.id===placementId); if(!p) return;
  const eng=(SDATA.engineers||[]).find(e=>e.id===p.engineer_id)||{};
  // roster entry the client sees: name, role, competency cards ONLY (no supplier/travel data)
  const entry={ name:p.engineer_name, role:eng.trade||'', phone:eng.phone||'', cards:(Array.isArray(eng.cards)?eng.cards.map(c=>({type:c.type||'',number:c.number||'',expiry:c.expiry||null,file:c.file||null})):[]) };
  const key=String(p.engineer_name||'').trim().toLowerCase();
  try{
    for(const t of (DATA.teams||[])){
      const ros=Array.isArray(t.roster)?t.roster:[];
      let nros=ros.filter(r=>String(r.name||'').trim().toLowerCase()!==key);
      if(teamId && t.id===teamId) nros=nros.concat([entry]);
      if(nros.length!==ros.length || (teamId && t.id===teamId)){ const up=await sb.from('teams').update({roster:nros}).eq('id',t.id); if(up.error) throw up.error; }
    }
    const upd=await sb.from('agency_placement').update({team_id:teamId||null}).eq('id',placementId); if(upd.error) throw upd.error;
  }catch(e){ alert('Could not update placement: '+(e.message||e)); return; }
  await loadClientData(); await loadSuppliers(); if(CURRENT==='teams') go('teams');
}
/* Consolidated register of every engineer across this client's crews,
   with their skills/roles and all competency cards (incl. uploaded copies). */
function allEngineers(){
  const map={};
  (DATA.teams||[]).forEach(t=>(Array.isArray(t.roster)?t.roster:[]).forEach(e=>{
    if(!e||!e.name) return;
    const key=e.name.trim().toLowerCase();
    const cur=map[key]||(map[key]={name:e.name.trim(),role:e.role||'',phone:e.phone||'',teams:new Set(),cards:{}});
    if(e.role&&!cur.role) cur.role=e.role;
    if(e.phone&&!cur.phone) cur.phone=e.phone;
    if(t.name) cur.teams.add(t.name);
    (e.cards||[]).forEach(c=>{ if(!c||!c.type) return; const ck=c.type.trim().toLowerCase(); const ex=cur.cards[ck];
      if(!ex || (c.file&&!ex.file) || (c.expiry&&(!ex.expiry||String(c.expiry)>String(ex.expiry)))) cur.cards[ck]=c; });
  }));
  return Object.values(map).sort((a,b)=>a.name.localeCompare(b.name));
}
function engHrKey(name){ return String(name||'').trim().toLowerCase(); }
function engHrFor(name){ return (ENGHR||[]).find(h=>h.engineer_key===engHrKey(name))||null; }
function engineerRegister(){
  const engs=allEngineers();
  if(!engs.length) return '';
  const isAdm = PROFILE.role==='admin' && VIEW!=='client';   // sensitive column: admins only, never in client preview
  const totalCards=engs.reduce((a,e)=>a+Object.keys(e.cards).length,0);
  const rows=engs.map(e=>{
    const cards=Object.values(e.cards);
    const chips=cards.length?cards.map(c=>{const st=cardStatus(c.expiry);return `<span class="chip ${st.c}" title="${esc(c.number?('No. '+c.number):'')}${c.expiry?(' · expires '+String(c.expiry).slice(0,10)):''}">${esc(c.type)}${st.label?` · ${st.label}`:''}${c.file?` <a href="${esc(c.file)}" target="_blank" rel="noopener" class="cardview" title="View uploaded copy">📄</a>`:''}</span>`;}).join(' '):'<span class="muted" style="font-size:11px">No cards recorded</span>';
    let hrCell='';
    if(isAdm){ const h=engHrFor(e.name); const has=!!h; const bits=[]; if(h){ if(h.nok_name) bits.push('NOK'); if(h.a1_status&&h.a1_status!=='Not required') bits.push('A1'); if(h.passport_number||h.passport_file) bits.push('Passport'); }
      const ap=placementFor(e.name, CLIENT?CLIENT.id:null);
      hrCell=`<td>${ap?'<span class="chip grey" style="font-size:10px" title="Agency-supplied engineer">Agency</span> ':''}${has?`<span class="chip green" style="font-size:10px">${bits.length?bits.join(' · '):'on file'}</span> `:''}<button class="edit-btn" onclick="openEngHr('${jss(e.name)}')">🔒 Safety &amp; travel</button>${(SUPPLIERS&&SUPPLIERS.length&&!ap)?` <button class="edit-btn" onclick="openMoveToAgency('${jss(e.name)}')" title="This engineer is agency supply — move their record to a supplier">→ Agency</button>`:''}</td>`; }
    return `<tr><td><b>${esc(e.name)}</b>${e.phone?`<div class="muted" style="font-size:11px">${esc(e.phone)}</div>`:''}</td>
      <td>${esc(e.role||'—')}</td>
      <td>${[...e.teams].map(t=>`<span class="chip grey">${esc(t)}</span>`).join(' ')||'—'}</td>
      <td><div class="eng-cards">${chips}</div></td>${hrCell}</tr>`;
  }).join('');
  return `<div class="card" style="margin-bottom:16px"><h4>👷 Engineers &amp; Competencies</h4><div class="csub">${engs.length} engineer${engs.length===1?'':'s'} · ${totalCards} skill${totalCards===1?'':'s'}/card${totalCards===1?'':'s'} on record · tap 📄 to view an uploaded copy of a cert or skill card${isAdm?' · 🔒 Safety &amp; travel is private to Mercury admins':''}</div>
    <table><thead><tr><th>Engineer</th><th>Role / skill</th><th>Team(s)</th><th>Competency cards &amp; certs</th>${isAdm?'<th>Private (admin only)</th>':''}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
/* Admin-only editor for a Mercury engineer's sensitive HR / travel details */
function openEngHr(name){
  if(PROFILE.role!=='admin'){ return; }
  const h=engHrFor(name)||{};
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>🔒 ${esc(name)} — safety &amp; travel</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="frow"><div class="fld"><label>Email</label><input id="h_email" value="${esc(h.email||'')}" placeholder="Optional"></div>
      <div class="fld"><label>Phone</label><input id="h_phone" value="${esc(h.phone||'')}" placeholder="Optional"></div></div>
      ${hrFieldsHtml('h',h,'')}
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="hrSave" onclick="submitEngHr('${jss(name)}')">Save details</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
async function submitEngHr(name){
  const btn=el('hrSave'); btn.disabled=true; btn.textContent='Saving…'; msg('Uploading…','');
  const hr=await collectHrFields('h','team/hr',name);
  const existing=engHrFor(name);
  const reg=engRegFor(name);
  const row=Object.assign({ engineer_key:engHrKey(name), full_name:name, engineer_id:(reg?reg.id:null), email:val('h_email')||null, phone:val('h_phone')||null, updated_at:new Date().toISOString() }, hr);
  let res;
  if(existing){ res=await sb.from('engineer_hr').update(row).eq('id',existing.id); }
  else { res=await sb.from('engineer_hr').insert(row); }
  if(res.error){ btn.disabled=false; btn.textContent='Save details'; msg('Could not save: '+res.error.message,'err'); return; }
  msg('✓ Saved securely.','ok'); await loadEngHr(); setTimeout(()=>{ closeForm(); if(CURRENT==='teams') go('teams'); }, 700);
}
/* Move an internal-team engineer's record across to an agency (supplier).
   Copies their details + cards + safety/travel data to the supplier, then
   removes them from this client's team roster and clears the internal HR row. */
function openMoveToAgency(name){
  if(PROFILE.role!=='admin') return;
  if(!SUPPLIERS||!SUPPLIERS.length){ alert('Add a supplier first.'); return; }
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal" style="max-width:520px">
    <div class="modal-h"><h3>Move ${esc(name)} to an agency</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="box see" style="background:var(--panel2);border:1px dashed var(--line2);border-radius:10px;padding:11px 13px;font-size:12.5px;color:var(--muted);margin-bottom:14px">This copies ${esc(name)}&rsquo;s trade, cards and safety/travel details to the chosen supplier, then removes them from this client&rsquo;s internal team and clears their internal HR record. Clients still just see the name on site — they are never told the engineer is agency.</div>
      <div class="fld"><label>Agency / supplier <span class="req">*</span></label><select id="mv_sup">${SUPPLIERS.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="mvSave" onclick="submitMoveToAgency('${jss(name)}')">→ Move to agency</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
async function submitMoveToAgency(name){
  const sid=val('mv_sup'); if(!sid){ msg('Choose a supplier.','err'); return; }
  const btn=el('mvSave'); btn.disabled=true; btn.textContent='Moving…'; msg('','');
  const eng=allEngineers().find(e=>e.name===name)||{name:name,role:'',phone:'',cards:{}};
  const cards=Object.values(eng.cards||{}).map(c=>({type:c.type||'',number:c.number||'',expiry:c.expiry||null,file:c.file||null}));
  const hr=engHrFor(name)||{};
  const row={ supplier_id:sid, full_name:name, trade:eng.role||null, phone:hr.phone||eng.phone||null, email:hr.email||null, rtw_status:'Not checked', status:'Approved', cards:cards,
    home_address:hr.home_address||null, date_of_birth:hr.date_of_birth||null, nationality:hr.nationality||null,
    nok_name:hr.nok_name||null, nok_relationship:hr.nok_relationship||null, nok_phone:hr.nok_phone||null,
    a1_status:hr.a1_status||null, a1_expiry:hr.a1_expiry||null, a1_file:hr.a1_file||null,
    medical_provider:hr.medical_provider||null, medical_number:hr.medical_number||null, medical_expiry:hr.medical_expiry||null, medical_file:hr.medical_file||null,
    passport_number:hr.passport_number||null, passport_expiry:hr.passport_expiry||null, passport_file:hr.passport_file||null,
    hr_notes:hr.hr_notes||null };
  try{
    const ins=await sb.from('supplier_engineers').insert(row);
    if(ins.error) throw ins.error;
    // remove from every team roster of the current client
    const key=String(name).trim().toLowerCase();
    for(const t of (DATA.teams||[])){
      const ros=Array.isArray(t.roster)?t.roster:[];
      if(ros.some(r=>r&&String(r.name||'').trim().toLowerCase()===key)){
        const nros=ros.filter(r=>!(r&&String(r.name||'').trim().toLowerCase()===key));
        const up=await sb.from('teams').update({roster:nros}).eq('id',t.id);
        if(up.error) throw up.error;
      }
    }
    // clear the internal HR record (data now lives with the supplier)
    if(hr.id){ await sb.from('engineer_hr').delete().eq('id',hr.id); }
  }catch(e){ btn.disabled=false; btn.textContent='→ Move to agency'; msg('Could not move: '+(e.message||e),'err'); return; }
  msg('✓ Moved to the agency.','ok');
  await loadClientData(); await loadSuppliers(); await loadEngHr();
  setTimeout(()=>{ closeForm(); if(CURRENT==='teams') go('teams'); }, 800);
}
