const canvas = require('canvas')
const express = require('express')
const { resolveTrack } = require('../lib/resolve.js')

const server = express.Router()

server.get("/:source/:id", async (req, res) => {
    try {
        const { source, id } = req.params

        if (!ALLOWED_SOURCES.has(source)) {
            return res.status(400).json({ error: true, message: "unsupported source" })
        }

        const realSource = SOURCE_MAP[source] ?? source

        if (!validateId(realSource, id)) {
            return res.status(400).json({ error: true, message: "invalid id" })
        }

        const track = await resolveTrack({ source: realSource, id })
        const image = await renderNowPlaying(track)

        res.set("Cache-Control", "public, max-age=300")
        res.send(image)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "internal error" })
    }
})

function validateId(source, id) {
  if (id.length > 200) return false

  switch (source) {
    case "youtube":
      return /^[a-zA-Z0-9_-]{11}$/.test(id)

    case "spotify":
      return /^[a-zA-Z0-9]{22}$/.test(id)

    case "vimeo":
      return /^\d+$/.test(id)

    case "soundcloud":
      return !id.includes("..") && !id.includes("//")

    default:
      return false
  }
}

const renderNowPlaying = (async (track) => {
    
})