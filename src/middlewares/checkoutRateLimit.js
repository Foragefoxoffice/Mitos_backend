const rateLimit = require("express-rate-limit");
const { normalizeCheckoutPhone } = require("../utils/checkoutPhone");

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const TOO_MANY = { message: "Too many attempts. Please wait a few minutes and try again." };

// Prod nginx doesn't forward the client address (no trust proxy either), so
// req.ip is 127.0.0.1 for EVERY visitor. Keying on it put all customers in
// one shared bucket — after ~10 coupon tries site-wide, every coupon for
// everyone failed with 429 (2026-09-23). Prefer the proxy headers when nginx
// sends them; the IP limit is generous because it may still be shared.
const clientIp = (req) => {
  const realIp = req.headers["x-real-ip"];
  if (realIp) return String(realIp).trim();
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return req.ip;
};

// Per-IP backstop: 100 attempts / 10 min.
const byIp = rateLimit({
  windowMs: WINDOW_MS,
  max: 100,
  validate: false,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIp,
  message: TOO_MANY,
});

// Per-phone: 10 attempts / 10 min. Skipped when no valid phone is sent
// (e.g. applying a coupon before typing the number) — falling back to the
// shared IP here is what caused the site-wide lockout.
const byPhone = rateLimit({
  windowMs: WINDOW_MS,
  max: 10,
  validate: false,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => normalizeCheckoutPhone(req.body?.phone),
  skip: (req) => !normalizeCheckoutPhone(req.body?.phone),
  message: TOO_MANY,
});

const checkoutRateLimit = [byIp, byPhone];

module.exports = { checkoutRateLimit, byIp, byPhone };
