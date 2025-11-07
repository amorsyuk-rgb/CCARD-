// GraceWise v5.9 – Render-Ready Server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";
import { fileURLToPath } from "url";

// === Path setup ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Initialize Express ===
const app = express();
const PORT = process.env.PORT || 10000;

// === Middleware ===
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// === LowDB setup ===
const dbFile = path.join(__dirname, "users.json");
const adapter = new JSONFile(dbFile);
const db = new Low(adapter, { users: [] });

await db.read();
db.data ||= { users: [] };

// === Routes ===

// Health check
app.get("/api", (req, res) => {
  res.json({ status: "GraceWise API is running", version: "v5.9" });
});

// Get all users (for testing)
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

// Login route
app.post("/api/login", async (req, res) => {
  const { identifier, password } = req.body; // identifier = email OR username
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

// === Fallback to index.html for single-page routing ===
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === Start server ===
app.listen(PORT, () => {
  console.log(`GraceWise v5.9 backend running on port ${PORT}`);
});
