/* ===================================================================
   COMMAND CENTRE  —  live ops: SLA timers, map, today board, check-in
   =================================================================== */
const SLA_HOURS={'Priority 1':4,'Priority 2':8,'Priority 3':24,'Priority 4':72};
function isOpenCallout(r){ const s=String(r.status||'').toLowerCase(); return !(s.includes('complete')||s.includes('closed')); }
function slaState(r){
  const tgt=SLA_HOURS[r.priority]||24;
  const start=new Date(r.submitted_at||r.call_date||Date.now()).getTime();
  const deadline=start+tgt*3600*1000;
  const remMs=deadline-Date.now();
  const remH=remMs/3600000;
  let cls='ok', label;
  if(remMs<0){ cls='breach'; label='BREACHED '+fmtDur(-remMs)+' ago'; }
  else { if(remH<=tgt*0.25) cls='warn'; label=fmtDur(remMs)+' left'; }
  return {cls,label,tgt};
}
function fmtDur(ms){ const h=Math.floor(ms/3600000), m=Math.floor((ms%3600000)/60000); if(h>=24){const d=Math.floor(h/24);return d+'d '+(h%24)+'h';} return h>0?(h+'h '+m+'m'):(m+'m'); }

function pageCommand(){
  const opens=(DATA.callouts||[]).filter(isOpenCallout);
  const ranked=opens.map(r=>({r,s:slaState(r)})).sort((a,b)=>{
    const order={breach:0,warn:1,ok:2}; return order[a.s.cls]-order[b.s.cls];
  });
  const breaches=ranked.filter(x=>x.s.cls==='breach').length;
  const p1=opens.filter(r=>r.priority==='Priority 1').length;
  const today=new Date().toISOString().slice(0,10);
  const reportsToday=[...(DATA.callouts||[]),...(DATA.shifts||[]),...(DATA.daily||[])].filter(r=>String(r.submitted_at||'').slice(0,10)===today).length;
  const geoPts=geoPoints();
  const k=`<div class="grid kpis">
    ${kpi('c','🔧','Open Call-Outs',opens.length,'')}
    ${kpi(breaches?'r':'g','⏱','SLA Breaches',breaches,'')}
    ${kpi(p1?'r':'g','🚨','Priority 1 Open',p1,'')}
    ${kpi('c','📍','Located Activity',geoPts.length,'')}
    ${kpi('v','✓','Reports Today',reportsToday,'')}</div>`;
  const slaList = ranked.length
    ? ranked.map(({r,s})=>`<div class="sla ${s.cls}"><div class="ref">${esc(r.job_number||'—')}</div>
        <div class="bd"><div class="t">${esc(String(r.fault_description||'').slice(0,70)||'Call-out')}</div>
        <div class="m">${esc(r.priority||'')} · ${esc(r.engineer||'unassigned')} · ${esc(r.status||'')}</div></div>
        <div class="timer">${priChip(r.priority)}<br>${s.label}</div></div>`).join('')
    : '<div class="empty"><div class="big">✅</div><b>No open call-outs</b><div style="font-size:13px;margin-top:4px">All clear for this client.</div></div>';
  return `<div class="sechead"><h3>🛰 Command Centre</h3><span class="sub">${esc(CLIENT.name)} · live</span><span class="line"></span><button class="checkin" onclick="checkIn()">📍 Check in here</button></div>
    ${k}
    <div class="row2" style="margin-top:16px">
      <div class="card"><h4>⏱ Open Call-Outs &amp; SLA</h4><div class="csub">Sorted by urgency · timers vs priority target</div>${slaList}</div>
      <div class="card"><h4>🗺 Activity Map</h4><div class="csub">Recent report &amp; check-in locations</div>
        ${geoPts.length?'<div id="opsMap"></div>':'<div class="empty"><div class="big">🗺</div><b>No located activity yet</b><div style="font-size:13px;margin-top:4px">Reports filed with location turned on will pin here.</div></div>'}</div>
    </div>
    <div class="card" style="margin-top:16px"><h4>👷 Engineers — last known location</h4><div class="csub">From check-ins &amp; located reports · times are when last seen, not continuous tracking</div>${lastSeenHtml()}</div>
    <div class="card" style="margin-top:16px"><h4>📡 Live Activity</h4><div class="csub">Most recent across this client</div>
      ${(function(){const f=buildFeed();return f.length?`<div class="list">${f.map(x=>`<div class="litem"><div class="av">${esc(x.who)}</div><div class="bd"><div class="t">${esc(x.title)}</div><div class="m">${esc(x.msg)}</div></div><div class="when">${esc(x.when)}</div></div>`).join('')}</div>`:'<div class="empty"><div class="big">📡</div><b>No activity yet</b></div>';})()}
    </div>`;
}
/* Client-facing (and admin client-view) read-only check-ins page */
function pageCheckins(){
  if(!CLIENT) return emptyState('📍','Choose a client','Pick a client to see where our engineers are on their sites.');
  const pts=geoPoints();
  return `<div class="sechead"><h3>📍 Site Check-ins</h3><span class="sub">${esc(CLIENT.name)} · where our engineers are on your sites</span><span class="line"></span></div>
    <div class="card"><h4>🗺 Activity Map</h4><div class="csub">Recent check-in &amp; located report locations</div>
      ${pts.length?'<div id="opsMap"></div>':'<div class="empty"><div class="big">🗺</div><b>No located activity yet</b><div style="font-size:13px;margin-top:4px">When our engineers check in on site or file a report with location on, it appears here.</div></div>'}</div>
    <div class="card" style="margin-top:16px"><h4>👷 Engineers — last known location</h4><div class="csub">From check-ins &amp; located reports · times are when last seen, not continuous tracking</div>${lastSeenHtml()}</div>`;
}
function geoPoints(){
  const pts=[];
  const add=(r,type)=>{ const la=Number(r.latitude),ln=Number(r.longitude); if(la&&ln&&!isNaN(la)&&!isNaN(ln)) pts.push({la,ln,type,who:r.engineer||r.supervisor||'',when:r.submitted_at||r.event_at,txt:r.fault_description||r.work_completed||r.current_status||type}); };
  (DATA.callouts||[]).forEach(r=>add(r,'Call-out'));
  (DATA.daily||[]).forEach(r=>add(r,'Daily report'));
  (DATA.gps||[]).forEach(r=>add(r,'Check-in'));
  return pts;
}
function initOpsMap(){
  if(typeof L==='undefined') return;
  const elm=el('opsMap'); if(!elm) return;
  const pts=geoPoints(); if(!pts.length) return;
  try{
    const map=L.map(elm,{scrollWheelZoom:false}).setView([pts[0].la,pts[0].ln],6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(map);
    const grp=[];
    pts.forEach(p=>{ const m=L.marker([p.la,p.ln]).addTo(map); m.bindPopup(`<b>${esc(p.type)}</b><br>${esc(p.who||'')}<br>${esc(String(p.txt||'').slice(0,60))}`); grp.push([p.la,p.ln]); });
    if(grp.length>1) map.fitBounds(grp,{padding:[30,30]});
  }catch(e){ console.warn('map failed',e); }
}
const CHECKIN_STATUSES=['On Site','Travelling','On Break','Off Duty'];
function lastSeen(){
  const by={};
  (DATA.gps||[]).forEach(g=>{ const who=g.engineer||'Unknown'; const t=+new Date(g.event_at||0);
    if(!by[who] || t>by[who]._t){ by[who]={engineer:who,status:g.current_status||'Checked in',site:g.site_name,when:g.event_at,la:Number(g.latitude),ln:Number(g.longitude),notes:g.notes,_t:t}; } });
  return Object.values(by).sort((a,b)=>b._t-a._t);
}
function lastSeenHtml(){
  const ls=lastSeen();
  if(!ls.length) return `<div class="empty"><div class="big">📍</div><b>No check-ins yet</b><div style="font-size:13px;margin-top:4px">Engineers tap “Check in here” on this page to log where they are. You’ll see their last known location and status here.</div></div>`;
  const sc=s=>s==='On Site'?'green':s==='Travelling'?'cyan':s==='On Break'?'amber':s==='Off Duty'?'grey':'cyan';
  return `<div class="list">${ls.map(e=>{
    const ll=(e.la&&e.ln&&!isNaN(e.la)&&!isNaN(e.ln))?`<a class="pdf-link" href="https://www.google.com/maps?q=${e.la},${e.ln}" target="_blank">Map ↗</a>`:'';
    return `<div class="litem"><div class="av">${esc((e.engineer||'··').split(' ').map(w=>w[0]).join('').slice(0,2))}</div>
      <div class="bd"><div class="t">${esc(e.engineer)} <span class="chip ${sc(e.status)}" style="margin-left:4px">${esc(e.status)}</span></div>
      <div class="m">${e.site?esc(e.site)+' · ':''}${esc(String(e.notes||'').slice(0,50))}</div></div>
      <div class="when">${esc(rel(e.when))} ${ll}</div></div>`;
  }).join('')}</div>`;
}
function checkIn(){
  if(!CLIENT){ alert('Pick a client first.'); return; }
  const siteOpts=`<option value="">— no site —</option>`+(DATA.sites||[]).map(s=>`<option value="${esc(s.code||s.city||'Site')}">${esc(s.code||s.city||'Site')}</option>`).join('');
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>📍 Check in</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      ${engineerDatalist()}
      <div class="frow">
        <div class="fld"><label>Engineer</label><input id="ci_eng" list="engList" value="${esc(PROFILE.full_name||PROFILE.email||'')}"></div>
        <div class="fld"><label>Status</label><select id="ci_status">${CHECKIN_STATUSES.map(s=>`<option>${s}</option>`).join('')}</select></div>
      </div>
      <div class="fld"><label>Site (optional)</label><select id="ci_site">${siteOpts}</select></div>
      <div class="fld"><label>Note (optional)</label><input id="ci_note" placeholder="e.g. arrived on site, starting 1st fix"></div>
      <div class="gps-note" id="gpsNote">📍 Your location is captured when you save (one-off — this is not continuous tracking).</div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="ciSave" onclick="submitCheckIn()">Check in</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
async function submitCheckIn(){
  const btn=el('ciSave'); btn.disabled=true; btn.textContent='Locating…'; msg('','');
  const base={client_id:CLIENT.id, engineer:val('ci_eng')||(PROFILE.full_name||PROFILE.email), current_status:val('ci_status')||'On Site', action_type:'Check-in', site_name:val('ci_site')||null, notes:val('ci_note')||null, event_at:new Date().toISOString()};
  const save=async(lat,ln)=>{
    try{ const {error}=await sb.from('gps_events').insert(Object.assign({},base,{latitude:lat,longitude:ln}));
      if(error){ msg('Could not save: '+error.message,'err'); btn.disabled=false; btn.textContent='Check in'; return; }
      msg('✓ Checked in.','ok'); await loadClientData(); setTimeout(()=>{ closeForm(); go('command'); },600);
    }catch(e){ msg('Could not save: '+(e.message||e),'err'); btn.disabled=false; btn.textContent='Check in'; }
  };
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(p=>save(p.coords.latitude,p.coords.longitude), ()=>{ msg('Saved without location (permission declined).','ok'); save(null,null); }, {enableHighAccuracy:true,timeout:8000});
  } else { save(null,null); }
}

