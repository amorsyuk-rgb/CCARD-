import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbFile = path.join(__dirname, 'data', 'db.json');
const adapter = new JSONFile(dbFile);
const db = new Low(adapter);

async function initDB(){ await db.read(); db.data ||= { users: [], backups: [] }; await db.write(); }
await initDB();

const JWT_SECRET = process.env.JWT_SECRET || 'change_me';
function createToken(payload){ return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }); }
function verifyToken(token){ try{ return jwt.verify(token, JWT_SECRET); }catch(e){ return null; } }

app.get('/', (req,res)=> res.redirect('/cards'));

app.post('/api/register', async (req,res)=>{
  const { username, userId, password } = req.body;
  if(!username||!userId) return res.status(400).json({ error:'Missing fields' });
  await db.read();
  if(db.data.users.find(u=>u.username===username||u.userId===userId)) return res.status(409).json({ error:'User exists' });
  const hash = password ? await bcrypt.hash(password,10) : null;
  const user = { id: nanoid(), username, userId, passwordHash: hash, faceDescriptors: [] };
  db.data.users.push(user); await db.write();
  const token = createToken({ sub:user.id });
  res.json({ token, user:{ id:user.id, username:user.username, userId:user.userId } });
});

app.post('/api/login', async (req,res)=>{
  const { username, userId, password } = req.body;
  await db.read();
  const user = db.data.users.find(u => (u.username===username && u.userId===userId) || (u.userId===userId && !username));
  if(!user) return res.status(401).json({ error:'Invalid credentials' });
  if(user.passwordHash){
    const ok = await bcrypt.compare(password||'', user.passwordHash);
    if(!ok) return res.status(401).json({ error:'Invalid credentials' });
  }
  const token = createToken({ sub:user.id });
  res.json({ token, user:{ id:user.id, username:user.username, userId:user.userId } });
});

app.post('/api/enroll-face', async (req,res)=>{
  const auth = req.headers.authorization?.split(' ')[1];
  const payload = verifyToken(auth);
  if(!payload) return res.status(401).json({ error:'Not authorized' });
  const { descriptor } = req.body;
  if(!descriptor) return res.status(400).json({ error:'Missing descriptor' });
  await db.read();
  const user = db.data.users.find(u=>u.id===payload.sub);
  if(!user) return res.status(404).json({ error:'User not found' });
  user.faceDescriptors ||= []; user.faceDescriptors.push(descriptor);
  await db.write();
  res.json({ ok:true });
});

app.post('/api/login-face', async (req,res)=>{
  const { descriptor } = req.body;
  if(!descriptor) return res.status(400).json({ error:'Missing descriptor' });
  await db.read();
  let best={user:null,distance:Infinity};
  for(const user of db.data.users){
    if(!user.faceDescriptors) continue;
    for(const d of user.faceDescriptors){
      let sum=0;
      for(let i=0;i<d.length;i++){ const diff=(d[i]||0)-(descriptor[i]||0); sum+=diff*diff; }
      const dist=Math.sqrt(sum);
      if(dist<best.distance){ best={user, distance:dist}; }
    }
  }
  const MATCH_THRESHOLD=0.6;
  if(best.user && best.distance<=MATCH_THRESHOLD){ const token=createToken({ sub:best.user.id }); res.json({ token, user:{ id:best.user.id, username:best.user.username, userId:best.user.userId }, distance: best.distance }); }
  else return res.status(401).json({ error:'No face match' });
});

app.post('/api/sync', async (req,res)=>{
  const auth = req.headers.authorization?.split(' ')[1];
  const payload = verifyToken(auth);
  if(!payload) return res.status(401).json({ error:'Not authorized' });
  const { banks, transactions } = req.body;
  await db.read();
  const timestamp = new Date().toISOString();
  db.data.backups ||= [];
  db.data.backups.push({ id: nanoid(), ownerId: payload.sub, timestamp, banks: banks||[], transactions: transactions||[] });
  // trim to last 5 backups per user
  const ours = db.data.backups.filter(b=>b.ownerId===payload.sub).sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
  const keep = ours.slice(0,5);
  db.data.backups = db.data.backups.filter(b=>b.ownerId!==payload.sub).concat(keep);
  await db.write();
  res.json({ ok:true, timestamp });
});

app.get('/api/restore', async (req,res)=>{
  const auth = req.headers.authorization?.split(' ')[1];
  const payload = verifyToken(auth);
  if(!payload) return res.status(401).json({ error:'Not authorized' });
  await db.read();
  const backups = (db.data.backups||[]).filter(b=>b.ownerId===payload.sub).sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).reverse();
  if(!backups.length) return res.json({ banks:[], transactions:[] });
  const latest = backups[0];
  res.json({ banks: latest.banks||[], transactions: latest.transactions||[], timestamp: latest.timestamp });
});

app.get('/api/users', async (req,res)=>{ await db.read(); res.json(db.data.users.map(u=>({ id:u.id, username:u.username, userId:u.userId }))); });

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log(`GraceWise v5.7 Hybrid running on port ${PORT}`));
