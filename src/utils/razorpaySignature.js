const crypto = require("crypto");

/**
 * Verify a Razorpay checkout ("payment verify") signature:
 * HMAC-SHA256(orderId|paymentId, keySecret) must equal the signature the
 * client sent back after Checkout.js completes.
 */
const isValidPaymentSignature = ({ orderId, paymentId, signature }, secret) => {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeCompare(expected, signature);
};

/**
 * Verify a Razorpay webhook signature: HMAC-SHA256(rawBody, webhookSecret)
 * must equal the `X-Razorpay-Signature` header.
 */
const isValidWebhookSignature = (rawBuffer, signature, secret) => {
  if (!rawBuffer || !signature || !secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBuffer)
    .digest("hex");
  return safeCompare(expected, signature);
};

function safeCompare(expectedHex, actualHex) {
  if (typeof expectedHex !== "string" || typeof actualHex !== "string") return false;
  const expectedBuf = Buffer.from(expectedHex, "hex");
  const actualBuf = Buffer.from(actualHex, "hex");
  if (expectedBuf.length === 0 || actualBuf.length === 0) return false;
  if (expectedBuf.length !== actualBuf.length) return false;
  try {
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

module.exports = {
  isValidPaymentSignature,
  isValidWebhookSignature,
};
