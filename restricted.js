const bcrypt = require('bcrypt')
const config = require('./config.json')
const db = require('./db.js')
const crypto = require("crypto")

function fastHash(key) {
    return crypto
        .createHash("sha256")
        .update(key)
        .digest("hex")
}

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

    if (!auth) {
        return res.status(401).json({
            error: true,
            message: "Missing Authorization header"
        })
    }

    /* ==========================
        BEARER API KEY AUTH
    ========================== */
    if (auth.startsWith("Bearer ")) {
        const apiKey = auth.slice(7).trim()

        if (!apiKey) {
            return res.status(401).json({
                error: true,
                message: "Missing Bearer token"
            })
        }

        // 1️⃣ fast hash lookup
        const keyHash = fastHash(apiKey)

        const row = db.prepare(`
            SELECT
                api_keys.id            AS api_key_id,
                api_keys.shsh          AS shsh,
                users.id               AS user_id,
                users.username         AS username
            FROM api_keys
            JOIN users ON users.id = api_keys.user_id
            WHERE api_keys.fast_hash = ?
        `).get(keyHash)

        if (!row) {
            return res.status(401).json({
                error: true,
                message: "Invalid API key"
            })
        }

        // 2️⃣ slow hash verification
        const ok = await bcrypt.compare(apiKey, row.shsh)
        if (!ok) {
            return res.status(401).json({
                error: true,
                message: "Invalid API key"
            })
        }

        // 3️⃣ update last_used_at (fire-and-forget)
        try {
            db.prepare(`
                UPDATE api_keys
                SET last_used_at = ?
                WHERE id = ?
            `).run(Date.now(), row.api_key_id)
        } catch {}

        req.user = {
            id: row.user_id,
            username: row.username,
            apiKeyId: row.api_key_id,
            authType: "api_key"
        }

        return next()
    }

    /* ==========================
        BASIC AUTH
    ========================== */
    if (auth.startsWith("Basic ")) {
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
            username,
            authType: "basic"
        }

        return next()
    }

    /* ==========================
        UNKNOWN AUTH SCHEME
    ========================== */
    return res.status(401).json({
        error: true,
        message: "Unsupported Authorization scheme"
    })
}

module.exports = { adminAuth, restricted }