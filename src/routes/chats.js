import { Router } from "express";
import { listChats } from "../db.js";

const router = Router();

// GET /api/chats - list all chats with id, created_at, and persona
// Require auth, filter by user_id
import { requireAuth } from "./auth.js";
router.get("/", requireAuth, (req, res) => {
  const user_id = req.user.user_id;
  const chats = listChats(user_id);
  res.json({ chats });
});

export default router;
