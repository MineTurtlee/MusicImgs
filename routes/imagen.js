const canvas = require("canvas")
const express = require("express")
const { resolveTrack } = require("../lib/resolve.js")
const { restricted } = require("../restricted.js")

const server = express.Router()

const ALLOWED_SOURCES = new Set(["youtube", "spotify", "soundcloud", "vimeo"])
const SOURCE_MAP = {
    yt: "youtube",
    sc: "soundcloud",
    vm: "vimeo",
}

/* ============================
     ROUTES
============================ */

async function handleRequest(req, res) {
    try {
        const { source, id, progress, name } = req.params

        if (!ALLOWED_SOURCES.has(source)) {
            return res.status(400).json({ error: "unsupported source" })
        }

        const realSource = SOURCE_MAP[source] ?? source

        if (!validateId(realSource, id)) {
            return res.status(400).json({ error: "invalid id" })
        }

        // optional progress (seconds)
        const progressSec =
            progress !== undefined ? Math.max(0, Number(progress) || 0) : null

        const track = await resolveTrack({ source: realSource, id })
        const image = await renderNowPlaying(track, progressSec, name)

        res.set("Content-Type", "image/png")
        res.set("Cache-Control", "public, max-age=5")
        res.send(image)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "internal error" })
    }
}

server.get("/:source/:id/:name", restricted, handleRequest)
server.get("/:source/:id/:name/:progress", restricted, handleRequest)
server.get("/:source/:id/:progress", restricted, handleRequest)
server.get("/:source/:id", restricted, handleRequest)

/* ============================
     VALIDATION
============================ */

function validateId(source, id) {
    if (!id || id.length > 200) return false

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

/* ============================
     RENDERING
============================ */

async function renderNowPlaying(track, progressSec, name) {
    canvas.registerFont("./fonts/Comfortaa-Regular.ttf", {
        family: "Comfortaa"
    })

    canvas.registerFont("./fonts/Comfortaa-Bold.ttf", {
        family: "Comfortaa"
    })

    const W = 1600
    const H = 420
    const cv = canvas.createCanvas(W, H)
    const ctx = cv.getContext("2d")

    const accent = track.accent || "#a855f7"
    const accentGlow = hexToRGBA(accent, 0.9)

    // normalize progress
    const duration = track.duration || 240
    const current = progressSec == null ? 0 : Math.max(0, progressSec)
    const pct = Math.min(current / duration, 1)

    // load album
    const album = await canvas.loadImage(track.thumbnail)

    /* ================= background ================= */
    drawCover(ctx, album, W, H)
    ctx.fillStyle = "rgba(0,0,0,0.55)"
    ctx.fillRect(0, 0, W, H)

    /* ================= card ================= */
    ctx.fillStyle = "rgba(20,20,20,0.65)"
    ctx.beginPath()
    ctx.roundRect(40, 30, W - 80, H - 60, 28)
    ctx.fill()

    /* ================= album art ================= */
    const albumSize = 300
    const albumX = 80
    const albumY = (H - albumSize) / 2

    ctx.save()
    ctx.shadowColor = accentGlow
    ctx.shadowBlur = 40
    ctx.beginPath()
    ctx.roundRect(albumX, albumY, albumSize, albumSize, 22)
    ctx.clip()

    const overscanBySource = {
        youtube: 1.3,
        spotify: 1.05,
        soundcloud: 1.1,
        vimeo: 1.2
    }

    const overscan = overscanBySource[track.source] ?? 1.15 // this one actually matters now

    const scale = Math.max(
        albumSize / album.width,
        albumSize / album.height
    ) * overscan

    const drawW = album.width * scale
    const drawH = album.height * scale

    const drawX = albumX + (albumSize - drawW) / 2
    const drawY = albumY + (albumSize - drawH) / 2

    ctx.drawImage(album, drawX, drawY, drawW, drawH)

    ctx.restore()

    ctx.strokeStyle = accent
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.roundRect(albumX, albumY, albumSize, albumSize, 22)
    ctx.stroke()

    /* ================= text ================= */
    const textX = albumX + albumSize + 50
    const textMaxWidth = W - textX - 80
    const centerY = H / 2

    ctx.textAlign = "left"

    ctx.fillStyle = "#fff"
    ctx.font = "900 52px 'Comfortaa', 'Segoe UI', sans-serif"
    ctx.fillText(
        truncateText(ctx, track.title, textMaxWidth),
        textX,
        centerY - 30
    )

    ctx.fillStyle = "rgba(255,255,255,0.65)"
    ctx.font = "500 34px 'Comfortaa', 'Segoe UI', sans-serif"
    ctx.fillText(
        truncateText(ctx, track.author, textMaxWidth),
        textX,
        centerY + 15
    )

    /* ================= progress bar ================= */
    const barY = centerY + 40
    const barH = 8

    // bar bg
    ctx.fillStyle = "rgba(255,255,255,0.18)"
    ctx.beginPath()
    ctx.roundRect(textX, barY, textMaxWidth, barH, 6)
    ctx.fill()

    // bar fill
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.roundRect(textX, barY, textMaxWidth * pct, barH, 6)
    ctx.fill()

    /* ================= time labels ================= */
    ctx.font = "500 22px 'Comfortaa', 'Segoe UI', sans-serif"
    ctx.fillStyle = "rgba(255,255,255,0.7)"

    ctx.textAlign = "left"
    ctx.fillText(
        formatTime(current),
        textX,
        barY + 37
    )

    ctx.textAlign = "right"
    ctx.fillText(
        formatTime(duration),
        textX + textMaxWidth,
        barY + 37
    )

    /* ================= source badge ================= */

    const cardPaddingX = 40
    const cardPaddingY = 30

    const badgeGap = 10
    const badgeRadius = 18
    const iconRadius = 15

    const iconSize = 26
    const iconPad = 10

    const label = name || "MusicImg Generator"
    ctx.font = "600 20px 'Comfortaa', 'Segoe UI', sans-serif"
    const labelWidth = ctx.measureText(label).width

    const badgeH = iconSize + iconPad * 2
    const badgeW =
        labelWidth +
        badgeGap +
        iconSize +
        iconPad * 3

    // anchor INSIDE the card
    const badgeX = W - cardPaddingX - badgeW - 30
    const badgeY = H - cardPaddingY - badgeH - 26

    // badge container
    ctx.fillStyle = "rgba(0,0,0,0.45)"
    ctx.beginPath()
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, badgeRadius)
    ctx.fill()

    // label (outside icon box)
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.fillStyle = "rgba(255,255,255,0.65)"
    ctx.fillText(
        label,
        badgeX + iconPad,
        badgeY + badgeH / 2
    )

    // icon background (ITS OWN PILL)
    const iconBoxX =
        badgeX + iconPad + labelWidth + badgeGap
    const iconBoxY = badgeY + (badgeH - (iconSize + iconPad)) / 2
    const iconBoxSize = iconSize + iconPad

    ctx.fillStyle = "rgba(0,0,0,0.6)"
    ctx.beginPath()
    ctx.roundRect(
        iconBoxX,
        iconBoxY,
        iconBoxSize,
        iconBoxSize,
        iconRadius
    )
    ctx.fill()

    // icon
    const iconPath = getSourceIcon(track.source)
    if (iconPath) {
        const icon = await canvas.loadImage(iconPath)
        ctx.drawImage(
            icon,
            iconBoxX + (iconBoxSize - iconSize) / 2,
            iconBoxY + (iconBoxSize - iconSize) / 2,
            iconSize,
            iconSize
        )
    }

    return cv.toBuffer("image/png")
}

/* ============================
     HELPERS
============================ */

function drawCover(ctx, img, w, h) {
    const ir = img.width / img.height
    const cr = w / h

    let dw, dh, dx, dy

    if (ir > cr) {
        dh = h
        dw = ir * dh
        dx = -(dw - w) / 2
        dy = 0
    } else {
        dw = w
        dh = dw / ir
        dx = 0
        dy = -(dh - h) / 2
    }

    ctx.filter = "blur(28px)"
    ctx.drawImage(img, dx, dy, dw, dh)
    ctx.filter = "none"
}

function truncateText(ctx, text, maxWidth) {
    if (!text) return ""
    if (ctx.measureText(text).width <= maxWidth) return text

    while (text.length) {
        text = text.slice(0, -1)
        if (ctx.measureText(text + "…").width <= maxWidth) {
            return text + "…"
        }
    }
    return "…"
}

function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec))
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, "0")}`
}

function hexToRGBA(hex, a = 1) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${a})`
}

function getSourceIcon(source) {
    switch (source) {
        case "youtube": return "./icons/youtube.png"
        case "spotify": return "./icons/spotify.png"
        case "soundcloud": return "./icons/soundcloud.png"
        case "vimeo": return "./icons/vimeo.png"
        default: return null
    }
}


module.exports = server
