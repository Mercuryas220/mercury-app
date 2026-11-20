const TITLES={hq:'HQ — Business Overview',digest:'Daily Digest',clients:'Clients',jobs:'Job Status — Mobilisation Control',completed:'Completed Works',crm:'CRM — Client Engagement',command:'Command Centre',checkins:'Site Check-ins',engineers:'Engineers — Team Register',compliance:'Compliance — Expiries & Right to Work',overview:'Programme Overview',sites:'Sites & Progress',schedule:'Schedule',rota:'Shift Rota',teams:'Teams & Routes',installs:'Install Reports',risks:'Risk Register',callouts:'Call-Out Reports',shifts:'Shift Reports',reports:'Activity Feed',gallery:'Photo Evidence',analytics:'Analytics & Insights',documents:'Documents',notify:'Email Updates',project:'Project Plan',requests:'Work Requests',quotes:'Quote Requests',quality:'Quality & Handover',suppliers:'Suppliers — Labour Partners',finance:'Profit & Margins',sup_home:'Supplier Dashboard',sup_engineers:'My Engineers',sup_jobs:'My Assignments',sup_timesheets:'Timesheets',sup_feedback:'Performance & Feedback',sup_docs:'Company Documents'};
function go(page){
  CURRENT=page;
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  const pt=el('pageTitle'); if(pt) pt.textContent=TITLES[page]||'';
  let html='';
  try{
    if(page==='hq')html=pageHQ();
    else if(page==='digest')html=pageDigest();
    else if(page==='engineers')html=pageEngineers();
    else if(page==='compliance')html=pageCompliance();
    else if(page==='suppliers')html=pageSuppliers();
    else if(page==='finance')html=pageFinance();
    else if(page==='sup_home')html=pageSupHome();
    else if(page==='sup_engineers')html=pageSupEngineers();
    else if(page==='sup_jobs')html=pageSupJobs();
    else if(page==='sup_timesheets')html=pageSupTimesheets();
    else if(page==='sup_feedback')html=pageSupFeedback();
    else if(page==='sup_docs')html=pageSupDocs();
    else if(page==='clients')html=pageClients();
    else if(page==='jobs')html=pageJobs();
    else if(page==='completed')html=pageCompleted();
    else if(page==='jobreg')html=pageJobRegister();
    else if(page==='quotereg')html=pageQuoteRegister();
    else if(!CLIENT){ html=emptyState('👈','Choose a client','Pick a client from the dropdown above'+(PROFILE.role==='admin'?', the Clients page or HQ':'')+' to open their dashboard.'); }
    else if(page==='command')html=pageCommand();
    else if(page==='checkins')html=pageCheckins();
    else if(page==='overview')html=pageOverview();
    else if(page==='sites')html=pageSites();
    else if(page==='schedule')html=pageSchedule();
    else if(page==='rota')html=pageRota();
    else if(page==='teams')html=pageTeams();
    else if(page==='installs')html=pageInstalls();
    else if(page==='risks')html=pageRisks();
    else if(page==='callouts')html=pageCallouts();
    else if(page==='shifts')html=pageShifts();
    else if(page==='reports')html=pageReports();
    else if(page==='gallery')html=pageGallery();
    else if(page==='requests')html=pageRequests();
    else if(page==='quotes')html=pageQuotes();
    else if(page==='analytics')html=pageAnalytics();
    else if(page==='documents')html=pageDocuments();
    else if(page==='notify')html=pageNotify();
    else if(page==='project')html=pageProjectPlan();
    else if(page==='crm')html=pageCRM();
    else if(page==='quality')html=pageQuality();
  }catch(e){ html=emptyState('⚠','Something went wrong drawing this page',esc(e.message)); }
  el('content').innerHTML=html;
  Object.values(charts).forEach(c=>{try{c.destroy()}catch(e){}});charts={};
  buildCharts(page);
  if(page==='command'||page==='checkins') setTimeout(initOpsMap, 60);
}
function buildCharts(page){
  if(typeof Chart==='undefined')return;
  try{
    Chart.defaults.color=getComputedStyle(document.body).getPropertyValue('--muted');
    if(page==='overview' && el('countryChart')){
      const by={},cnt={};
      DATA.sites.filter(s=>s.country).forEach(s=>{by[s.country]=(by[s.country]||0)+Number(s.progress_pct||0);cnt[s.country]=(cnt[s.country]||0)+1;});
      const labels=Object.keys(by); if(!labels.length)return;
      charts.country=new Chart(el('countryChart'),{type:'doughnut',data:{labels:labels.map(l=>(flagEmoji[l]||'')+' '+l),datasets:[{data:labels.map(l=>Math.round(by[l]/cnt[l])),backgroundColor:['#38bdf8','#22c55e','#a78bfa','#f59e0b','#fb7185','#34d399'],borderWidth:0}]},options:{cutout:'62%',plugins:{legend:{position:'right',labels:{boxWidth:12,padding:10,font:{size:11}}}}}});
    }
    if(page==='analytics'){
      const a=analyticsData(); const grid={color:getComputedStyle(document.body).getPropertyValue('--line2')};
      if(el('aMonth')) charts.m=new Chart(el('aMonth'),{type:'bar',data:{labels:a.mKeys,datasets:[{label:'Call-outs',data:a.mKeys.map(m=>a.months[m]),backgroundColor:'#38bdf8',borderRadius:6}]},options:{plugins:{legend:{display:false}},scales:{y:{grid,beginAtZero:true,ticks:{precision:0}},x:{grid:{display:false}}}}});
      if(el('aPri')){ const pl=Object.keys(a.pri); charts.p=new Chart(el('aPri'),{type:'doughnut',data:{labels:pl,datasets:[{data:pl.map(p=>a.pri[p]),backgroundColor:['#ef4444','#f59e0b','#38bdf8','#22c55e','#a78bfa'],borderWidth:0}]},options:{cutout:'60%',plugins:{legend:{position:'right',labels:{boxWidth:12,font:{size:11}}}}}}); }
      if(el('aSites')) charts.s=new Chart(el('aSites'),{type:'bar',data:{labels:a.topSites.map(x=>x[0]),datasets:[{label:'Call-outs',data:a.topSites.map(x=>x[1]),backgroundColor:'#fb7185',borderRadius:6}]},options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{grid,beginAtZero:true,ticks:{precision:0}},y:{grid:{display:false}}}}});
      if(el('aEng')) charts.e=new Chart(el('aEng'),{type:'bar',data:{labels:a.topEng.map(x=>x[0]),datasets:[{label:'Reports',data:a.topEng.map(x=>x[1]),backgroundColor:'#22c55e',borderRadius:6}]},options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{grid,beginAtZero:true,ticks:{precision:0}},y:{grid:{display:false}}}}});
    }
  }catch(e){console.warn('chart skipped',e);}
}
