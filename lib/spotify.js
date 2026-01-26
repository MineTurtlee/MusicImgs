const keys = require("../config.json").apiKeys

let spotifyToken = null
let spotifyTokenExpiresAt = 0

async function fetchSpotifyToken() {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: keys.spotify.client_id,
      client_secret: keys.spotify.client_secret
    })
  })

  const data = await res.json()

  spotifyToken = data.access_token
  spotifyTokenExpiresAt = Date.now() + data.expires_in * 1000

  return spotifyToken
}

async function getSpotifyToken() {
  if (!spotifyToken || Date.now() >= spotifyTokenExpiresAt - 60_000) {
    return await fetchSpotifyToken()
  }

  return spotifyToken
}

// 👇 OPTIONAL auto-clean
setInterval(() => {
  if (spotifyToken && Date.now() >= spotifyTokenExpiresAt) {
    spotifyToken = null
  }
}, 60_000)

module.exports = { getSpotifyToken }
