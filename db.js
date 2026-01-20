const sqlite3 = require("better-sqlite3")
const db = sqlite3('img.db')

db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    referral_id INTEGER NOT NULL,
    FOREIGN KEY (referral_id) REFERENCES referrals(id)
  )
`).run()


db.prepare(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    key_hash TEXT,
    created_at INTEGER
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    uses INTEGER NOT NULL DEFAULT 0,
    max_uses INTEGER NOT NULL,
    expiration_date INTEGER
  )
`).run()

module.exports = db