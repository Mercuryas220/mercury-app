/* ============ FETCH ALL DATA FOR THE SELECTED CLIENT ============ */
async function loadClientData(){
  if(!CLIENT){ DATA=emptyData(); return; }
  const cid=CLIENT.id;
  const q=(t,extra)=>sb.from(t).select(extra||'*').eq('client_id',cid);
  // Each table is loaded independently and tolerantly: a missing table or
  // a query error for one returns [] instead of taking down the whole load.
  const safe=async(p)=>{ try{ const r=await p; return (r&&Array.isArray(r.data))?r.data:[]; }catch(e){ console.warn('Mercury: a data table failed to load (continuing):',e&&e.message||e); return []; } };
  const isAdmin = PROFILE && PROFILE.role==='admin';
  const [sites,teams,risks,daily,callouts,qa,progress,shifts,gps,mediaRows,docs,wreq,engRows,rota,shiftTypes,crmC,crmI,crmO,crmS,notif,drafts,contacts,kindSettings] = await Promise.all([
    safe(q('sites')), safe(q('teams')), safe(q('risks')),
    safe(q('daily_reports').order('submitted_at',{ascending:false}).limit(100)),
    safe(q('callout_reports').order('submitted_at',{ascending:false}).limit(200)),
    safe(q('qa_signoffs').order('submitted_at',{ascending:false}).limit(100)),
    safe(q('progress_reports').order('submitted_at',{ascending:false}).limit(100)),
    safe(q('shift_reports').order('submitted_at',{ascending:false}).limit(200)),
    safe(q('gps_events').order('event_at',{ascending:false}).limit(100)),
    safe(q('media').order('created_at',{ascending:false}).limit(120)),
    safe(q('documents').order('created_at',{ascending:false}).limit(200)),
    safe(q('work_requests').order('created_at',{ascending:false}).limit(200)),
    safe(sb.from('engineers').select('full_name').order('full_name')),
    safe(q('rota_shifts').order('shift_date',{ascending:true}).limit(2000)),
    safe(q('shift_types').order('name',{ascending:true})),
    isAdmin?safe(q('crm_contacts').order('is_primary',{ascending:false})):Promise.resolve([]),
    isAdmin?safe(q('crm_interactions').order('occurred_at',{ascending:false}).limit(300)):Promise.resolve([]),
    isAdmin?safe(q('crm_opportunities').order('created_at',{ascending:false}).limit(200)):Promise.resolve([]),
    isAdmin?safe(sb.from('crm_status').select('*').eq('client_id',cid).limit(1)):Promise.resolve([]),
    safe(q('notifications').order('created_at',{ascending:false}).limit(60)),
    canSubmit()?safe(q('report_drafts').order('updated_at',{ascending:false}).limit(50)):Promise.resolve([]),
    safe(q('client_contacts').order('created_at')),
    safe(sb.from('notification_kind_settings').select('*').order('sort'))
  ]);
  DATA={
    sites:sites, teams:teams, risks:risks, daily:daily, callouts:callouts, qa:qa,
    progress:progress, shifts:shifts, gps:gps, media:mediaRows, documents:docs, requests:wreq,
    engineers:(engRows||[]).map(e=>e&&e.full_name).filter(Boolean),
    rota:rota, shiftTypes:shiftTypes,
    crmContacts:crmC, crmLog:crmI, crmOpps:crmO, crmStatus:(crmS&&crmS[0])||null,
    notifications:notif, drafts:drafts,
    contacts:contacts, kindSettings:kindSettings
  };
  // attach team name to each site
  const tmap={}; DATA.teams.forEach(t=>{ if(t&&t.id) tmap[t.id]=t; });
  DATA.sites.forEach(s=>{ s._team=(tmap[s.team_id]&&tmap[s.team_id].name)?String(tmap[s.team_id].name).replace('Team ',''):'—'; });
}

/* ============ APP SHELL ============ */
function renderShell(){
  const isClient = VIEW==='client';
  const isAdmin = PROFILE.role==='admin';
  const att = (isAdmin && HQDATA) ? hqAttentionCount() : 0;
  const adminNav = (isAdmin && !isClient && !SUPPREVIEW) ? `
      <div class="navlabel">Admin</div>
      <button class="nav-btn" data-page="hq"><span class="ic">🏠</span> HQ Overview ${att?`<span class="nav-badge">${att}</span>`:''}</button>
      <button class="nav-btn" data-page="digest"><span class="ic">📨</span> Daily Digest</button>
      <button class="nav-btn" data-page="clients"><span class="ic">🗂</span> Clients</button>
      <button class="nav-btn" data-page="quotereg"><span class="ic">📝</span> Quotes</button>
      <button class="nav-btn" data-page="jobreg"><span class="ic">📋</span> Jobs</button>
      <button class="nav-btn" data-page="jobs"><span class="ic">🚦</span> Job Status</button>
      <button class="nav-btn" data-page="engineers"><span class="ic">👷</span> Engineers</button>
      <button class="nav-btn" data-page="compliance"><span class="ic">🛡</span> Compliance</button>
      <button class="nav-btn" data-page="suppliers"><span class="ic">🚚</span> Suppliers</button>
      <button class="nav-btn" data-page="finance"><span class="ic">💷</span> Profit</button>
      <button class="nav-btn" data-page="crm"><span class="ic">🤝</span> CRM</button>` : '';
  const isSupplier = PROFILE.role==='supplier' || !!SUPPREVIEW;
  const supplierNav = isSupplier ? `
      <div class="navlabel">Supplier Portal</div>
      <button class="nav-btn active" data-page="sup_home"><span class="ic">🏠</span> Dashboard</button>
      <button class="nav-btn" data-page="sup_engineers"><span class="ic">👷</span> My Engineers</button>
      <button class="nav-btn" data-page="sup_jobs"><span class="ic">🗓</span> My Assignments</button>
      <button class="nav-btn" data-page="sup_timesheets"><span class="ic">⏱</span> Timesheets</button>
      <button class="nav-btn" data-page="sup_feedback"><span class="ic">⭐</span> Performance</button>
      <button class="nav-btn" data-page="sup_docs"><span class="ic">📁</span> Company Docs</button>` : '';
  const opsNav = isClient ? '' : `
      <div class="navlabel">Live</div>
      <button class="nav-btn" data-page="command"><span class="ic">🛰</span> Command Centre</button>
      <div class="navlabel">Operations</div>
      <button class="nav-btn" data-page="risks"><span class="ic">⚠</span> Risk Register</button>
      <button class="nav-btn" data-page="callouts"><span class="ic">🔧</span> Call-Out Reports</button>
      <button class="nav-btn" data-page="shifts"><span class="ic">🗓</span> Shift Reports</button>
      <button class="nav-btn" data-page="requests"><span class="ic">📋</span> Work Requests</button>
      <button class="nav-btn" data-page="quotes"><span class="ic">📝</span> Quote Requests</button>
      <button class="nav-btn" data-page="analytics"><span class="ic">📊</span> Analytics</button>`;
  // Client-portal branding: show the client's logo/colour; "Delivered by Mercury"
  const cinit=(CLIENT&&CLIENT.name?CLIENT.name.replace(/[^A-Za-z0-9]/g,'').charAt(0).toUpperCase():'M');
  const brandBlock = (isClient && CLIENT)
    ? `<div class="brand">${CLIENT.logo_url?`<img class="brandlogo-img" src="${esc(CLIENT.logo_url)}">`:`<div class="logo" style="background:${esc(CLIENT.brand_color||'#22c55e')}">${cinit}</div>`}<div><h1>${esc(CLIENT.name)}</h1><p>Delivered by Mercury</p></div></div>`
    : `<div class="brand"><div class="logo logo-mark"><img class="logomark" src="${MLOGO}" alt="Mercury"></div><div><h1>Mercury</h1><p>Operations Platform</p></div></div>`;
  const galleryNav = `<button class="nav-btn" data-page="gallery"><span class="ic">🖼</span> Photo Evidence</button>`;
  const docsNav = `<button class="nav-btn" data-page="documents"><span class="ic">📁</span> Documents</button>`;
  const projNav = `<button class="nav-btn" data-page="project"><span class="ic">📐</span> Project Plan</button>`;
  el('root').innerHTML=`<div class="shell">
    <aside class="sidebar">
      ${brandBlock}
      ${adminNav}
      ${supplierNav}
      ${isSupplier?'':`<div class="navlabel">${isClient?'Delivery':'Programme'}</div>
      <button class="nav-btn active" data-page="overview"><span class="ic">◫</span> Overview</button>
      <button class="nav-btn" data-page="sites"><span class="ic">▦</span> Sites &amp; Progress</button>
      <button class="nav-btn" data-page="schedule"><span class="ic">▤</span> Schedule</button>
      <button class="nav-btn" data-page="rota"><span class="ic">📆</span> Shift Rota</button>
      <button class="nav-btn" data-page="teams"><span class="ic">⛺</span> Teams &amp; Routes</button>
      <button class="nav-btn" data-page="installs"><span class="ic">🔩</span> Install Reports</button>
      ${opsNav}
      <div class="navlabel">${isClient?'Transparency':'Delivery'}</div>
      ${isClient?'<button class="nav-btn" data-page="requests"><span class="ic">🛠</span> Request Work</button><button class="nav-btn" data-page="quotes"><span class="ic">📝</span> Request a Quote</button>':''}
      ${isClient?'<button class="nav-btn" data-page="callouts"><span class="ic">🔧</span> Call-Out Reports</button><button class="nav-btn" data-page="shifts"><span class="ic">🗓</span> Shift Reports</button>':''}
      ${isClient?'<button class="nav-btn" data-page="checkins"><span class="ic">📍</span> Site Check-ins</button>':''}
      <button class="nav-btn" data-page="reports"><span class="ic">✓</span> ${isClient?'Latest Updates':'Activity Feed'}</button>
      ${galleryNav}
      ${projNav}
      ${docsNav}
      <button class="nav-btn" data-page="notify"><span class="ic">✉</span> Email Updates</button>
      <button class="nav-btn" data-page="quality"><span class="ic">★</span> Quality &amp; Handover</button>
      <button class="nav-btn" data-page="completed"><span class="ic">🗄</span> Completed Works</button>`}
      <div class="side-foot">Signed in as<br><b>${esc(PROFILE.full_name||PROFILE.email)}</b><br>${esc((PROFILE.role||'client').toUpperCase())}</div>
      <button class="logout" id="logoutBtn">Sign out</button>
    </aside>
    <div class="navscrim" onclick="document.body.classList.remove('nav-open')"></div>
    <div class="main">
      <div class="topbar">
        <button class="hamburger" onclick="document.body.classList.toggle('nav-open')">☰</button>
        <div class="tbtitle"><div class="crumb">${esc(isSupplier?(SUPPLIER?SUPPLIER.name:'Supplier'):(CLIENT?CLIENT.name:'No client'))}</div><h2 id="pageTitle">Programme Overview</h2></div>
        <div class="spacer"></div>
        ${(CLIENTS.length>1 && !isSupplier)?`<select class="cli-select" id="cliSelect">${CLIENTS.map(c=>`<option value="${c.id}" ${CLIENT&&c.id===CLIENT.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>`:''}
        ${(SUPPREVIEW && SUPPLIERS.length>1)?`<select class="cli-select" onchange="enterSupplierPreview(this.value)">${SUPPLIERS.map(s=>`<option value="${s.id}" ${s.id===SUPPREVIEW?'selected':''}>${esc(s.name)}</option>`).join('')}</select>`:''}
        ${PROFILE.role==='admin'?`<div class="toggle"><button id="bI" class="${(VIEW==='internal'&&!SUPPREVIEW)?'on':''}" onclick="setView('internal')">🛠 Internal</button><button id="bC" class="${VIEW==='client'?'on':''}" onclick="setView('client')">👁 Client</button>${SUPPLIERS.length?`<button id="bS" class="${SUPPREVIEW?'on':''}" onclick="enterSupplierPreview()">🚚 Supplier</button>`:''}</div>`:''}
        ${VIEW!=='client'?`<button class="theme-toggle" onclick="toggleTheme()" title="Light / dark mode">🌓</button>`:''}
        <div class="notifwrap" id="notifWrap">${bellHtml()}</div>
        <div class="live"><span class="beat"></span> Live</div>
      </div>
      <div class="content" id="content"></div>
    </div></div>`;
  document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>{ go(b.dataset.page); document.body.classList.remove('nav-open'); }));
  if(!window.__notifBound){ window.__notifBound=true; document.addEventListener('click',e=>{ const w=el('notifWrap'); if(w && !w.contains(e.target)) w.classList.remove('open'); }); }
  if(CLIENT) document.body.style.setProperty('--brand', CLIENT.brand_color||'#22c55e');
  applySavedTheme();
  el('logoutBtn').addEventListener('click', async ()=>{ await sb.auth.signOut(); location.reload(); });
  const cs=el('cliSelect');
  if(cs) cs.addEventListener('change', async e=>{ CLIENT=CLIENTS.find(c=>c.id===e.target.value); await loadClientData(); go(CURRENT); el('pageTitle').closest('.topbar').querySelector('.crumb').textContent=CLIENT.name; });
}
async function toggleTheme(){ const on=document.body.classList.toggle('theme-light'); try{localStorage.setItem('mercuryTheme',on?'light':'dark');}catch(e){} }
function applySavedTheme(){ try{ if(VIEW!=='client' && localStorage.getItem('mercuryTheme')==='light') document.body.classList.add('theme-light'); else document.body.classList.remove('theme-light'); }catch(e){} }
async function setView(v){
  const wasPreview=!!SUPPREVIEW;
  exitSupplierPreview();            // leaving any supplier preview and restore full data
  VIEW=v;
  document.body.classList.toggle('client',v==='client');
  if(v==='client' && !CLIENT && CLIENTS.length){ CLIENT=CLIENTS[0]; await loadClientData(); }
  renderShell();
  const dest = wasPreview ? (v==='client'?'overview':'hq') : ((v==='client' && CURRENT==='clients') ? 'overview' : CURRENT);
  go(dest);
}

/* ============ DERIVED VALUES ============ */
function rollups(){
  const sites=(DATA.sites||[]).filter(s=>String(s.status||'')!=='Pending');
  const active=sites.filter(s=>!['Pending','Not Started'].includes(s.status));
  const complete=sites.filter(s=>s.status==='Complete');
  const live=sites.filter(s=>['Live','At Risk','Delayed','Mobilising'].includes(s.status));
  const avg=active.length?Math.round(active.reduce((a,s)=>a+Number(s.progress_pct||0),0)/active.length):0;
  const onSched=active.filter(s=>!['Delayed','At Risk'].includes(s.status)).length;
  const onSchedPct=active.length?Math.round(onSched/active.length*100):0;
  const openRisks=(DATA.risks||[]).filter(r=>!['Closed','Complete'].includes(String(r.status||'')));
  const crit=openRisks.filter(r=>String(r.risk_level||'')==='Critical');
  return {sites,active,complete,live,avg,onSchedPct,openRisks,crit,total:(DATA.sites||[]).length};
}
function kpi(cls,icon,label,val,unit,nav){return `<div class="card kpi ${cls}${nav?' kpi-link':''}"${nav?` onclick="go('${nav}')" role="button" tabindex="0"`:''}><div class="spark">${icon}</div><div class="lbl">${label}</div><div class="val">${val}${unit?`<small>${unit}</small>`:''}</div>${nav?'<div class="kpi-go">→</div>':''}</div>`;}
function sectionH(t,s){return `<div class="section-h"><h3>${t}</h3>${s?`<span class="sub">${s}</span>`:''}<span class="line"></span></div>`;}
function emptyState(icon,title,msg){return `<div class="card"><div class="empty"><div class="big">${icon}</div><b>${title}</b><div style="margin-top:6px;font-size:13px">${msg}</div></div></div>`;}

/* gantt across the client's date range */
function gantt(){
  const dated=(DATA.sites||[]).filter(s=>s.planned_start&&s.planned_end);
  if(!dated.length) return emptyState('📅','No dates scheduled yet','Add planned start/end dates to your sites and the timeline appears here.');
  const ds=dated.map(s=>+new Date(s.planned_start)), de=dated.map(s=>+new Date(s.planned_end));
  const min=Math.min(...ds), max=Math.max(...de), span=Math.max(1,max-min);
  const pct=d=>((+new Date(d)-min)/span)*100;
  const now=Date.now();
  const todayPct=(now>=min&&now<=max)?((now-min)/span)*100:null;
  const clamp=v=>Math.max(0,Math.min(100,v));
  // ---- calendar / month axis ----
  const months=[];
  const d0=new Date(min);
  months.push({pct:0, label:d0.toLocaleDateString('en-GB',{month:'short',year:'2-digit'}), edge:'start'});
  let yy=d0.getFullYear(), mm=d0.getMonth()+1; if(mm>11){mm=0;yy++;}
  let t=new Date(yy,mm,1).getTime();
  while(t<=max){
    const p=((t-min)/span)*100; const dt=new Date(t);
    if(p>2&&p<98) months.push({pct:p, label:dt.toLocaleDateString('en-GB',{month:'short'})+(dt.getMonth()===0?(" '"+String(dt.getFullYear()).slice(2)):''), edge:''});
    mm++; if(mm>11){mm=0;yy++;} t=new Date(yy,mm,1).getTime();
  }
  const tkStyle=p=>p<4?'left:0':p>96?'right:0':('left:'+p+'%');
  const scale=`<div class="gscale"><div></div><div class="gscale-track">`+
    months.map(m=>`<span class="gtk" style="${tkStyle(m.pct)}">${esc(m.label)}</span>`).join('')+
    (todayPct!=null?`<span class="gscale-today" style="left:${clamp(todayPct)}%">Today</span>`:'')+
    `</div></div>`;
  const gridHtml=months.map(m=>`<div class="gline" style="left:${clamp(m.pct)}%"></div>`).join('');
  const rows=dated.sort((a,b)=>new Date(a.planned_start)-new Date(b.planned_start)).map(s=>{
    const l=pct(s.planned_start), r=pct(s.planned_end), w=Math.max(2.5,r-l);
    const col=s.status==='Complete'?'linear-gradient(90deg,#22c55e,#4ade80)':s.status==='Delayed'?'linear-gradient(90deg,#ef4444,#fb7185)':s.status==='At Risk'?'linear-gradient(90deg,#f59e0b,#fbbf24)':'linear-gradient(90deg,#38bdf8,#22c55e)';
    const today=todayPct!=null?`<div class="gtoday" style="left:${clamp(todayPct)}%"></div>`:'';
    const miles=(Array.isArray(s.milestones)?s.milestones:[]).filter(m=>m.date).map(m=>{const mp=clamp(pct(m.date));return `<div class="gmile ${m.done?'done':''}" style="left:${mp}%" title="${esc(m.title||'')}${m.date?(' · '+String(m.date).slice(0,10)):''}${m.done?' ✓':''}"></div>`;}).join('');
    return `<div class="grow"><div class="gname"><span class="chip ${flagOf(s.status)}" style="padding:2px 7px">${esc(s._team)}</span> ${flagEmoji[s.country]||''} ${esc(s.code||s.city)}</div>
      <div class="gtrack">${gridHtml}<div class="gbar" style="left:${l}%;width:${w}%;background:${col}">${Number(s.progress_pct)>0?Math.round(s.progress_pct)+'%':''}</div>${miles}${today}</div></div>`;
  }).join('');
  return `<div class="gantt">${scale}${rows}<div class="legend"><span><i style="background:#38bdf8"></i> In progress</span><span><i style="background:#22c55e"></i> Complete</span><span><i style="background:#f59e0b"></i> At risk</span><span><i style="background:#ef4444"></i> Delayed</span><span><i style="background:#6366f1;border-radius:50%"></i> Milestone</span><span><i style="background:rgba(56,189,248,.95);width:2px;border-radius:0"></i> Today</span></div></div>`;
}
function ring(p,label){const r=58,c=2*Math.PI*r,o=c-(p/100)*c;return `<div class="ring"><svg width="150" height="150" viewBox="0 0 150 150"><circle cx="75" cy="75" r="${r}" fill="none" stroke="var(--line2)" stroke-width="12"/><circle cx="75" cy="75" r="${r}" fill="none" stroke="url(#g)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${o}"/><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#22c55e"/></linearGradient></defs></svg><div class="mid"><div><b>${p}%</b><span>${label}</span></div></div></div>`;}

