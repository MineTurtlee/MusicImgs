const sqlite3 = require("better-sqlite3")
const db = sqlite3("img.db")

// Always enforce foreign keys in SQLite (off by default 💀)
db.pragma("foreign_keys = ON")

/* =========================
   USERS
========================= */
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    referral_id INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    FOREIGN KEY (referral_id) REFERENCES referrals(id) ON DELETE SET NULL
  )
`).run()

/* =========================
   API KEYS (NO PLAINTEXT)
========================= */
db.prepare(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT,
    fast_hash TEXT UNIQUE NOT NULL,
    shsh TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`).run()

db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_api_keys_fast_hash
  ON api_keys(fast_hash)
`).run()

/* =========================
   ADMIN KEYS (NO PLAINTEXT 🔥)
========================= */
db.prepare(`
  CREATE TABLE IF NOT EXISTS admin_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    fast_hash TEXT UNIQUE NOT NULL,
    shsh TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )
`).run()

db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_admin_keys_fast_hash
  ON admin_keys(fast_hash)
`).run()

/* =========================
   REFERRALS
========================= */
db.prepare(`
  CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    uses INTEGER NOT NULL DEFAULT 0,
    max_uses INTEGER NOT NULL,
    expiration_date INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )
`).run()

module.exports = db
