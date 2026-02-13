import { Router } from "express";
import { listChats } from "../db.js";

const router = Router();

// GET /api/chats - list all chats with id, created_at, and persona
router.get("/", (req, res) => {
  const chats = listChats();
  res.json({ chats });
});

export default router;
