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

    if (!auth || !auth.startsWith("Basic ")) {
        return res.status(401).json({
            error: true,
            message: "Missing Basic Authorization header"
        })
    }

    let decoded
    try {
        decoded = Buffer
            .from(auth.slice(6), "base64")
            .toString("utf8")
    } catch {
        return res.status(401).json({
            error: true,
            message: "Invalid Authorization header"
        })
    }

    const sep = decoded.indexOf(":")
    if (sep === -1) {
        return res.status(401).json({
            error: true,
            message: "Invalid Authorization format"
        })
    }

    const username = decoded.slice(0, sep)
    const password = decoded.slice(sep + 1)

    const user = db.prepare(`
        SELECT id, password
        FROM users
        WHERE username = ?
    `).get(username)

    if (!user) {
        return res.status(401).json({
            error: true,
            message: "Invalid credentials"
        })
    }

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) {
        return res.status(401).json({
            error: true,
            message: "Invalid credentials"
        })
    }

    req.user = {
        id: user.id,
        username
    }

    next()
}

module.exports = { adminAuth, restricted }