// List all chats with id, created_at, and persona (if any)
export function listChats() {
  const database = getDb();
  return database.prepare(`
    SELECT c.id, c.created_at, ch.persona
    FROM chats c
    LEFT JOIN characters ch ON c.id = ch.chat_id
    ORDER BY c.created_at DESC
  `).all();
}
import Database from "better-sqlite3";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = process.env.DB_PATH || path.join(__dirname, "..", "data", "chat.db");

let db;

function ensureDbDirectory(dbPath) {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });
}

function initDb() {
  console.log(`[db] Using SQLite path: ${defaultDbPath}`);
  ensureDbDirectory(defaultDbPath);
  db = new Database(defaultDbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS image_prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      image_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS memories (
      chat_id TEXT PRIMARY KEY,
      summary TEXT NOT NULL,
      summary_message_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS characters (
      chat_id TEXT PRIMARY KEY,
      persona TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS outfits (
      chat_id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );
  `);

  const imagePromptColumns = db.prepare("PRAGMA table_info(image_prompts)").all();
  const hasImageUrl = imagePromptColumns.some((column) => column.name === "image_url");
  if (!hasImageUrl) {
    db.exec("ALTER TABLE image_prompts ADD COLUMN image_url TEXT");
  }
}

export function getDb() {
  if (!db) {
    initDb();
  }
  return db;
}

export function createChat() {
  const id = crypto.randomUUID();
  const database = getDb();
  database.prepare("INSERT INTO chats (id) VALUES (?)").run(id);
  return id;
}

export function getOrCreateChat(chatId) {
  const database = getDb();
  if (chatId) {
    const row = database.prepare("SELECT id FROM chats WHERE id = ?").get(chatId);
    if (row) {
      return chatId;
    }
  }
  return createChat();
}

export function addMessage(chatId, role, content) {
  const database = getDb();
  database.prepare("INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)").run(chatId, role, content);
}

export function addImagePrompt(chatId, prompt, imageUrl = null) {
  const database = getDb();
  database
    .prepare("INSERT INTO image_prompts (chat_id, prompt, image_url) VALUES (?, ?, ?)")
    .run(chatId, prompt, imageUrl);
}

export function getRecentMessages(chatId, limit) {
  const database = getDb();
  const rows = database
    .prepare("SELECT role, content FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT ?")
    .all(chatId, limit);
  return rows.reverse();
}

export function getChatHistory(chatId, limit, offset) {
  const database = getDb();
  return database
    .prepare(
      "SELECT role, content, created_at, kind, image_url FROM (" +
        "SELECT role, content, created_at, 'message' AS kind, NULL AS image_url FROM messages WHERE chat_id = ? " +
        "UNION ALL " +
        "SELECT 'assistant' AS role, prompt AS content, created_at, 'image_prompt' AS kind, image_url FROM image_prompts WHERE chat_id = ?" +
      ") ORDER BY created_at ASC LIMIT ? OFFSET ?"
    )
    .all(chatId, chatId, limit, offset);
}

export function getMessageCount(chatId) {
  const database = getDb();
  const row = database.prepare("SELECT COUNT(*) AS count FROM messages WHERE chat_id = ?").get(chatId);
  return row?.count ?? 0;
}

export function getMessagesSlice(chatId, offset, limit) {
  const database = getDb();
  return database
    .prepare("SELECT role, content FROM messages WHERE chat_id = ? ORDER BY id ASC LIMIT ? OFFSET ?")
    .all(chatId, limit, offset);
}

export function getRecentImagePrompts(chatId, limit) {
  const database = getDb();
  return database
    .prepare("SELECT prompt FROM image_prompts WHERE chat_id = ? ORDER BY id DESC LIMIT ?")
    .all(chatId, limit)
    .map((row) => row.prompt);
}

export function updateLatestImagePromptImageUrl(chatId, imageUrl) {
  const database = getDb();
  const result = database
    .prepare(
      "UPDATE image_prompts SET image_url = ? WHERE id = (" +
        "SELECT id FROM image_prompts WHERE chat_id = ? ORDER BY id DESC LIMIT 1" +
      ")"
    )
    .run(imageUrl, chatId);
  return result?.changes ?? 0;
}

export function getMemory(chatId) {
  const database = getDb();
  return database.prepare("SELECT summary, summary_message_count FROM memories WHERE chat_id = ?").get(chatId) || null;
}

export function upsertMemory(chatId, summary, summaryMessageCount) {
  const database = getDb();
  database
    .prepare(
      "INSERT INTO memories (chat_id, summary, summary_message_count) VALUES (?, ?, ?) " +
        "ON CONFLICT(chat_id) DO UPDATE SET summary = excluded.summary, summary_message_count = excluded.summary_message_count, updated_at = CURRENT_TIMESTAMP"
    )
    .run(chatId, summary, summaryMessageCount);
}

export function getCharacter(chatId) {
  const database = getDb();
  const row = database.prepare("SELECT persona FROM characters WHERE chat_id = ?").get(chatId);
  return row?.persona || null;
}

export function upsertCharacter(chatId, persona) {
  const database = getDb();
  database
    .prepare(
      "INSERT INTO characters (chat_id, persona) VALUES (?, ?) " +
        "ON CONFLICT(chat_id) DO UPDATE SET persona = excluded.persona, updated_at = CURRENT_TIMESTAMP"
    )
    .run(chatId, persona);
}

export function deleteChat(chatId) {
  const database = getDb();
  database.prepare("DELETE FROM chats WHERE id = ?").run(chatId);
}

export function getOutfit(chatId) {
  const database = getDb();
  const row = database.prepare("SELECT description FROM outfits WHERE chat_id = ?").get(chatId);
  return row?.description || null;
}

export function upsertOutfit(chatId, description) {
  const database = getDb();
  database
    .prepare(
      "INSERT INTO outfits (chat_id, description) VALUES (?, ?) " +
        "ON CONFLICT(chat_id) DO UPDATE SET description = excluded.description, updated_at = CURRENT_TIMESTAMP"
    )
    .run(chatId, description);
}
