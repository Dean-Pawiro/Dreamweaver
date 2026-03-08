// (moved to initDb below)
// List all chats for a user_id
export function listChats(user_id) {
  const database = getDb();
  // If user_id is 'master', return all chats
  const masterUser = database.prepare("SELECT user_id FROM users WHERE username = ?").get("master");
  if (masterUser && user_id === masterUser.user_id) {
    return database.prepare(`
      SELECT c.id, c.created_at, ch.persona, c.character_id
      FROM chats c
      LEFT JOIN characters ch ON c.character_id = ch.character_id
      ORDER BY c.created_at DESC
    `).all();
  }
  return database.prepare(`
    SELECT c.id, c.created_at, ch.persona, c.character_id
    FROM chats c
    LEFT JOIN characters ch ON c.character_id = ch.character_id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `).all(user_id);
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
  // Ensure master account exists
  const dbTmp = new Database(defaultDbPath);
  dbTmp.pragma("journal_mode = WAL");
  dbTmp.exec(`CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL);`);
  const masterUser = dbTmp.prepare("SELECT user_id, password FROM users WHERE username = ?").get("master");
  const hash = crypto.createHash("sha256").update("master").digest("hex");
  if (!masterUser) {
    const masterId = crypto.randomUUID();
    dbTmp.prepare("INSERT INTO users (user_id, username, password) VALUES (?, ?, ?)" ).run(masterId, "master", hash);
  } else if (masterUser.password === "master") {
    dbTmp.prepare("UPDATE users SET password = ? WHERE user_id = ?").run(hash, masterUser.user_id);
  }
  dbTmp.close();
  // ...existing code...
  // console.log(`[db] Using SQLite path: ${defaultDbPath}`); // Debug only
  ensureDbDirectory(defaultDbPath);
  db = new Database(defaultDbPath);
  db.pragma("journal_mode = WAL");
  // New schema: characters table has character_id, persona, updated_at
  // chats table has id, character_id, created_at
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS characters (
      character_id TEXT PRIMARY KEY,
      persona TEXT NOT NULL,
      user_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      character_id TEXT,
      user_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(character_id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
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

    CREATE TABLE IF NOT EXISTS outfits (
      chat_id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );
  `);


  // No default users are seeded. Remove all hardcoded username/password logic.

  // Migration: if old characters table exists, migrate data
  const columns = db.prepare("PRAGMA table_info(characters)").all();
  if (columns.some(col => col.name === "chat_id")) {
    // Migrate old characters table to new schema
    const oldRows = db.prepare("SELECT chat_id, persona, updated_at FROM characters").all();
    db.exec("DROP TABLE IF EXISTS characters");
    db.exec(`
      CREATE TABLE IF NOT EXISTS characters (
        character_id TEXT PRIMARY KEY,
        persona TEXT NOT NULL,
        user_id TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
      )
    `);
    // Re-link all existing characters and chats to the correct user_id if not already set
    // db.prepare("UPDATE characters SET user_id = ? WHERE user_id IS NULL").run(deanId);
    // db.prepare("UPDATE chats SET user_id = ? WHERE user_id IS NULL").run(deanId);
    const insert = db.prepare("INSERT INTO characters (character_id, persona, updated_at) VALUES (?, ?, ?)");
    for (const row of oldRows) {
      insert.run(row.chat_id, row.persona, row.updated_at);
    }
    // Update chats table to add character_id column if missing
    const chatCols = db.prepare("PRAGMA table_info(chats)").all();
    if (!chatCols.some(col => col.name === "character_id")) {
      db.exec("ALTER TABLE chats ADD COLUMN character_id TEXT");
    }
    // Set character_id in chats where possible
    const update = db.prepare("UPDATE chats SET character_id = ? WHERE id = ?");
    for (const row of oldRows) {
      update.run(row.chat_id, row.chat_id);
    }
  }

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

export function createChat(user_id) {
  const id = crypto.randomUUID();
  const database = getDb();
  database.prepare("INSERT INTO chats (id, user_id) VALUES (?, ?)").run(id, user_id);
  return id;
}

export function getOrCreateChat(chatId, user_id) {
  const database = getDb();
  if (chatId) {
    const row = database.prepare("SELECT id FROM chats WHERE id = ?").get(chatId);
    if (row) {
      // Do not update user_id if chat exists
      return chatId;
    }
    // Create chat with specified id for gallery
    database.prepare("INSERT INTO chats (id, user_id) VALUES (?, ?)").run(chatId, user_id);
    return chatId;
  }
  // Only assign user_id when creating a new chat
  return createChat(user_id);
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
      "SELECT id, role, content, created_at, kind, image_url FROM (" +
        "SELECT id, role, content, created_at, 'message' AS kind, NULL AS image_url FROM messages WHERE chat_id = ? " +
        "UNION ALL " +
        "SELECT id, 'assistant' AS role, prompt AS content, created_at, 'image_prompt' AS kind, image_url FROM image_prompts WHERE chat_id = ?" +
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

export function getCharacter(characterId) {
  const database = getDb();
  const row = database.prepare("SELECT persona FROM characters WHERE character_id = ?").get(characterId);
  return row?.persona || null;
}

export function upsertCharacter(characterId, persona, user_id) {
  const database = getDb();
  database
    .prepare(
      "INSERT INTO characters (character_id, persona, user_id) VALUES (?, ?, ?) " +
        "ON CONFLICT(character_id) DO UPDATE SET persona = excluded.persona, updated_at = CURRENT_TIMESTAMP, user_id = excluded.user_id"
    )
    .run(characterId, persona, user_id);
}

export function deleteChat(chatId) {
  const database = getDb();
  database.prepare("DELETE FROM chats WHERE id = ?").run(chatId);
}

export function deleteMessage(messageId) {
  const database = getDb();
  database.prepare("DELETE FROM messages WHERE id = ?").run(messageId);
}

export function deleteImagePrompt(promptId) {
  const database = getDb();
  database.prepare("DELETE FROM image_prompts WHERE id = ?").run(promptId);
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
