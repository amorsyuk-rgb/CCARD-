// core.js - shared storage, theme, nav helpers, calculations
const BANKS_KEY='gw_banks_v55', TX_KEY='gw_tx_v55', THEME_KEY='gw_theme_v55', LAST_TAB='gw_last_v55';
function uid(){return Math.random().toString(36).slice(2,9)}
function load(k){try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
function setVal(k,v){localStorage.setItem(k,v)}
function getVal(k){return localStorage.getItem(k)}
function fmt(d){return d?new Date(d).toLocaleDateString():'-'}
function parseDate(v){return v?new Date(v+'T00:00:00'):null}
function daysDiff(a,b){return Math.round((b-a)/(1000*60*60*24))}
function toEGP(n){return 'EGP '+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
// interest calculators
function simpleInterest(amount,daily,days){return amount*(daily/100)*days}
function compoundInterest(amount,daily,days){const r=(daily/100);return amount*(Math.pow(1+r,days)-1)}
// theme
let theme=getVal(THEME_KEY)||'cib';
function applyTheme(){ if(theme==='dark'){ document.documentElement.classList.add('dark'); document.body.classList.add('dark'); } else { document.documentElement.classList.remove('dark'); document.body.classList.remove('dark'); } setVal(THEME_KEY,theme); }
// nav highlight
function setActiveNav(path){ const items=document.querySelectorAll('.bottom-nav .nav-item'); items.forEach(i=>{ i.classList.toggle('active', i.dataset.path===path); }); }
// export/import
function exportData(){ const data={banks:load(BANKS_KEY),tx:load(TX_KEY),theme:theme}; const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='gracewise_export_v55.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href); }
function importData(file,cb){ const reader=new FileReader(); reader.onload=function(){ try{ const data=JSON.parse(reader.result); if(data.banks) localStorage.setItem(BANKS_KEY,JSON.stringify(data.banks)); if(data.tx) localStorage.setItem(TX_KEY,JSON.stringify(data.tx)); if(data.theme) { theme=data.theme; applyTheme(); } if(cb) cb(); }catch(e){ alert('Invalid JSON'); } }; reader.readAsText(file); }
// calculate due according to repeating cycle
function calculateDueForCycle(bank,purchaseDate){
  try{
    const endDay=new Date(bank.end).getDate();
    const dueDay=new Date(bank.due).getDate();
    const purchase=new Date(purchaseDate.getFullYear(),purchaseDate.getMonth(),purchaseDate.getDate());
    let cycleEndMonth=purchase.getMonth(), cycleEndYear=purchase.getFullYear();
    if(purchase.getDate()>endDay){ cycleEndMonth++; if(cycleEndMonth>11){ cycleEndMonth=0; cycleEndYear++; } }
    const cycleEnd=new Date(cycleEndYear,cycleEndMonth,endDay);
    let dueMonth=cycleEnd.getMonth()+1, dueYear=cycleEnd.getFullYear();
    if(dueMonth>11){ dueMonth=0; dueYear++; }
    const daysInMonth=new Date(dueYear,dueMonth+1,0).getDate();
    const dueDayAdjusted=Math.min(dueDay,daysInMonth);
    const due=new Date(dueYear,dueMonth,dueDayAdjusted);
    return {cycleEnd,due};
  }catch(e){console.error(e); return {cycleEnd:new Date(), due:new Date()};}
}
