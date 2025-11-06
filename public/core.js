// GraceWise v5.8.3 Login Fix Patch — Correct API base URL
const TOKEN_KEY = 'gw_token_v56';
const API = window.location.origin + '/api';

function setToken(t){ localStorage.setItem(TOKEN_KEY, t); }
function getToken(){ return localStorage.getItem(TOKEN_KEY); }
function clearToken(){ localStorage.removeItem(TOKEN_KEY); }

function currentUserId(){
  try{
    const token = getToken();
    if(!token) return localStorage.getItem("gw_last_user") || "guest";
    const payload = JSON.parse(atob(token.split('.')[1]));
    const id = payload.email || payload.sub || "guest";
    localStorage.setItem("gw_last_user", id);
    return id;
  }catch(e){ return localStorage.getItem("gw_last_user") || "guest"; }
}

async function registerUser(username,email,password){
  const res = await fetch(`${API}/register`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ username,email,password })
  });
  const data = await res.json();
  if(res.ok){ setToken(data.token); await restoreFromServer(); await syncToServer(); return { ok:true, user:data.user }; }
  return { ok:false, error:data.error };
}

async function loginCreds(emailOrUser, password){
  const isEmail = emailOrUser.includes('@');
  const body = isEmail ? { email: emailOrUser, password } : { username: emailOrUser, password };
  const res = await fetch(`${API}/login`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if(res.ok){ setToken(data.token); await restoreFromServer(); await syncToServer(); return { ok:true, user:data.user }; }
  return { ok:false, error:data.error };
}

async function forgotPassword(email){
  const res = await fetch(`${API}/forgot`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ email })
  });
  return await res.json();
}

async function resetPassword(email,code,newPassword){
  const res = await fetch(`${API}/reset`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ email,code,newPassword })
  });
  return await res.json();
}

async function syncToServer(){
  const token = getToken(); if(!token) return;
  const banks = JSON.parse(localStorage.getItem('gw_banks_'+currentUserId())||'[]');
  const txs = JSON.parse(localStorage.getItem('gw_tx_'+currentUserId())||'[]');
  try{
    await fetch(`${API}/sync`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({ banks, transactions: txs })
    });
  }catch(e){ console.warn('Sync error', e); }
}

async function restoreFromServer(){
  const token = getToken(); if(!token) return;
  try{
    const res = await fetch(`${API}/restore`, { headers:{'Authorization':'Bearer '+token} });
    if(!res.ok) return;
    const data = await res.json();
    if(data.banks && data.banks.length) localStorage.setItem('gw_banks_'+currentUserId(), JSON.stringify(data.banks));
    if(data.transactions && data.transactions.length) localStorage.setItem('gw_tx_'+currentUserId(), JSON.stringify(data.transactions));
  }catch(e){ console.warn('Restore error', e); }
}
