// Migration script to add users table and seed accounts without losing chats
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve("./data/chat.db");
const db = new Database(dbPath);

// Add users table if not exists
const createUsersTable = `
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);
`;
db.exec(createUsersTable);

// Seed accounts if not present
// No default users are seeded. Remove all hardcoded username/password logic.

// Add user_id column to characters and chats if missing
const charCols = db.prepare("PRAGMA table_info(characters)").all();
if (!charCols.some(col => col.name === "user_id")) {
  db.exec("ALTER TABLE characters ADD COLUMN user_id TEXT");
}
const chatCols = db.prepare("PRAGMA table_info(chats)").all();
if (!chatCols.some(col => col.name === "user_id")) {
  db.exec("ALTER TABLE chats ADD COLUMN user_id TEXT");
}

// Link all existing characters and chats to dean-pawiro
if (charCols.some(col => col.name === "user_id")) {
  db.prepare("UPDATE characters SET user_id = ? WHERE user_id IS NULL").run(deanId);
}
if (chatCols.some(col => col.name === "user_id")) {
  db.prepare("UPDATE chats SET user_id = ? WHERE user_id IS NULL").run(deanId);
}

// console.log("Migration complete. Users table and accounts added. Existing chats preserved."); // Debug only
