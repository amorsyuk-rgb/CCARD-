// core.js v5.8.3 - validation engine + auto-rate syncing + per-user storage + light/dark themes
const TOKEN_KEY = 'gw_token_v56';

function setToken(t){ localStorage.setItem(TOKEN_KEY, t); }
function getToken(){ return localStorage.getItem(TOKEN_KEY); }
function clearToken(){ localStorage.removeItem(TOKEN_KEY); }

function currentUserId(){ try{ const token = getToken(); if(!token) return localStorage.getItem('gw_last_user')||'guest'; const payload = JSON.parse(atob(token.split('.')[1])); const id = payload.email || payload.sub || 'guest'; localStorage.setItem('gw_last_user', id); return id; }catch(e){ return localStorage.getItem('gw_last_user')||'guest'; } }

function keyFor(base){ return `gw_${base}_${currentUserId()}`; }
function BANKS_KEY(){ return keyFor('banks'); }
function TX_KEY(){ return keyFor('tx'); }
function THEME_KEY(){ return keyFor('theme'); }

function uid(){ return Math.random().toString(36).slice(2,9); }
function load(k){ try{ return JSON.parse(localStorage.getItem(k)||'[]'); }catch(e){ return []; } }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); setTimeout(()=>syncToServer(),1200); }
function setVal(k,v){ localStorage.setItem(k,v); }
function getVal(k){ return localStorage.getItem(k); }

function fmt(d){ return d? new Date(d).toLocaleDateString() : '-'; }
function parseDate(v){ return v? new Date(v+'T00:00:00') : null; }
function daysDiff(a,b){ return Math.round((b-a)/(1000*60*60*24)); }
function toEGP(n){ return 'EGP '+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function simpleInterest(amount,daily,days){ return amount*(daily/100)*days; }

// Theme: light / dark (stored as 'light' or 'dark')
function applyTheme(){ let theme = localStorage.getItem(THEME_KEY()) || 'light'; if(theme==='dark'){ document.documentElement.classList.add('dark'); document.body.classList.add('dark'); } else { document.documentElement.classList.remove('dark'); document.body.classList.remove('dark'); } localStorage.setItem(THEME_KEY(), theme); }
function setActiveNav(path){ document.querySelectorAll('.bottom-nav .nav-item').forEach(i=> i.classList.toggle('active', i.dataset.path===path)); }

// --- Validation helpers ---
function markInvalid(el, message){
  el.classList.add('invalid');
  let idx = el.nextElementSibling;
  if(idx && idx.classList && idx.classList.contains('field-error')){ idx.textContent = message; }
  else { const span = document.createElement('div'); span.className = 'field-error'; span.textContent = message; el.parentNode.insertBefore(span, el.nextSibling); }
}
function clearInvalid(el){ el.classList.remove('invalid'); const idx = el.nextElementSibling; if(idx && idx.classList && idx.classList.contains('field-error')) idx.remove(); }
function scrollToInvalid(el){ el.scrollIntoView({behavior:'smooth', block:'center'}); el.classList.add('shake'); setTimeout(()=>el.classList.remove('shake'),400); }

function validateCardForm(form){
  // fields: name, endDate, dueDate, annual, daily, fine
  const name = form.querySelector('#bankName');
  const end = form.querySelector('#bankEnd');
  const due = form.querySelector('#bankDue');
  const annual = form.querySelector('#bankRate');
  const daily = form.querySelector('#bankDaily');
  const fine = form.querySelector('#bankFine');
  let firstInvalid = null;
  // name
  clearInvalid(name);
  if(!name.value || name.value.trim().length<3){ markInvalid(name,'Card name is required (3+ chars)'); firstInvalid = firstInvalid||name; }
  // dates
  clearInvalid(end); clearInvalid(due);
  if(!end.value){ markInvalid(end,'Pick cycle end date'); firstInvalid = firstInvalid||end; }
  if(!due.value){ markInvalid(due,'Pick due date'); firstInvalid = firstInvalid||due; }
  if(end.value && due.value){
    const e = new Date(end.value+'T00:00:00'); const d = new Date(due.value+'T00:00:00');
    if(d.getTime() <= e.getTime()){ markInvalid(due,'Due date must be after cycle end'); firstInvalid = firstInvalid||due; }
  }
  // numeric fields
  clearInvalid(annual); clearInvalid(daily); clearInvalid(fine);
  const aVal = parseFloat(annual.value||'0'); const dVal = parseFloat(daily.value||'0'); const fVal = parseFloat(fine.value||'0');
  if(isNaN(aVal) || aVal < 0){ markInvalid(annual,'Annual rate must be a number ≥ 0'); firstInvalid = firstInvalid||annual; }
  if(isNaN(dVal) || dVal < 0){ markInvalid(daily,'Daily rate must be a number ≥ 0'); firstInvalid = firstInvalid||daily; }
  if(isNaN(fVal) || fVal < 0){ markInvalid(fine,'Late fine must be a number ≥ 0'); firstInvalid = firstInvalid||fine; }
  return firstInvalid;
}

// Auto-sync annual <-> daily (365 days)
function bindRateSync(annualEl, dailyEl){
  let lock = false;
  annualEl.addEventListener('input', ()=>{
    if(lock) return;
    lock = true;
    const a = parseFloat(annualEl.value||'0'); if(!isNaN(a)){ dailyEl.value = (a/365).toFixed(6); }
    lock = false;
  });
  dailyEl.addEventListener('input', ()=>{
    if(lock) return;
    lock = true;
    const d = parseFloat(dailyEl.value||'0'); if(!isNaN(d)){ annualEl.value = (d*365).toFixed(2); }
    lock = false;
  });
}

// Sync helpers (unchanged)
async function syncToServer(){ const token = getToken(); if(!token) return; try{ await fetch('/api/sync',{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({ banks: load(BANKS_KEY()), transactions: load(TX_KEY()) }) }); }catch(e){ console.warn('Sync error',e); } }
async function restoreFromServer(){ const token = getToken(); if(!token) return; try{ const res = await fetch('/api/restore',{ headers:{'Authorization':'Bearer '+token} }); if(!res.ok) return; const data = await res.json(); if(data.banks && data.banks.length) save(BANKS_KEY(), data.banks); if(data.transactions && data.transactions.length) save(TX_KEY(), data.transactions); }catch(e){ console.warn('Restore error',e); } }

// form utility: focus and scroll to first invalid field
function handleFormValidationAndSave(form, onSave){
  const firstInvalid = validateCardForm(form);
  if(firstInvalid){ scrollToInvalid(firstInvalid); return false; }
  // collect values and save
  const banks = load(BANKS_KEY());
  const name = form.querySelector('#bankName').value.trim();
  const end = form.querySelector('#bankEnd').value;
  const due = form.querySelector('#bankDue').value;
  const rate = parseFloat(form.querySelector('#bankRate').value)||0;
  const daily = parseFloat(form.querySelector('#bankDaily').value)||0;
  const fine = parseFloat(form.querySelector('#bankFine').value)||0;
  // update existing by name or push
  const existing = banks.find(b=>b.name.toLowerCase()===name.toLowerCase());
  if(existing){ existing.end = end; existing.due = due; existing.rate = rate; existing.daily = daily; existing.fine = fine; } else { banks.push({ id: uid(), name, end, due, rate, daily, fine }); }
  save(BANKS_KEY(), banks);
  if(typeof onSave==='function') onSave();
  return true;
}
