// GraceWise v5.9 — Render-Safe Universal LowDB Server

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { Low } from "lowdb";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// === Safe universal JSON adapter (works even if lowdb/node not exported) ===
let JSONFileAdapter;
try {
  // Try official subpath (works locally and with correct export)
  const lowdbNode = await import("lowdb/node");
  JSONFileAdapter = lowdbNode.JSONFile;
} catch {
  // Fallback for Render or limited environments
  console.warn("⚠️ lowdb/node not available — using custom JSON adapter.");
  JSONFileAdapter = class {
    constructor(filename) { this.filename = filename; }
    async read() {
      try {
        const data = await fs.promises.readFile(this.filename, "utf-8");
        return JSON.parse(data || "{}");
      } catch {
        return null;
      }
    }
    async write(obj) {
      await fs.promises.writeFile(this.filename, JSON.stringify(obj, null, 2));
    }
  };
}

// === Resolve absolute paths ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Initialize Express ===
const app = express();
const PORT = process.env.PORT || 10000;

// === Middleware ===
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// === LowDB Setup (users.json in root) ===
const dbFile = path.join(__dirname, "users.json");
const adapter = new JSONFileAdapter(dbFile);
const db = new Low(adapter, { users: [] });
await db.read();
db.data ||= { users: [] };

// === API ROUTES ===

// Health check
app.get("/api", (req, res) => {
  res.json({ status: "GraceWise API is running", version: "v5.9" });
});

// Get all users
app.get("/api/users", async (req, res) => {
  await db.read();
  res.json(db.data.users || []);
});

// Register new user
app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: "Missing required fields" });

  await db.read();
  const exists = db.data.users.find(
    (u) => u.email === email || u.username === username
  );
  if (exists) return res.status(409).json({ error: "User already exists" });

  const id = Date.now().toString();
  db.data.users.push({ id, username, email, password });
  await db.write();
  res.json({ success: true, id });
});

// Login existing user
app.post("/api/login", async (req, res) => {
  const { identifier, password } = req.body; // identifier = username OR email
  if (!identifier || !password)
    return res.status(400).json({ error: "Missing login credentials" });

  await db.read();
  const user = db.data.users.find(
    (u) =>
      (u.email === identifier || u.username === identifier) &&
      u.password === password
  );

  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
    },
  });
});

// === SPA Fallback ===
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(`✅ GraceWise v5.9 backend running on port ${PORT}`);
});
