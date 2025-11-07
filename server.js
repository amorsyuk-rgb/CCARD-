// GraceWise v5.9 – Render-Safe Universal LowDB Server with Login + Reset Support
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { Low } from "lowdb";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Safe universal adapter for Render
let JSONFileAdapter;
try {
  const lowdbNode = await import("lowdb/node");
  JSONFileAdapter = lowdbNode.JSONFile;
} catch {
  console.warn("⚠️ lowdb/node not available — using custom JSON adapter.");
  JSONFileAdapter = class {
    constructor(filename) { this.filename = filename; }
    async read() {
      try {
        const data = await fs.promises.readFile(this.filename, "utf-8");
        return JSON.parse(data || "{}");
      } catch { return null; }
    }
    async write(obj) {
      await fs.promises.writeFile(this.filename, JSON.stringify(obj, null, 2));
    }
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const dbFile = path.join(__dirname, "users.json");
const adapter = new JSONFileAdapter(dbFile);
const db = new Low(adapter, { users: [] });
await db.read();
db.data ||= { users: [] };

// === Routes ===
app.get("/api", (req, res) => res.json({ status: "GraceWise API running", version: "v5.9" }));

app.get("/api/users", async (req, res) => { await db.read(); res.json(db.data.users || []); });

app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: "Missing fields" });
  await db.read();
  const exists = db.data.users.find(u => u.email === email || u.username === username);
  if (exists) return res.status(409).json({ error: "User exists" });
  const id = Date.now().toString();
  db.data.users.push({ id, username, email, password });
  await db.write();
  res.json({ success: true, id });
});

app.post("/api/login", async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: "Missing credentials" });
  await db.read();
  const user = db.data.users.find(u =>
    (u.email === identifier || u.username === identifier) && u.password === password);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ success: true, user: { id: user.id, username: user.username, email: user.email } });
});

// --- Forgot / Reset Password ---
const resetCodes = new Map();

app.post("/api/forgot", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Missing email" });
  await db.read();
  const user = db.data.users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: "User not found" });
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  resetCodes.set(email, code);
  console.log(`Reset code for ${email}: ${code}`);
  res.json({ ok: true, code });
});

app.post("/api/reset", async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) return res.status(400).json({ error: "Missing fields" });
  const valid = resetCodes.get(email);
  if (!valid || valid !== code) return res.status(400).json({ error: "Invalid or expired code" });
  await db.read();
  const user = db.data.users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.password = newPassword;
  await db.write();
  resetCodes.delete(email);
  res.json({ ok: true });
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));

app.listen(PORT, () => console.log(`✅ GraceWise v5.9 backend running on port ${PORT}`));
