// GraceWise v5.8.3.3 — Mobile JSON Fix (Safe for Safari & iPhone)
// Keeps all Smart Sync, Validation, Rate Sync, and Theme logic intact.
// Only modifies fetch() calls to ensure JSON headers and safe parsing.

const TOKEN_KEY = 'gw_token_v56';
const API = location.origin.replace(/\/$/, '') + '/api';

function setToken(t){ localStorage.setItem(TOKEN_KEY, t); }
function getToken(){ return localStorage.getItem(TOKEN_KEY); }
function clearToken(){ localStorage.removeItem(TOKEN_KEY); }

async function safeJson(res){
  try {
    const text = await res.text();
    return JSON.parse(text);
  } catch (e) {
    alert('⚠️ Server returned an unexpected response. Please retry.');
    return { ok:false, error:'Invalid JSON response' };
  }
}

// --- Auth functions ---
async function registerUser(username,email,password){
  try{
    const res = await fetch(`${API}/register`,{
      method:'POST',
      headers:{
        'Accept':'application/json',
        'Content-Type':'application/json'
      },
      body: JSON.stringify({ username,email,password })
    });
    const data = await safeJson(res);
    if(res.ok && data.token){ setToken(data.token); await restoreFromServer(); await syncToServer(); return { ok:true, user:data.user }; }
    else return { ok:false, error:data.error||'Registration failed' };
  }catch(e){ alert('Register failed: '+e.message); return { ok:false, error:e.message }; }
}

async function loginCreds(emailOrUser, password){
  try{
    const isEmail = emailOrUser.includes('@');
    const body = isEmail ? { email: emailOrUser, password } : { username: emailOrUser, password };
    const res = await fetch(`${API}/login`,{
      method:'POST',
      headers:{
        'Accept':'application/json',
        'Content-Type':'application/json'
      },
      body: JSON.stringify(body)
    });
    const data = await safeJson(res);
    if(res.ok && data.token){ setToken(data.token); await restoreFromServer(); await syncToServer(); return { ok:true, user:data.user }; }
    else return { ok:false, error:data.error||'Login failed' };
  }catch(e){ alert('Login failed: '+e.message); return { ok:false, error:e.message }; }
}

async function forgotPassword(email){
  try{
    const res = await fetch(`${API}/forgot`,{
      method:'POST',
      headers:{
        'Accept':'application/json',
        'Content-Type':'application/json'
      },
      body: JSON.stringify({ email })
    });
    return await safeJson(res);
  }catch(e){ return { ok:false, error:e.message }; }
}

async function resetPassword(email,code,newPassword){
  try{
    const res = await fetch(`${API}/reset`,{
      method:'POST',
      headers:{
        'Accept':'application/json',
        'Content-Type':'application/json'
      },
      body: JSON.stringify({ email,code,newPassword })
    });
    return await safeJson(res);
  }catch(e){ return { ok:false, error:e.message }; }
}

// --- Sync helpers (unchanged) ---
async function syncToServer(){
  const token = getToken(); if(!token) return;
  const banks = JSON.parse(localStorage.getItem('gw_banks_'+currentUserId())||'[]');
  const txs = JSON.parse(localStorage.getItem('gw_tx_'+currentUserId())||'[]');
  try{
    await fetch(`${API}/sync`,{
      method:'POST',
      headers:{
        'Accept':'application/json',
        'Content-Type':'application/json',
        'Authorization':'Bearer '+token
      },
      body: JSON.stringify({ banks, transactions: txs })
    });
  }catch(e){ console.warn('Sync error', e); }
}

async function restoreFromServer(){
  const token = getToken(); if(!token) return;
  try{
    const res = await fetch(`${API}/restore`, { headers:{'Authorization':'Bearer '+token} });
    if(!res.ok) return;
    const data = await safeJson(res);
    if(data.banks && data.banks.length) localStorage.setItem('gw_banks_'+currentUserId(), JSON.stringify(data.banks));
    if(data.transactions && data.transactions.length) localStorage.setItem('gw_tx_'+currentUserId(), JSON.stringify(data.transactions));
  }catch(e){ console.warn('Restore error', e); }
}

// (Other helper functions unchanged from v5.8.3.2 remain in your current core.js)
// Merge this file to replace only the functions above.
