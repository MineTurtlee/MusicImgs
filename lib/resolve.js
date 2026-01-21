const SOURCE_COLORS = {
  youtube: "#ff0033",
  soundcloud: "#ff7700",
  spotify: "#1db954",
  vimeo: "#1ab7ea",
  bandcamp: "#629aa9"
}

function escapeHTML(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

async function resolveTrack({ source, id }) {
  switch (source) {
    case "youtube": {
      // NO API KEY NEEDED 🎉
      const url = `https://www.youtube.com/watch?v=${id}`
      const oembed = await fetch(
        `https://www.youtube.com/oembed?url=${url}&format=json`
      ).then(r => r.json())

      return {
        title: escapeHTML(oembed.title),
        author: escapeHTML(oembed.author_name),
        duration: null,
        isStream: false,
        source,
        url,
        thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        accent: SOURCE_COLORS[source]
      }
    }

    case "soundcloud": {
      const url = `https://soundcloud.com/${id}`
      const oembed = await fetch(
        `https://soundcloud.com/oembed?url=${url}&format=json`
      ).then(r => r.json())

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
    }

    case "spotify": {
      const url = `https://open.spotify.com/track/${id}`
      const oembed = await fetch(
        `https://open.spotify.com/oembed?url=${url}`
      ).then(r => r.json())

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
    }

    default:
      throw new Error("Unsupported source")
  }
}

module.exports = { resolveTrack }
