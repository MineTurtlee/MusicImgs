const crypto = require("crypto")
const bcrypt = require("bcrypt")

function generateApiKey() {
  var bytes = crypto.randomBytes(32).toString("hex")
  return ("mimg-" + bytes)
}

async function hashKey(key) {
  return await bcrypt.hash(key, 10)
}

