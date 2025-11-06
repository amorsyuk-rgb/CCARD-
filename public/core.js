// GraceWise v5.7.2 Secure Hybrid — per-user isolated storage

// --- JWT + user helpers ---
const TOKEN_KEY = 'gw_token_v56';

function currentUserId() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return 'guest';
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Prefer userId (like “GW001”), fallback to sub
    return payload.userId || payload.sub || 'guest';
  } catch (e) {
    return 'guest';
  }
}
function keyFor(base) {
  return `gw_${base}_${currentUserId()}`;
}

// --- Dynamic keys ---
function BANKS_KEY() { return keyFor('banks'); }
function TX_KEY()    { return keyFor('tx'); }
function THEME_KEY() { return keyFor('theme'); }

// --- Basic utilities ---
function uid(){ return Math.random().toString(36).slice(2,9); }
function load(k){ try{ return JSON.parse(localStorage.getItem(k)||'[]'); }catch(e){ return []; } }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function setVal(k,v){ localStorage.setItem(k,v); }
function getVal(k){ return localStorage.getItem(k); }
function setToken(t){ localStorage.setItem(TOKEN_KEY,t); }
function getToken(){ return localStorage.getItem(TOKEN_KEY); }
function clearToken(){ localStorage.removeItem(TOKEN_KEY); }
function fmt(d){ return d? new Date(d).toLocaleDateString() : '-'; }
function parseDate(v){ return v? new Date(v+'T00:00:00') : null; }
function daysDiff(a,b){ return Math.round((b-a)/(1000*60*60*24)); }
function toEGP(n){ return 'EGP '+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function simpleInterest(amount,daily,days){ return amount*(daily/100)*days; }

// --- Theme & nav ---
function applyTheme(){
  let theme = getVal(THEME_KEY()) || 'cib';
  if(theme==='dark'){
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  }
  setVal(THEME_KEY(), theme);
}
function setActiveNav(path){
  document.querySelectorAll('.bottom-nav .nav-item')
    .forEach(i=> i.classList.toggle('active', i.dataset.path===path));
}

// --- Cloud sync ---
async function syncToServer(){
  const token=getToken(); if(!token) return {ok:false,error:'Not logged in'};
  try{
    const res = await fetch('/api/sync',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({
        banks: load(BANKS_KEY()),
        transactions: load(TX_KEY())
      })
    });
    return await res.json();
  }catch(e){ return {ok:false,error:String(e)}; }
}

async function restoreFromServer(){
  const token=getToken(); if(!token) return {ok:false,error:'Not logged in'};
  try{
    const res = await fetch('/api/restore',{headers:{'Authorization':'Bearer '+token}});
    if(!res.ok) return {ok:false,error:'Restore failed'};
    const data = await res.json();
    if(data.banks) save(BANKS_KEY(), data.banks);
    if(data.transactions) save(TX_KEY(), data.transactions);
    return {ok:true,timestamp:data.timestamp};
  }catch(e){ return {ok:false,error:String(e)}; }
}

// --- Auth helpers ---
async function registerUser(username,userId,password){
  try{
    const res = await fetch('/api/register',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body: JSON.stringify({username,userId,password})
    });
    if(!res.ok) return {ok:false,error:await res.text()};
    const data = await res.json(); setToken(data.token);
    return {ok:true,user:data.user};
  }catch(e){ return {ok:false,error:String(e)}; }
}

async function loginCreds(username,userId,password){
  try{
    const res = await fetch('/api/login',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body: JSON.stringify({username,userId,password})
    });
    if(!res.ok) return {ok:false,error:await res.text()};
    const data = await res.json(); setToken(data.token);
    return {ok:true,user:data.user};
  }catch(e){ return {ok:false,error:String(e)}; }
}

async function loginFace(descriptor){
  try{
    const res = await fetch('/api/login-face',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body: JSON.stringify({descriptor})
    });
    if(!res.ok) return {ok:false,error:await res.text()};
    const data = await res.json(); setToken(data.token);
    return {ok:true,user:data.user};
  }catch(e){ return {ok:false,error:String(e)}; }
}

async function enrollFace(descriptor){
  const token=getToken(); if(!token) return {ok:false,error:'Not logged in'};
  try{
    const res = await fetch('/api/enroll-face',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({descriptor})
    });
    if(!res.ok) return {ok:false,error:await res.text()};
    return {ok:true};
  }catch(e){ return {ok:false,error:String(e)}; }
}

// --- Logout helper ---
function logout(){
  clearToken();
  localStorage.removeItem(keyFor('banks'));
  localStorage.removeItem(keyFor('tx'));
  localStorage.removeItem(keyFor('theme'));
  alert('Logged out');
  location.href='/login';
}
