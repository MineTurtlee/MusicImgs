const crypto = require('crypto')
const bcrypt = require('bcrypt')
const express = require('express')
const db = require("../db")
const { adminAuth } = require("../restricted")

server = express.Router()

server.post("/keys", adminAuth, async (req, res) => {
    const { name } = req.body

    const rawKey = "mimg-" + crypto.randomBytes(24).toString("hex")

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
        INSERT INTO admin_keys (name, fast_hash, shsh)
        VALUES (?, ?, ?)
    `).run(
        safeName,
        fastHash,
        shsh
    )

    console.log(`New admin key generated: ${safeName}`)

    return res.status(201).json({
        error: false,
        admin_key: rawKey,
        id: result.lastInsertRowid
    })
})

server.delete("/keys", adminAuth, async (req, res) => {
    const { id } = req.body

    if (!Number.isInteger(id)) {
        return res.status(400).json({
            error: true,
            message: "Invalid key id"
        })
    }

    const key = db.prepare(
        "SELECT id FROM admin_keys WHERE id = ?"
    ).get(id)

    if (!key) {
        return res.status(404).json({
            error: true,
            message: "Admin key not found"
        })
    }

    const count = db.prepare(
        "SELECT COUNT(*) AS c FROM admin_keys"
    ).get().c

    if (count <= 1) {
        return res.status(409).json({
            error: true,
            message: "Cannot delete the last admin key"
        })
    }

    db.prepare(
        "DELETE FROM admin_keys WHERE id = ?"
    ).run(id)

    return res.status(204).send()
})


server.post('/ref', adminAuth, async (req, res) => {
    let { code, max_uses, expires } = req.body

    if (code && typeof code !== "string") {
        return res.status(400).json({ error: true })
    }

    if (code) {
        const exists = db.prepare(
            "SELECT id FROM referrals WHERE code = ?"
        ).get(code)
        if (exists) {
            return res.status(409).json({
                error: true,
                message: "Referral code already exists"
            })
        }
    }

    const realCode = code ?? crypto.randomBytes(8).toString("hex")

    const rmax_uses =
        Number.isInteger(max_uses) && max_uses > 0
            ? max_uses
            : 100

    const expiration_date =
        Number.isInteger(expires)
            ? expires
            : Date.now() + (30 * 86400 * 1000)

    const state = db.prepare(
        "INSERT INTO referrals (code, max_uses, expiration_date) VALUES (?, ?, ?)"
    ).run(realCode, rmax_uses, expiration_date)

    return res.status(201).json({
        error: false,
        id: state.lastInsertRowid,
        code: realCode,
        max_uses: rmax_uses,
        expiration_date
    })
})

server.delete('/ref/:id', adminAuth, async (req, res) => {
    const id = Number(req.params.id)

    if (!Number.isInteger(id)) {
        return res.status(400).json({
            error: true,
            message: "Invalid referral id"
        })
    }

    const key = db.prepare(
        "SELECT id FROM referrals WHERE id = ?"
    ).get(id)

    if (!key) {
        return res.status(404).json({
            error: true,
            message: "Referral code not found"
        })
    }

    db.prepare(
        "DELETE FROM referrals WHERE id = ?"
    ).run(id)

    return res.status(204).send()
})


module.exports = server