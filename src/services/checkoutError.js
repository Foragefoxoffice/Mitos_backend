/**
 * Error type for the public/guest checkout flow. Controllers translate this
 * into `res.status(status).json({ message })`; services throw it for every
 * expected 4xx condition (bad cart shape, unavailable plan/package, invalid
 * coupon, missing order, etc).
 */
class CheckoutError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "CheckoutError";
    this.status = status;
  }
}

module.exports = { CheckoutError };
