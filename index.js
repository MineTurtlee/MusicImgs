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
            "UPDATE referrals SET uses = uses + 1 WHERE id = ?"
        ).run(referralRow.id)
        return res.status(200).json({debug: true})
    }
})

server.listen(config.port, () => {
    console.log(`Server started! Listening on port ${config.port}`)
})