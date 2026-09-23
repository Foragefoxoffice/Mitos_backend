const crypto = require("crypto");
const {
  isValidPaymentSignature,
  isValidWebhookSignature,
} = require("./razorpaySignature");

const SECRET = "test_secret";

describe("isValidPaymentSignature", () => {
  const orderId = "order_123";
  const paymentId = "pay_456";
  const validSignature = crypto
    .createHmac("sha256", SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  it("returns true for a valid signature", () => {
    expect(
      isValidPaymentSignature({ orderId, paymentId, signature: validSignature }, SECRET)
    ).toBe(true);
  });

  it("returns false for a tampered signature", () => {
    const tampered = validSignature.slice(0, -1) + (validSignature.slice(-1) === "a" ? "b" : "a");
    expect(
      isValidPaymentSignature({ orderId, paymentId, signature: tampered }, SECRET)
    ).toBe(false);
  });

  it("returns false when signature is missing", () => {
    expect(
      isValidPaymentSignature({ orderId, paymentId, signature: undefined }, SECRET)
    ).toBe(false);
  });

  it("returns false when secret is missing", () => {
    expect(
      isValidPaymentSignature({ orderId, paymentId, signature: validSignature }, undefined)
    ).toBe(false);
  });

  it("does not throw on a wrong-length signature", () => {
    expect(() =>
      isValidPaymentSignature({ orderId, paymentId, signature: "abcd" }, SECRET)
    ).not.toThrow();
    expect(
      isValidPaymentSignature({ orderId, paymentId, signature: "abcd" }, SECRET)
    ).toBe(false);
  });

  it("does not throw on a non-hex signature", () => {
    expect(() =>
      isValidPaymentSignature({ orderId, paymentId, signature: "not-hex-!!" }, SECRET)
    ).not.toThrow();
  });
});

describe("isValidWebhookSignature", () => {
  const rawBody = Buffer.from(JSON.stringify({ event: "payment.captured" }));
  const validSignature = crypto.createHmac("sha256", SECRET).update(rawBody).digest("hex");

  it("returns true for a valid webhook signature", () => {
    expect(isValidWebhookSignature(rawBody, validSignature, SECRET)).toBe(true);
  });

  it("returns false for a tampered body", () => {
    const tamperedBody = Buffer.from(JSON.stringify({ event: "payment.failed" }));
    expect(isValidWebhookSignature(tamperedBody, validSignature, SECRET)).toBe(false);
  });

  it("returns false when signature is missing", () => {
    expect(isValidWebhookSignature(rawBody, undefined, SECRET)).toBe(false);
  });

  it("returns false when secret is missing", () => {
    expect(isValidWebhookSignature(rawBody, validSignature, undefined)).toBe(false);
  });

  it("does not throw on a wrong-length signature", () => {
    expect(() => isValidWebhookSignature(rawBody, "abcd", SECRET)).not.toThrow();
  });
});
