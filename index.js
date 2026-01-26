const express = require('express')
const config = require("./config.json")
const { generateApiKey } = require("./crypto.js")
const { adminAuth, restricted } = require("./restricted.js")
const routes = require("./routes")
const { createCanvas, registerFont } = require("canvas")
require("./lib/spotify.js")
require("./lib/soundcloud.js")

registerFont("./fonts/Comfortaa-Regular.ttf", {
  family: "Comfortaa"
})

const server = express()
server.use(express.json())
server.use('/api/auth', routes.auth)
server.use('/api/admin', routes.admin)
server.use('/api/imagen', routes.imagen)
server.use('/api/keys', routes.keys)

server.listen(config.port, () => {
    console.log(`Server started! Listening on port ${config.port}`)
})