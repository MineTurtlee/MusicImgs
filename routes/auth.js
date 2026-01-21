const db = require('../db')
const express = require('express')

const server = express.Router()

server.post('/register', async (req, res) => {
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

server.delete('/auth', async (req, res) => {
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

module.exports = server