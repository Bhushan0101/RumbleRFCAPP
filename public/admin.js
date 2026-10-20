/* RFC local admin panel. Talks to the auth-gated /api/admin/* write API.
   Renders all stored values escaped so stored content can never script this page. */
const root=document.getElementById('admin');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Field specs mirror the server's writable-field validators (server is the source of truth).
// Gallery and News (stories) editing is intentionally OFF for now — re-add their entries here
// to restore it. See docs/INSTAGRAM.md and the feature flags in the Settings tab.
const TEXT='text',NUM='number',AREA='textarea',URL='url',IMG='image';
const SPECS={
 athletes:{label:'Athletes',fields:[['name',TEXT,true],['nickname',TEXT],['division',TEXT,true],['country',TEXT,true],['wins',NUM],['losses',NUM],['draws',NUM],['portrait_url',IMG],['cartoon_url',IMG],['biography',AREA],['is_sample',NUM],['display_order',NUM]],bulk:true},
 events:{label:'Events',fields:[['title',TEXT,true],['subtitle',TEXT,true],['status',TEXT],['starts_at',TEXT],['timezone',TEXT],['venue',TEXT],['city',TEXT],['ticket_url',URL],['poster_url',IMG],['description',AREA],['is_sample',NUM],['display_order',NUM]]},
 bouts:{label:'Bouts',fields:[['event_id',NUM,true],['red_athlete_id',NUM,true],['blue_athlete_id',NUM,true],['division',TEXT,true],['card_section',TEXT],['bout_order',NUM],['winner_id',NUM],['result_method',TEXT],['result_round',NUM],['result_time',TEXT]]},
 rankings:{label:'Rankings',fields:[['division',TEXT,true],['athlete_id',NUM,true],['position',NUM],['movement',NUM],['updated_at',TEXT],['is_sample',NUM]]},
 achievements:{label:'Achievements',fields:[['athlete_id',NUM,true],['title',TEXT,true],['description',AREA],['achieved_on',TEXT],['display_order',NUM]]},
 sponsors:{label:'Sponsors',fields:[['name',TEXT,true],['logo_url',IMG],['website_url',URL],['display_order',NUM]]},
};
const SETTING_KEYS=['brand_name','primary_color','accent_color','content_mode','instagram_url','youtube_url','gallery_enabled','news_enabled'];
let active='athletes',editId=null;

async function api(method,path,body){
 const opts={method,headers:{'X-Requested-With':'fetch'},credentials:'same-origin'};
 if(body!==undefined){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body);}
 const res=await fetch('/api/admin/'+path,opts);
 let data=null;try{data=await res.json();}catch{}
 return {ok:res.ok,status:res.status,data};
}
async function apiRaw(path,bodyBlob,contentType){
 const headers={'X-Requested-With':'fetch'};if(contentType)headers['Content-Type']=contentType;
 const res=await fetch('/api/admin/'+path,{method:'POST',headers,credentials:'same-origin',body:bodyBlob});
 let data=null;try{data=await res.json();}catch{}
 return {ok:res.ok,status:res.status,data};
}

function msg(text,kind){const m=document.getElementById('amsg');if(m){m.textContent=text||'';m.className='admin-msg '+(kind||'');}}

/* ---- auth ---- */
async function boot(){
 const s=await api('GET','session');
 if(!s.data||!s.data.configured){root.innerHTML='<div class="login-box"><h2>Admin not configured</h2><p>Run <code>python scripts/set_admin_password.py</code> in the project, then reload this page.</p></div>';return;}
 if(s.data.authenticated)renderApp();else renderLogin();
}
function renderLogin(){
 root.innerHTML='<div class="login-box"><h2>RFC Admin</h2><p style="font-size:12px;color:var(--muted)">Local content management.</p><input type="password" id="pw" placeholder="Admin password" aria-label="Admin password"><button class="btn" id="loginbtn" style="width:100%">Sign in</button><div class="admin-msg err" id="amsg"></div></div>';
 const go=async()=>{const r=await api('POST','login',{password:document.getElementById('pw').value});if(r.ok)renderApp();else msg((r.data&&r.data.error)||'Login failed','err');};
 document.getElementById('loginbtn').onclick=go;
 document.getElementById('pw').addEventListener('keydown',e=>{if(e.key==='Enter')go();});
}

/* ---- app shell ---- */
function renderApp(){
 const rail=Object.entries(SPECS).map(([k,v])=>`<button data-tab="${k}" class="${k===active?'active':''}">${esc(v.label)}</button>`).join('')+`<button data-tab="__settings" class="${active==='__settings'?'active':''}">Settings & flags</button>`;
 root.innerHTML=`<div class="admin-top"><h1>RFC ADMIN</h1><div class="admin-actions"><a class="btn ghost" href="/" target="_blank">View site ↗</a><button class="btn ghost" id="logout">Log out</button></div></div><div class="admin-rail">${rail}</div><div class="admin-msg" id="amsg"></div><div id="panel"></div>`;
 document.getElementById('logout').onclick=async()=>{await api('POST','logout');renderLogin();};
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{active=b.dataset.tab;editId=null;renderApp();});
 if(active==='__settings')renderSettings();else renderCollection(active);
}

/* ---- collection CRUD ---- */
async function renderCollection(name){
 const spec=SPECS[name];const panel=document.getElementById('panel');
 const r=await api('GET',name);
 if(!r.ok){if(r.status===401)return renderLogin();panel.textContent='Could not load.';return;}
 const rows=r.data||[];
 const cols=['id',...spec.fields.map(f=>f[0])];
 const table=`<table class="admin-table"><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}<th>Actions</th></tr></thead><tbody>${rows.map(row=>`<tr>${cols.map(c=>`<td>${esc(row[c])}</td>`).join('')}<td><div class="admin-actions"><button class="btn ghost" data-edit="${row.id}" style="padding:6px 10px">Edit</button><button class="btn danger" data-del="${row.id}">Delete</button></div></td></tr>`).join('')}</tbody></table>`;
 panel.innerHTML=`<h2 style="font-size:26px;margin-bottom:14px">${editId?'Edit':'New'} ${esc(spec.label.replace(/s$/,''))}</h2>${formHtml(spec,editId?rows.find(x=>x.id===editId):null)}${spec.bulk?bulkHtml():''}${table}`;
 panel.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{editId=+b.dataset.edit;renderCollection(name);});
 panel.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this row?'))return;const d=await api('DELETE',`${name}/${b.dataset.del}`);if(d.ok){msg('Deleted.','ok');editId=null;renderCollection(name);}else msg((d.data&&d.data.error)||'Delete failed','err');});
 panel.querySelector('#saveform').onclick=()=>saveRow(name,spec);
 if(editId)panel.querySelector('#cancelform').onclick=()=>{editId=null;renderCollection(name);};
 wireUploads(panel);
 if(spec.bulk)wireBulk(panel,name);
}
function formHtml(spec,row){
 const field=([key,type,req])=>{
  const val=row?row[key]:'';
  const v=val==null?'':val;
  const lbl=`${esc(key)}${req?' *':''}`;
  if(type===AREA)return `<label class="full">${lbl}<textarea name="${key}">${esc(v)}</textarea></label>`;
  if(type===IMG)return `<label>${lbl}<input type="url" name="${key}" value="${esc(v)}" placeholder="https://… or upload"><span class="upload-row"><input type="file" accept="image/png,image/jpeg,image/webp" data-upload-for="${key}"><small data-upload-status></small></span></label>`;
  const t=type===NUM?'number':(type===URL?'url':'text');
  return `<label>${lbl}<input type="${t}" name="${key}" value="${esc(v)}"></label>`;
 };
 return `<div class="admin-form">${spec.fields.map(field).join('')}<div class="full admin-actions"><button class="btn" id="saveform">${row?'Save changes':'Create'}</button>${row?'<button class="btn ghost" id="cancelform">Cancel edit</button>':''}</div></div>`;
}
function wireUploads(panel){
 panel.querySelectorAll('[data-upload-for]').forEach(inp=>inp.onchange=async()=>{
  const file=inp.files[0];if(!file)return;
  const key=inp.dataset.uploadFor;const status=inp.parentElement.querySelector('[data-upload-status]');
  status.textContent='Uploading…';
  const fd=new FormData();fd.append('file',file);
  const r=await apiRaw('upload',fd);  // browser sets multipart boundary
  if(r.ok&&r.data&&r.data.url){panel.querySelector(`[name="${key}"]`).value=r.data.url;status.textContent='Uploaded ✓';}
  else{status.textContent=(r.data&&r.data.error)||'Upload failed';}
 });
}
function bulkHtml(){
 return `<div class="admin-form" style="grid-template-columns:1fr"><div class="full"><h3 style="font-size:20px;margin-bottom:6px">Bulk add from spreadsheet (CSV)</h3><p style="font-size:12px;color:var(--muted)">Download the template, fill it in Excel / Numbers / Sheets, save as CSV, then upload. Each row is validated; rows with errors are skipped and reported. Organiser only.</p><div class="admin-actions" style="margin-top:12px"><a class="btn ghost" href="/api/admin/template/athletes.csv">Download CSV template ↓</a><input type="file" accept=".csv,text/csv" id="csvfile"><button class="btn" id="csvupload">Import CSV</button></div><div class="admin-msg" id="csvmsg"></div></div></div>`;
}
function wireBulk(panel,name){
 const btn=panel.querySelector('#csvupload');if(!btn)return;
 btn.onclick=async()=>{
  const f=panel.querySelector('#csvfile').files[0];const m=panel.querySelector('#csvmsg');
  if(!f){m.textContent='Choose a CSV file first.';m.className='admin-msg err';return;}
  m.textContent='Importing…';m.className='admin-msg';
  const text=await f.text();
  const r=await apiRaw('import/athletes',text,'text/csv');
  if(r.ok){m.className='admin-msg ok';m.textContent=`Added ${r.data.added} athlete(s).`+(r.data.errors.length?` Skipped: ${r.data.errors.join('; ')}`:'');renderCollection(name);}
  else{m.className='admin-msg err';m.textContent=(r.data&&r.data.error)||'Import failed';}
 };
}
async function saveRow(name,spec){
 const body={};
 document.querySelectorAll('.admin-form [name]').forEach(el=>{
  const key=el.name,raw=el.value.trim();const f=spec.fields.find(x=>x[0]===key);
  if(raw===''){return;}  // omit blanks; server keeps existing/defaults
  body[key]=f[1]===NUM?Number(raw):raw;
 });
 const r=editId?await api('PUT',`${name}/${editId}`,body):await api('POST',name,body);
 if(r.ok){msg(editId?'Saved.':'Created.','ok');editId=null;renderCollection(name);}
 else if(r.status===401)renderLogin();
 else msg((r.data&&r.data.error)||'Save failed','err');
}

/* ---- settings / social ---- */
async function renderSettings(){
 const panel=document.getElementById('panel');
 const r=await api('GET','settings');
 if(!r.ok){if(r.status===401)return renderLogin();panel.textContent='Could not load.';return;}
 const s=r.data||{};
 panel.innerHTML=`<h2 style="font-size:26px;margin-bottom:6px">Settings & feature flags</h2><p style="font-size:12px;color:var(--muted);margin-bottom:18px">Brand values, social URLs, and public feature flags. Set <b>gallery_enabled</b> / <b>news_enabled</b> to <b>1</b> to switch those pages back on (currently off). Instagram details are stored here but the Instagram feature is parked — see docs/INSTAGRAM.md.</p><div class="admin-form">${SETTING_KEYS.map(k=>`<label class="${k==='brand_name'?'full':''}">${esc(k)}<input name="set_${k}" value="${esc(s[k])}"></label>`).join('')}<div class="full"><button class="btn" id="savesettings">Save settings</button></div></div>`;
 panel.querySelector('#savesettings').onclick=async()=>{
  let okAll=true;
  for(const k of SETTING_KEYS){
   const el=panel.querySelector(`[name="set_${k}"]`);const val=el.value.trim();
   const r=await api('PUT',`settings/${k}`,{value:val});
   if(!r.ok){okAll=false;msg(`${k}: ${(r.data&&r.data.error)||'failed'}`,'err');break;}
  }
  if(okAll)msg('Settings saved.','ok');
 };
}

boot();
