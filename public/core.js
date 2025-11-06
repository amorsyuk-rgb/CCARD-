// core.js v5.8 - hybrid storage + email auth helpers
const TOKEN_KEY = 'gw_token_v56';
function setToken(t){
  Object.keys(localStorage).forEach(k => { if(k.startsWith('gw_')) localStorage.removeItem(k); });
  localStorage.setItem(TOKEN_KEY, t);
}
function getToken(){ return localStorage.getItem(TOKEN_KEY); }
function clearToken(){ localStorage.removeItem(TOKEN_KEY); }
function currentUserId(){
  try{
    const token = getToken();
    if(!token) return 'guest';
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.email || payload.sub || 'guest';
  }catch(e){ return 'guest'; }
}
function keyFor(base){ return `gw_${base}_${currentUserId()}`; }
function BANKS_KEY(){ return keyFor('banks'); }
function TX_KEY(){ return keyFor('tx'); }
function THEME_KEY(){ return keyFor('theme'); }
function uid(){ return Math.random().toString(36).slice(2,9); }
function load(k){ try{ return JSON.parse(localStorage.getItem(k)||'[]'); }catch(e){ return []; } }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function fmt(d){ return d? new Date(d).toLocaleDateString() : '-'; }
function parseDate(v){ return v? new Date(v+'T00:00:00') : null; }
function daysDiff(a,b){ return Math.round((b-a)/(1000*60*60*24)); }
function toEGP(n){ return 'EGP '+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function simpleInterest(amount,daily,days){ return amount*(daily/100)*days; }
function applyTheme(){ let theme = localStorage.getItem(THEME_KEY()) || 'cib'; if(theme==='dark'){ document.documentElement.classList.add('dark'); document.body.classList.add('dark'); } else { document.documentElement.classList.remove('dark'); document.body.classList.remove('dark'); } localStorage.setItem(THEME_KEY(), theme); }
function setActiveNav(path){ document.querySelectorAll('.bottom-nav .nav-item').forEach(i=> i.classList.toggle('active', i.dataset.path===path)); }
async function registerUser(username,email,password){ try{ const res = await fetch('/api/register',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, email, password }) }); if(!res.ok) return { ok:false, error: await res.text() }; const data = await res.json(); setToken(data.token); return { ok:true, user: data.user }; }catch(e){ return { ok:false, error: String(e) }; } }
async function loginCreds(emailOrUser, password){ try{ const isEmail = emailOrUser.includes('@'); const body = isEmail ? { email: emailOrUser, password } : { username: emailOrUser, password }; const res = await fetch('/api/login',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }); if(!res.ok) return { ok:false, error: await res.text() }; const data = await res.json(); setToken(data.token); return { ok:true, user: data.user }; }catch(e){ return { ok:false, error: String(e) }; } }
async function forgotPassword(email){ try{ const res = await fetch('/api/forgot',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email }) }); const data = await res.json(); return data; }catch(e){ return { ok:false, error: String(e) }; } }
async function resetPassword(email, code, newPassword){ try{ const res = await fetch('/api/reset',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, code, newPassword }) }); const data = await res.json(); return data; }catch(e){ return { ok:false, error: String(e) }; } }
async function syncToServer(){ const token = getToken(); if(!token) return { ok:false, error:'Not logged in' }; try{ const res = await fetch('/api/sync',{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({ banks: load(BANKS_KEY()), transactions: load(TX_KEY()) }) }); return await res.json(); }catch(e){ return { ok:false, error: String(e) }; } }
async function restoreFromServer(){ const token = getToken(); if(!token) return { ok:false, error:'Not logged in' }; try{ const res = await fetch('/api/restore',{ headers:{ 'Authorization':'Bearer '+token } }); if(!res.ok) return { ok:false, error:'Restore failed' }; const data = await res.json(); if(data.banks) save(BANKS_KEY(), data.banks); if(data.transactions) save(TX_KEY(), data.transactions); return { ok:true, timestamp: data.timestamp }; }catch(e){ return { ok:false, error: String(e) }; } }