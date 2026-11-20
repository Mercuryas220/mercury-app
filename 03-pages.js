/* ============ PAGES ============ */
/* milestones: a delivery "story" from sites, QA sign-offs and reports */
function milestones(){
  const ev=[];
  (DATA.sites||[]).filter(s=>s.status==='Complete').forEach(s=>ev.push({date:s.planned_end||s.created_at,t:`${esc(s.code||s.city||'Site')} completed`,m:`${esc(s.city||'')} ${esc(s.country||'')}`.trim()}));
  (DATA.qa||[]).forEach(q=>{const s=(DATA.sites||[]).find(x=>x.id===q.site_id)||{};ev.push({date:q.signoff_date||q.submitted_at,t:`Handover signed — ${esc(s.code||s.city||'site')}`,m:'QA sign-off complete'});});
  (DATA.daily||[]).slice(0,6).forEach(d=>{const s=(DATA.sites||[]).find(x=>x.id===d.site_id)||{};ev.push({date:d.report_date||d.submitted_at,t:`Progress update — ${esc(s.code||s.city||'')}`,m:esc(String(d.work_completed||'').slice(0,70))});});
  return ev.filter(e=>e.date).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8);
}
function timelineHtml(){
  const ms=milestones();
  if(!ms.length) return `<div class="empty"><div class="big">🗓</div><b>No milestones yet</b><div style="font-size:13px;margin-top:4px">Completed sites and sign-offs will appear here as the programme progresses.</div></div>`;
  return `<div class="timeline">${ms.map(e=>`<div class="tl-item"><div class="d">${esc(String(e.date).slice(0,10))}</div><div class="t">${e.t}</div>${e.m?`<div class="m">${e.m}</div>`:''}</div>`).join('')}</div>`;
}
function isVideoMedia(m){ return (m&&m.media_type==='video') || /\.(mp4|mov|m4v|webm|avi|3gp)(\?|$)/i.test((m&&m.file_url)||''); }
function isVideoUrl(u){ return /\.(mp4|mov|m4v|webm|avi|3gp)(\?|$)/i.test(String(u||'')); }
/* Thumbnail strip for a list of media URLs (photos + video links) */
function reqPhotoStrip(urls){ const list=(urls||[]).filter(Boolean); if(!list.length) return ''; return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${list.map(u=> isVideoUrl(u)
  ? `<a href="${esc(u)}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:5px;font-size:11px;padding:8px 10px;border:1px solid var(--line2);border-radius:8px;text-decoration:none">🎬 View video</a>`
  : `<a href="${esc(u)}" target="_blank" rel="noopener" title="Open full size"><img src="${esc(u)}" loading="lazy" style="width:82px;height:82px;object-fit:cover;border-radius:8px;border:1px solid var(--line2)"></a>`).join('')}</div>`; }
function mediaTile(m){
  const cap=`<div class="cap">${esc(String(m.report_type||'media'))} · ${esc(String(m.created_at||'').slice(0,10))}</div>`;
  if(isVideoMedia(m)) return `<div class="mtile"><video src="${esc(m.file_url)}" controls preload="metadata" playsinline></video>${cap}</div>`;
  return `<a href="${esc(m.file_url)}" target="_blank"><img src="${esc(m.file_url)}" loading="lazy">${cap}</a>`;
}
function photoStrip(limit){
  const ph=(DATA.media||[]).filter(m=>m.file_url).slice(0,limit||8);
  if(!ph.length) return '';
  return `<div class="gallery">${ph.map(mediaTile).join('')}</div>`;
}
/* map each report id -> the site/project it belongs to, so media can be foldered */
function mediaSiteMap(){
  const map={};
  const put=arr=>(arr||[]).forEach(r=>{ if(!r||!r.id) return; const s=(DATA.sites||[]).find(x=>x.id===r.site_id); map[r.id]= s?(s.code||s.city||'Site') : (r.site_name||null); });
  put(DATA.callouts); put(DATA.shifts); put(DATA.daily); put(DATA.progress);
  return map;
}
function pageGallery(){
  const ph=(DATA.media||[]).filter(m=>m.file_url);
  if(!ph.length) return sectionH('Photo &amp; Video Evidence')+emptyState('🖼','Nothing yet','Photos and videos attached to reports filed from site will appear here, organised into a folder for each project.');
  const smap=mediaSiteMap();
  const folders={};
  ph.forEach(m=>{ const name=(smap[m.report_id]||'General / unassigned'); (folders[name]=folders[name]||[]).push(m); });
  const names=Object.keys(folders).sort((a,b)=>{ if(a==='General / unassigned')return 1; if(b==='General / unassigned')return -1; return folders[b].length-folders[a].length; });
  const vids=ph.filter(isVideoMedia).length;
  const body=names.map((name,i)=>{
    const items=folders[name].slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
    const v=items.filter(isVideoMedia).length;
    return `<details class="mfolder" ${i===0?'open':''}><summary><span class="mf-name">📁 ${esc(name)}</span><span class="mf-count">${items.length} item${items.length===1?'':'s'}${v?` · ${v} video${v===1?'':'s'}`:''}</span></summary><div class="gallery">${items.map(mediaTile).join('')}</div></details>`;
  }).join('');
  return sectionH('Photo &amp; Video Evidence',`${ph.length-vids} image${ph.length-vids===1?'':'s'}${vids?` · ${vids} video${vids===1?'':'s'}`:''} · ${names.length} project folder${names.length===1?'':'s'}`)+`<div class="card">${body}</div>`;
}

/* premium client-facing overview */
function clientOverview(){
  const R=rollups();
  const cinit=(CLIENT.name||'M').replace(/[^A-Za-z0-9]/g,'').charAt(0).toUpperCase();
  const hero=`<div class="client-hero">
    <div class="logo-lg">${CLIENT.logo_url?`<img src="${esc(CLIENT.logo_url)}">`:cinit}</div>
    <div class="ht"><h2>${esc(CLIENT.name)}</h2>
      <p>${R.total?`${R.complete.length} of ${R.total} sites delivered · ${R.avg}% overall · ${R.onSchedPct}% on schedule`:'Programme is being set up.'}</p>
      <div class="by">${CLIENT.system_ref?('System '+esc(CLIENT.system_ref)+' · '):''}Live programme view · delivered by Mercury Automated Solutions</div>
      <button class="addbtn reportbtn" style="margin-top:12px" onclick="downloadClientReport()">⬇ Download report</button></div>
    <div>${ring(R.total?R.avg:0,'complete')}</div></div>`;
  if(!R.total) return hero+emptyState('🚀','Your programme is being set up','Live progress, photos and handover records will appear here as work begins.');
  const k=`<div class="grid kpis">
    ${kpi('c','▦','Sites in Programme',R.total,'','sites')}
    ${kpi('g','✓','Delivered',R.complete.length,'','sites')}
    ${kpi('c','◴','On Schedule',R.onSchedPct,'%','schedule')}
    ${kpi('v','★','Quality Pass Rate',R.complete.length?100:0,'%','quality')}</div>`;
  return hero+k+`
    <div class="row2" style="margin-top:16px">
      <div class="card"><h4>🗓 Delivery Milestones <button class="viewall" onclick="go('schedule')">View →</button></h4><div class="csub">Key moments as your programme progresses</div>${timelineHtml()}</div>
      <div class="card"><h4>📍 Programme Timeline <button class="viewall" onclick="go('schedule')">View →</button></h4><div class="csub">Install windows by site</div>${gantt()}</div>
    </div>
    ${photoStrip(8)?`<div class="card" style="margin-top:16px"><h4>🖼 Recent Photo &amp; Video Evidence <button class="viewall" onclick="go('gallery')">View all →</button></h4><div class="csub">Dated media from our crews on site</div>${photoStrip(8)}</div>`:''}
    <div class="row2" style="margin-top:16px">
      <div class="card">${qualityMini(R)}</div>
      <div class="card"><h4>📰 Latest Updates <button class="viewall" onclick="go('reports')">View →</button></h4><div class="csub">Recent progress from site</div>${(function(){const f=buildFeed();return f.length?`<div class="list">${f.map(x=>`<div class="litem"><div class="av">${esc(x.who)}</div><div class="bd"><div class="t">${esc(x.title)}</div><div class="m">${esc(x.msg)}</div></div><div class="when">${esc(x.when)}</div></div>`).join('')}</div>`:'<div class="empty"><div class="big">📰</div><b>Updates will appear here</b></div>';})()}</div>
    </div>`;
}
function navCard(page,icon,title,stat){ return `<div class="navcard" onclick="go('${page}')"><div class="nc-ic">${icon}</div><div class="nc-bd"><div class="nc-t">${esc(title)}</div><div class="nc-s">${esc(stat)}</div></div><div class="nc-go">→</div></div>`; }
function overviewNav(R){
  const media=(DATA.media||[]).length;
  const proj=(DATA.documents||[]).filter(d=>(d.doc_class||'library')==='project').length;
  const lib=(DATA.documents||[]).filter(d=>(d.doc_class||'library')!=='project').length;
  const rota=(DATA.rota||[]).length, inst=(DATA.progress||[]).length, co=(DATA.callouts||[]).length, sh=(DATA.shifts||[]).length;
  const cards=[
    navCard('sites','▦','Sites & Progress',`${R.total} site${R.total===1?'':'s'} · ${R.avg}% avg`),
    navCard('schedule','▤','Schedule','Install windows & milestones'),
    navCard('rota','📆','Shift Rota', rota?`${rota} shift${rota===1?'':'s'} planned`:'Cover schedule'),
    navCard('installs','🔩','Install Reports', inst?`${inst} report${inst===1?'':'s'}`:'Daily M&E progress'),
    navCard('gallery','🖼','Photo & Video', media?`${media} item${media===1?'':'s'}`:'Site evidence'),
    navCard('project','📐','Project Plan', proj?`${proj} file${proj===1?'':'s'}`:'Drawings & docs'),
    navCard('documents','📁','Documents', lib?`${lib} on file`:'Compliance pack'),
    navCard('callouts','🔧','Call-Out Reports', co?`${co} on record`:'Reactive call-outs'),
    navCard('shifts','🗓','Shift Reports', sh?`${sh} on record`:'Shift summaries'),
    navCard('quality','★','Quality & Handover', `${R.complete.length} signed off`),
    navCard('requests','🛠','Request Work','Ask us to quote a job'),
    navCard('quotes','📝','Request a Quote','For your sales team')
  ].join('');
  return `<div class="card" style="margin-top:16px"><h4 style="color:var(--text)">🧭 Explore your dashboard</h4><div class="csub">Tap any area to see the detail</div><div class="navcards" style="margin-top:12px">${cards}</div></div>`;
}

function pageOverview(){
  const R=rollups(), isClient=VIEW==='client';
  if(isClient) return clientOverview();
  if(!R.total) return emptyState('🚀','Your dashboard is ready','No sites have been added for this client yet. Load the Pipp data file (or add sites in Supabase) and they will appear here instantly.');
  const k=isClient?`<div class="grid kpis">
      ${kpi('c','▦','Sites in Programme',R.total,'')}
      ${kpi('g','✓','Delivered',R.complete.length,'')}
      ${kpi('g','◓','Overall Progress',R.avg,'%')}
      ${kpi('c','◴','On Schedule',R.onSchedPct,'%')}
      ${kpi('v','★','QA Pass Rate',R.complete.length?100:0,'%')}</div>`
    :`<div class="grid kpis">
      ${kpi('c','▦','Sites',R.total,'')}
      ${kpi('g','◓','Avg Progress',R.avg,'%')}
      ${kpi('c','⛺','Crews',DATA.teams.length,'')}
      ${kpi('a','◴','On Schedule',R.onSchedPct,'%')}
      ${kpi('r','⚠','Open Risks',R.openRisks.length,'')}
      ${kpi('v','✓','Complete',R.complete.length,'')}</div>`;
  const banner=isClient
    ?`<div class="banner"><span class="ic">🤝</span><div class="bd"><b>Welcome to your live programme view.</b><p>Updated automatically as our crews report from site. ${CLIENT.system_ref?('System '+esc(CLIENT.system_ref)):''}</p></div></div>`
    :`<div class="banner"><span class="ic">🛰</span><div class="bd"><b>${esc(CLIENT.name)}.</b><p>${R.live.length} sites active · ${DATA.teams.length} crews · ${R.avg}% average completion.</p></div><button class="addbtn reportbtn" onclick="downloadClientReport()">⬇ Download report</button></div>`;
  const feed=buildFeed();
  return banner+k+`
    <div class="row2" style="margin-top:16px">
      <div class="card"><h4>📅 Programme Timeline</h4><div class="csub">Install windows by site</div>${gantt()}</div>
      <div class="card"><h4>🌍 Progress by Country</h4><div class="csub">Average completion</div>${(DATA.sites||[]).length?'<canvas id="countryChart" height="220"></canvas>':'<div class="empty"><div class="big">🌍</div><b>No data yet</b></div>'}</div>
    </div>
    <div class="row2" style="margin-top:16px">
      <div class="card"><h4>${isClient?'📰 Latest Updates':'📡 Live Field Activity'}</h4><div class="csub">Most recent reports from site</div>
        ${feed.length?`<div class="list">${feed.map(f=>`<div class="litem"><div class="av">${esc(f.who)}</div><div class="bd"><div class="t">${f.flag?flagEmoji[f.country]||'':''} ${esc(f.title)}</div><div class="m">${esc(f.msg)}</div></div><div class="when">${esc(f.when)}</div></div>`).join('')}</div>`:'<div class="empty"><div class="big">📡</div><b>No reports yet</b><div style="font-size:13px;margin-top:5px">Reports submitted from the field will stream in here.</div></div>'}
      </div>
      <div class="card">${isClient?qualityMini(R):risksMini(R)}</div>
    </div>`;
}
function buildFeed(){
  const items=[]; const sitesArr=DATA.sites||[];
  (DATA.daily||[]).forEach(d=>{const s=sitesArr.find(x=>x.id===d.site_id)||{};items.push({who:(d.supervisor||'·').split(' ').map(w=>w[0]).join('').slice(0,2)||'··',title:`${s.code||s.city||'Site'} · Daily Report`,msg:d.work_completed||d.status||'Daily update submitted',when:rel(d.submitted_at),country:s.country,flag:1,ts:+new Date(d.submitted_at)});});
  (DATA.callouts||[]).forEach(c=>{const s=sitesArr.find(x=>x.id===c.site_id)||{};items.push({who:(c.engineer||'··').split(' ').map(w=>w[0]).join('').slice(0,2)||'··',title:`${s.code||s.city||'Site'} · Call-Out`,msg:c.fault_description||c.status||'Call-out logged',when:rel(c.submitted_at),country:s.country,flag:1,ts:+new Date(c.submitted_at)});});
  (DATA.qa||[]).forEach(q=>{const s=sitesArr.find(x=>x.id===q.site_id)||{};items.push({who:'QA',title:`${s.code||s.city||'Site'} · QA Sign-off`,msg:'Handover signed off',when:rel(q.submitted_at),country:s.country,flag:1,ts:+new Date(q.submitted_at)});});
  return items.sort((a,b)=>b.ts-a.ts).slice(0,6);
}
function rel(d){if(!d)return '';const diff=(Date.now()-+new Date(d))/60000;if(diff<60)return Math.max(1,Math.round(diff))+'m ago';if(diff<1440)return Math.round(diff/60)+'h ago';return Math.round(diff/1440)+'d ago';}
function risksMini(R){
  if(!R.openRisks.length) return `<h4>⚠ Risks</h4><div class="empty"><div class="big">✓</div><b>No open risks</b></div>`;
  return `<h4>⚠ Risks Needing Attention</h4><div class="csub">Open items by severity</div><div class="list">${R.openRisks.slice(0,5).map(r=>{const s=DATA.sites.find(x=>x.id===r.site_id)||{};const lc=r.risk_level==='Critical'?'red':r.risk_level==='High'?'amber':'cyan';return `<div class="litem"><div class="av" style="background:var(--${lc}-soft);color:var(--${lc})">${esc((s.code||'··').slice(-2))}</div><div class="bd"><div class="t">${esc(r.title||'Risk')}</div><div class="m">${esc(s.city||'')} · ${esc(r.owner||'')}</div></div><div class="when"><span class="chip ${lc}">${esc(r.risk_level||'')}</span></div></div>`;}).join('')}</div>`;
}
function qualityMini(R){return `<h4>★ Quality &amp; Handover</h4><div class="csub">QA-checked before handover</div><div class="ringwrap" style="margin:10px 0 4px"><div>${ring(R.complete.length?100:0,'pass rate')}</div><div style="flex:1;min-width:160px"><div class="metrics" style="grid-template-columns:1fr 1fr"><div><b>${R.complete.length}</b><span>Handovers signed</span></div><div><b>${DATA.qa.length}</b><span>QA records</span></div><div><b>${R.active.length}</b><span>Sites reporting</span></div><div><b>${R.openRisks.length}</b><span>Open risks</span></div></div></div></div>`;}

function pageSites(){
  const R=rollups(); const editor=isEditor(); const isClient=VIEW==='client';
  const header=`<div class="sechead"><h3>Sites &amp; Progress</h3><span class="sub">${R.total} sites · ${R.complete.length} delivered · ${R.avg}% average</span><span class="line"></span>${editor?`<button class="addbtn" onclick="openDailyUpdate()">📈 Daily Update</button> <button class="edit-btn" onclick="openSiteForm()">＋ Add site</button>`:''}</div>`;
  if(!(DATA.sites||[]).length) return header+emptyState('▦','No sites yet',editor?'Tap “Add site” to create the first one.':'No sites for this client yet.');
  let head=isClient?'<th>Site</th><th>Location</th><th>Crew</th><th>Status</th><th>Progress</th>':'<th>Site</th><th>Location</th><th>Crew</th><th>Status</th><th>Progress</th><th>Days</th><th>Window</th>';
  if(editor) head+='<th></th>';
  const rows=DATA.sites.map(s=>{
    const crewN=Array.isArray(s.crew)?s.crew.length:0;
    const extra=isClient?'':`<td>${s.work_days||'—'}</td><td class="muted">${s.planned_start?String(s.planned_start).slice(5):'TBC'} → ${s.planned_end?String(s.planned_end).slice(5):'TBC'}</td>`;
    const editCell=editor?`<td style="text-align:right;white-space:nowrap"><button class="edit-btn" onclick="openDailyUpdate('${s.id}')" title="Daily progress update">📈</button> <button class="edit-btn" onclick="openSiteForm('${s.id}')">Edit</button></td>`:'';
    return `<tr><td><span class="site-code">${esc(s.code||'—')}</span></td>
      <td>${flagEmoji[s.country]||''} ${esc(s.city||'')}<div class="muted" style="font-size:11px">${esc(s.country||'')}</div></td>
      <td><span class="chip grey" style="background:var(--panel2)">${esc(s._team)}</span>${crewN?` <span class="muted" style="font-size:11px">👷 ${crewN}</span>`:''}</td>
      <td><span class="chip ${flagOf(s.status)}"><span class="d"></span>${esc(s.status||'')}</span></td>
      <td><div class="pcell"><div class="pbar ${pbarClass(s.status)}"><i style="width:${Number(s.progress_pct)||0}%"></i></div><b>${Math.round(s.progress_pct||0)}%</b></div></td>
      ${extra}${editCell}</tr>`;
  }).join('');
  return header+`<div class="card"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function pageSchedule(){
  const editor=isEditor();
  const header=`<div class="sechead"><h3>Programme Schedule</h3><span class="sub">Install windows &amp; milestones, driven by your site dates</span><span class="line"></span>${editor?`<button class="edit-btn" onclick="openSiteForm()">＋ Add site</button>`:''}</div>`;
  const gx=`<div class="card"><h4>📅 Install Windows</h4><div class="csub">Bars show planned window; fill shows reported progress</div>${gantt()}</div>`;
  const sites=(DATA.sites||[]).slice().sort((a,b)=>new Date(a.planned_start||'2999')-new Date(b.planned_start||'2999'));
  const mileCards=sites.map(s=>{
    const ms=Array.isArray(s.milestones)?s.milestones.slice().sort((a,b)=>new Date(a.date||'2999')-new Date(b.date||'2999')):[];
    const win=`${s.planned_start?String(s.planned_start).slice(0,10):'TBC'} → ${s.planned_end?String(s.planned_end).slice(0,10):'TBC'}`;
    const rows = ms.length ? ms.map(m=>`<div class="litem" style="padding:8px 12px"><div class="bd"><div class="t">${m.done?'✅':'⬜'} ${esc(m.title)}</div></div><div class="when">${esc(m.date?String(m.date).slice(0,10):'TBC')}</div></div>`).join('')
      : `<div class="muted" style="padding:6px 2px;font-size:12.5px">No milestones set${editor?' — tap Edit to add some.':'.'}</div>`;
    return `<div class="card" style="margin-top:12px"><div class="sechead" style="margin:0 0 8px"><h4 style="margin:0">${flagEmoji[s.country]||''} ${esc(s.code||s.city||'Site')}</h4><span class="sub">${esc(win)} · ${Math.round(s.progress_pct||0)}%</span><span class="line"></span>${editor?`<button class="edit-btn" onclick="openSiteForm('${s.id}')">Edit dates &amp; milestones</button>`:''}</div><div class="list">${rows}</div></div>`;
  }).join('');
  const mileSection = sites.length ? mileCards : emptyState('🗓','No sites scheduled yet',editor?'Add a site, then set its dates and milestones here.':'Your programme schedule will appear here.');
  return header+gx+mileSection;
}

