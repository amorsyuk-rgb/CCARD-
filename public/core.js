// GraceWise v5.8.2 Hybrid Sync Fix
const TOKEN_KEY = 'gw_token_v56';

function setToken(t){
  localStorage.setItem(TOKEN_KEY, t);
}

function getToken(){ return localStorage.getItem(TOKEN_KEY); }

function clearToken(){
  localStorage.removeItem(TOKEN_KEY);
}

function currentUserId(){
  try{
    const token = getToken();
    if(!token) return localStorage.getItem("gw_last_user") || "guest";
    const payload = JSON.parse(atob(token.split('.')[1]));
    const id = payload.email || payload.sub || "guest";
    localStorage.setItem("gw_last_user", id);
    return id;
  }catch(e){
    return localStorage.getItem("gw_last_user") || "guest";
  }
}

function keyFor(base){ return `gw_${base}_${currentUserId()}`; }
function BANKS_KEY(){ return keyFor('banks'); }
function TX_KEY(){ return keyFor('tx'); }
function THEME_KEY(){ return keyFor('theme'); }

function uid(){ return Math.random().toString(36).slice(2,9); }
function load(k){ try{ return JSON.parse(localStorage.getItem(k)||'[]'); }catch(e){ return []; } }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); setTimeout(()=>syncToServer(),1500); }
function setVal(k,v){ localStorage.setItem(k,v); }
function getVal(k){ return localStorage.getItem(k); }
function fmt(d){ return d? new Date(d).toLocaleDateString() : '-'; }
function parseDate(v){ return v? new Date(v+'T00:00:00') : null; }
function daysDiff(a,b){ return Math.round((b-a)/(1000*60*60*24)); }
function toEGP(n){ return 'EGP '+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function simpleInterest(amount,daily,days){ return amount*(daily/100)*days; }

function applyTheme(){
  let theme = localStorage.getItem(THEME_KEY()) || 'cib';
  if(theme==='dark'){
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  }
  localStorage.setItem(THEME_KEY(), theme);
}

function setActiveNav(path){ document.querySelectorAll('.bottom-nav .nav-item').forEach(i=> i.classList.toggle('active', i.dataset.path===path)); }

async function registerUser(username,email,password){
  const res = await fetch('/api/register',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username,email,password }) });
  const data = await res.json(); if(res.ok){ setToken(data.token); await restoreFromServer(); await syncToServer(); return { ok:true, user:data.user }; }
  return { ok:false, error:data.error };
}

async function loginCreds(emailOrUser, password){
  const isEmail = emailOrUser.includes('@');
  const body = isEmail ? { email: emailOrUser, password } : { username: emailOrUser, password };
  const res = await fetch('/api/login',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const data = await res.json();
  if(res.ok){ setToken(data.token); await restoreFromServer(); await syncToServer(); return { ok:true, user:data.user }; }
  return { ok:false, error:data.error };
}

async function forgotPassword(email){ const res = await fetch('/api/forgot',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email }) }); return await res.json(); }
async function resetPassword(email,code,newPassword){ const res = await fetch('/api/reset',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email,code,newPassword }) }); return await res.json(); }

async function syncToServer(){
  const token = getToken(); if(!token) return;
  const banks = load(BANKS_KEY()); const txs = load(TX_KEY());
  try{ await fetch('/api/sync',{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({ banks, transactions: txs }) }); }catch(e){ console.warn('Sync error',e); }
}

async function restoreFromServer(){
  const token = getToken(); if(!token) return;
  try{
    const res = await fetch('/api/restore',{ headers:{'Authorization':'Bearer '+token} });
    if(!res.ok) return;
    const data = await res.json();
    if(data.banks && data.banks.length) save(BANKS_KEY(), data.banks);
    if(data.transactions && data.transactions.length) save(TX_KEY(), data.transactions);
  }catch(e){ console.warn('Restore error',e); }
}

function downloadDataFile(){
  const payload = { banks: load(BANKS_KEY()), transactions: load(TX_KEY()), exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`gracewise_${currentUserId()}.json`; a.click();
  URL.revokeObjectURL(url);
}
