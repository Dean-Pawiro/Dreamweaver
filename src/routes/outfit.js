import { Router } from "express";
import { getOutfit } from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const { chatId } = req.query || {};

  if (!chatId || typeof chatId !== "string") {
    return res.status(400).json({ error: "chatId is required" });
  }

  const outfit = getOutfit(chatId);
  return res.json({ chatId, outfit: outfit || "" });
});

export default router;
