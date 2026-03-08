import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "data", "chat.db");

const db = new Database(dbPath);

try {
  // Check if created_at column already exists
  const tableInfo = db.pragma("table_info(characters)");
  const hasCreatedAt = tableInfo.some(col => col.name === "created_at");
  
  if (!hasCreatedAt) {
    console.log("Adding created_at column to characters table...");
    db.exec("ALTER TABLE characters ADD COLUMN created_at TEXT;");
    // Set all existing rows to current timestamp
    db.exec("UPDATE characters SET created_at = datetime('now') WHERE created_at IS NULL;");
    console.log("✓ Migration complete: created_at column added");
  } else {
    console.log("✓ created_at column already exists");
  }
} catch (error) {
  console.error("Migration failed:", error.message);
} finally {
  db.close();
}
