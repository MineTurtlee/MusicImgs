const TOKEN_URL = "https://secure.soundcloud.com/oauth/token"

// module-level singleton state
let accessToken = null
let refreshToken = null
let expiresAt = 0
let inflightPromise = null

function encodeBasic(id, secret) {
    return Buffer.from(`${id}:${secret}`, "utf8").toString("base64")
}

async function requestToken(clientId, clientSecret, grant = "client_credentials") {
    const body =
        grant === "refresh_token"
            ? new URLSearchParams({
                    grant_type: "refresh_token",
                    refresh_token: refreshToken
                })
            : new URLSearchParams({
                    grant_type: "client_credentials"
                })

    console.log(encodeBasic(clientId, clientSecret))

    const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
            Authorization: `Basic ${encodeBasic(clientId, clientSecret)}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json"
        },
        body
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`SoundCloud OAuth failed ${res.status}: ${text}`)
    }

    const data = await res.json()

    if (!data.access_token || !data.expires_in) {
        throw new Error("SoundCloud OAuth returned invalid payload")
    }

    accessToken = data.access_token

    // refresh_token is OPTIONAL for client_credentials
    if (data.refresh_token) {
        refreshToken = data.refresh_token
    }

    // expire early to avoid race conditions (Spotify strat)
    const bufferMs = 60_000
    expiresAt = Math.max(
        Date.now(),
        Date.now() + data.expires_in * 1000 - bufferMs
    )

    return accessToken
}

async function getSoundCloudToken(clientId, clientSecret) {
    const now = Date.now()

    // valid token → reuse
    if (accessToken && now < expiresAt) {
        return accessToken
    }

    // dedupe concurrent requests
    if (inflightPromise) {
        return inflightPromise
    }

    inflightPromise = (async () => {
        try {
            // try refresh first (if supported)
            if (refreshToken) {
                try {
                    return await requestToken(clientId, clientSecret, "refresh_token")
                } catch {
                    // refresh tokens are flaky on SC → drop it
                    refreshToken = null
                }
            }

            // fallback to client_credentials
            return await requestToken(clientId, clientSecret)
        } finally {
            inflightPromise = null
        }
    })()

    return inflightPromise
}

function invalidateSoundCloudToken() {
    accessToken = null
    refreshToken = null
    expiresAt = 0
}

module.exports = {
    getSoundCloudToken,
    invalidateSoundCloudToken
}
