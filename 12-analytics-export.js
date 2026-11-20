/* ===================================================================
   ANALYTICS & INSIGHTS  (internal) — computed live from the data
   =================================================================== */
function analyticsData(){
  const co=DATA.callouts||[], sh=DATA.shifts||[];
  // by month
  const months={}; co.forEach(r=>{const m=String(r.submitted_at||r.call_date||'').slice(0,7); if(m)months[m]=(months[m]||0)+1;});
  const mKeys=Object.keys(months).sort().slice(-12);
  // priority
  const pri={}; co.forEach(r=>{const p=r.priority||'Unspecified'; pri[p]=(pri[p]||0)+1;});
  // top sites (repeat faults)
  const siteCount={}; co.forEach(r=>{ const s=(DATA.sites||[]).find(x=>x.id===r.site_id); const key=s?(s.code||s.city):(r.internal_notes?String(r.internal_notes).replace(/^.*Site:\s*/,'').slice(0,18):'Unassigned'); siteCount[key]=(siteCount[key]||0)+1; });
  const topSites=Object.entries(siteCount).sort((a,b)=>b[1]-a[1]).slice(0,7);
  // engineer activity
  const eng={}; co.forEach(r=>{if(r.engineer)eng[r.engineer]=(eng[r.engineer]||0)+1;}); sh.forEach(r=>{if(r.engineer)eng[r.engineer]=(eng[r.engineer]||0)+1;});
  const topEng=Object.entries(eng).sort((a,b)=>b[1]-a[1]).slice(0,8);
  // SLA: resolved within target (needs completed_time); else current open health
  let resolved=0, within=0;
  co.forEach(r=>{ const s=String(r.status||'').toLowerCase(); if((s.includes('complete')||s.includes('closed'))&&r.completed_time&&r.submitted_at){ resolved++; const hrs=(new Date(r.completed_time)-new Date(r.submitted_at))/3600000; if(hrs<=(SLA_HOURS[r.priority]||24)) within++; } });
  const opens=co.filter(isOpenCallout); const breaching=opens.filter(r=>slaState(r).cls==='breach').length;
  const slaPct = resolved? Math.round(within/resolved*100) : (opens.length? Math.round((opens.length-breaching)/opens.length*100) : 100);
  const slaLabel = resolved? `${within}/${resolved} resolved within target` : (opens.length? `${opens.length-breaching}/${opens.length} open within SLA`:'No call-outs');
  // kpis
  const downs=co.map(r=>Number(r.downtime_minutes)).filter(n=>!isNaN(n)&&n>0);
  const avgDown=downs.length?Math.round(downs.reduce((a,b)=>a+b,0)/downs.length):null;
  const followups=co.filter(r=>r.follow_up_required===true).length;
  const hours=sh.map(r=>Number(r.hours_worked)).filter(n=>!isNaN(n)); const totHours=hours.reduce((a,b)=>a+b,0);
  return {mKeys,months,pri,topSites,topEng,slaPct,slaLabel,kpis:{total:co.length,open:opens.length,avgDown,followups,shifts:sh.length,totHours}};
}
function pageAnalytics(){
  const co=DATA.callouts||[];
  if(!co.length && !(DATA.shifts||[]).length) return sectionH('Analytics')+emptyState('📊','No data to analyse yet','Once call-outs and shift reports are logged for this client, the insights appear here.');
  const a=analyticsData(); const k=a.kpis;
  return sectionH('Analytics &amp; Insights',`${esc(CLIENT.name)} · live`)+
    `<div class="grid kpis">
      ${kpi('c','🔧','Total Call-Outs',k.total,'')}
      ${kpi(k.open?'a':'g','⏱','Open Now',k.open,'')}
      ${kpi('v','⌛','Avg Downtime',k.avgDown!=null?k.avgDown:'—',k.avgDown!=null?'min':'')}
      ${kpi('c','↩','Follow-ups',k.followups,'')}
      ${kpi('g','🗓','Shift Reports',k.shifts,'')}
      ${kpi('c','⏰','Shift Hours',Math.round(k.totHours),'')}
    </div>
    <div class="row2" style="margin-top:16px">
      <div class="card"><h4>📈 Call-Outs by Month</h4><div class="csub">Reactive workload trend (last 12 months)</div><canvas id="aMonth" height="200"></canvas></div>
      <div class="card"><h4>🎯 SLA Compliance</h4><div class="csub">${esc(a.slaLabel)}</div><div class="ringwrap" style="justify-content:center">${ring(a.slaPct,'within SLA')}</div></div>
    </div>
    <div class="row2" style="margin-top:16px">
      <div class="card"><h4>🏭 Repeat-Fault Hotspots</h4><div class="csub">Sites with the most call-outs</div><canvas id="aSites" height="220"></canvas></div>
      <div class="card"><h4>🥧 By Priority</h4><div class="csub">Call-out mix by priority</div><canvas id="aPri" height="220"></canvas></div>
    </div>
    <div class="card" style="margin-top:16px"><h4>👷 Engineer Activity</h4><div class="csub">Reports filed per engineer (call-outs + shifts)</div><canvas id="aEng" height="160"></canvas></div>`;
}

/* ===================================================================
   CLIENT REPORT EXPORT  —  one-click branded programme PDF
   =================================================================== */
async function urlToDataUrl(url){
  try{ const r=await fetch(url); const b=await r.blob(); return await new Promise(res=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=()=>res(null);fr.readAsDataURL(b);}); }
  catch(e){ return null; }
}
async function downloadClientReport(){
  if(!CLIENT){ alert('Pick a client first.'); return; }
  if(!window.jspdf){ alert('Report tool still loading — try again in a moment.'); return; }
  const btns=document.querySelectorAll('.reportbtn'); btns.forEach(b=>{b.disabled=true;b.dataset.t=b.textContent;b.textContent='Building report…';});
  try{
    const R=rollups(); const a=(DATA.callouts&&DATA.callouts.length)||(DATA.shifts&&DATA.shifts.length)?analyticsData():null;
    const {jsPDF}=window.jspdf; const doc=new jsPDF({unit:'pt',format:'a4'}); const W=595,H=842; let y=0;
    // cover band
    doc.setFillColor(10,14,22); doc.rect(0,0,W,150,'F');
    try{ doc.addImage(MLOGO,'PNG',40,38,74,74); }catch(e){}
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(22); doc.text('Programme Report',130,72);
    doc.setFont('helvetica','normal'); doc.setFontSize(12); doc.setTextColor(180,200,220);
    doc.text(esc2(CLIENT.name),130,94);
    doc.setFontSize(9.5); doc.text(`${CLIENT.system_ref?('System '+CLIENT.system_ref+'  ·  '):''}Generated ${new Date().toLocaleDateString('en-GB')}  ·  Mercury Automated Solutions`,130,112);
    y=186;
    const H2=(t)=>{ doc.setFont('helvetica','bold'); doc.setTextColor(15,32,51); doc.setFontSize(13); doc.text(t,40,y); doc.setDrawColor(225,235,243); doc.line(40,y+8,W-40,y+8); y+=26; };
    const row=(k,v)=>{ doc.setFont('helvetica','bold');doc.setTextColor(90,107,128);doc.setFontSize(9);doc.text(String(k).toUpperCase(),40,y); doc.setFont('helvetica','normal');doc.setTextColor(15,32,51);doc.setFontSize(11); const ls=doc.splitTextToSize(String(v==null?'—':v),W-80); doc.text(ls,40,y+13); y+=13+ls.length*13+9; };
    const need=(px)=>{ if(y>H-px){ doc.addPage(); y=48; } };
    // summary
    H2('Programme Summary');
    const tiles=[['Sites',R.total],['Delivered',R.complete.length],['Overall progress',R.avg+'%'],['On schedule',R.onSchedPct+'%'],['Open risks',R.openRisks.length],['QA pass rate',(R.complete.length?100:0)+'%']];
    let tx=40; const tw=(W-80)/3;
    tiles.forEach((t,i)=>{ const col=i%3, rr=Math.floor(i/3); const bx=40+col*tw, by=y+rr*54;
      doc.setFillColor(244,248,252); doc.roundedRect(bx,by,tw-10,46,8,8,'F');
      doc.setTextColor(90,107,128);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text(String(t[0]).toUpperCase(),bx+12,by+17);
      doc.setTextColor(15,32,51);doc.setFontSize(18);doc.text(String(t[1]),bx+12,by+38); });
    y+=2*54+14;
    // SLA
    if(a){ need(60); H2('SLA Performance'); row('SLA compliance', a.slaPct+'%  ('+a.slaLabel+')'); if(a.kpis.avgDown!=null) row('Average downtime', a.kpis.avgDown+' minutes'); row('Total call-outs', a.kpis.total+'  ('+a.kpis.open+' open)'); }
    // milestones
    const ms=milestones(); if(ms.length){ need(120); H2('Delivery Milestones'); ms.slice(0,8).forEach(e=>{ need(40); doc.setFont('helvetica','bold');doc.setTextColor(15,32,51);doc.setFontSize(10.5);doc.text(textOnly(e.t),40,y); doc.setFont('helvetica','normal');doc.setTextColor(120,135,155);doc.setFontSize(9);doc.text(String(e.date).slice(0,10)+(e.m?('  ·  '+textOnly(e.m)):''),40,y+12); y+=28; }); }
    // sites table
    const sites=(DATA.sites||[]).filter(s=>!String(s.status||'').toLowerCase().includes('pending'));
    if(sites.length){ need(80); H2('Sites & Progress');
      doc.setFont('helvetica','bold');doc.setTextColor(90,107,128);doc.setFontSize(8.5);
      doc.text('SITE',40,y);doc.text('LOCATION',150,y);doc.text('STATUS',330,y);doc.text('PROGRESS',460,y); y+=6; doc.setDrawColor(225,235,243);doc.line(40,y,W-40,y); y+=14;
      sites.forEach(s=>{ need(26); doc.setFont('helvetica','bold');doc.setTextColor(15,32,51);doc.setFontSize(10);doc.text(textOnly(s.code||s.city||'—'),40,y);
        doc.setFont('helvetica','normal');doc.setTextColor(60,75,95);doc.text(textOnly((s.city||'')+(s.country?(', '+s.country):'')),150,y);
        doc.text(textOnly(s.status||''),330,y); doc.text(Math.round(s.progress_pct||0)+'%',460,y);
        // mini bar
        doc.setFillColor(225,235,243);doc.roundedRect(500,y-8,55,7,3,3,'F'); doc.setFillColor(34,197,94);doc.roundedRect(500,y-8,Math.max(2,55*(Number(s.progress_pct||0)/100)),7,3,3,'F');
        y+=20; }); }
    // photos
    const photos=(DATA.media||[]).filter(m=>m.file_url).slice(0,6);
    if(photos.length){ need(160); H2('Photo Evidence'); let px=40, started=y;
      for(let i=0;i<photos.length;i++){ const du=await urlToDataUrl(photos[i].file_url); if(!du)continue; need(130); const col=i%2; const bx=40+col*((W-80)/2+10); if(col===0&&i>0)y+=0;
        try{ doc.addImage(du, du.indexOf('png')>-1?'PNG':'JPEG', bx, y, (W-80)/2-5, 110); }catch(e){}
        if(col===1){ y+=120; } }
      if(photos.length%2===1) y+=120;
    }
    // footer on every page
    const pages=doc.getNumberOfPages();
    for(let i=1;i<=pages;i++){ doc.setPage(i); doc.setTextColor(150,160,175);doc.setFontSize(8); doc.text('Mercury Automated Solutions  ·  '+CLIENT.name+'  ·  Page '+i+' of '+pages,40,H-24); }
    const fname=(CLIENT.slug||'client')+'-programme-report-'+new Date().toISOString().slice(0,10)+'.pdf';
    doc.save(fname);
  }catch(e){ alert('Could not build report: '+(e.message||e)); }
  finally{ btns.forEach(b=>{b.disabled=false;b.textContent=b.dataset.t||'⬇ Download report';}); }
}
function esc2(s){ return String(s==null?'':s); }
function textOnly(s){ return String(s==null?'':s).replace(/<[^>]*>/g,''); }

