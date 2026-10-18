// Pure helpers for Android/iOS push targeting (notificationController.js +
// userController.saveFcmToken). Dependency-free so they're unit-testable
// without a database.

const PLATFORMS = ["ALL", "ANDROID", "IOS"];

// Admin request value -> "ALL" | "ANDROID" | "IOS", or null if invalid.
// Missing/empty means ALL so older admin builds keep their current behavior.
function normalizeTargetPlatform(value) {
  if (value == null || value === "") return "ALL";
  const upper = String(value).trim().toUpperCase();
  return PLATFORMS.includes(upper) ? upper : null;
}

// Resolves the OS of the device saving an FCM token. Prefers the explicit
// `platform` the app sends (new builds send Platform.OS); falls back to the
// User-Agent for older installed builds that don't send it yet: React
// Native's networking is OkHttp on Android ("okhttp/4.x") and NSURLSession
// on iOS ("<App>/<build> CFNetwork/... Darwin/..."). Returns "android" |
// "ios" | null.
function detectFcmPlatform(bodyPlatform, userAgent) {
  const explicit = String(bodyPlatform || "").trim().toLowerCase();
  if (explicit === "android" || explicit === "ios") return explicit;
  const ua = String(userAgent || "");
  if (/okhttp/i.test(ua)) return "android";
  if (/CFNetwork|Darwin/i.test(ua)) return "ios";
  return null;
}

// Keeps only users whose registered device matches the target platform.
// Users with an unknown platform are left out of an Android-only / iOS-only
// send (we can't know which they are), and counted separately so admin can
// see how many that was.
function filterUsersByPlatform(users, targetPlatform) {
  if (targetPlatform === "ALL") return { users, skippedOtherPlatform: 0, unknownPlatform: 0 };
  const want = targetPlatform.toLowerCase();
  const kept = [];
  let unknownPlatform = 0;
  for (const u of users) {
    if (u.fcmPlatform === want) kept.push(u);
    else if (!u.fcmPlatform) unknownPlatform++;
  }
  return { users: kept, skippedOtherPlatform: users.length - kept.length, unknownPlatform };
}

module.exports = { PLATFORMS, normalizeTargetPlatform, detectFcmPlatform, filterUsersByPlatform };
