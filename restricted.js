const bcrypt = require('bcrypt')
const config = require('./config.json')
const db = require('./db.js')
const crypto = require("crypto")

const adminAuth = async (req, res, next) => {
    const auth = req.headers.authorization
    if (!auth?.startsWith("Bearer ")) {
        return res.status(401).json({ error: true })
    }

    const token = auth.slice(7)

    // God keys (use sparingly)
    if (config.getpastrnkeys.includes(token)) {
        return next()
    }

    const fastHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex")

    const row = db
        .prepare("SELECT shsh FROM admin_keys WHERE fast_hash = ?")
        .get(fastHash)

    if (!row) {
        return res.status(401).json({ error: true })
    }

    if (await bcrypt.compare(token, row.shsh)) {
        return next()
    }

    return res.status(401).json({ error: true })
}

const restricted = async (req, res, next) => {
    const auth = req.headers.authorization
    if (!auth?.startsWith("Bearer ")) {
        return res.status(401).json({ error: true })
    }

    const token = auth.slice(7)

    if (config.getpastrnkeys.includes(token)) {
        return next()
    }

    const fastHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex")

    const row =
        db.prepare("SELECT shsh FROM api_keys WHERE fast_hash = ?").get(fastHash) ||
        db.prepare("SELECT shsh FROM admin_keys WHERE fast_hash = ?").get(fastHash)

    if (!row) {
        return res.status(401).json({ error: true })
    }

    if (await bcrypt.compare(token, row.shsh)) {
        return next()
    }

    return res.status(401).json({ error: true })
}

module.exports = { adminAuth, restricted }