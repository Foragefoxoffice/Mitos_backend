const { GoogleAuth } = require("google-auth-library");
const path = require("path");

async function testAuth() {
  try {
    const auth = new GoogleAuth({
      keyFile: path.join(__dirname, "google-play-api.json"),
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();

    const token =
      typeof tokenResponse === "string"
        ? tokenResponse
        : tokenResponse.token;

    console.log("✅ ACCESS TOKEN GENERATED");
    console.log("Token preview:", token.slice(0, 30) + "...");
  } catch (err) {
    console.error("❌ AUTH FAILED:", err);
  }
}

testAuth();
