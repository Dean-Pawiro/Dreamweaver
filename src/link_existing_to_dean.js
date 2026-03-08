// Script to link all existing chats and characters to dean-pawiro user
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve("./data/chat.db");
const db = new Database(dbPath);


// Link all characters and chats to dean-pawiro

// This script previously linked all existing chats and characters to a hardcoded user. It is now removed for security.
