
import { Router } from "express";
import { requireAuth } from "./auth.js";
import { getDb } from "../db.js";
import crypto from "crypto";

const router = Router();
const maxCharacters = Number(process.env.CHARACTER_MAX_CHARS || 5000);

// Helper: get character by ID
function getCharacter(characterId) {
  const database = getDb();
  const row = database.prepare("SELECT persona FROM characters WHERE character_id = ?").get(characterId);
  return row ? row.persona : null;
}

// Helper: insert or update character
function upsertCharacter(characterId, persona, user_id) {
  const database = getDb();
  const existing = database.prepare("SELECT character_id FROM characters WHERE character_id = ?").get(characterId);
  if (existing) {
    database.prepare("UPDATE characters SET persona = ?, updated_at = datetime('now') WHERE character_id = ?").run(persona, characterId);
  } else {
    database.prepare("INSERT INTO characters (character_id, persona, user_id, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))").run(characterId, persona, user_id);
  }
}

// List personas (protected)
router.get("/", requireAuth, (req, res) => {
  const { characterId, chatId } = req.query || {};
  // If chatId is provided, look up characterId for that chat
  if (chatId && typeof chatId === "string") {
    try {
      const database = getDb();
      const row = database.prepare("SELECT character_id FROM chats WHERE id = ?").get(chatId);
      if (row && row.character_id) {
        const persona = getCharacter(row.character_id);
        return res.json({ characterId: row.character_id, persona });
      } else {
        return res.json({ characterId: null, persona: null });
      }
    } catch (error) {
      return res.status(500).json({ error: error.message || "Failed to get persona for chat" });
    }
  }
  if (characterId && typeof characterId === "string") {
    const persona = getCharacter(characterId);
    return res.json({ characterId, persona });
  }
  // If no characterId, list all personas for the current user
  const user_id = req.user.user_id;
  try {
    const database = getDb();
    // Allow master user to see all personas
    const masterUser = database.prepare("SELECT user_id FROM users WHERE username = ?").get("master");
    let rows;
    if (masterUser && user_id === masterUser.user_id) {
      rows = database.prepare("SELECT character_id as id, persona, updated_at FROM characters ORDER BY updated_at DESC LIMIT 30").all();
    } else {
      rows = database.prepare("SELECT character_id as id, persona, updated_at FROM characters WHERE user_id = ? ORDER BY updated_at DESC LIMIT 30").all(user_id);
    }
    return res.json({ personas: rows });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to list personas" });
  }
});

// Delete a character persona by character_id (protected)
router.delete("/", requireAuth, (req, res) => {
  const { characterId } = req.query || req.body || {};
  if (!characterId || typeof characterId !== "string") {
    return res.status(400).json({ error: "characterId is required" });
  }
  try {
    const database = getDb();
    database.prepare("DELETE FROM characters WHERE character_id = ?").run(characterId);
    // Optionally also delete the chat itself if you want full cleanup:
    // database.prepare("DELETE FROM chats WHERE character_id = ?").run(characterId);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to delete character" });
  }
});

// Create/update persona (protected)
router.post("/", requireAuth, (req, res) => {
  let { chatId, persona, characterId, actionType } = req.body || {};
  const user_id = req.user.user_id;
  if (!persona || typeof persona !== "string") {
    return res.status(400).json({ error: "persona is required" });
  }
  if (persona.length > maxCharacters) {
    return res.status(400).json({ error: `persona exceeds ${maxCharacters} characters` });
  }
  // Use provided characterId or generate new
  const resolvedCharacterId = characterId || crypto.randomUUID();
  upsertCharacter(resolvedCharacterId, persona.trim(), user_id);
  const database = getDb();
  if (chatId) {
    database.prepare("UPDATE chats SET character_id = ?, user_id = ? WHERE id = ?").run(resolvedCharacterId, user_id, chatId);
    return res.json({ chatId, characterId: resolvedCharacterId, persona: persona.trim() });
  } else if (actionType === "use" && characterId) {
    // 'Use' action: create new chat linked to existing character
    const newChatId = crypto.randomUUID();
    database.prepare("INSERT INTO chats (id, character_id, user_id) VALUES (?, ?, ?)").run(newChatId, resolvedCharacterId, user_id);
    return res.json({ chatId: newChatId, characterId: resolvedCharacterId, persona: persona.trim() });
  } else if (characterId) {
    // Edit: only update character, no chat
    return res.json({ characterId: resolvedCharacterId, persona: persona.trim() });
  } else {
    // If no characterId, treat as new persona and create new chat
    const newChatId = crypto.randomUUID();
    database.prepare("INSERT INTO chats (id, character_id, user_id) VALUES (?, ?, ?)").run(newChatId, resolvedCharacterId, user_id);
    return res.json({ chatId: newChatId, characterId: resolvedCharacterId, persona: persona.trim() });
  }
});

export default router;
