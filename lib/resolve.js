const keys = require("../config.json").apiKeys
const { getSpotifyToken } = require("./spotify.js")
const { getSoundCloudToken, invalidateSoundCloudToken } = require("../lib/soundcloud.js")


const SOURCE_COLORS = {
  youtube: "#ff0033",
  soundcloud: "#ff7700",
  spotify: "#1db954",
  vimeo: "#1ab7ea",
  bandcamp: "#629aa9"
}


const oauthkeys/*: Array[Object] */ = []

function escapeHTML(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function parseISODuration(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0

  const [, h, m, s] = match.map(x => parseInt(x || 0))
  return h * 3600 + m * 60 + s
}


async function resolveTrack({ source, id }) {
  switch (source) {
    case "youtube": {
      // NO API KEY NEEDED 🎉
      const url = `https://www.youtube.com/watch?v=${id}`
      const oembed = await fetch(
        `https://www.youtube.com/oembed?url=${url}&format=json`
      ).then(r => r.json())
      const apiLink =
        `https://www.googleapis.com/youtube/v3/videos` +
        `?part=contentDetails,snippet` +
        `&id=${id}` +
        `&key=${keys.youtube}`

      
      const data = await fetch(apiLink).then(r => r.json())
      const item = data.items?.[0]
      let duration = parseISODuration(item?.contentDetails?.duration) || null
      let stream = item.snippet?.liveBroadcastContent === "live"

      return {
        title: oembed.title,
        author: oembed.author_name,
        duration: duration,
        isStream: stream,
        source,
        url,
        thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        accent: SOURCE_COLORS[source]
      }
    }

    case "soundcloud": {
      let track

      // Otherwise assume it's a SoundCloud page URL
      track = await resolveSoundCloud(id)

      return {
        title: track.title,
        author: track.author,
        duration: track.duration,
        isStream: !track.duration,
        source: "soundcloud",
        url: id,
        thumbnail: track.thumbnail,
        accent: SOURCE_COLORS.soundcloud
      }
    }

    case "spotify": {
      const url = `https://open.spotify.com/track/${id}`
      const oembed = await fetch(
        `https://open.spotify.com/oembed?url=${url}`
      ).then(r => r.json())

      const token = await getSpotifyToken()

      const data = await fetch(
        `https://api.spotify.com/v1/tracks/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      ).then(r => r.json())

      let duration = Number.isFinite(data.duration_ms)
        ? Math.floor(data.duration_ms / 1000)
        : null

      let artists = []
      for (const artist of data.artists || []) {
        if (artist.name) artists.push(artist.name)
      }

      return {
        title: oembed.title,
        author: (artists.length > 0) ? artists.join(", ") : oembed.author_name,
        duration: duration,
        isStream: false,
        source,
        url,
        thumbnail: oembed.thumbnail_url,
        accent: SOURCE_COLORS[source]
      }
    }

    default:
      throw new Error("Unsupported source")
  }
}

function extractSoundCloudURN(url) {
  const match = url.match(/soundcloud:tracks:\d+/)
  return match ? match[0] : null
}

async function resolveSoundCloud(input) {
  const url = `https://api.soundcloud.com/tracks/soundcloud:tracks:${input}`

  const token = await getSoundCloudToken(
    keys.soundcloud.client_id,
    keys.soundcloud.client_secret
  )

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      charset: "utf-8"
    }
  })

  if (res.status === 401) {
    invalidateSoundCloudToken()
    throw new Error("SoundCloud token expired")
  }

  if (!res.ok) {
    throw new Error(`SoundCloud resolve failed ${res.status}`)
  }

  const data = await res.json()

  return {
    id: data.id,
    title: data.title,
    author: data.user?.username,
    duration: Math.floor((data.duration ?? 0) / 1000),
    thumbnail: data.artwork_url?.replace("-large", "-t500x500"),
    streamable: data.streamable,
    source: "soundcloud"
  }
}

function encodeBasicAuth(clientId, clientSecret) {
  return Buffer
    .from(`${clientId}:${clientSecret}`, "utf8")
    .toString("base64")
}


async function resolveSCT({ source, id}) {
  let track
  track = await resolveSoundCloudTest(id)
  return track
}

async function resolveSoundCloudTest(url) {
  const clientId = keys.soundcloud.client_id
  const clientSecret = keys.soundcloud.client_secret

  // 1️⃣ get (or reuse) OAuth token
  const token = await getSoundCloudToken(clientId, clientSecret)

  // 2️⃣ call resolve endpoint with Bearer token
  const res = await fetch(
    `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(url)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    }
  )

  // 3️⃣ optional: auto-heal on expiry
  if (res.status === 401) {
    invalidateSoundCloudToken()
    throw new Error("SoundCloud token expired")
  }

  return res
}

module.exports = { resolveTrack, resolveSCT }
