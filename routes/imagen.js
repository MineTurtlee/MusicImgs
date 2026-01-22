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

/*
return {
        title: escapeHTML(oembed.title),
        author: escapeHTML(oembed.author_name),
        duration: null,
        isStream: false,
        source,
        url,
        thumbnail: oembed.thumbnail_url,
        accent: SOURCE_COLORS[source]
      }
*/

const renderNowPlaying = (async (track) => {
    const canvas = canvas.createCanvas(1920, 700)
    const ctx = canvas.getContext('2d')
    const accentGlow = "rgba(168, 85, 247, 0.8)"

    const albumSize = 720
    const albumX = (canvas.width - albumSize) / 2
    const albumY = 40
    const albumRadius = 24

    ctx.save()
    ctx.shadowColor = accentGlow
    ctx.shadowBlur = 60
    ctx.offsetX = 0
    ctx.offsetY = 15
    ctx.fillStyle = "#222222"
    
    this.roundRect(ctx, albumX, albumY, albumSize, albumSize, albumRadius)
    ctx.clip()

    const scale = Math.max(albumSize / track.thumbnail.width, albumSize / track.thumbnail.height)
    const scaledWidth = track.thumbnail.width * scale
    const scaledHeight = track.thumbnail.height * scale
    const imgX = albumX - (scaledWidth - albumSize) / 2
    const imgY = albumY - (scaledHeight - albumSize) / 2

    ctx.drawImage(await canvas.loadImage(track.thumbnail), imgX, imgY, scaledWidth, scaledHeight)
    ctx.restore()

    ctx.save()
    ctx.beginPath()
    this.roundRect(ctx, albumX, albumY, albumSize, albumSize, albumRadius)
    ctx.strokeStyle = accentGlow
    ctx.lineWidth = 8
    ctx.shadowColor = accentGlow
    ctx.shadowBlur = 20
    ctx.stroke()
    ctx.restore()
})