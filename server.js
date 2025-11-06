
/*
  server_full_restore_patch.js
  Restores full GraceWise backend API routes:
  - /api/register, /api/login, /api/forgot, /api/reset
  - /api/sync, /api/restore, /api/users
  - persistent lowdb at ./data/db.json
  - JWT auth, bcrypt password hashing
  - logs reset codes to console for testing
*/

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Low, JSONFile } from 'lowdb';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ensure data folder exists
const dataDir = path.join(__dirname, 'data');
if(!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbFile = path.join(__dirname, 'data', 'db.json');
const adapter = new JSONFile(dbFile);
const db = new Low(adapter);

async function initDB(){
  await db.read();
  db.data ||= { users: [], backups: [] };
  // ensure older backups array exists
  db.data.backups ||= [];
  await db.write();
}
await initDB();

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_render_env';
function createToken(payload){ return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }); }
function verifyToken(token){ try{ return jwt.verify(token, JWT_SECRET); }catch(e){ return null; } }

function findUserByEmail(email){
  return db.data.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
}
function findUserByUsername(username){
  return db.data.users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase());
}

// Basic routes for convenience
app.get('/', (req,res) => res.redirect('/login'));

// Register
app.post('/api/register', async (req,res) => {
  const { username, email, password } = req.body;
  if(!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  await db.read();
  if(findUserByEmail(email)) return res.status(409).json({ error: 'Email already registered' });
  if(findUserByUsername(username)) return res.status(409).json({ error: 'Username taken' });
  const hash = await bcrypt.hash(password, 10);
  const user = { id: nanoid(), username, email, passwordHash: hash, verified: true, resetCode: null };
  db.data.users.push(user);
  await db.write();
  const token = createToken({ sub: user.id, email: user.email });
  res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
});

// Login (by email or username)
app.post('/api/login', async (req,res) => {
  const { email, username, password } = req.body;
  if(!(email || username) || !password) return res.status(400).json({ error: 'Missing fields' });
  await db.read();
  let user = null;
  if(email) user = findUserByEmail(email);
  if(!user && username) user = findUserByUsername(username);
  if(!user) return res.status(401).json({ error: 'User not found' });
  const ok = await bcrypt.compare(password||'', user.passwordHash);
  if(!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = createToken({ sub: user.id, email: user.email });
  res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
});

// Forgot password (generates reset code, logs it to console)
app.post('/api/forgot', async (req,res) => {
  const { email } = req.body;
  if(!email) return res.status(400).json({ error: 'Missing email' });
  await db.read();
  const user = findUserByEmail(email);
  if(!user) return res.status(404).json({ error: 'No such email' });
  const code = Math.floor(100000 + Math.random()*900000).toString();
  user.resetCode = code;
  await db.write();
  console.log(`[GraceWise] Password reset code for ${email}: ${code}`);
  // For now return code in JSON for easy testing (remove in production)
  res.json({ ok: true, message: 'Reset code generated', code });
});

// Reset password
app.post('/api/reset', async (req,res) => {
  const { email, code, newPassword } = req.body;
  if(!email || !code || !newPassword) return res.status(400).json({ error: 'Missing fields' });
  await db.read();
  const user = db.data.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase() && u.resetCode === code);
  if(!user) return res.status(400).json({ error: 'Invalid code or email' });
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.resetCode = null;
  await db.write();
  res.json({ ok: true, message: 'Password reset successful' });
});

// Sync (save user banks & transactions on server side)
// expects Authorization: Bearer <token>
app.post('/api/sync', async (req,res) => {
  const auth = req.headers.authorization?.split(' ')[1];
  const payload = verifyToken(auth);
  if(!payload) return res.status(401).json({ error: 'Not authorized' });
  const { banks, transactions } = req.body;
  await db.read();
  const timestamp = new Date().toISOString();
  db.data.backups ||= [];
  db.data.backups.push({ id: nanoid(), ownerId: payload.sub, timestamp, banks: banks||[], transactions: transactions||[] });
  // keep only last 10 backups per user
  const ours = db.data.backups.filter(b => b.ownerId === payload.sub).sort((a,b) => b.timestamp.localeCompare(a.timestamp));
  const keep = ours.slice(0,10);
  db.data.backups = db.data.backups.filter(b => b.ownerId !== payload.sub).concat(keep);
  await db.write();
  res.json({ ok: true, timestamp });
});

// Restore latest backup for user
app.get('/api/restore', async (req,res) => {
  const auth = req.headers.authorization?.split(' ')[1];
  const payload = verifyToken(auth);
  if(!payload) return res.status(401).json({ error: 'Not authorized' });
  await db.read();
  const backups = (db.data.backups || []).filter(b => b.ownerId === payload.sub).sort((a,b) => b.timestamp.localeCompare(a.timestamp)).reverse();
  if(!backups.length) return res.json({ banks: [], transactions: [] });
  const latest = backups[0];
  res.json({ banks: latest.banks||[], transactions: latest.transactions||[], timestamp: latest.timestamp });
});

// List users (non-sensitive fields)
app.get('/api/users', async (req,res) => {
  await db.read();
  const users = (db.data.users || []).map(u => ({ id: u.id, username: u.username, email: u.email }));
  res.json(users);
});

// Health check
app.get('/api/health', (req,res) => res.json({ ok: true, time: new Date().toISOString() }));

// Serve pages (if present in /public)
const pages = ['login','cards','transactions','grace','settings','forgot'];
pages.forEach(page => {
  app.get(`/${page}`, (req,res) => {
    const p = path.join(__dirname, 'public', `${page}.html`);
    if(fs.existsSync(p)) return res.sendFile(p);
    return res.status(404).send('Page not found');
  });
});

// fallback to index.html for client-side routing if exists
app.get('*', (req,res) => {
  const index = path.join(__dirname, 'public', 'index.html');
  if(fs.existsSync(index)) return res.sendFile(index);
  res.status(404).send('Not Found');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`GraceWise v5.8.3 FULL server running on port ${PORT}`));
