const { GoogleAuth } = require("google-auth-library");
const path = require("path");


const auth = new GoogleAuth({
  keyFile: process.env.GOOGLE_PLAY_KEY_PATH || path.join(__dirname, "google-play-api.json"),
  scopes: ["https://www.googleapis.com/auth/androidpublisher"],
});

async function getGooglePlayAccessToken() {
  const client = await auth.getClient();
  const accessTokenResponse = await client.getAccessToken();

  // 🔑 IMPORTANT FIX
  const token =
    typeof accessTokenResponse === "string"
      ? accessTokenResponse
      : accessTokenResponse.token;

  return token;
}

module.exports = { getGooglePlayAccessToken };
