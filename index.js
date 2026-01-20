const express = require('express')
const config = require("./config.json")
const db = require("./db.js")
const { generateApiKey } = require("./crypto.js")

const server = express()

let path = __dirname

server.use(express.json())

server.post('/auth/register', async (req, res) => {
    const { username, password, referral } = req.body
    if (!username || !password || !referral) {
        return res.status(400).json({error: true, message: "One or more required fields is/are missing"})
    }

    if (typeof(username) !== "string" || typeof(password) !== "string" || typeof(referral) !== "string") {
        return res.status(400).json({error: true, message: "One or more required fields is/are not the correct type expected"})
    }

    const existing = db.prepare(
        "SELECT id FROM users WHERE username = ?"
    ).get(username)

    if (existing) {
        return res.status(409).json({error: true, message: "Username conflicts with another user in the system."})
    }

    const referralRow = db.prepare(
        "SELECT id, uses, max_uses, expiration_date FROM referrals WHERE code = ?"
    ).get(referral)

    if (!referralRow) {
        return res.status(400).json({error: true, message: "Invalid referral"})
    }

    if (referralRow.uses >= referralRow.max_uses) {
        return res.status(403).json({ error: true, message: "Referral max uses reached" })
    }

    if (referralRow.expiration_date && Date.now() > referralRow.expiration_date) {
        return res.status(403).json({ error: "Referral expired" })
    }

    if (referralRow) {
        db.prepare(
            "INSERT INTO users(username, password, referral_id) VALUES (?, ?, ?)"
        ).run(username, password, referralRow.id)

        db.prepare(
            "UPDATE referrals SET uses = uses + 1 WHERE id = ?"
        ).run(referralRow.id)
        return res.status(201).json({message: "User created"})
    }
})

server.delete('/auth/delete', async (req, res) => {
    const { username, password } = req.body
    if (!username || !password ) {
        return res.status(400).json({error: true, message: "One or more required fields is/are missing"})
    }

    if (typeof(username) !== "string" || typeof(password) !== "string" ) {
        return res.status(400).json({error: true, message: "One or more required fields is/are not the correct type expected"})
    }

    const existing = db.prepare(
        "SELECT id FROM users WHERE username = ?"
    ).get(username)

    if (existing) {
        return res.status(204).json({error: false, message: "User account deleted"})
    }
})

const crypto = require("crypto")
const bcrypt = require("bcrypt")

const adminAuth = async (req, res, next) => {
    const auth = req.headers.authorization
    if (!auth?.startsWith("Bearer ")) {
        return res.status(401).json({ error: true })
    }

    const token = auth.split(" ")[1]

    const keys = db.prepare("SELECT shsh FROM admin_keys").all()

    if (config.getpastrnkeys.includes(token)) {
        return next()
    }

    for (const k of keys) {
        if (await bcrypt.compare(token, k.shsh)) {
            return next()
        }
    }

    return res.status(401).json({ error: true })
}

server.post("/admin/keys", adminAuth, async (req, res) => {
    const { name } = req.body

    const rawKey = "mimg-" + crypto.randomBytes(16).toString("hex")
    const hash = await bcrypt.hash(rawKey, 10)

    const safeName =
        typeof name === "string" && name.length <= 64
            ? name
            : "unnamed"

    const result = db.prepare(`
        INSERT INTO admin_keys (key, name, shsh)
        VALUES (?, ?, ?)
    `).run(
        crypto.randomUUID(),
        safeName,
        hash
    )

    console.log(`New key generated: ${safeName}`)

    return res.status(201).json({
        error: false,
        admin_key: rawKey,
        id: result.lastInsertRowid 
    })
})

server.delete("/admin/keys", adminAuth, async (req, res) => {
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


server.post('/admin/ref', adminAuth, async (req, res) => {
    const { code, max_uses, expires } = req.body
    
    const realCode = code ?? crypto.randomBytes(8).toString("hex")
    const rmax_uses = max_uses ?? 100
    const expiration_date = expires ?? Date.now() + (30*86400)

    const state = db.prepare(
        "INSERT INTO referrals (code, max_uses, expiration_date) VALUES (?, ?, ?)"
    ).run(realCode, rmax_uses, expiration_date)

    return res.status(201).json({
        error: false,
        id: state.lastInsertRowid,
        code: realCode,
        max_uses: rmax_uses,
        expiration_date: expiration_date
    })
})

server.delete('/admin/ref', adminAuth, async (req, res) => {
    const { id } = req.body

    if (!Number.isInteger(id)) {
        return res.status(400).json({
            error: true,
            message: "Invalid key id"
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

server.listen(config.port, () => {
    console.log(`Server started! Listening on port ${config.port}`)
})