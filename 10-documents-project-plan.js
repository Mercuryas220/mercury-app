/* ===================================================================
   DOCUMENT VAULT  —  RAMS, Avetta, certificates, handover packs
   =================================================================== */
const DOC_TYPES=['RAMS','Avetta','Certificate','Handover Pack','Insurance','Method Statement','Other'];
const PROJECT_DOC_TYPES=['Drawing','Kick-off Pack','Meeting Minutes','Toolbox Talk','Programme','RAMS / Method Statement','Permit','Specification','O&M / Handover','Survey / Report','Other'];
function projIcon(t){ return ({'Drawing':'📐','Kick-off Pack':'🚀','Meeting Minutes':'📝','Toolbox Talk':'🦺','Programme':'📅','RAMS / Method Statement':'⚠️','Permit':'📋','Specification':'📑','O&M / Handover':'📦','Survey / Report':'📊'})[t]||'📄'; }
function docExpiry(d){
  if(!d.expiry_date) return {cls:'grey',label:'No expiry'};
  const days=Math.ceil((new Date(d.expiry_date)-Date.now())/86400000);
  if(days<0) return {cls:'red',label:'Expired '+(-days)+'d ago'};
  if(days<=30) return {cls:'amber',label:'Expires in '+days+'d'};
  return {cls:'green',label:'Valid · expires '+String(d.expiry_date).slice(0,10)};
}
function pageDocuments(){
  const docs=(DATA.documents||[]).filter(d=>(d.doc_class||'library')!=='project');
  const expired=docs.filter(d=>d.expiry_date && new Date(d.expiry_date)<Date.now()).length;
  const soon=docs.filter(d=>{if(!d.expiry_date)return false;const dd=Math.ceil((new Date(d.expiry_date)-Date.now())/86400000);return dd>=0&&dd<=30;}).length;
  const head=`<div class="sechead"><h3>📁 Documents</h3><span class="sub">${docs.length} on file${expired?` · ${expired} expired`:''}${soon?` · ${soon} expiring soon`:''}</span><span class="line"></span>${canAddDocs()?`<button class="addbtn" onclick="openDocForm()">＋ Add document</button>`:''}</div>`;
  if(!docs.length) return head+emptyState('📁','No documents yet',canAddDocs()?'Tap “Add document” to upload RAMS, certificates, handover packs or anything you need to share.':'Your compliance documents and handover packs will appear here.');
  const rows=docs.map(d=>{const e=docExpiry(d);const s=(DATA.sites||[]).find(x=>x.id===d.site_id);return `<tr>
    <td><b>${esc(d.title||'Document')}</b>${d.file_name?`<div class="muted" style="font-size:11px">${esc(d.file_name)}</div>`:''}</td>
    <td><span class="chip grey" style="background:var(--panel2)">${esc(d.doc_type||'—')}</span></td>
    <td>${s?esc(s.code||s.city):'<span class="muted">All / general</span>'}</td>
    <td><span class="chip ${e.cls}">${e.label}</span></td>
    <td>${d.file_url?`<a class="pdf-link" href="${esc(d.file_url)}" target="_blank">Open ↗</a>`:'<span class="muted">—</span>'}</td></tr>`;}).join('');
  return head+`<div class="card"><table><thead><tr><th>Document</th><th>Type</th><th>Site</th><th>Status</th><th>File</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function openDocForm(){
  if(!CLIENT){ alert('Pick a client first.'); return; }
  CAPTURE={photos:[],videos:[],sig:null,gps:null};
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>Add Document</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="fld"><label>Title <span class="req">*</span></label><input id="d_title" placeholder="e.g. RAMS — Rome site"></div>
      <div class="frow">
        <div class="fld"><label>Type</label><select id="d_type">${DOC_TYPES.map(t=>`<option>${t}</option>`).join('')}</select></div>
        <div class="fld"><label>Site (optional)</label><select id="d_site">${siteOptions()}</select></div>
      </div>
      <div class="fld"><label>Expiry date (optional)</label><input id="d_expiry" type="date"></div>
      <div class="fld"><label>File <span class="req">*</span></label><input id="d_file" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.csv"></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="docSave" onclick="submitDoc()">Upload document</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
async function submitDoc(){
  const title=val('d_title'); const fileEl=el('d_file');
  if(!title){ msg('Please add a title.','err'); return; }
  if(!fileEl.files||!fileEl.files[0]){ msg('Please choose a file.','err'); return; }
  const btn=el('docSave'); btn.disabled=true; btn.textContent='Uploading…'; msg('','');
  const file=fileEl.files[0];
  const safe=file.name.replace(/[^A-Za-z0-9._-]/g,'_');
  const path=`${CLIENT.slug}/documents/${Date.now()}_${safe}`;
  let url=null;
  try{ const {error}=await sb.storage.from('evidence').upload(path,file,{upsert:true}); if(!error){ url=sb.storage.from('evidence').getPublicUrl(path).data.publicUrl; } else { msg('Upload failed: '+error.message,'err'); btn.disabled=false; btn.textContent='Upload document'; return; } }
  catch(e){ msg('Upload error: '+(e.message||e),'err'); btn.disabled=false; btn.textContent='Upload document'; return; }
  const row={client_id:CLIENT.id, site_id:val('d_site')||null, title:title, doc_type:val('d_type'), doc_class:'library', file_url:url, file_name:file.name, expiry_date:val('d_expiry')||null, uploaded_by:(PROFILE.full_name||PROFILE.email)};
  const {error}=await sb.from('documents').insert(row);
  if(error){ msg('Could not save: '+error.message,'err'); btn.disabled=false; btn.textContent='Upload document'; return; }
  msg('✓ Document added.','ok');
  await notifyClient(CLIENT.id,'document','New document added: '+title,'documents','A new document is available in your dashboard.');
  await loadClientData();
  setTimeout(()=>{ closeForm(); go('documents'); }, 800);
}

/* ===================================================================
   PROJECT PLAN  —  all project files (drawings, kick-off, minutes,
   toolbox talks, programme, RAMS, handover…), per site or client-wide.
   Separate from the compliance library. Visible to the client.
   =================================================================== */
function pageProjectPlan(){
  const editor=isEditor(); const canAdd=canAddDocs();
  const docs=(DATA.documents||[]).filter(d=>(d.doc_class||'library')==='project');
  const head=`<div class="sechead"><h3>📐 Project Plan</h3><span class="sub">${docs.length} project file${docs.length===1?'':'s'} · drawings, minutes, toolbox talks &amp; more</span><span class="line"></span>${canAdd?`<button class="addbtn" onclick="openProjectDocForm()">＋ Add project file</button>`:''}</div>`;
  if(!docs.length) return head+emptyState('📐','No project files yet',canAdd?'Tap “Add project file” to upload drawings, kick-off packs, meeting minutes, toolbox talks, the programme, RAMS or handover documents — to a site or to the whole project.':'Project drawings, minutes, toolbox talks and other documents will appear here.');
  // optional site filter
  const sitesWith=[...new Set(docs.map(d=>d.site_id).filter(Boolean))];
  const filter=`<div class="fld" style="max-width:280px;margin-bottom:12px"><label>Filter by site</label><select id="pp_filter" onchange="renderProjectFilter()"><option value="">All files</option><option value="__cw">Client-wide only</option>${(DATA.sites||[]).filter(s=>sitesWith.includes(s.id)).map(s=>`<option value="${s.id}">${esc(s.code||s.city||'Site')}</option>`).join('')}</select></div>`;
  // group by category
  const cats=PROJECT_DOC_TYPES.filter(c=>docs.some(d=>(d.doc_type||'Other')===c));
  const other=docs.filter(d=>!PROJECT_DOC_TYPES.includes(d.doc_type||'Other'));
  const groups=cats.map(c=>{
    const list=docs.filter(d=>(d.doc_type||'Other')===c);
    return projGroupHtml(c,list,editor);
  }).join('') + (other.length?projGroupHtml('Other',other,editor):'');
  return head+filter+`<div id="ppGroups">${groups}</div>`;
}
function projGroupHtml(cat,list,editor){
  const rows=list.map(d=>{
    const s=(DATA.sites||[]).find(x=>x.id===d.site_id);
    const where=s?esc(s.code||s.city):'<span class="muted">Client-wide</span>';
    const del=editor?`<button class="edit-btn" style="color:var(--red)" onclick="deleteProjectDoc('${d.id}')">Delete</button>`:'';
    return `<tr data-site="${esc(d.site_id||'__cw')}">
      <td><b>${esc(d.title||'File')}</b>${d.file_name?`<div class="muted" style="font-size:11px">${esc(d.file_name)}</div>`:''}</td>
      <td>${where}</td>
      <td class="muted" style="font-size:12px">${esc(d.uploaded_by||'')}${d.created_at?` · ${String(d.created_at).slice(0,10)}`:''}</td>
      <td style="white-space:nowrap">${d.file_url?`<a class="pdf-link" href="${esc(d.file_url)}" target="_blank">Open ↗</a>`:'<span class="muted">—</span>'} ${del}</td></tr>`;
  }).join('');
  return `<div class="card pp-group" style="margin-bottom:14px"><h4>${projIcon(cat)} ${esc(cat)} <span class="muted" style="font-weight:600;font-size:12px">· ${list.length}</span></h4>
    <table><thead><tr><th>File</th><th>Site</th><th>Added</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function renderProjectFilter(){
  const v=val('pp_filter');
  document.querySelectorAll('#ppGroups tr[data-site]').forEach(tr=>{
    const show = !v || (v==='__cw'? tr.dataset.site==='__cw' : tr.dataset.site===v);
    tr.style.display = show?'':'none';
  });
  document.querySelectorAll('#ppGroups .pp-group').forEach(g=>{
    const any=[...g.querySelectorAll('tr[data-site]')].some(tr=>tr.style.display!=='none');
    g.style.display=any?'':'none';
  });
}
function openProjectDocForm(){
  if(!CLIENT){ alert('Pick a client first.'); return; }
  const typeOpts=PROJECT_DOC_TYPES.map(t=>`<option>${t}</option>`).join('');
  const wrap=document.createElement('div'); wrap.className='modal-bg'; wrap.id='modalBg';
  wrap.innerHTML=`<div class="modal">
    <div class="modal-h"><h3>Add Project File</h3><button class="modal-x" onclick="closeForm()">✕</button></div>
    <div class="modal-b">
      <div class="fld"><label>Title <span class="req">*</span></label><input id="p_title" placeholder="e.g. GA Drawing Rev C — Level 1"></div>
      <div class="frow">
        <div class="fld"><label>Category</label><select id="p_type">${typeOpts}</select></div>
        <div class="fld"><label>Site</label><select id="p_site"><option value="">Client-wide (whole project)</option>${(DATA.sites||[]).map(s=>`<option value="${s.id}">${esc(s.code||s.city||'Site')}${s.city?(' — '+esc(s.city)):''}</option>`).join('')}</select></div>
      </div>
      <div class="box see" style="background:var(--panel2);border:1px dashed var(--line2);border-radius:10px;padding:11px 13px;font-size:12.5px;color:var(--muted);margin:4px 0 12px">Upload a file <b>or</b> paste a link (handy for large drawings or files already in SharePoint / Drive). One of the two is enough.</div>
      <div class="fld"><label>Upload file</label><input id="p_file" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.csv,.dwg,.dxf,.zip,.ppt,.pptx"></div>
      <div class="fld"><label>…or link (URL)</label><input id="p_url" placeholder="https://…"></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" onclick="closeForm()">Cancel</button><button class="btn" id="pSave" onclick="submitProjectDoc()">Add file</button></div>
    <div class="savemsg" id="saveMsg" style="padding-bottom:14px"></div>
  </div>`;
  document.body.appendChild(wrap);
}
async function submitProjectDoc(){
  const title=val('p_title'); if(!title){ msg('Please add a title.','err'); return; }
  const fileEl=el('p_file'); const linkUrl=val('p_url');
  const hasFile=fileEl&&fileEl.files&&fileEl.files[0];
  if(!hasFile && !linkUrl){ msg('Add a file or a link.','err'); return; }
  const btn=el('pSave'); btn.disabled=true; btn.textContent='Saving…'; msg('','');
  let url=linkUrl||null, fname=null;
  if(hasFile){ btn.textContent='Uploading…'; const file=fileEl.files[0]; fname=file.name;
    const safe=file.name.replace(/[^A-Za-z0-9._-]/g,'_'); const path=`${CLIENT.slug}/project/${Date.now()}_${safe}`;
    try{ const {error}=await sb.storage.from('evidence').upload(path,file,{upsert:true});
      if(error){ msg('Upload failed: '+error.message,'err'); btn.disabled=false; btn.textContent='Add file'; return; }
      url=sb.storage.from('evidence').getPublicUrl(path).data.publicUrl;
    }catch(e){ msg('Upload error: '+(e.message||e),'err'); btn.disabled=false; btn.textContent='Add file'; return; }
  }
  const row={client_id:CLIENT.id, site_id:val('p_site')||null, title:title, doc_type:val('p_type'), doc_class:'project', file_url:url, file_name:fname, uploaded_by:(PROFILE.full_name||PROFILE.email)};
  const {error}=await sb.from('documents').insert(row);
  if(error){ msg('Could not save: '+error.message,'err'); btn.disabled=false; btn.textContent='Add file'; return; }
  msg('✓ Added to the project plan.','ok');
  await notifyClient(CLIENT.id,'document','New project file added: '+title,'project','A new file is in your Project Plan.');
  await loadClientData(); setTimeout(()=>{ closeForm(); go('project'); }, 700);
}
async function deleteProjectDoc(id){
  if(!confirm('Delete this project file? This cannot be undone.')) return;
  const {error}=await sb.from('documents').delete().eq('id',id);
  if(error){ alert('Could not delete: '+error.message); return; }
  await loadClientData(); go('project');
}

