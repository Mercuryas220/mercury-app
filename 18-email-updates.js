/* ============ EMAIL UPDATES (client contact list) ============ */
function ntfKinds(){
  const ks=(DATA.kindSettings||[]).filter(k=>k.severity!=='off');
  return ks.length?ks:[
    {kind:'quote',label:'Quotes'},{kind:'request',label:'Work requests'},
    {kind:'job',label:'Job and schedule changes'},{kind:'document',label:'New documents'},
    {kind:'report',label:'Reports and progress updates'}
  ];
}
function ntfStatus(s){
  const m={verified:['Confirmed','var(--green)'],pending:['Awaiting confirmation','var(--amber)'],paused:['Stopped','var(--faint)']};
  const p=m[s]||[s,'var(--muted)'];
  return `<span style="font-size:11px;font-weight:700;color:${p[1]};border:1px solid ${p[1]};border-radius:999px;padding:2px 9px;white-space:nowrap">${esc(p[0])}</span>`;
}
function ntfSay(msg,bad){ const n=el('ntfMsg'); if(!n) return; n.textContent=msg||''; n.style.color=bad?'var(--red)':'var(--green)'; }
function pageNotify(){
  if(!CLIENT) return emptyState('\ud83d\udc48','Choose a client','Pick a client to manage their email updates.');
  const isAdmin = PROFILE && PROFILE.role==='admin';
  const rows=(DATA.contacts||[]);
  const kinds=ntfKinds();
  const list = rows.length ? rows.map(c=>{
    const freq=({instant:'As it happens',daily:'Daily summary',off:'Paused'})[c.delivery]||c.delivery;
    const scope=(!c.kinds||!c.kinds.length)?'All updates':c.kinds.map(k=>{ const f=kinds.find(x=>x.kind===k); return f?f.label:k; }).join(', ');
    return `<div class="card" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between">
      <div style="min-width:220px">
        <b>${esc(c.full_name)}</b>
        <div class="muted" style="font-size:13px">${esc(c.email)}${c.job_title?' \u00b7 '+esc(c.job_title):''}</div>
        <div class="muted" style="font-size:12px;margin-top:3px">${esc(freq)} \u00b7 ${esc(scope)}</div>
      </div>
      ${ntfStatus(c.status)}
      ${isAdmin?`<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <select onchange="ntfSetDelivery('${c.id}',this.value)" style="padding:6px 8px;border-radius:8px;background:var(--panel2);color:var(--text);border:1px solid var(--line2)">
          <option value="instant" ${c.delivery==='instant'?'selected':''}>As it happens</option>
          <option value="daily" ${c.delivery==='daily'?'selected':''}>Daily summary</option>
          <option value="off" ${c.delivery==='off'?'selected':''}>Paused</option>
        </select>
        ${c.status!=='verified'?`<button class="viewall" onclick="ntfResend('${c.id}')">Resend confirmation</button>`:''}
        <button class="viewall" onclick="ntfRemove('${c.id}')">Remove</button>
      </div>`:''}
    </div>`;
  }).join('') : emptyState('\u2709','No one is on the list yet', isAdmin?'Add the first address below.':'Ask your Mercury contact to add the people who should receive updates.');
  const form = isAdmin ? `<div class="card">
    <h4>Add someone</h4>
    <div class="csub">They get a confirmation email first. Nothing is sent until they click it.</div>
    <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-top:12px">
      <input id="ntfName" placeholder="Name" style="padding:9px 10px;border-radius:8px;background:var(--panel2);color:var(--text);border:1px solid var(--line2)">
      <input id="ntfEmail" type="email" placeholder="Email address" style="padding:9px 10px;border-radius:8px;background:var(--panel2);color:var(--text);border:1px solid var(--line2)">
      <input id="ntfRole" placeholder="Job title (optional)" style="padding:9px 10px;border-radius:8px;background:var(--panel2);color:var(--text);border:1px solid var(--line2)">
      <select id="ntfFreq" style="padding:9px 10px;border-radius:8px;background:var(--panel2);color:var(--text);border:1px solid var(--line2)">
        <option value="instant">As it happens</option>
        <option value="daily">Daily summary</option>
      </select>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px 18px;margin:14px 0 4px">
      ${kinds.map(k=>`<label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" class="ntfKind" value="${esc(k.kind)}" checked> ${esc(k.label)}</label>`).join('')}
    </div>
    <div style="display:flex;align-items:center;gap:14px;margin-top:12px">
      <button class="btn" onclick="ntfAdd()">Add and send confirmation</button>
      <span id="ntfMsg" style="font-size:13px"></span>
    </div>
  </div>` : '';
  return sectionH('Email Updates','Who hears about progress by email. Separate from dashboard sign-in \u2014 adding an address here never changes how anyone logs in.')+form+list;
}
async function ntfReload(){ await loadClientData(); go('notify'); }
async function ntfAdd(){
  const name=(el('ntfName').value||'').trim();
  const email=(el('ntfEmail').value||'').trim();
  const role=(el('ntfRole').value||'').trim();
  const freq=el('ntfFreq').value;
  const kinds=[].slice.call(document.querySelectorAll('.ntfKind:checked')).map(i=>i.value);
  const all=document.querySelectorAll('.ntfKind').length;
  if(!name) return ntfSay('Add a name so the list stays readable.',true);
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return ntfSay('Check the email address.',true);
  if(!kinds.length) return ntfSay('Choose at least one kind of update.',true);
  ntfSay('Adding\u2026');
  const r=await sb.from('client_contacts').insert({client_id:CLIENT.id, full_name:name, email:email, job_title:role||null, delivery:freq, kinds:(kinds.length===all?null:kinds)});
  if(r.error) return ntfSay(r.error.code==='23505'?'That address is already on the list.':'Not added: '+r.error.message,true);
  await ntfReload();
}
async function ntfSetDelivery(id,val){
  const r=await sb.from('client_contacts').update({delivery:val}).eq('id',id);
  ntfSay(r.error?('Change not saved: '+r.error.message):'Saved.',!!r.error);
  const c=(DATA.contacts||[]).find(x=>x.id===id); if(c) c.delivery=val;
}
async function ntfResend(id){
  const r=await sb.rpc('resend_verification',{p_contact_id:id});
  ntfSay(r.error?('Could not queue it: '+r.error.message):'Confirmation sent \u2014 usually arrives within a couple of minutes.',!!r.error);
}
async function ntfRemove(id){
  if(!confirm('Remove this person from email updates?')) return;
  const r=await sb.from('client_contacts').delete().eq('id',id);
  if(r.error) return ntfSay('Not removed: '+r.error.message,true);
  await ntfReload();
}

