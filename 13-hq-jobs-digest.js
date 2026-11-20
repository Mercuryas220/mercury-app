/* ===================================================================
   HQ DASHBOARD  (admin, business-wide across ALL clients)
   =================================================================== */
let HQDATA=null;
function clientName(id){ const c=CLIENTS.find(x=>x.id===id); return c?c.name:'—'; }
async function loadHQ(){
  const safe=async(p)=>{ try{ const r=await p; return (r&&Array.isArray(r.data))?r.data:[]; }catch(e){ console.warn('HQ load issue (continuing):',e&&e.message||e); return []; } };
  const [co,docs,risks,reqs,sites,crmS,crmO,rota,jobs,shifts,prog,daily,teamsAll]=await Promise.all([
    safe(sb.from('callout_reports').select('id,client_id,site_id,site_name,job_number,priority,status,submitted_at,fault_description,engineer').order('submitted_at',{ascending:false}).limit(2000)),
    safe(sb.from('documents').select('id,client_id,title,doc_type,expiry_date').limit(2000)),
    safe(sb.from('risks').select('id,client_id,title,risk_level,status').limit(2000)),
    safe(sb.from('work_requests').select('id,client_id,title,work_type,status,priority,created_at,kind').order('created_at',{ascending:false}).limit(2000)),
    safe(sb.from('sites').select('id,client_id,code,city,country,status,progress_pct,planned_start,planned_end,team_id,crew').limit(5000)),
    safe(sb.from('crm_status').select('client_id,stage,next_follow_up,owner').limit(2000)),
    safe(sb.from('crm_opportunities').select('client_id,value,stage').limit(2000)),
    safe(sb.from('rota_shifts').select('client_id,site_id,engineer,shift_date,shift_name,start_time,end_time,color').order('shift_date',{ascending:true}).limit(8000)),
    safe(sb.from('job_readiness').select('*').order('start_date',{ascending:true}).limit(3000)),
    safe(sb.from('shift_reports').select('id,client_id,site_id,site_name,engineer,work_completed,status,submitted_at,shift_date').order('submitted_at',{ascending:false}).limit(1500)),
    safe(sb.from('progress_reports').select('id,client_id,site_id,discipline,engineer,work_completed,progress_pct,submitted_at,report_date').order('submitted_at',{ascending:false}).limit(1500)),
    safe(sb.from('daily_reports').select('*').order('submitted_at',{ascending:false}).limit(1000)),
    safe(sb.from('teams').select('id,client_id,name,roster').limit(3000))
  ]);
  HQDATA={callouts:co,documents:docs,risks:risks,requests:reqs,sites:sites,crmStatus:crmS,crmOpps:crmO,rota:rota,jobs:jobs,shifts:shifts,progress:prog,daily:daily,teams:teamsAll};
}
function hqItems(){
  if(!HQDATA) return [];
  const items=[];
  HQDATA.callouts.filter(isOpenCallout).forEach(r=>{
    const s=slaState(r);
    if(r.priority==='Priority 1') items.push({sev:0,cls:'red',cat:'Priority 1',goPage:'callouts',client_id:r.client_id,t:textOnly(r.fault_description||'Priority 1 call-out'),m:(r.job_number||'')+' · '+(r.engineer||'unassigned'),extra:s.cls==='breach'?'SLA breached':s.label});
    else if(s.cls==='breach') items.push({sev:1,cls:'red',cat:'SLA breach',goPage:'callouts',client_id:r.client_id,t:textOnly(r.fault_description||'Call-out'),m:(r.job_number||'')+' · '+(r.priority||''),extra:s.label});
  });
  HQDATA.documents.forEach(d=>{ if(!d.expiry_date)return; const days=Math.ceil((new Date(d.expiry_date)-Date.now())/86400000);
    if(days<0) items.push({sev:1,cls:'red',cat:'Document expired',goPage:'documents',client_id:d.client_id,t:textOnly(d.title||'Document'),m:d.doc_type||'',extra:'Expired '+(-days)+'d ago'});
    else if(days<=30) items.push({sev:2,cls:'amber',cat:'Document expiring',goPage:'documents',client_id:d.client_id,t:textOnly(d.title||'Document'),m:d.doc_type||'',extra:'In '+days+'d'});
  });
  HQDATA.risks.filter(r=>String(r.risk_level||'')==='Critical' && !['Closed','Complete'].includes(String(r.status||''))).forEach(r=>{
    items.push({sev:0,cls:'red',cat:'Critical risk',goPage:'risks',client_id:r.client_id,t:textOnly(r.title||'Critical risk'),m:'',extra:r.status||'Open'});
  });
  (HQDATA.requests||[]).filter(r=>['New','Reviewing'].includes(String(r.status||''))).forEach(r=>{
    const isQuote=String(r.kind||'work')==='quote';
    items.push({sev:1,cls:'cyan',cat:isQuote?'Quote request':'Work request',goPage:isQuote?'quotes':'requests',client_id:r.client_id,t:textOnly(r.title||'Work request'),m:r.work_type||'',extra:(r.status||'New')+(r.priority&&r.priority!=='Normal'?(' · '+r.priority):'')});
  });
  return items.sort((a,b)=>a.sev-b.sev);
}
function hqAttentionCount(){ return hqItems().length; }
/* HQ: every report submitted across ALL clients, in one feed */
function hqReportFeed(){
  if(!HQDATA) return [];
  const siteCode=id=>{ const s=(HQDATA.sites||[]).find(x=>x.id===id); return s?(s.code||s.city||''):''; };
  const out=[];
  (HQDATA.callouts||[]).forEach(r=> out.push({type:'Call-out',cls:'cyan',page:'callouts',client_id:r.client_id,when:r.submitted_at,eng:r.engineer,site:siteCode(r.site_id)||r.site_name||'',sum:textOnly(r.fault_description||'')||r.job_number||''}));
  (HQDATA.shifts||[]).forEach(r=> out.push({type:'Shift',cls:'violet',page:'shifts',client_id:r.client_id,when:r.submitted_at,eng:r.engineer,site:siteCode(r.site_id)||r.site_name||'',sum:textOnly(r.work_completed||'')}));
  (HQDATA.progress||[]).forEach(r=> out.push({type:'Install',cls:'green',page:'installs',client_id:r.client_id,when:r.submitted_at||r.report_date,eng:r.engineer,site:siteCode(r.site_id),sum:textOnly(r.work_completed||'')+(r.progress_pct!=null?(' ('+Math.round(r.progress_pct)+'%)'):'')}));
  (HQDATA.daily||[]).forEach(r=> out.push({type:'Daily',cls:'amber',page:'reports',client_id:r.client_id,when:r.submitted_at,eng:r.engineer||r.supervisor||'',site:siteCode(r.site_id),sum:textOnly(r.summary||r.work_done||r.notes||r.update||'')}));
  return out.filter(x=>x.when).sort((a,b)=>String(b.when).localeCompare(String(a.when)));
}
let HQREP={days:7,type:'all'};
function hqReportCard(){ return `<div class="card" style="margin-top:16px"><div id="hqRepBox">${hqRepInner()}</div></div>`; }
function hqRepSet(d){ HQREP.days=d; const b=el('hqRepBox'); if(b) b.innerHTML=hqRepInner(); }
function hqRepType(t){ HQREP.type=t; const b=el('hqRepBox'); if(b) b.innerHTML=hqRepInner(); }
function hqRepInner(){
  const feed=hqReportFeed();
  const cutoff = HQREP.days? Date.now() - HQREP.days*86400000 : 0;
  const inPeriod=feed.filter(x=> !cutoff || +new Date(x.when) >= cutoff);
  let rows=inPeriod;
  if(HQREP.type!=='all') rows=rows.filter(x=>x.type===HQREP.type);
  const counts={}; inPeriod.forEach(x=>counts[x.type]=(counts[x.type]||0)+1);
  const submitted=new Set(inPeriod.map(x=>x.client_id));
  const noReport=(CLIENTS||[]).filter(c=>!submitted.has(c.id));
  const periodLbl = HQREP.days===1?'today':(HQREP.days?('last '+HQREP.days+' days'):'all time');
  const dfmt=w=>{ const d=new Date(w); if(isNaN(d)) return ''; return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})+' '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); };
  const pBtn=(d,l)=>`<button class="edit-btn ${HQREP.days===d?'on':''}" onclick="hqRepSet(${d})">${l}</button>`;
  const tBtn=(t,l)=>`<button class="edit-btn ${HQREP.type===t?'on':''}" onclick="hqRepType('${t}')">${l}</button>`;
  const summ=['Install','Shift','Call-out','Daily'].filter(t=>counts[t]).map(t=>counts[t]+' '+t.toLowerCase()).join(' · ');
  const head=`<div class="sechead" style="margin:0 0 8px"><h4 style="margin:0">📋 Reports submitted — all clients</h4><span class="sub">${inPeriod.length} in ${periodLbl}${summ?(' · '+summ):''}</span><span class="line"></span></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${pBtn(1,'Today')}${pBtn(7,'7 days')}${pBtn(30,'30 days')}${pBtn(0,'All')}<span style="width:10px"></span>${tBtn('all','All types')}${tBtn('Install','Install')}${tBtn('Shift','Shift')}${tBtn('Call-out','Call-out')}${tBtn('Daily','Daily')}</div>`;
  const gap = noReport.length ? `<div class="note" style="margin-bottom:10px;font-size:12px;border-left:3px solid var(--amber);padding-left:10px">⚠ <b>No reports ${periodLbl}</b> from: ${noReport.map(c=>esc(c.name)).join(', ')}</div>` : `<div class="note" style="margin-bottom:10px;font-size:12px;border-left:3px solid var(--green);padding-left:10px">✅ Every client has submitted at least one report ${periodLbl}.</div>`;
  const table = rows.length ? `<div style="max-height:440px;overflow:auto"><table class="tbl"><thead><tr><th>When</th><th>Client</th><th>Type</th><th>Site</th><th>Engineer</th><th>Summary</th><th></th></tr></thead><tbody>${rows.slice(0,300).map(x=>`<tr><td style="white-space:nowrap">${esc(dfmt(x.when))}</td><td><b>${esc(clientName(x.client_id))}</b></td><td><span class="chip ${x.cls}">${esc(x.type)}</span></td><td>${esc(x.site||'—')}</td><td>${esc(x.eng||'—')}</td><td>${esc(String(x.sum||'').slice(0,70))}${String(x.sum||'').length>70?'…':''}</td><td><button class="addbtn sm" onclick="enterClientTo('${x.client_id}','${x.page}')">Open →</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty" style="padding:14px"><b>No reports in this period</b><div style="font-size:12px;margin-top:4px">Try a wider date range or a different type.</div></div>';
  return head+gap+table;
}
/* HQ: planned-work view — Day / Week / Month with a selectable range.
   Only clients with CONFIRMED shifts in the window are shown. */
let HQPLAN=null;
function _som(d){return new Date(d.getFullYear(),d.getMonth(),1);}
function _eom(d){return new Date(d.getFullYear(),d.getMonth()+1,0);}
function _addM(d,n){return new Date(d.getFullYear(),d.getMonth()+n,1);}
function _mon(d){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());const dow=(x.getDay()+6)%7;x.setDate(x.getDate()-dow);x.setHours(0,0,0,0);return x;}
function hqPlanDefault(mode){
  const t=new Date(); t.setHours(0,0,0,0);
  if(mode==='day'){ const e=new Date(t); e.setDate(e.getDate()+29); return {from:ymd(t), to:ymd(e)}; }
  if(mode==='week'){ const m=_mon(t); const e=new Date(m); e.setDate(e.getDate()+8*7-1); return {from:ymd(m), to:ymd(e)}; }
  return {from:ymd(_som(t)), to:ymd(_eom(_addM(t,5)))};   // month + jobs: 6-month window
}
function hqPlanInit(){ if(!HQPLAN) HQPLAN=Object.assign({mode:'month'}, hqPlanDefault('month')); }
function hqPlanSetMode(m){ HQPLAN=Object.assign({mode:m}, hqPlanDefault(m)); hqPlanRender(); }
function hqPlanApplyRange(){ hqPlanInit(); const f=el('planFrom')&&el('planFrom').value, t=el('planTo')&&el('planTo').value; if(f&&t&&f<=t){ HQPLAN.from=f; HQPLAN.to=t; } hqPlanRender(); }
function hqPlanShift(dir){
  hqPlanInit(); const f=parseYmd(HQPLAN.from), t=parseYmd(HQPLAN.to);
  if(HQPLAN.mode==='month'){ const n=(t.getFullYear()*12+t.getMonth())-(f.getFullYear()*12+f.getMonth())+1; const nf=_addM(f,dir*n); HQPLAN.from=ymd(_som(nf)); HQPLAN.to=ymd(_eom(_addM(nf,n-1))); }
  else { const span=Math.round((t-f)/86400000)+1; const nf=new Date(f); nf.setDate(nf.getDate()+dir*span); const nt=new Date(nf); nt.setDate(nt.getDate()+span-1); HQPLAN.from=ymd(nf); HQPLAN.to=ymd(nt); }
  hqPlanRender();
}
function hqPlanRender(){ const box=el('hqPlanBox'); if(box) box.innerHTML=hqPlanInner(); }
function hqPlanCols(mode,from,to){
  const cols=[]; const f=parseYmd(from), t=parseYmd(to); const DAY=86400000;
  if(mode==='month'){ let mi=f.getFullYear()*12+f.getMonth(); const mt=t.getFullYear()*12+t.getMonth();
    for(;mi<=mt && cols.length<18; mi++){ const y=Math.floor(mi/12), m=mi%12; const dt=new Date(y,m,1); const end=new Date(y,m+1,0); cols.push({key:'m'+mi, label:dt.toLocaleDateString('en-GB',{month:'short'}), sub:"'"+String(y).slice(2), full:dt.toLocaleDateString('en-GB',{month:'short',year:'2-digit'}), t0:+dt, t1:+end+DAY-1}); } }
  else if(mode==='week'){ let d=_mon(f); while(d<=t && cols.length<27){ const k=ymd(d); const e=new Date(d); e.setDate(e.getDate()+6); cols.push({key:'w'+k, label:d.toLocaleDateString('en-GB',{day:'numeric',month:'short'}), sub:'wk', full:'wk of '+d.toLocaleDateString('en-GB',{day:'numeric',month:'short'}), t0:+d, t1:+e+DAY-1}); const nd=new Date(d); nd.setDate(nd.getDate()+7); d=nd; } }
  else { let d=new Date(f); while(d<=t && cols.length<62){ const k=ymd(d); cols.push({key:'d'+k, label:String(d.getDate()), sub:d.toLocaleDateString('en-GB',{weekday:'short'}).slice(0,2), full:d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}), t0:+d, t1:+d+DAY-1}); const nd=new Date(d); nd.setDate(nd.getDate()+1); d=nd; } }
  return cols;
}
function hqBucketKey(mode,dateStr){ const d=parseYmd(dateStr); if(mode==='month') return 'm'+(d.getFullYear()*12+d.getMonth()); if(mode==='week') return 'w'+ymd(_mon(d)); return 'd'+dateStr; }
function hqPlannedWork(){ return `<div id="hqPlanBox">${hqPlanInner()}</div>`; }
/* HQ jobs timeline — every individual job (site) across all clients as its
   own Gantt bar, like the client Programme Timeline but business-wide. */
function hqJobsGantt(){
  const DAY=86400000;
  const fromT=+parseYmd(HQPLAN.from), toT=+parseYmd(HQPLAN.to)+DAY-1;
  const sites=(HQDATA.sites||[]).filter(s=>!siteDone(s) && s.planned_start && s.planned_end)
    .filter(s=>{ const ps=+parseYmd(s.planned_start), pe=+parseYmd(s.planned_end); return pe>=fromT && ps<=toT; })
    .sort((a,b)=> String(a.planned_start).localeCompare(String(b.planned_start)) || clientName(a.client_id).localeCompare(clientName(b.client_id)));
  if(!sites.length) return {gantt:emptyState('📅','No individual jobs in this range','No site install windows fall in these dates. Change the range or check another period.'), detail:''};
  const min=fromT, max=toT, span=Math.max(1,max-min);
  const pct=t=>((t-min)/span)*100; const clamp=v=>Math.max(0,Math.min(100,v));
  const now=Date.now(); const todayPct=(now>=min&&now<=max)?pct(now):null;
  // month ticks across the window
  const ticks=[]; let tk=new Date(new Date(min).getFullYear(), new Date(min).getMonth(), 1); if(+tk<min) tk=new Date(tk.getFullYear(),tk.getMonth()+1,1);
  while(+tk<=max){ ticks.push({pct:clamp(pct(+tk)), label:tk.toLocaleDateString('en-GB',{month:'short',year:'2-digit'})}); tk=new Date(tk.getFullYear(),tk.getMonth()+1,1); }
  const gridHtml=ticks.map(m=>`<div class="gline" style="left:${m.pct}%"></div>`).join('');
  const scale=`<div class="gscale"><div></div><div class="gscale-track" style="position:relative">`+ticks.map(m=>`<span class="gtk" style="left:${m.pct}%;transform:translateX(-50%)">${esc(m.label)}</span>`).join('')+(todayPct!=null?`<span class="gscale-today" style="left:${clamp(todayPct)}%">Today</span>`:'')+`</div></div>`;
  // engineers booked per site within range
  const engBySite={}; (HQDATA.rota||[]).forEach(r=>{ if(!r.shift_date||!r.site_id||!r.engineer) return; const x=+parseYmd(r.shift_date); if(x<fromT||x>toT) return; (engBySite[r.site_id]=engBySite[r.site_id]||new Set()).add(r.engineer); });
  // readiness status per site (so we can flag jobs that need action in red)
  const ragBySite={}; (typeof autoJobs==='function'?autoJobs():[]).forEach(j=>{ ragBySite[j.id]=jobStatus(j).cls; });
  const allocOf=s=>{ const cw=Array.isArray(s.crew)?s.crew.map(c=>c&&(c.name||(typeof c==='string'?c:''))).map(x=>String(x||'').trim()).filter(Boolean):[]; const rn=engBySite[s.id]?[...engBySite[s.id]]:[]; return [...new Set([...cw,...rn])].sort(); };
  const rows=sites.map(s=>{
    const ps=+parseYmd(s.planned_start), pe=+parseYmd(s.planned_end)+DAY;
    const l=clamp(pct(ps)), r=clamp(pct(pe)), w=Math.max(1.5,r-l);
    const notReady = ragBySite[s.id]==='red';
    const col = notReady ? 'linear-gradient(90deg,#ef4444,#f87171)'
      : s.status==='Delayed'?'linear-gradient(90deg,#ef4444,#fb7185)'
      : s.status==='At Risk'?'linear-gradient(90deg,#f59e0b,#fbbf24)'
      : 'linear-gradient(90deg,#38bdf8,#22c55e)';
    const today=todayPct!=null?`<div class="gtoday" style="left:${clamp(todayPct)}%"></div>`:'';
    const cn=clientName(s.client_id); const engs=allocOf(s);
    const tip=cn+' · '+(s.code||s.city||'Site')+' · '+String(s.planned_start).slice(0,10)+' → '+String(s.planned_end).slice(0,10)+' · '+(s.status||'')+(notReady?' · ⚠ NOT READY — action required':'')+(engs.length?(' · '+engs.length+' eng: '+engs.join(', ')):' · no engineers allocated');
    return `<div class="grow${notReady?' attn':''}" onclick="enterClient('${s.client_id}')" style="cursor:pointer" title="${esc(tip)}"><div class="gname">${notReady?'<span title="Action required">⚠</span> ':''}${flagEmoji[s.country]||''} <b>${esc(s.code||s.city||'Site')}</b><span class="muted" style="font-weight:600;font-size:10px">${esc(cn.slice(0,18))}</span></div>
      <div class="gtrack">${gridHtml}<div class="gbar" style="left:${l}%;width:${w}%;background:${col}">${notReady?'⚠ ':''}${engs.length?engs.length+'👷':''}</div>${today}</div></div>`;
  }).join('');
  const gantt=`<div class="gantt gantt-hq">${scale}${rows}<div class="legend"><span><i style="background:#ef4444"></i> ⚠ Not ready — action required</span><span><i style="background:#38bdf8"></i> In progress</span><span><i style="background:#f59e0b"></i> At risk</span><span>👷 = engineers allocated</span><span><i style="background:rgba(56,189,248,.95);width:2px;border-radius:0"></i> Today</span><span>click a job to open its client</span></div></div>`;
  const detRows=sites.map(s=>{ const cn=clientName(s.client_id); const engs=allocOf(s);
    return `<tr onclick="enterClient('${s.client_id}')" style="cursor:pointer"><td><b>${esc(cn)}</b></td><td>${flagEmoji[s.country]||''} ${esc(s.code||s.city||'Site')}</td><td>${esc(String(s.planned_start).slice(0,10))} → ${esc(String(s.planned_end).slice(0,10))}</td><td><span class="chip ${s.status==='Delayed'?'red':s.status==='At Risk'?'amber':'cyan'}">${esc(s.status||'Planned')}</span></td><td>${engs.length?engs.map(e=>`<span class="chip cyan" style="margin:1px 2px">${esc(e)}</span>`).join(''):'<span class="muted">none allocated</span>'}</td></tr>`; }).join('');
  const detail=`<div class="card" style="margin-top:16px"><h4>📋 Jobs — detail</h4><div class="csub">${sites.length} individual job${sites.length===1?'':'s'} in range · install window · status · engineers allocated · click to open</div>
    <table><thead><tr><th>Client</th><th>Job / site</th><th>Install window</th><th>Status</th><th>Engineers allocated</th></tr></thead><tbody>${detRows}</tbody></table></div>`;
  return {gantt,detail};
}
function hqPlanInner(){
  hqPlanInit(); const mode=HQPLAN.mode, from=HQPLAN.from, to=HQPLAN.to;
  const rota=(HQDATA&&HQDATA.rota)||[]; const sites=(HQDATA&&HQDATA.sites)||[]; const siteById={}; sites.forEach(s=>{ siteById[s.id]=s; });
  const fT=+parseYmd(from), tT=+parseYmd(to)+86400000-1;
  const segModes=[['month','Month'],['week','Week'],['day','Day'],['jobs','Jobs ▸ timeline']];
  const seg=`<div class="seg">${segModes.map(m=>`<button class="${mode===m[0]?'on':''}" onclick="hqPlanSetMode('${m[0]}')">${m[1]}</button>`).join('')}</div>`;
  const ctl=`<div class="planctl">${seg}<div class="planrange"><button class="navbtn" title="Previous" onclick="hqPlanShift(-1)">‹</button><input type="date" id="planFrom" value="${from}"><span class="ar">→</span><input type="date" id="planTo" value="${to}"><button class="navbtn" onclick="hqPlanApplyRange()">Apply</button><button class="navbtn" title="Next" onclick="hqPlanShift(1)">›</button><button class="navbtn ghost" onclick="hqPlanSetMode('${mode}')">Today</button></div></div>`;
  const titleBit = mode==='jobs' ? 'every individual job on a timeline' : (mode+' view');
  const headCard=`<div class="card"><h4>🗓 Planned Work — all clients (${titleBit})</h4><div class="csub">Confirmed shift rota <b style="color:var(--cyan)">●</b> and programme / install windows <b style="color:#a855f7">●</b> · only clients with work in the range are shown · switch to <b>Jobs ▸ timeline</b> to see every individual job</div>${ctl}`;
  if(mode==='jobs'){ const jg=hqJobsGantt(); return headCard+jg.gantt+`</div>`+jg.detail; }
  const cols=hqPlanCols(mode,from,to);
  const colByKey={}; cols.forEach(c=>colByKey[c.key]=c);
  const agg={};
  const cellOf=(cid,ck)=>{ const c=agg[cid]||(agg[cid]={}); return c[ck]||(c[ck]={days:new Set(),eng:new Set(),sites:new Set(),shifts:0,prog:new Set()}); };
  // source 1: confirmed shift rota
  rota.forEach(r=>{ if(!r.shift_date) return; const x=+parseYmd(r.shift_date); if(x<fT||x>tT) return; const ck=hqBucketKey(mode,r.shift_date); if(!colByKey[ck]) return; const cell=cellOf(r.client_id,ck); cell.shifts++; cell.days.add(r.shift_date); if(r.engineer) cell.eng.add(r.engineer); const s=siteById[r.site_id]; cell.sites.add(s?(s.code||s.city||'Site'):'General'); });
  // source 2: programme / install windows (site planned_start..planned_end) — completed jobs are excluded (they live in Completed Works)
  sites.forEach(s=>{ if(!s.planned_start||!s.planned_end||!s.client_id) return; if(['Complete','Closed'].includes(String(s.status||''))) return; const ps=+parseYmd(s.planned_start), pe=+parseYmd(s.planned_end); if(pe<fT||ps>tT) return; cols.forEach(c=>{ if(pe>=c.t0 && ps<=c.t1){ cellOf(s.client_id,c.key).prog.add(s.code||s.city||'Site'); } }); });
  const clientIds=Object.keys(agg);
  if(!clientIds.length) return headCard+emptyState('📅','No planned work in this range','Nothing in any Shift Rota or programme for these dates. Use ‹ › or change the range to look at another period.')+`</div>`;
  const rotaMetric=cell=> mode==='day' ? (cell.eng.size||cell.shifts) : cell.days.size;
  let maxRota=1, maxProg=1; clientIds.forEach(cid=>Object.values(agg[cid]).forEach(cell=>{ const mv=rotaMetric(cell); if(mv>maxRota)maxRota=mv; if(cell.prog.size>maxProg)maxProg=cell.prog.size; }));
  const rows=clientIds.map(cid=>{ const cells=Object.values(agg[cid]); return {cid, rdays:cells.reduce((a,c)=>a+c.days.size,0), psites:new Set(cells.flatMap(c=>[...c.prog])).size}; }).sort((a,b)=> (b.rdays-a.rdays) || (b.psites-a.psites) || clientName(a.cid).localeCompare(clientName(b.cid)));
  const todayKey=hqBucketKey(mode,ymd(new Date()));
  const head=`<tr><th class="msticky">Client</th>${cols.map(c=>`<th class="${c.key===todayKey?'mnow':''}">${esc(c.label)}<div class="myr">${esc(c.sub)}</div></th>`).join('')}</tr>`;
  const body=rows.map(rw=>{ const cm=agg[rw.cid];
    const cells=cols.map(c=>{ const cell=cm[c.key]; if(!cell) return `<td class="mcell empty ${c.key===todayKey?'mnow':''}">·</td>`;
      const hasRota=cell.days.size>0, hasProg=cell.prog.size>0;
      const tipBits=[clientName(rw.cid), c.full];
      if(hasRota) tipBits.push('Shifts: '+cell.days.size+' day'+(cell.days.size===1?'':'s')+' · '+cell.eng.size+' eng ('+([...cell.eng].sort().join(', ')||'unassigned')+')');
      if(hasProg) tipBits.push('Programme: '+[...cell.prog].join(', '));
      const tip=tipBits.join(' · ');
      if(hasRota){ const inten=(0.22+0.78*(rotaMetric(cell)/maxRota)).toFixed(2); const big= mode==='day'? cell.eng.size : cell.days.size; const small= mode==='day'? '' : `<span>${cell.eng.size}👷</span>`;
        return `<td class="mcell ${c.key===todayKey?'mnow':''}" style="background:rgba(56,189,248,${inten})" title="${esc(tip)}"><b>${big}</b>${small}${hasProg?'<span class="pflag" title="Programme / install window">📐</span>':''}</td>`; }
      // programme-only cell
      const inten=(0.2+0.6*(cell.prog.size/maxProg)).toFixed(2);
      return `<td class="mcell progcell ${c.key===todayKey?'mnow':''}" style="background:rgba(168,85,247,${inten})" title="${esc(tip)}"><b>${cell.prog.size}</b><span>📐</span></td>`;
    }).join('');
    const tag=rw.rdays?`${rw.rdays}d`:''; const ptag=rw.psites?`${rw.psites}📐`:'';
    return `<tr onclick="enterClient('${rw.cid}')" style="cursor:pointer"><td class="msticky"><b>${esc(clientName(rw.cid))}</b><span class="muted" style="font-size:10px"> ${[tag,ptag].filter(Boolean).join(' · ')}</span></td>${cells}</tr>`;
  }).join('');
  const grid=`<div class="mgrid-wrap"><table class="mgrid">${head}${body}</table></div>
    <div class="legend"><span><i style="background:rgba(56,189,248,.85)"></i> ${mode==='day'?'Confirmed shifts — engineers on site':'Confirmed shifts — days planned'}</span><span><i style="background:rgba(168,85,247,.8)"></i> 📐 Programme / install window — sites on site</span><span>darker = busier</span><span>hover a cell for detail · click a client to open</span></div>`;
  const detRows=[];
  rows.forEach(rw=>{ const cm=agg[rw.cid]; cols.forEach(c=>{ const cell=cm[c.key]; if(!cell) return; const engs=[...cell.eng].sort(); const hasRota=cell.days.size>0, hasProg=cell.prog.size>0;
    const type=hasRota&&hasProg?'<span class="chip cyan">Shifts</span> <span class="chip violet">Programme</span>':hasRota?'<span class="chip cyan">Shifts</span>':'<span class="chip violet">Programme</span>';
    const siteList=[...new Set([...cell.sites,...cell.prog])].map(s=>esc(s)).join(', ');
    const who=engs.length?engs.map(e=>`<span class="chip cyan" style="margin:1px 2px">${esc(e)}</span>`).join(''):(hasProg?'<span class="muted">install window — no shifts yet</span>':'<span class="muted">unassigned</span>');
    detRows.push(`<tr onclick="enterClient('${rw.cid}')" style="cursor:pointer"><td><b>${esc(clientName(rw.cid))}</b></td><td>${esc(c.full)}</td><td>${type}</td><td>${siteList}</td><td>${cell.days.size||'—'}</td><td>${who}</td></tr>`); }); });
  const detail=`<div class="card" style="margin-top:16px"><h4>📋 Planned work — detail</h4><div class="csub">Shifts and programme windows in the selected range · click a row to open the client</div>
    <table><thead><tr><th>Client</th><th>${mode==='month'?'Month':mode==='week'?'Week of':'Date'}</th><th>Type</th><th>Site(s)</th><th>Shift days</th><th>Engineers / status</th></tr></thead><tbody>${detRows.join('')}</tbody></table></div>`;
  return headCard+grid+`</div>`+detail;
}

/* ============ JOB STATUS — internal mobilisation / readiness (RAG) ============ */
const JOB_RISK=['Low','Medium','High'];
function siteDone(s){ return ['Complete','Closed'].includes(String(s.status||'')) || Number(s.progress_pct||0)>=100; }
/* AUTO job readiness — every live site/job is derived from your real data.
   No manual entry: labour comes from the rota/teams, documents from the
   document vault, dates from the site schedule. Stays RED until ready. */
function autoJobs(){
  if(!HQDATA) return [];
  const sites=(HQDATA.sites||[]).filter(s=>!siteDone(s));
  const rota=(HQDATA.rota||[]); const docs=(HQDATA.documents||[]);
  const overrides={}; (HQDATA.jobs||[]).forEach(j=>{ if(j.site_id) overrides[j.site_id]=j; });
  const engBySite={}; rota.forEach(r=>{ if(r.site_id&&r.engineer){ (engBySite[r.site_id]=engBySite[r.site_id]||new Set()).add(r.engineer); } });
  // supplier (temp-labour) engineers booked onto a site count toward the labour check too
  const supBySite={}; (SDATA.assignments||[]).forEach(a=>{ if(a.site_id && ['Booked','On site'].includes(a.status)){ const nm=supEngName(a.engineer_id); if(nm&&nm!=='—') (supBySite[a.site_id]=supBySite[a.site_id]||new Set()).add(nm+' (agency)'); } });
  const docByClient={}; docs.forEach(d=>{ docByClient[d.client_id]=(docByClient[d.client_id]||0)+1; });
  return sites.map(s=>{
    const o=overrides[s.id]||{};
    const oc=Array.isArray(o.checklist)?o.checklist:[];
    const manualAuto={}; oc.forEach(it=>{ if(it&&it.auto&&it.key) manualAuto[it.key]=!!it.done; });  // manually-actioned auto checks
    // engineers allocated = crew assigned on the site + anyone booked on the rota (deduped)
    const rotaNames=engBySite[s.id]?[...engBySite[s.id]]:[];
    const supNames=supBySite[s.id]?[...supBySite[s.id]]:[];
    const crewNames=Array.isArray(s.crew)?s.crew.map(c=>c&&(c.name||(typeof c==='string'?c:''))).map(x=>String(x||'').trim()).filter(Boolean):[];
    const engs=[...new Set([...crewNames,...rotaNames,...supNames])].sort();
    const reqN=Number(o.engineers_required||0);
    let labourData, labourInfo;
    if(reqN>0){ labourData = engs.length>=reqN; labourInfo = engs.length+' of '+reqN+' allocated'+(engs.length?(' — '+engs.join(', ')):''); }
    else { labourData = engs.length>0 || !!s.team_id; labourInfo = engs.length?engs.join(', '):(s.team_id?'Team assigned':''); }
    const hasDocs = (docByClient[s.client_id]||0)>0;
    const labourLabel = reqN>0 ? ('Engineers allocated ('+engs.length+'/'+reqN+')') : 'Engineers / labour allocated';
    const checks=[
      {key:'start', label:'Start date confirmed', auto:true, dataDone:!!s.planned_start, manualDone:!!manualAuto.start, done: !!s.planned_start||!!manualAuto.start},
      {key:'labour', label:labourLabel, auto:true, dataDone:labourData, manualDone:!!manualAuto.labour, done: labourData||!!manualAuto.labour, info: labourInfo, reqN:reqN },
      {key:'docs', label:'Documents in place (RAMS, risk assessment…)', auto:true, dataDone:hasDocs, manualDone:!!manualAuto.docs, done: hasDocs||!!manualAuto.docs}
    ];
    oc.forEach(it=>{ if(it&&it.label&&!it.auto) checks.push({label:it.label, done:!!it.done, custom:true}); });
    return {site:s, id:s.id, client_id:s.client_id, title:(s.code||s.city||'Site'), loc:[s.city,s.country].filter(Boolean).join(', '), start_date:s.planned_start||null, checks, engs, override:o, status_override:(o.status_override||null), risk:(o.risk||'Medium'), notes:o.notes||''};
  });
}
function jobStatus(j){
  const outstanding=(j.checks||[]).filter(c=>!c.done);
  const today=new Date(); today.setHours(0,0,0,0);
  const daysTo=j.start_date? Math.ceil((parseYmd(j.start_date)-today)/86400000) : null;
  if(j.status_override && ['green','amber','red'].includes(j.status_override)){ const m={green:'Ready (set)',amber:'Watch (set)',red:'Held (set)'}; return {cls:j.status_override,label:m[j.status_override],outstanding,daysTo,manual:true}; }
  if(!outstanding.length) return {cls:'green',label:'Ready to start',outstanding,daysTo};
  return {cls:'red',label:'Not ready — actions outstanding',outstanding,daysTo};   // stays red until everything is in place
}
function riskChip(r){ const c=r==='High'?'red':r==='Low'?'green':'amber'; return `<span class="chip ${c}">${esc(r||'Medium')}</span>`; }
function pageJobs(){
  if(PROFILE.role!=='admin') return emptyState('🔒','Admins only','Job Status is an internal mobilisation-control view for Mercury administrators.');
  if(!HQDATA) return emptyState('⏳','Loading…','One moment…');
  const jobs=autoJobs();
  const completed=(HQDATA.sites||[]).filter(siteDone).length;
  const withStat=jobs.map(j=>({j,s:jobStatus(j)}));
  const notReady=withStat.filter(x=>x.s.cls!=='green').sort((a,b)=>{ const da=a.j.start_date||'9999-99', db=b.j.start_date||'9999-99'; return String(da).localeCompare(String(db)); });
  const ready=withStat.filter(x=>x.s.cls==='green').sort((a,b)=>{ const da=a.j.start_date||'9999-99', db=b.j.start_date||'9999-99'; return String(da).localeCompare(String(db)); });
  const k=`<div class="grid kpis">
    ${kpi('r','🔴','Not ready',notReady.length,'')}
    ${kpi('g','🟢','Ready to start',ready.length,'')}
    ${kpi('c','🗄','Completed (archived)',completed,'','completed')}
    ${kpi('c','🗓','Live jobs',jobs.length,'')}</div>`;
  const header=`<div class="sechead"><h3>🚦 Job Status — Mobilisation Control</h3><span class="sub">Auto-built from your sites, rota &amp; documents · red until ready, then it drops off</span><span class="line"></span><button class="addbtn reportbtn" onclick="loadHQ().then(()=>go('jobs'))">↻ Refresh</button></div>`;
  const intro=`<div class="card" style="margin-bottom:14px"><div class="csub" style="margin:0">Every live job appears here automatically. It stays 🔴 <b>red</b> until the engineers are allocated, the documents are in place and the start date is confirmed — then it turns 🟢 <b>ready</b> and drops off the action list. When the works are finished it moves to <b onclick="go('completed')" style="cursor:pointer;color:var(--cyan)">Completed Works ↗</b>. Click any job to add site-specific checks (permits, materials, access…).</div></div>`;
  const rowOf=(x)=>{ const j=x.j, s=x.s; const total=j.checks.length, done=total-s.outstanding.length;
    const due=s.daysTo==null?'<span class="muted">no date</span>':(s.daysTo<0?`<span class="chip red">${-s.daysTo}d ago</span>`:s.daysTo===0?'<span class="chip red">today</span>':(s.daysTo<=7?`<span class="chip amber">${s.daysTo}d</span>`:`${s.daysTo}d`));
    const out=s.outstanding.length?s.outstanding.slice(0,5).map(i=>`<span class="chip ${s.cls==='green'?'green':'red'}" style="margin:1px 2px">${esc(i.label)}</span>`).join('')+(s.outstanding.length>5?` <span class="muted">+${s.outstanding.length-5}</span>`:''):'<span class="chip green">All in place</span>';
    return `<tr onclick="openJobReadiness('${j.id}')" style="cursor:pointer">
      <td><span class="rag rag-${s.cls}"></span><b>${esc(s.label)}</b></td>
      <td><b>${esc(j.title)}</b><div class="muted" style="font-size:11px">${esc(clientName(j.client_id))}${j.loc?(' · '+esc(j.loc)):''}</div></td>
      <td>${esc(j.start_date?String(j.start_date).slice(0,10):'—')}</td>
      <td>${due}</td>
      <td><div class="pcell" style="min-width:70px"><div class="pbar ${done>=total&&total?'green':'cyan'}"><i style="width:${total?Math.round(done/total*100):0}%"></i></div><b>${done}/${total}</b></div></td>
      <td>${out}</td></tr>`; };
  const notReadyTable = notReady.length
    ? `<div class="card"><h4>🔴 Needs action before start</h4><div class="csub">Jobs that aren’t ready yet — soonest first</div><table><thead><tr><th>Status</th><th>Job</th><th>Start</th><th>Due in</th><th>Readiness</th><th>Outstanding</th></tr></thead><tbody>${notReady.map(rowOf).join('')}</tbody></table></div>`
    : `<div class="card">${emptyState('✅','Everything is ready','No live job has outstanding actions. New jobs appear here automatically as soon as a site or shift is created.')}</div>`;
  const readyBlock = ready.length
    ? `<details class="mfolder" style="margin-top:16px"><summary><span class="mf-name">🟢 Ready to start (${ready.length})</span><span class="mf-count">fully mobilised — kept here until the works complete</span></summary><div class="card" style="margin-top:10px"><table><thead><tr><th>Status</th><th>Job</th><th>Start</th><th>Due in</th><th>Readiness</th><th></th></tr></thead><tbody>${ready.map(rowOf).join('')}</tbody></table></div></details>`
    : '';
  if(!jobs.length) return header+k+emptyState('🚦','No live jobs yet','Jobs appear here automatically from your Sites &amp; Schedule and Shift Rota. Add a site (with a start date) or book a shift and it shows up instantly — red until it’s fully ready.');
  return header+k+intro+notReadyTable+readyBlock;
}
/* Optional: add job-specific checks / notes / a manual hold to a site.
   Auto checks (labour, docs, date) are shown read-only. */
function openJobReadiness(siteId){
  const job=autoJobs().find(j=>j.id===siteId); if(!job){ alert('Job not found.'); return; }
  const o=job.override||{};
  const riskOpts=JOB_RISK.map(x=>`<option ${ (o.risk||'Medium')===x?'selected':''}>${x}</option>`).join('');
  const ovOpts=[['','Auto (from checks)'],['green','Force Ready (green)'],['amber','Watch (amber)'],['red','Hold (red)']].map(x=>`<option value="${x[0]}" ${ (o.status_override||'')===x[0]?'selected':''}>${x[1]}</option>`).join('');
  const autoChecks=job.checks.filter(c=>c.auto);
  JR_AUTO={}; JR_AUTODEFS=autoChecks.map(c=>({key:c.key,label:c.label}));
  autoChecks.forEach(c=>{ JR_AUTO[c.key]=!!c.manualDone; });
  const autoRows=autoChecks.map(c=>{
    if(c.dataDone) return `<div class="jcheck-ro"><span class="rag rag-green"></span><b>${esc(c.label)}</b>${c.info?`<span class="muted" style="font-size:11px"> · ${esc(c.info)}</span>`:''}<span class="muted" style="margin-left:auto;font-size:11px">in place</span></div>`;
    const on=!!c.manualDone;
    return `<div class="jcheck-ro jclick" id="auto_${c.key}" onclick="toggleAutoCheck('${c.key}')"><span class="rag rag-${on?'green':'red'}"></span><b>${esc(c.label)}</b><span class="autostate" style="margin-left:auto;font-size:11px;color:${on?'var(--green)':'var(--red)'}">${on?'✓ actioned — click to undo':'outstanding — click to mark actioned'}</span></div>`;
  }).join('');
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>${esc(job.title)} — readiness</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="box see" style="background:var(--panel2);border:1px dashed var(--line2);border-radius:10px;padding:11px 13px;font-size:12.5px;color:var(--muted);margin-bottom:14px">${esc(clientName(job.client_id))}${job.loc?(' · '+esc(job.loc)):''}${job.start_date?(' · starts '+String(job.start_date).slice(0,10)):''}. These checks update automatically from your rota, documents and schedule. Add any job-specific items below.</div>
      <div class="fld"><label>Automatic checks</label><div class="jauto">${autoRows}</div></div>
      <div class="fld"><label>Engineers required for this job</label><input id="j_engreq" type="number" min="0" step="1" value="${o.engineers_required!=null?o.engineers_required:''}" placeholder="e.g. 4 — the labour check clears once this many are booked on the rota (leave blank for ‘any labour’)"></div>
      <div class="fld">
        <div class="crewhd"><label style="margin:0">Extra job-specific checks</label><button type="button" class="edit-btn" onclick="addJobCheck()">＋ Add item</button></div>
        <div id="jChecks"></div>
        <div class="note">e.g. permits, parking/access, special materials, lifting plan. Tick when confirmed.</div>
      </div>
      <div class="frow">
        <div class="fld"><label>Manual status override</label><select id="j_override">${ovOpts}</select></div>
        <div class="fld"><label>Risk if not ready</label><select id="j_risk">${riskOpts}</select></div>
      </div>
      <div class="fld"><label>Notes</label><input id="j_notes" value="${esc(o.notes||'')}" placeholder="Optional"></div>
    </div>
    <div class="modal-foot">
      ${o.id?`<button class="btn-ghost" style="color:var(--red)" onclick="clearJobReadiness('${o.id}')">Clear custom items</button>`:''}
      <button class="btn-ghost" onclick="closeForm()">Cancel</button>
      <button class="btn" id="jobSave" onclick="saveJobReadiness('${siteId}','${o.id||''}')">Save</button>
    </div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
  (Array.isArray(o.checklist)?o.checklist:[]).forEach(c=>{ if(c&&c.label&&!c.auto) addJobCheck(c.label,c.done); });
}
let JR_AUTO={}, JR_AUTODEFS=[];
function toggleAutoCheck(key){
  JR_AUTO[key]=!JR_AUTO[key];
  const row=el('auto_'+key); if(!row) return;
  const dot=row.querySelector('.rag'), st=row.querySelector('.autostate');
  if(JR_AUTO[key]){ if(dot)dot.className='rag rag-green'; if(st){ st.textContent='✓ actioned — click to undo'; st.style.color='var(--green)'; } }
  else { if(dot)dot.className='rag rag-red'; if(st){ st.textContent='outstanding — click to mark actioned'; st.style.color='var(--red)'; } }
}
function jobCheckRow(label,done){ return `<div class="jcheck"><label class="jck"><input type="checkbox" class="jc-d" ${done?'checked':''}><span>done</span></label><input class="jc-l" value="${esc(label||'')}" placeholder="Action / requirement"><button type="button" class="crew-rm" title="Remove" onclick="this.closest('.jcheck').remove()">✕</button></div>`; }
function addJobCheck(label,done){ const w=el('jChecks'); if(w) w.insertAdjacentHTML('beforeend', jobCheckRow(label||'',!!done)); }
function collectJobChecks(){ return [...document.querySelectorAll('#jChecks .jcheck')].map(r=>({label:r.querySelector('.jc-l').value.trim(), done:r.querySelector('.jc-d').checked})).filter(i=>i.label); }
async function saveJobReadiness(siteId,overrideId){
  const site=(HQDATA.sites||[]).find(s=>s.id===siteId)||{};
  const btn=el('jobSave'); btn.disabled=true; btn.textContent='Saving…'; msg('','');
  const autoItems=(JR_AUTODEFS||[]).filter(d=>JR_AUTO[d.key]).map(d=>({auto:true,key:d.key,label:d.label,done:true}));
  const checklist=collectJobChecks().concat(autoItems);
  const engreq=parseInt(val('j_engreq'),10);
  const row={ client_id:site.client_id||null, site_id:siteId, site_label:(site.code||site.city||null), title:(site.code||site.city||'Site'), start_date:site.planned_start||null, risk:val('j_risk')||'Medium', engineers_required:(isNaN(engreq)?null:engreq), checklist:checklist, status_override:val('j_override')||null, notes:val('j_notes')||null };
  const res = overrideId ? await sb.from('job_readiness').update(row).eq('id',overrideId) : await sb.from('job_readiness').insert(row);
  if(res.error){ btn.disabled=false; btn.textContent='Save'; msg('Could not save: '+res.error.message,'err'); return; }
  msg('✓ Saved.','ok'); await loadHQ(); setTimeout(()=>{ closeForm(); go('jobs'); },400);
}
async function clearJobReadiness(overrideId){
  if(!confirm('Remove the custom checks/notes for this job? The automatic checks stay.')) return;
  const {error}=await sb.from('job_readiness').delete().eq('id',overrideId);
  if(error){ alert('Could not clear: '+error.message); return; }
  await loadHQ(); closeForm(); go('jobs');
}
/* ============ COMPLETED WORKS — archive of finished jobs ============ */
function pageCompleted(){
  const allClients = (PROFILE.role==='admin' && VIEW!=='client');
  const src = (allClients && HQDATA) ? (HQDATA.sites||[]) : ((DATA&&DATA.sites)||[]);
  const done = src.filter(siteDone).slice().sort((a,b)=> String(b.planned_end||b.planned_start||'').localeCompare(String(a.planned_end||a.planned_start||'')));
  const header=`<div class="sechead"><h3>🗄 Completed Works</h3><span class="sub">Finished jobs — archived &amp; kept on record</span><span class="line"></span></div>`;
  if(!done.length) return header+emptyState('🗄','No completed works yet','When a site/job is marked Complete it moves here automatically — off the live schedule, but kept on record so nothing is lost.');
  const fmt=d=>d?String(d).slice(0,10):'—';
  const dur=(a,b)=>{ if(!a||!b) return '—'; const days=Math.round((parseYmd(b)-parseYmd(a))/86400000)+1; return days>0?days+'d':'—'; };
  const rows=done.map(s=>`<tr>
    ${allClients?`<td><b>${esc(clientName(s.client_id))}</b></td>`:''}
    <td><span class="site-code">${esc(s.code||'—')}</span><div class="muted" style="font-size:11px">${esc(s.city||'')}${s.country?(' · '+esc(s.country)):''}</div></td>
    <td>${fmt(s.planned_start)}</td>
    <td>${fmt(s.planned_end)}</td>
    <td>${dur(s.planned_start,s.planned_end)}</td>
    <td><span class="chip green">${esc(s.status||'Complete')}</span></td>
    <td><div class="pcell" style="min-width:70px"><div class="pbar green"><i style="width:${Math.min(100,Math.round(s.progress_pct||100))}%"></i></div><b>${Math.min(100,Math.round(s.progress_pct||100))}%</b></div></td>
    </tr>`).join('');
  return header+`<div class="card"><div class="csub">${done.length} completed job${done.length===1?'':'s'}${allClients?' across all clients':''} · most recent first</div>
    <table><thead><tr>${allClients?'<th>Client</th>':''}<th>Site</th><th>Started</th><th>Completed</th><th>Duration</th><th>Status</th><th>Final progress</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/* ================= DAILY DIGEST (admin) =================
   One-glance "what needs you today" pulled from across the business. */
function digestData(){
  const today=ymd(new Date());
  const feed=(typeof hqReportFeed==='function')?hqReportFeed():[];
  const todays=feed.filter(x=>String(x.when||'').slice(0,10)===today);
  const submitted=new Set(todays.map(x=>x.client_id));
  const noReport=(CLIENTS||[]).filter(c=>!submitted.has(c.id));
  const comp=(typeof complianceItems==='function')?complianceItems():[];
  const expired=comp.filter(x=>x.c==='red');
  const soon=comp.filter(x=>x.c==='amber' && x.days!=null && x.days<=14);
  const tsPending=(SDATA.timesheets||[]).filter(t=>t.status==='Submitted');
  const openCO=(HQDATA&&HQDATA.callouts?HQDATA.callouts:[]).filter(isOpenCallout);
  const p1=openCO.filter(r=>r.priority==='Priority 1');
  const breaches=openCO.filter(r=>slaState(r).cls==='breach');
  const notReady=(typeof autoJobs==='function')?autoJobs().map(j=>({j,s:jobStatus(j)})).filter(x=>x.s.cls!=='green'):[];
  const newReq=(HQDATA&&HQDATA.requests?HQDATA.requests:[]).filter(r=>['New','Reviewing'].includes(String(r.status||'')));
  return {today,todays,noReport,expired,soon,tsPending,openCO,p1,breaches,notReady,newReq};
}
function pageDigest(){
  if(PROFILE.role!=='admin') return emptyState('🔒','Admins only','This is the Mercury business digest.');
  if(!HQDATA) return emptyState('⏳','Loading…','One moment…');
  const d=digestData();
  const today=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  const k=`<div class="grid kpis" style="margin-bottom:14px">
    ${kpi('v','📋','Reports today',d.todays.length,'')}
    ${kpi(d.expired.length?'r':'g','⛔','Compliance expired',d.expired.length,'')}
    ${kpi(d.tsPending.length?'a':'g','⏱','Timesheets to approve',d.tsPending.length,'')}
    ${kpi(d.p1.length?'r':'g','🚨','Priority 1 open',d.p1.length,'')}
  </div>`;
  const sec=(icon,title,body,page,cta)=>`<div class="card" style="margin-bottom:14px"><div class="sechead" style="margin:0 0 8px"><h4 style="margin:0">${icon} ${title}</h4><span class="line"></span>${page?`<button class="edit-btn" onclick="go('${page}')">${cta||'Open'} →</button>`:''}</div>${body}</div>`;
  const chip=(t,c)=>`<span class="chip ${c}">${esc(t)}</span>`;
  // reports
  const repBody = `<div class="csub" style="margin:0 0 6px">${d.todays.length} report${d.todays.length===1?'':'s'} in today.</div>` +
    (d.noReport.length? `<div class="note" style="border-left:3px solid var(--amber);padding-left:10px;font-size:12.5px">⚠ <b>No report yet today</b> from: ${d.noReport.map(c=>esc(c.name)).join(', ')}</div>` : `<div class="note" style="border-left:3px solid var(--green);padding-left:10px;font-size:12.5px">✅ Every client has submitted today.</div>`);
  // compliance
  const compBody = (d.expired.length||d.soon.length)
    ? `<div class="csub" style="margin:0 0 6px">${d.expired.length} expired · ${d.soon.length} expiring within 14 days.</div><div>${d.expired.slice(0,6).map(x=>`${chip(x.who+' — '+x.subject,'red')} `).join('')}${d.soon.slice(0,6).map(x=>`${chip(x.who+' — '+x.subject+' ('+x.days+'d)','amber')} `).join('')}</div>`
    : `<div class="note" style="border-left:3px solid var(--green);padding-left:10px;font-size:12.5px">✅ Nothing expired or expiring in the next two weeks.</div>`;
  // timesheets
  const tsBody = d.tsPending.length ? `<div class="csub" style="margin:0">${d.tsPending.length} timesheet${d.tsPending.length===1?'':'s'} waiting for your approval.</div>` : `<div class="note" style="border-left:3px solid var(--green);padding-left:10px;font-size:12.5px">✅ No timesheets waiting.</div>`;
  // call-outs / SLA
  const coBody = d.openCO.length ? `<div>${chip(d.openCO.length+' open','cyan')} ${d.p1.length?chip(d.p1.length+' Priority 1','red'):''} ${d.breaches.length?chip(d.breaches.length+' SLA breach','red'):''}</div>` : `<div class="note" style="border-left:3px solid var(--green);padding-left:10px;font-size:12.5px">✅ No open call-outs.</div>`;
  // jobs not ready
  const jobBody = d.notReady.length ? `<div class="csub" style="margin:0 0 6px">${d.notReady.length} job${d.notReady.length===1?'':'s'} not yet ready to mobilise.</div>${d.notReady.slice(0,5).map(x=>`<div style="font-size:12.5px">• ${esc(x.j.title)} <span class="muted">(${esc(clientName(x.j.client_id))}${x.j.start_date?(' · '+String(x.j.start_date).slice(0,10)):''})</span></div>`).join('')}` : `<div class="note" style="border-left:3px solid var(--green);padding-left:10px;font-size:12.5px">✅ All live jobs are ready.</div>`;
  // requests
  const reqBody = d.newReq.length ? `<div class="csub" style="margin:0">${d.newReq.length} new work/quote request${d.newReq.length===1?'':'s'} to review.</div>` : `<div class="note" style="border-left:3px solid var(--green);padding-left:10px;font-size:12.5px">✅ No new requests.</div>`;
  return `<div class="sechead"><h3>📨 Daily Digest</h3><span class="sub">${esc(today)} · what needs you today, across all clients</span><span class="line"></span><button class="addbtn reportbtn" onclick="copyDigest()">📋 Copy for email</button></div>`
    + k
    + sec('📋','Reports',repBody,'hq','Reports')
    + sec('🛡','Compliance',compBody,'compliance','Compliance')
    + sec('⏱','Timesheets to approve',tsBody,'suppliers','Suppliers')
    + sec('🔧','Open call-outs &amp; SLA',coBody,'command','Command Centre')
    + sec('🚦','Jobs to mobilise',jobBody,'jobs','Job Status')
    + sec('🛠','New requests',reqBody,'hq','HQ');
}
function copyDigest(){
  const d=digestData(); const L=[];
  L.push('MERCURY — DAILY DIGEST · '+new Date().toLocaleDateString('en-GB'));
  L.push('');
  L.push('REPORTS TODAY: '+d.todays.length);
  if(d.noReport.length) L.push('  No report yet from: '+d.noReport.map(c=>c.name).join(', '));
  L.push('COMPLIANCE: '+d.expired.length+' expired, '+d.soon.length+' expiring within 14 days');
  d.expired.slice(0,12).forEach(x=>L.push('  [EXPIRED] '+x.who+' — '+x.subject));
  d.soon.slice(0,12).forEach(x=>L.push('  [SOON] '+x.who+' — '+x.subject+' ('+x.days+'d)'));
  L.push('TIMESHEETS TO APPROVE: '+d.tsPending.length);
  L.push('OPEN CALL-OUTS: '+d.openCO.length+' ('+d.p1.length+' Priority 1, '+d.breaches.length+' SLA breach)');
  L.push('JOBS NOT READY TO MOBILISE: '+d.notReady.length);
  d.notReady.slice(0,10).forEach(x=>L.push('  • '+x.j.title+' ('+clientName(x.j.client_id)+')'));
  L.push('NEW WORK/QUOTE REQUESTS: '+d.newReq.length);
  const text=L.join('\n');
  try{ navigator.clipboard.writeText(text).then(()=>alert('Digest copied — paste it into an email.'),()=>prompt('Copy the digest:',text)); }
  catch(e){ prompt('Copy the digest:',text); }
}
function pageHQ(){
  if(PROFILE.role!=='admin') return emptyState('🔒','Admins only','This business-wide view is for Mercury administrators.');
  if(!HQDATA) return emptyState('⏳','Loading business overview','One moment…');
  const items=hqItems();
  const co=HQDATA.callouts.filter(isOpenCallout);
  const p1=co.filter(r=>r.priority==='Priority 1').length;
  const breaches=co.filter(r=>slaState(r).cls==='breach').length;
  const expired=HQDATA.documents.filter(d=>d.expiry_date&&new Date(d.expiry_date)<Date.now()).length;
  const expiring=HQDATA.documents.filter(d=>{if(!d.expiry_date)return false;const dd=Math.ceil((new Date(d.expiry_date)-Date.now())/86400000);return dd>=0&&dd<=30;}).length;
  const crit=HQDATA.risks.filter(r=>String(r.risk_level||'')==='Critical'&&!['Closed','Complete'].includes(String(r.status||''))).length;
  const newReq=(HQDATA.requests||[]).filter(r=>['New','Reviewing'].includes(String(r.status||''))).length;
  // per-client rollup
  const byClient={};
  const bump=(cid,k)=>{ byClient[cid]=byClient[cid]||{co:0,br:0,dx:0,rk:0}; byClient[cid][k]++; };
  co.forEach(r=>{ bump(r.client_id,'co'); if(slaState(r).cls==='breach')bump(r.client_id,'br'); });
  HQDATA.documents.forEach(d=>{ if(d.expiry_date){const dd=Math.ceil((new Date(d.expiry_date)-Date.now())/86400000); if(dd<=30)bump(d.client_id,'dx');} });
  HQDATA.risks.forEach(r=>{ if(String(r.risk_level||'')==='Critical'&&!['Closed','Complete'].includes(String(r.status||'')))bump(r.client_id,'rk'); });
  const activeClients=Object.keys(byClient).sort((a,b)=>(byClient[b].co+byClient[b].br+byClient[b].dx+byClient[b].rk)-(byClient[a].co+byClient[a].br+byClient[a].dx+byClient[a].rk));
  const k=`<div class="grid kpis">
    ${kpi('c','🔧','Open Call-Outs',co.length,'')}
    ${kpi(breaches?'r':'g','⏱','SLA Breaches',breaches,'')}
    ${kpi(p1?'r':'g','🚨','Priority 1 Open',p1,'')}
    ${kpi(expired?'r':'g','📁','Docs Expired',expired,'')}
    ${kpi(expiring?'a':'g','⏳','Docs Expiring',expiring,'')}
    ${kpi(crit?'r':'g','⚠','Critical Risks',crit,'')}
    ${kpi(newReq?'c':'g','🛠','Work Requests',newReq,'')}
  </div>`;
  const list = items.length
    ? `<div class="list">${items.slice(0,40).map(it=>`<div class="litem"><div class="av" style="background:var(--${it.cls}-soft);color:var(--${it.cls})">${it.cat[0]}</div>
        <div class="bd"><div class="t">${esc(it.t)} <span class="chip ${it.cls}" style="margin-left:4px">${esc(it.cat)}</span></div><div class="m">${esc(clientName(it.client_id))}${it.m?(' · '+esc(it.m)):''} · ${esc(it.extra)}</div></div>
        <div class="when"><button class="addbtn sm" onclick="enterClientTo('${it.client_id}','${it.goPage||'overview'}')">Open →</button></div></div>`).join('')}</div>`
    : `<div class="empty"><div class="big">✅</div><b>Nothing needs attention</b><div style="font-size:13px;margin-top:4px">No open Priority-1s, SLA breaches, expiring documents or critical risks across any client.</div></div>`;
  const clientRows = activeClients.length
    ? activeClients.map(cid=>{const b=byClient[cid];return `<tr onclick="enterClient('${cid}')" style="cursor:pointer">
        <td><b>${esc(clientName(cid))}</b></td>
        <td>${b.co||0}</td>
        <td>${b.br?`<span class="chip red">${b.br}</span>`:'0'}</td>
        <td>${b.dx?`<span class="chip amber">${b.dx}</span>`:'0'}</td>
        <td>${b.rk?`<span class="chip red">${b.rk}</span>`:'0'}</td>
        <td><span class="pdf-link">Open →</span></td></tr>`;}).join('')
    : '<tr><td colspan="6" class="muted" style="text-align:center;padding:20px">All clear across every client.</td></tr>';
  // ---- Portfolio: every client's performance at a glance ----
  const sitesArr=HQDATA.sites||[]; const crmStatusArr=HQDATA.crmStatus||[]; const crmOppArr=HQDATA.crmOpps||[];
  const openCoByClient={}; co.forEach(r=>{ openCoByClient[r.client_id]=(openCoByClient[r.client_id]||0)+1; });
  const openRkByClient={}; HQDATA.risks.forEach(r=>{ if(!['Closed','Complete'].includes(String(r.status||''))) openRkByClient[r.client_id]=(openRkByClient[r.client_id]||0)+1; });
  const crmByClient={}; crmStatusArr.forEach(s=>{ crmByClient[s.client_id]=s; });
  const pipeByClient={}; let pipeTotal=0; crmOppArr.forEach(o=>{ if(String(o.stage||'')!=='Lost' && String(o.stage||'')!=='Won'){ pipeByClient[o.client_id]=(pipeByClient[o.client_id]||0)+Number(o.value||0); pipeTotal+=Number(o.value||0); } });
  let followsDue=0; crmStatusArr.forEach(s=>{ if(s.next_follow_up){ const days=Math.ceil((new Date(s.next_follow_up)-Date.now())/86400000); if(days<=7) followsDue++; } });
  const portfolio=(CLIENTS||[]).map(c=>{
    const cs=sitesArr.filter(s=>s.client_id===c.id);
    const active=cs.filter(s=>!['Pending','Not Started','Complete','Closed'].includes(String(s.status||'')));
    const avg=active.length?Math.round(active.reduce((a,s)=>a+Number(s.progress_pct||0),0)/active.length):0;
    const done=cs.filter(s=>s.status==='Complete').length;
    const st=crmByClient[c.id]||{};
    return {c, total:cs.length, active:active.length, done, avg, co:openCoByClient[c.id]||0, rk:openRkByClient[c.id]||0, stage:st.stage, follow:st.next_follow_up, pipe:pipeByClient[c.id]||0};
  }).sort((a,b)=>b.total-a.total || b.avg-a.avg);
  const portfolioRows = portfolio.length ? portfolio.map(p=>{
    const fs=followState(p.follow);
    return `<tr onclick="enterClient('${p.c.id}')" style="cursor:pointer">
      <td><b>${esc(p.c.name)}</b></td>
      <td>${crmStageChip(p.stage)}</td>
      <td>${p.total} <span class="muted" style="font-size:11px">(${p.active} live)</span></td>
      <td><div class="pcell" style="min-width:90px"><div class="pbar ${p.avg>=100?'green':'cyan'}"><i style="width:${p.avg}%"></i></div><b>${p.avg}%</b></div></td>
      <td>${p.co?`<span class="chip amber">${p.co}</span>`:'0'}</td>
      <td>${p.rk?`<span class="chip red">${p.rk}</span>`:'0'}</td>
      <td>${p.follow?`<span class="chip ${fs.c}">${esc(fs.label||String(p.follow).slice(0,10))}</span>`:'<span class="muted">—</span>'}</td>
      <td>${p.pipe?gbp(p.pipe):'<span class="muted">—</span>'}</td></tr>`;
  }).join('') : '<tr><td colspan="8" class="muted" style="text-align:center;padding:20px">No clients yet.</td></tr>';
  const plan=hqPlannedWork();
  // ---- job readiness (mobilisation) summary — auto-derived ----
  const ajobs=autoJobs().map(j=>({j,s:jobStatus(j)}));
  const jr={green:0,red:0}; ajobs.forEach(x=>{ if(x.s.cls==='green')jr.green++; else jr.red++; });
  const nextNotReady=ajobs.filter(x=>x.s.cls!=='green').sort((a,b)=>String(a.j.start_date||'9999').localeCompare(String(b.j.start_date||'9999'))).slice(0,5);
  const jobsCard=`<div class="card" style="margin-top:16px"><div class="sechead" style="margin:0 0 10px"><h4 style="margin:0">🚦 Job Status — mobilisation readiness</h4><span class="sub">${jr.red} not ready · ${jr.green} ready</span><span class="line"></span><button class="edit-btn" onclick="go('jobs')">Open Job Status →</button></div>${
    nextNotReady.length? `<div class="list">${nextNotReady.map(x=>`<div class="litem" onclick="openJobReadiness('${x.j.id}')" style="cursor:pointer"><div class="av"><span class="rag rag-${x.s.cls}"></span></div><div class="bd"><div class="t">${esc(x.j.title)}</div><div class="m">${esc(clientName(x.j.client_id))}${x.j.loc?(' · '+esc(x.j.loc)):''} · ${x.s.outstanding.length} outstanding</div></div><div class="when">${x.j.start_date?esc(String(x.j.start_date).slice(0,10)):'—'}</div></div>`).join('')}</div>`
      : '<div class="empty" style="padding:14px"><b>All live jobs are ready ✅</b><div style="font-size:12px;margin-top:4px">Jobs appear here automatically from your sites &amp; rota and turn red until labour, docs and dates are in place.</div></div>' }</div>`;
  return `<div class="sechead"><h3>🏠 HQ — Business Overview</h3><span class="sub">Across all ${CLIENTS.length} clients · live</span><span class="line"></span><button class="addbtn reportbtn" onclick="loadHQ().then(()=>go('hq'))">↻ Refresh</button></div>
    ${k}
    ${hqReportCard()}
    ${jobsCard}
    ${plan}
    <div class="card" style="margin-top:16px"><h4>🏆 Portfolio — all clients</h4><div class="csub">How the business is performing across every client · ${followsDue} follow-up${followsDue===1?'':'s'} due soon · ${gbp(pipeTotal)} open pipeline · click a row to open</div>
      <table><thead><tr><th>Client</th><th>Stage</th><th>Sites</th><th>Avg progress</th><th>Call-outs</th><th>Risks</th><th>Next follow-up</th><th>Pipeline</th></tr></thead><tbody>${portfolioRows}</tbody></table></div>
    <div class="row2" style="margin-top:16px">
      <div class="card"><h4>🔔 Needs Attention</h4><div class="csub">Everything across the business that needs action, most urgent first</div>${list}</div>
      <div class="card"><h4>🏢 By Client</h4><div class="csub">Clients with anything outstanding — click to open</div>
        <table><thead><tr><th>Client</th><th>Open</th><th>SLA</th><th>Docs</th><th>Risk</th><th></th></tr></thead><tbody>${clientRows}</tbody></table></div>
    </div>`;
}

