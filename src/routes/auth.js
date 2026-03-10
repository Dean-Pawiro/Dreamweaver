
import { Router } from "express";
const router = Router();
import { getDb } from "../db.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";


const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

// Helper: sign a JWT
function signJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

// Middleware: verify JWT and attach user to req.user
export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = auth.replace("Bearer ", "");
  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// List all users (master only)
router.get("/users", requireAuth, (req, res) => {
  const db = getDb();
  const master = db.prepare("SELECT user_id FROM users WHERE username = ?").get("master");
  if (!master || req.user.user_id !== master.user_id) return res.status(403).json({ error: "Forbidden" });
  const users = db.prepare("SELECT user_id, username FROM users ORDER BY username").all();
  res.json({ users });
});

// Delete a user (master only)
router.delete("/users/:user_id", requireAuth, (req, res) => {
  const db = getDb();
  const master = db.prepare("SELECT user_id FROM users WHERE username = ?").get("master");
  if (!master || req.user.user_id !== master.user_id) return res.status(403).json({ error: "Forbidden" });
  const { user_id } = req.params;
  if (!user_id) return res.status(400).json({ error: "Missing user_id" });
  if (user_id === master.user_id) return res.status(400).json({ error: "Cannot delete master user" });
  db.prepare("DELETE FROM users WHERE user_id = ?").run(user_id);
  res.json({ success: true });
});


// Delete all chats for a user (master only)
router.delete("/users/:user_id/chats", requireAuth, (req, res) => {
  const db = getDb();
  const master = db.prepare("SELECT user_id FROM users WHERE username = ?").get("master");
  if (!master || req.user.user_id !== master.user_id) return res.status(403).json({ error: "Forbidden" });
  const { user_id } = req.params;
  if (!user_id) return res.status(400).json({ error: "Missing user_id" });

  db.prepare("DELETE FROM chats WHERE user_id = ?").run(user_id);
  res.json({ success: true });
});


// Signup endpoint
router.post("/signup", (req, res) => {
  const db = getDb();
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  // Check if username exists
  const existing = db.prepare("SELECT user_id FROM users WHERE username = ?").get(username);
  if (existing) {
    return res.status(409).json({ error: "Username already exists" });
  }
  // Hash password
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  const result = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(username, hash);
  const user_id = result.lastInsertRowid;
  const token = signJwt({ user_id, username });
  return res.json({ token, user_id, username });
});


// (removed duplicate declaration)

router.post("/login", (req, res) => {
  const db = getDb();
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  const user = db.prepare("SELECT user_id, username, password FROM users WHERE username = ?").get(username);
  // Hash input password for comparison
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  if (!user || user.password !== hash) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = signJwt({ user_id: user.user_id, username: user.username });
  return res.json({ token, user_id: user.user_id, username: user.username });
});

// Logout is a no-op with JWT (handled client-side)
// Refresh token endpoint - re-issues a new token
router.post("/refresh", requireAuth, (req, res) => {
  const newToken = signJwt({ user_id: req.user.user_id, username: req.user.username });
  return res.json({ token: newToken, user_id: req.user.user_id, username: req.user.username });
});

router.post("/logout", (req, res) => {
  return res.json({ success: true });
});

router.post("/account/password", requireAuth, (req, res) => {
  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ error: "Password required" });
  }
  // Hash password for safety
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  const db = getDb();
  db.prepare("UPDATE users SET password = ? WHERE user_id = ?").run(hash, req.user.user_id);
  return res.json({ success: true });
});

export default router;
