const router = require('express').Router();
const db = require('../db');
const { restricted } = require('../restricted');

server.post("/keys", userAuth, async (req, res) => {
    const { name } = req.body
    const userId = req.user.id

    const rawKey = "uimg-" + crypto.randomBytes(24).toString("hex")

    const fastHash = crypto
        .createHash("sha256")
        .update(rawKey)
        .digest("hex")

    const shsh = await bcrypt.hash(rawKey, 10)

    const safeName =
        typeof name === "string" && name.length <= 64
            ? name
            : "unnamed"

    const result = db.prepare(`
        INSERT INTO api_keys (user_id, name, fast_hash, shsh, created_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(
        userId,
        safeName,
        fastHash,
        shsh,
        Date.now()
    )

    return res.status(201).json({
        ok: true,
        api_key: rawKey,
        id: result.lastInsertRowid
    })
})

server.delete("/keys", userAuth, async (req, res) => {
    const { id } = req.body
    const userId = req.user.id

    if (!Number.isInteger(id)) {
        return res.status(400).json({
            error: true,
            message: "Invalid key id"
        })
    }

    const key = db.prepare(`
        SELECT id FROM api_keys
        WHERE id = ? AND user_id = ?
    `).get(id, userId)

    if (!key) {
        return res.status(404).json({
            error: true,
            message: "API key not found"
        })
    }

    db.prepare(
        "DELETE FROM api_keys WHERE id = ?"
    ).run(id)

    return res.status(204).send()
})
