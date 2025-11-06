// GraceWise core.js v5.8.3.4 — Full, standalone
// - Mobile-safe JSON handling for auth endpoints (Accept + Content-Type)
// - Hybrid local + cloud persistence per-user (auto sync + restore + manual)
// - Validation helpers, rate auto-sync, theme, transaction and grace helpers
// Drop this file as /public/core.js and redeploy.

const TOKEN_KEY = 'gw_token_v56';
const API = location.origin.replace(/\/$/, '') + '/api'; // robust API base

// -------------------- auth & token --------------------
function setToken(t){ localStorage.setItem(TOKEN_KEY, t); }
function getToken(){ return localStorage.getItem(TOKEN_KEY); }
function clearToken(){ localStorage.removeItem(TOKEN_KEY); }

function currentUserId(){
  try{
    const token = getToken();
    if(!token) return localStorage.getItem('gw_last_user') || 'guest';
    const payload = JSON.parse(atob(token.split('.')[1]));
    const id = payload.email || payload.sub || 'guest';
    localStorage.setItem('gw_last_user', id);
    return id;
  }catch(e){
    return localStorage.getItem('gw_last_user') || 'guest';
  }
}

// -------------------- keys & storage --------------------
function keyFor(base){ return `gw_${base}_${currentUserId()}`; }
function BANKS_KEY(){ return keyFor('banks'); }
function TX_KEY(){ return keyFor('tx'); }
function THEME_KEY(){ return keyFor('theme'); }

function uid(){ return Math.random().toString(36).slice(2,9); }
function load(k){ try{ return JSON.parse(localStorage.getItem(k)||'[]'); }catch(e){ return []; } }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); setTimeout(()=>syncToServer(),1200); }
function setVal(k,v){ localStorage.setItem(k,v); }
function getVal(k){ return localStorage.getItem(k); }

// -------------------- utils --------------------
function fmt(d){ return d? new Date(d).toLocaleDateString() : '-'; }
function parseDate(v){ return v? new Date(v+'T00:00:00') : null; }
function daysDiff(a,b){ return Math.round((b-a)/(1000*60*60*24)); }
function toEGP(n){ return 'EGP '+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function simpleInterest(amount,daily,days){ return amount*(daily/100)*days; }

// -------------------- theme --------------------
// Theme values: 'light' or 'dark'
function applyTheme(){ let theme = localStorage.getItem(THEME_KEY()) || 'light'; if(theme==='dark'){ document.documentElement.classList.add('dark'); document.body.classList.add('dark'); } else { document.documentElement.classList.remove('dark'); document.body.classList.remove('dark'); } localStorage.setItem(THEME_KEY(), theme); }
function setActiveNav(path){ document.querySelectorAll('.bottom-nav .nav-item').forEach(i=> i.classList.toggle('active', i.dataset.path===path)); }

// -------------------- validation UX --------------------
function markInvalid(el, message){
  if(!el) return;
  el.classList.add('invalid');
  let idx = el.nextElementSibling;
  if(idx && idx.classList && idx.classList.contains('field-error')){ idx.textContent = message; }
  else { const span = document.createElement('div'); span.className = 'field-error'; span.textContent = message; el.parentNode.insertBefore(span, el.nextSibling); }
}
function clearInvalid(el){ if(!el) return; el.classList.remove('invalid'); const idx = el.nextElementSibling; if(idx && idx.classList && idx.classList.contains('field-error')) idx.remove(); }
function scrollToInvalid(el){ try{ el.scrollIntoView({behavior:'smooth', block:'center'}); el.classList.add('shake'); setTimeout(()=>el.classList.remove('shake'),400); }catch(e){} }

// -------------------- rate sync --------------------
function bindRateSync(annualEl, dailyEl){
  if(!annualEl||!dailyEl) return;
  let lock = false;
  annualEl.addEventListener('input', ()=>{
    if(lock) return;
    lock = true;
    const a = parseFloat(annualEl.value||'0'); if(!isNaN(a)){ dailyEl.value = (a/365).toFixed(6); }
    lock = false;
  });
  annualEl.addEventListener('blur', ()=>{ const a = parseFloat(annualEl.value||'0'); if(isNaN(a) || a<0) annualEl.value = '0.00'; });
  dailyEl.addEventListener('input', ()=>{
    if(lock) return;
    lock = true;
    const d = parseFloat(dailyEl.value||'0'); if(!isNaN(d)){ annualEl.value = (d*365).toFixed(2); }
    lock = false;
  });
  dailyEl.addEventListener('blur', ()=>{ const d = parseFloat(dailyEl.value||'0'); if(isNaN(d) || d<0) dailyEl.value = '0.000000'; });
}

// -------------------- mobile-safe JSON helpers --------------------
async function safeJson(res){
  try {
    const text = await res.text();
    return JSON.parse(text);
  } catch (e) {
    // Provide helpful alert on mobile if parse fails
    alert('⚠️ Server returned an unexpected response. Please retry.');
    return { ok:false, error:'Invalid JSON response' };
  }
}

// -------------------- Auth API (mobile-safe) --------------------
async function registerUser(username,email,password){
  try{
    const res = await fetch(`${API}/register`,{
      method:'POST',
      headers:{ 'Accept':'application/json', 'Content-Type':'application/json' },
      body: JSON.stringify({ username,email,password })
    });
    const data = await safeJson(res);
    if(res.ok && data.token){ setToken(data.token); await restoreAndMerge(); await syncToServer(); return { ok:true, user:data.user }; }
    return { ok:false, error:data.error||'Registration failed' };
  }catch(e){ return { ok:false, error:e.message }; }
}

async function loginCreds(emailOrUser, password){
  try{
    const isEmail = emailOrUser.includes('@');
    const body = isEmail ? { email: emailOrUser, password } : { username: emailOrUser, password };
    const res = await fetch(`${API}/login`,{
      method:'POST',
      headers:{ 'Accept':'application/json', 'Content-Type':'application/json' },
      body: JSON.stringify(body)
    });
    const data = await safeJson(res);
    if(res.ok && data.token){ setToken(data.token); await restoreAndMerge(); await syncToServer(); return { ok:true, user:data.user }; }
    return { ok:false, error:data.error||'Login failed' };
  }catch(e){ return { ok:false, error:e.message }; }
}

async function forgotPassword(email){
  try{
    const res = await fetch(`${API}/forgot`,{
      method:'POST',
      headers:{ 'Accept':'application/json', 'Content-Type':'application/json' },
      body: JSON.stringify({ email })
    });
    return await safeJson(res);
  }catch(e){ return { ok:false, error:e.message }; }
}

async function resetPassword(email,code,newPassword){
  try{
    const res = await fetch(`${API}/reset`,{
      method:'POST',
      headers:{ 'Accept':'application/json', 'Content-Type':'application/json' },
      body: JSON.stringify({ email,code,newPassword })
    });
    return await safeJson(res);
  }catch(e){ return { ok:false, error:e.message }; }
}

// -------------------- sync & restore --------------------
async function syncToServer(){
  const token = getToken(); if(!token) return { ok:false, error:'not logged in' };
  const banks = load(BANKS_KEY()); const txs = load(TX_KEY());
  try{
    const res = await fetch(`${API}/sync`,{
      method:'POST',
      headers:{ 'Accept':'application/json', 'Content-Type':'application/json', 'Authorization':'Bearer '+token },
      body: JSON.stringify({ banks, transactions: txs })
    });
    return await safeJson(res);
  }catch(e){ console.warn('Sync error',e); return { ok:false, error:String(e) }; }
}

async function restoreFromServer(){
  const token = getToken(); if(!token) return { ok:false, error:'not logged in' };
  try{
    const res = await fetch(`${API}/restore`,{ headers:{ 'Authorization':'Bearer '+token } });
    if(!res.ok) return { ok:false, error:'restore failed' };
    const data = await safeJson(res);
    if(data.banks && data.banks.length) save(BANKS_KEY(), data.banks);
    if(data.transactions && data.transactions.length) save(TX_KEY(), data.transactions);
    return { ok:true };
  }catch(e){ console.warn('Restore error',e); return { ok:false, error:String(e) }; }
}

// Merge local and remote: keep union, prefer local for conflicts (by id)
async function restoreAndMerge(){
  const r = await restoreFromServer();
  const localBanks = load(BANKS_KEY());
  const localTx = load(TX_KEY());
  if(!r.ok) return;
  const remoteBanks = load(BANKS_KEY()); // after restoreFromServer() saved remote to localKey
  const remoteTx = load(TX_KEY());
  // merge banks
  const mergedBanks = [...remoteBanks];
  localBanks.forEach(lb=>{ const idx = mergedBanks.findIndex(x=>x.id===lb.id); if(idx>=0) mergedBanks[idx]=lb; else mergedBanks.push(lb); });
  // merge transactions
  const mergedTx = [...remoteTx];
  localTx.forEach(lt=>{ const idx = mergedTx.findIndex(x=>x.id===lt.id); if(idx>=0) mergedTx[idx]=lt; else mergedTx.push(lt); });
  // save merged locally (this will trigger sync shortly)
  save(BANKS_KEY(), mergedBanks);
  save(TX_KEY(), mergedTx);
  return { ok:true };
}

// -------------------- data export --------------------
function downloadDataFile(){
  const payload = { banks: load(BANKS_KEY()), transactions: load(TX_KEY()), exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `gracewise_${currentUserId()}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// -------------------- Forms: cards validation & save --------------------
function validateCardFormElements(nameEl,endEl,dueEl,annualEl,dailyEl,fineEl){
  [nameEl,endEl,dueEl,annualEl,dailyEl,fineEl].forEach(el=>clearInvalid(el));
  let firstInvalid = null;
  if(!nameEl.value || nameEl.value.trim().length<3){ markInvalid(nameEl,'Card name is required (3+ chars)'); firstInvalid = firstInvalid||nameEl; }
  if(!endEl.value){ markInvalid(endEl,'Pick cycle end date'); firstInvalid = firstInvalid||endEl; }
  if(!dueEl.value){ markInvalid(dueEl,'Pick due date'); firstInvalid = firstInvalid||dueEl; }
  if(endEl.value && dueEl.value){
    const e=new Date(endEl.value+'T00:00:00'); const d=new Date(dueEl.value+'T00:00:00');
    if(d.getTime()<=e.getTime()){ markInvalid(dueEl,'Due date must be after cycle end'); firstInvalid = firstInvalid||dueEl; }
  }
  const aVal = parseFloat(annualEl.value||'0'); const dVal = parseFloat(dailyEl.value||'0'); const fVal = parseFloat(fineEl.value||'0');
  if(isNaN(aVal) || aVal<0){ markInvalid(annualEl,'Annual rate must be ≥ 0'); firstInvalid = firstInvalid||annualEl; }
  if(isNaN(dVal) || dVal<0){ markInvalid(dailyEl,'Daily rate must be ≥ 0'); firstInvalid = firstInvalid||dailyEl; }
  if(isNaN(fVal) || fVal<0){ markInvalid(fineEl,'Late fine must be ≥ 0'); firstInvalid = firstInvalid||fineEl; }
  return firstInvalid;
}

function handleFormValidationAndSave(form, onSave){
  const nameEl = form.querySelector('#bankName');
  const endEl = form.querySelector('#bankEnd');
  const dueEl = form.querySelector('#bankDue');
  const annualEl = form.querySelector('#bankRate');
  const dailyEl = form.querySelector('#bankDaily');
  const fineEl = form.querySelector('#bankFine');
  const firstInvalid = validateCardFormElements(nameEl,endEl,dueEl,annualEl,dailyEl,fineEl);
  if(firstInvalid){ scrollToInvalid(firstInvalid); return false; }
  const banks = load(BANKS_KEY());
  const name = nameEl.value.trim();
  const existing = banks.find(b=>b.name.toLowerCase()===name.toLowerCase());
  const payload = { id: existing? existing.id : uid(), name, end: endEl.value, due: dueEl.value, rate: parseFloat(annualEl.value||'0'), daily: parseFloat(dailyEl.value||'0'), fine: parseFloat(fineEl.value||'0') };
  if(existing){ const idx=banks.findIndex(x=>x.id===existing.id); banks[idx]=payload; } else banks.push(payload);
  save(BANKS_KEY(), banks);
  if(typeof onSave==='function') onSave();
  return true;
}

// -------------------- logout --------------------
function logoutUser(){ clearToken(); // keep local data
  window.location.href = '/login'; 
}

// -------------------- small helpers exported to pages --------------------
// The pages expect some helpers to be global, ensure they exist
window.currentUserId = currentUserId;
window.BANKS_KEY = BANKS_KEY;
window.TX_KEY = TX_KEY;
window.applyTheme = applyTheme;
window.setActiveNav = setActiveNav;
window.bindRateSync = bindRateSync;
window.handleFormValidationAndSave = handleFormValidationAndSave;
window.markInvalid = markInvalid;
window.clearInvalid = clearInvalid;
window.scrollToInvalid = scrollToInvalid;
window.save = save;
window.load = load;
window.uid = uid;
window.fmt = fmt;
window.toEGP = toEGP;
window.simpleInterest = simpleInterest;
window.downloadDataFile = downloadDataFile;
window.syncToServer = syncToServer;
window.restoreFromServer = restoreFromServer;
window.logoutUser = logoutUser;
window.registerUser = registerUser;
window.loginCreds = loginCreds;
window.forgotPassword = forgotPassword;
window.resetPassword = resetPassword;

console.log('GraceWise core.js v5.8.3.4 loaded — API base:', API);
