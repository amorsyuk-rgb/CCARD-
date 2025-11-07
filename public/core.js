// GraceWise core.js — v5.9 inclusive-cycle + login + reset integration
// Unified logic for calculations, user auth, and recovery.

(function(){
  // --- Date handling ---
  function parseDateSafe(v){
    if(v === undefined || v === null) return null;
    if(v instanceof Date && !isNaN(v)) return v;
    const s = String(v).trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)){
      const d = new Date(s + 'T00:00:00');
      if(!isNaN(d)) return d;
    }
    if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)){
      const [dd,mm,yy] = s.split('/');
      const d = new Date(parseInt(yy,10), parseInt(mm,10)-1, parseInt(dd,10));
      if(!isNaN(d)) return d;
    }
    const f = new Date(s);
    if(!isNaN(f)) return f;
    return null;
  }

  function extractDayOfMonth(value){
    if(value === undefined || value === null) return null;
    const vstr = String(value).trim();
    if(/^[0-9]{1,2}$/.test(vstr)){
      const n = parseInt(vstr,10);
      if(n>=1 && n<=31) return n;
    }
    const d = parseDateSafe(vstr);
    if(d) return d.getDate();
    const digits = vstr.replace(/[^0-9]/g,'');
    if(digits.length){
      const n = parseInt(digits.slice(-2),10);
      if(!isNaN(n) && n>=1 && n<=31) return n;
    }
    return null;
  }

  // --- Inclusive-cycle due date ---
  function computeDueDateFromPurchase(purchaseDate, cycleEndDay, dueDay){
    const purchase = parseDateSafe(purchaseDate) || new Date();
    const pDay = purchase.getDate();
    let cycleMonth = purchase.getMonth();
    let cycleYear = purchase.getFullYear();
    if(pDay > cycleEndDay){
      cycleMonth += 1;
      if(cycleMonth > 11){ cycleMonth = 0; cycleYear += 1; }
    }
    let dueMonth = cycleMonth + 1;
    let dueYear = cycleYear;
    if(dueMonth > 11){ dueMonth = 0; dueYear += 1; }
    const lastDay = new Date(dueYear, dueMonth + 1, 0).getDate();
    const safeDueDay = Math.min(dueDay, lastDay);
    return new Date(dueYear, dueMonth, safeDueDay);
  }

  function computeTransactionAnalysis(tx, card, today){
    today = today || new Date();
    const cycleEndDay = extractDayOfMonth(card.end ?? card.cycleEnd ?? 21) || 21;
    const dueDay = extractDayOfMonth(card.due ?? card.dueDay ?? 15) || 15;
    const annual = parseFloat(card.rate || 0) || 0;
    const daily = parseFloat(card.daily || (annual/365) || 0) || 0;
    const fine = parseFloat(card.fine || 0) || 0;
    const amount = parseFloat(tx.amount || 0) || 0;

    const purchase = parseDateSafe(tx.date || tx.purchaseDate || tx.purchase) || new Date();
    const dueDate = computeDueDateFromPurchase(purchase, cycleEndDay, dueDay);
    const msPerDay = 1000*60*60*24;
    const graceDays = Math.round((dueDate - purchase) / msPerDay);
    const daysLeft = Math.round((dueDate - today) / msPerDay);

    let interest = 0, totalDue = amount, status = '', color = '';
    if(daysLeft > 0){
      status = `🟢 In grace (${daysLeft} days left)`;
      color = '#059669';
    } else if(daysLeft === 0){
      status = '🟡 Due today';
      color = '#f59e0b';
    } else {
      const overdue = Math.abs(daysLeft);
      interest = amount * (daily/100) * overdue;
      totalDue = amount + interest + fine;
      status = `🔴 Overdue by ${overdue} days`;
      color = '#dc2626';
    }
    const progress = graceDays > 0 ? Math.min(Math.round(((graceDays - daysLeft) / graceDays) * 100), 100) : 100;
    return { purchase, dueDate, graceDays, daysLeft, interest, totalDue, status, color, progress };
  }

  function recalculateAllTransactions(today){
    today = today || new Date();
    var txs;
    try{ txs = (typeof TX_KEY === 'function') ? JSON.parse(localStorage.getItem(TX_KEY())||'[]') : JSON.parse(localStorage.getItem('gw_tx_guest')||'[]'); }catch(e){ txs = []; }
    var banks;
    try{ banks = (typeof BANKS_KEY === 'function') ? JSON.parse(localStorage.getItem(BANKS_KEY())||'[]') : JSON.parse(localStorage.getItem('gw_banks_guest')||'[]'); }catch(e){ banks = []; }
    const map = {};
    banks.forEach(b=> map[b.id] = b);
    return (txs || []).map(tx => { const card = map[tx.bankId] || map[tx.cardId] || { end:21, due:15, rate:0, daily:0, fine:0, name:'Unknown' }; return { tx, analysis: computeTransactionAnalysis(tx, card, today) }; });
  }

  // --- Authentication + Account Management ---
  async function loginCreds(identifier, password) {
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("gw_user", JSON.stringify(data.user));
        return { ok: true, user: data.user };
      } else {
        return { ok: false, error: data.error || "Invalid credentials" };
      }
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function registerUser(username, email, password) {
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("gw_user", JSON.stringify({ username, email, id: data.id }));
        return { ok: true };
      } else {
        return { ok: false, error: data.error || "Registration failed" };
      }
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function forgotPassword(email) {
    try {
      const res = await fetch("/api/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      return await res.json();
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function resetPassword(email, code, newPassword) {
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword })
      });
      return await res.json();
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // --- Export globals ---
  window.parseDateSafe = parseDateSafe;
  window.extractDayOfMonth = extractDayOfMonth;
  window.computeDueDateFromPurchase = computeDueDateFromPurchase;
  window.computeTransactionAnalysis = computeTransactionAnalysis;
  window.recalculateAllTransactions = recalculateAllTransactions;
  window.loginCreds = loginCreds;
  window.registerUser = registerUser;
  window.forgotPassword = forgotPassword;
  window.resetPassword = resetPassword;

  console.log("GraceWise core v5.9 full logic loaded");
})();
