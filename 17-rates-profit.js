/* ---------- ADMIN: RATE CARD (cost + sell, admin-only) ---------- */
function openRateCard(){
  if(PROFILE.role!=='admin') return;
  const trades=[...new Set([ ...RATECARD.filter(r=>r.scope==='trade').map(r=>r.trade), ...(SDATA.engineers||[]).map(e=>e.trade), 'Mechanical','Electrical','Multi-skilled','Labourer' ].filter(Boolean))].sort();
  const engs=(SDATA.engineers||[]).slice().sort((a,b)=>String(a.full_name||'').localeCompare(String(b.full_name||'')));
  const rcInput=(cls,v)=>`<input class="${cls}" type="number" min="0" step="0.01" value="${v!=null?esc(String(v)):''}" style="width:88px" placeholder="—">`;
  const tradeRows=trades.map(tr=>{ const ex=RATECARD.find(r=>r.scope==='trade' && String(r.trade||'').toLowerCase()===tr.toLowerCase()); return `<tr class="rc-row" data-scope="trade" data-trade="${esc(tr)}" data-id="${ex?ex.id:''}"><td><b>${esc(tr)}</b></td><td>${rcInput('rc-cost',ex?ex.cost_rate:null)}</td><td>${rcInput('rc-sell',ex?ex.sell_rate:null)}</td></tr>`; }).join('');
  const engRows=engs.map(e=>{ const ex=RATECARD.find(r=>r.scope==='engineer' && r.engineer_id===e.id); const res=resolveRates(e); return `<tr class="rc-row" data-scope="engineer" data-eng="${e.id}" data-id="${ex?ex.id:''}"><td>${esc(e.full_name)}<div class="muted" style="font-size:11px">${esc(e.trade||'—')} · card: ${res.cost!=null?gbp(res.cost):'—'}/${res.sell!=null?gbp(res.sell):'—'}</div></td><td>${rcInput('rc-cost',ex?ex.cost_rate:null)}</td><td>${rcInput('rc-sell',ex?ex.sell_rate:null)}</td></tr>`; }).join('');
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal" style="max-width:640px">
    <div class="modal-h"><h3>💷 Rate card</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b" id="rcBox">
      <div class="box see" style="background:var(--panel2);border:1px dashed var(--line2);border-radius:10px;padding:11px 13px;font-size:12px;color:var(--muted);margin-bottom:14px"><b>Cost</b> = what we pay the supplier (auto-fills jobs). <b>Sell</b> = what we charge the client. Sell &amp; margin are <b>admin-only</b> — never shown to suppliers, engineers or clients. Leave blank to inherit the trade rate.</div>
      <h4 style="margin:4px 0 6px">By trade — the card</h4>
      <div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Trade</th><th>Cost £/hr</th><th>Sell £/hr</th></tr></thead><tbody>${tradeRows||'<tr><td colspan="3" class="muted">No trades yet</td></tr>'}</tbody></table></div>
      <div style="display:flex;gap:8px;margin:8px 0 16px"><input id="rc_newtrade" placeholder="Add a trade (e.g. Pipefitter)" style="flex:1"><button class="edit-btn" onclick="rcAddTrade()">＋ Add trade</button></div>
      <h4 style="margin:4px 0 6px">Per-engineer overrides</h4>
      <div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Engineer</th><th>Cost £/hr</th><th>Sell £/hr</th></tr></thead><tbody>${engRows||'<tr><td colspan="3" class="muted">No engineers yet</td></tr>'}</tbody></table></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="rcSave" onclick="saveRateCard()">Save rate card</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
function rcAddTrade(){ const t=(val('rc_newtrade')||'').trim(); if(!t) return; const tb=document.querySelector('#rcBox table tbody'); if(!tb) return; tb.insertAdjacentHTML('beforeend',`<tr class="rc-row" data-scope="trade" data-trade="${esc(t)}" data-id=""><td><b>${esc(t)}</b></td><td><input class="rc-cost" type="number" min="0" step="0.01" style="width:88px" placeholder="—"></td><td><input class="rc-sell" type="number" min="0" step="0.01" style="width:88px" placeholder="—"></td></tr>`); el('rc_newtrade').value=''; }
async function saveRateCard(){
  const btn=el('rcSave'); btn.disabled=true; btn.textContent='Saving…'; msg('','');
  const rows=[...document.querySelectorAll('#rcBox .rc-row')];
  const ups=[], ins=[];
  rows.forEach(r=>{ const id=r.getAttribute('data-id')||''; const scope=r.getAttribute('data-scope'); const trade=r.getAttribute('data-trade')||null; const eng=r.getAttribute('data-eng')||null;
    const cv=r.querySelector('.rc-cost').value, sv=r.querySelector('.rc-sell').value;
    const c=cv===''?null:Number(cv), s=sv===''?null:Number(sv);
    if(id){ ups.push({id, cost_rate:c, sell_rate:s, updated_at:new Date().toISOString()}); }
    else if(c!=null||s!=null){ ins.push({scope, trade:scope==='trade'?trade:null, engineer_id:scope==='engineer'?eng:null, supplier_id:scope==='engineer'?((engById(eng)||{}).supplier_id||null):null, cost_rate:c, sell_rate:s}); }
  });
  try{
    for(const u of ups){ const id=u.id; const rest={cost_rate:u.cost_rate,sell_rate:u.sell_rate,updated_at:u.updated_at}; const {error}=await sb.from('rate_card').update(rest).eq('id',id); if(error) throw error; }
    if(ins.length){ const {error}=await sb.from('rate_card').insert(ins); if(error) throw error; }
  }catch(e){ btn.disabled=false; btn.textContent='Save rate card'; msg('Could not save: '+(e.message||e),'err'); return; }
  msg('✓ Rate card saved.','ok'); await supRefresh('suppliers');
}

/* ---------- ADMIN: PROFIT — Project P&L + supplier summary ---------- */
function pageFinance(){
  if(PROFILE.role!=='admin') return emptyState('🔒','Admins only','This area is for the Mercury team.');
  const approved=(SDATA.timesheets||[]).filter(t=>['Approved','Paid'].includes(t.status));
  const asgById={}; (SDATA.assignments||[]).forEach(a=>asgById[a.id]=a);
  // group approved timesheets by client (via assignment)
  const byClient={};
  approved.forEach(t=>{ const a=asgById[t.assignment_id]; const cid=(a&&a.client_id)||'__none'; const c=byClient[cid]||(byClient[cid]={cost:0,rev:0,hrs:0,hasSell:false}); const cost=tsCost(t); const rev=tsRevenue(t); c.cost+=cost; c.hrs+=tsHours(t); if(rev!=null){ c.rev+=rev; c.hasSell=true; } });
  // fixed project values by client
  const projByClient={}; (PROJFIN||[]).forEach(p=>{ const c=projByClient[p.client_id]||(projByClient[p.client_id]={sell:0,cost:0,items:[]}); c.sell+=Number(p.sell_value||0); c.cost+=Number(p.cost_budget||0); c.items.push(p); });
  const clientIds=[...new Set([...Object.keys(byClient).filter(x=>x!=='__none'), ...Object.keys(projByClient)])];
  // totals
  let tRev=0,tCost=0,tProj=0;
  clientIds.forEach(cid=>{ const b=byClient[cid]||{rev:0,cost:0}; const p=projByClient[cid]||{sell:0}; tRev+=b.rev; tCost+=b.cost; tProj+=p.sell; });
  const grandRev=tRev+tProj; const profit=grandRev-tCost; const marginPct=grandRev>0?Math.round(profit/grandRev*100):0;
  const k=`<div class="grid kpis" style="margin-bottom:14px">
    ${kpi('cyan','£','Revenue',gbp(grandRev).replace('£',''),'')}
    ${kpi('','🧾','Labour cost',gbp(tCost).replace('£',''),'')}
    ${kpi(profit>=0?'green':'red','📈','Profit',gbp(profit).replace('£',''),'')}
    ${kpi(profit>=0?'green':'red','%','Margin',marginPct,'%')}
  </div>`;
  const note=`<div class="note" style="margin-bottom:12px;font-size:12px">Revenue = hourly charge-out (from approved timesheets × the rate card’s sell rate) <b>plus</b> any fixed project values you record below. Labour cost = what you pay suppliers on approved timesheets. All figures here are admin-only.</div>`;
  const rows = clientIds.length ? clientIds.map(cid=>{ const b=byClient[cid]||{cost:0,rev:0,hrs:0,hasSell:false}; const p=projByClient[cid]||{sell:0}; const rev=b.rev+p.sell; const cost=b.cost; const pr=rev-cost; const mp=rev>0?Math.round(pr/rev*100):0;
      return `<tr><td><b>${esc(supClientName(cid)||'Unassigned')}</b></td><td>${b.hrs||0} h</td><td>${gbp(cost)}</td><td>${b.hasSell?gbp(b.rev):'<span class="muted">—</span>'}</td><td>${p.sell?gbp(p.sell):'<span class="muted">—</span>'}</td><td><b>${gbp(rev)}</b></td><td class="${pr>=0?'':'neg'}" style="color:${pr>=0?'var(--green)':'var(--red)'}"><b>${gbp(pr)}</b></td><td>${rev>0?mp+'%':'—'}</td></tr>`; }).join('')
    : `<tr><td colspan="8" class="muted" style="padding:14px">No approved timesheets or project values yet. Approve some timesheets and set sell rates on the rate card to see profit here.</td></tr>`;
  const pnl=`<div class="card" style="overflow-x:auto"><div class="sechead" style="margin-top:0"><h3 style="font-size:15px">Project P&amp;L</h3><span class="line"></span><button class="edit-btn" onclick="openProjValue()">＋ Add project value</button></div>
    <table class="tbl"><thead><tr><th>Client / project</th><th>Hours</th><th>Labour cost</th><th>Charge-out</th><th>Fixed value</th><th>Revenue</th><th>Profit</th><th>Margin</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  // supplier summary
  const supRows=(SUPPLIERS||[]).map(s=>{ const ts=approved.filter(t=>t.supplier_id===s.id); let cost=0,rev=0,hrs=0,hasSell=false; ts.forEach(t=>{ cost+=tsCost(t); hrs+=tsHours(t); const r=tsRevenue(t); if(r!=null){ rev+=r; hasSell=true; } }); const pr=rev-cost; return {s,cost,rev,hrs,hasSell,pr,n:ts.length}; }).filter(x=>x.n>0);
  const supSummary = supRows.length ? `<div class="card" style="overflow-x:auto;margin-top:16px"><h4 style="margin:0 0 10px">Supplier summary (approved timesheets)</h4>
    <table class="tbl"><thead><tr><th>Supplier</th><th>Timesheets</th><th>Hours</th><th>Cost</th><th>Charge-out</th><th>Margin</th></tr></thead><tbody>
    ${supRows.map(x=>`<tr><td><b>${esc(x.s.name)}</b></td><td>${x.n}</td><td>${x.hrs} h</td><td>${gbp(x.cost)}</td><td>${x.hasSell?gbp(x.rev):'<span class="muted">—</span>'}</td><td style="color:${x.pr>=0?'var(--green)':'var(--red)'}"><b>${x.hasSell?gbp(x.pr):'—'}</b></td></tr>`).join('')}
    </tbody></table></div>` : '';
  // recorded fixed project values list
  const pvList=(PROJFIN||[]).length?`<div class="card" style="margin-top:16px"><h4 style="margin:0 0 10px">Fixed project values</h4><table class="tbl"><thead><tr><th>Client</th><th>Project</th><th>Sell value</th><th>Cost budget</th><th></th></tr></thead><tbody>${PROJFIN.map(p=>`<tr><td>${esc(supClientName(p.client_id)||'—')}</td><td>${esc(p.label||'—')}</td><td><b>${gbp(p.sell_value||0)}</b></td><td>${p.cost_budget?gbp(p.cost_budget):'—'}</td><td><button class="edit-btn" style="color:var(--red)" onclick="deleteProjValue('${p.id}')">🗑</button></td></tr>`).join('')}</tbody></table></div>`:'';
  return `<div class="sechead"><h3>Profit &amp; Margins</h3><span class="sub">Admin-only · project P&amp;L and supplier profitability</span><span class="line"></span></div>`+k+note+pnl+supSummary+pvList;
}
function openProjValue(){
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>Add project value</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="fld"><label>Client <span class="req">*</span></label><select id="pv_client"><option value="">— select client —</option>${(CLIENTS||[]).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
      <div class="fld"><label>Project / job label</label><input id="pv_label" placeholder="e.g. Leeds DC conveyor — fixed price"></div>
      <div class="frow">
        <div class="fld"><label>Sell value (£) <span class="req">*</span></label><input id="pv_sell" type="number" min="0" step="0.01" placeholder="agreed revenue"></div>
        <div class="fld"><label>Cost budget (£, optional)</label><input id="pv_cost" type="number" min="0" step="0.01" placeholder="planned cost"></div>
      </div>
      <div class="fld"><label>Notes</label><input id="pv_notes" placeholder="Optional"></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="pvSave" onclick="submitProjValue()">Add value</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
async function submitProjValue(){
  const cid=val('pv_client'); if(!cid){ msg('Please choose a client.','err'); return; }
  const sell=num('pv_sell'); if(sell==null){ msg('Please enter a sell value.','err'); return; }
  const btn=el('pvSave'); btn.disabled=true; btn.textContent='Saving…'; msg('','');
  const row={ client_id:cid, label:val('pv_label')||null, sell_value:sell, cost_budget:num('pv_cost'), notes:val('pv_notes')||null };
  const {error}=await sb.from('project_finance').insert(row);
  if(error){ btn.disabled=false; btn.textContent='Add value'; msg('Could not save: '+error.message,'err'); return; }
  msg('✓ Saved.','ok'); await supRefresh('finance');
}
async function deleteProjValue(id){ if(!confirm('Delete this project value?')) return; const {error}=await sb.from('project_finance').delete().eq('id',id); if(error){ alert('Could not delete: '+error.message); return; } await supRefresh('finance'); }

