import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Low, JSONFile } from 'lowdb';
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

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_secure';
function createToken(payload){ return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }); }
function verifyToken(token){ try{ return jwt.verify(token, JWT_SECRET); }catch(e){ return null; } }

function findUserByEmail(email){ return db.data.users.find(u => u.email && u.email.toLowerCase()===email.toLowerCase()); }
function findUserByUsername(username){ return db.data.users.find(u => u.username && u.username.toLowerCase()===username.toLowerCase()); }

app.get('/', (req,res)=> res.redirect('/login'));

// Register
app.post('/api/register', async (req,res)=>{
  const { username, email, password } = req.body;
  if(!username || !email || !password) return res.status(400).json({ error:'Missing fields' });
  await db.read();
  if(findUserByEmail(email)) return res.status(409).json({ error:'Email already registered' });
  if(findUserByUsername(username)) return res.status(409).json({ error:'Username taken' });
  const hash = await bcrypt.hash(password, 10);
  const user = { id: nanoid(), username, email, passwordHash: hash, verified: true, resetCode: null };
  db.data.users.push(user);
  await db.write();
  const token = createToken({ sub: user.id, email: user.email });
  res.json({ token, user: { id:user.id, username:user.username, email:user.email } });
});

// Login (email or username)
app.post('/api/login', async (req,res)=>{
  const { email, username, password } = req.body;
  await db.read();
  let user = null;
  if(email) user = findUserByEmail(email);
  if(!user && username) user = findUserByUsername(username);
  if(!user) return res.status(401).json({ error:'User not found' });
  const ok = await bcrypt.compare(password||'', user.passwordHash);
  if(!ok) return res.status(401).json({ error:'Invalid credentials' });
  const token = createToken({ sub: user.id, email: user.email });
  res.json({ token, user: { id:user.id, username:user.username, email:user.email } });
});

// Forgot/reset and sync endpoints omitted for brevity in this patch (assumes they exist in your server)

app.get('*', (req,res)=> res.redirect('/login'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log(`GraceWise v5.8.3.2 patch server running on port ${PORT}`));
