const express = require('express')
const config = require("./config.json")
const { generateApiKey } = require("./crypto.js")
const { adminAuth, restricted } = require("./restricted.js")
const routes = require("./routes")

const server = express()
server.use(express.json())
server.use('/api/auth', routes.auth)
server.use('/api/admin', routes.admin)


server.listen(config.port, () => {
    console.log(`Server started! Listening on port ${config.port}`)
})