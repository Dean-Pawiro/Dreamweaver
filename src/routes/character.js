import { Router } from "express";
import { getCharacter, getOrCreateChat, upsertCharacter } from "../db.js";

const router = Router();

const maxCharacters = Number(process.env.CHARACTER_MAX_CHARS || 5000);

router.get("/", (req, res) => {
  const { chatId } = req.query || {};

  if (!chatId || typeof chatId !== "string") {
    return res.status(400).json({ error: "chatId is required" });
  }

  const persona = getCharacter(chatId);
  return res.json({ chatId, persona });
});

router.post("/", (req, res) => {
  const { chatId, persona } = req.body || {};

  if (!persona || typeof persona !== "string") {
    return res.status(400).json({ error: "persona is required" });
  }

  if (persona.length > maxCharacters) {
    return res.status(400).json({ error: `persona exceeds ${maxCharacters} characters` });
  }

  const resolvedChatId = getOrCreateChat(chatId);
  upsertCharacter(resolvedChatId, persona.trim());

  return res.json({ chatId: resolvedChatId, persona: persona.trim() });
});

export default router;
