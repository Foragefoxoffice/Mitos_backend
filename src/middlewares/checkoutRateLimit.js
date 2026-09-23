const rateLimit = require("express-rate-limit");
const { normalizeCheckoutPhone } = require("../utils/checkoutPhone");

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const TOO_MANY = { message: "Too many attempts. Please wait a few minutes and try again." };

const firstForwardedFor = (req) => {
  const xff = req.headers["x-forwarded-for"];
  return xff ? String(xff).split(",")[0].trim() : req.ip;
};

// Per-IP: 20 attempts / 10 min.
const byIp = rateLimit({
  windowMs: WINDOW_MS,
  max: 20,
  validate: false,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: firstForwardedFor,
  message: TOO_MANY,
});

// Per-phone: 10 attempts / 10 min. Falls back to IP when the phone in the
// body doesn't normalize (so it still limits something rather than no-op).
const byPhone = rateLimit({
  windowMs: WINDOW_MS,
  max: 10,
  validate: false,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => normalizeCheckoutPhone(req.body?.phone) || firstForwardedFor(req),
  message: TOO_MANY,
});

const checkoutRateLimit = [byIp, byPhone];

module.exports = { checkoutRateLimit, byIp, byPhone };
