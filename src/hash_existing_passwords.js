// Script to hash all existing plaintext passwords in users table
import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";

const dbPath = path.resolve("./data/chat.db");
const db = new Database(dbPath);

const users = db.prepare("SELECT user_id, password FROM users").all();

for (const user of users) {
  // If password is already hashed (length 64, hex), skip
  if (/^[a-f0-9]{64}$/.test(user.password)) continue;
  const hash = crypto.createHash("sha256").update(user.password).digest("hex");
  db.prepare("UPDATE users SET password = ? WHERE user_id = ?").run(hash, user.user_id);
  // console.log(`Hashed password for user_id: ${user.user_id}`); // Debug only
}

// console.log("All existing passwords are now hashed."); // Debug only
