import { Router } from "express";
import { getOutfit } from "../db.js";
import { requireAuth } from "./auth.js";

const router = Router();

// Require JWT authentication for outfit access
router.get("/", requireAuth, (req, res) => {
  const { chatId } = req.query || {};

  if (!chatId || typeof chatId !== "string") {
    return res.status(400).json({ error: "chatId is required" });
  }

  // Optionally, you could check if the chatId belongs to the user (if implemented in db)
  const outfit = getOutfit(chatId);
  return res.json({ chatId, outfit: outfit || "" });
});

export default router;
