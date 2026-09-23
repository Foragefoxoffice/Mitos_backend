const { CheckoutError } = require("./checkoutError");
const { maskPhone } = require("../utils/checkoutPhone");

const toPositiveInt = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Validate and normalize the raw cart payload from the public checkout API
 * into a small, well-shaped list of intents. Does NOT touch the DB — pure
 * validation of shape/cardinality only (see checkoutCatalog.resolveCartLines
 * for turning these into priced lines).
 *
 * Public cart = at most 1 NEET plan + (at most 1 test-series package OR the
 * bundle). If the bundle is present, any package item is dropped.
 */
const parseCartItems = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new CheckoutError(400, "Cart is empty");
  }

  let plan = null;
  let pkg = null;
  let hasBundle = false;

  for (const rawItem of raw) {
    if (!rawItem || typeof rawItem !== "object" || typeof rawItem.type !== "string") {
      throw new CheckoutError(400, "Invalid cart item");
    }

    if (rawItem.type === "PLAN") {
      const priceId = toPositiveInt(rawItem.priceId);
      if (priceId == null) throw new CheckoutError(400, "Invalid cart item");
      if (plan && plan.priceId !== priceId) {
        throw new CheckoutError(400, "Cart can only contain one plan");
      }
      plan = { type: "PLAN", priceId };
    } else if (rawItem.type === "TS_PACKAGE") {
      const packageId = toPositiveInt(rawItem.packageId);
      if (packageId == null) throw new CheckoutError(400, "Invalid cart item");
      if (pkg) {
        throw new CheckoutError(400, "Cart can only contain one test-series package");
      }
      pkg = { type: "TS_PACKAGE", packageId };
    } else if (rawItem.type === "TS_BUNDLE") {
      hasBundle = true;
    } else {
      throw new CheckoutError(400, "Invalid cart item");
    }
  }

  const items = [];
  if (plan) items.push(plan);
  if (hasBundle) {
    items.push({ type: "TS_BUNDLE" });
  } else if (pkg) {
    items.push(pkg);
  }
  return items;
};

/**
 * Same rules as couponController.validateCoupon, extracted so both the
 * logged-in and guest checkout paths use one source of truth.
 */
const evaluateCoupon = (coupon, { now = new Date(), usedByUser = 0 } = {}) => {
  if (!coupon || !coupon.isActive) {
    return { ok: false, message: "Invalid coupon code" };
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    return { ok: false, message: "Coupon expired" };
  }
  if (coupon.maxUsage && coupon.usedCount >= coupon.maxUsage) {
    return { ok: false, message: "Coupon usage limit reached" };
  }
  if (coupon.maxPerUser && usedByUser >= coupon.maxPerUser) {
    return { ok: false, message: "Coupon already used" };
  }
  return { ok: true };
};

const computeDiscount = (coupon, amount) => {
  let discount = coupon.type === "percentage"
    ? Math.round((amount * coupon.value) / 100)
    : coupon.value;
  if (discount > amount) discount = amount;
  if (discount < 0) discount = 0;
  return discount;
};

/**
 * Coupons apply to the PLAN line only (same as createCombinedOrder).
 */
const buildQuote = (lines, coupon) => {
  const originalAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  const planLine = lines.find((line) => line.type === "PLAN");
  const discountAmount = coupon && planLine ? computeDiscount(coupon, planLine.amount) : 0;
  const finalAmount = originalAmount - discountAmount;
  return { originalAmount, discountAmount, finalAmount };
};

/**
 * Public-safe receipt view of a checkout order. Never includes userId, the
 * full phone number, or the email address.
 */
const buildReceipt = (order) => {
  const items = (order.items || []).map((item) => {
    const out = { type: item.type, title: item.title };
    if (item.expiresAt) out.expiresAt = item.expiresAt;
    return out;
  });
  return {
    orderId: order.razorpayOrderId,
    state: order.status,
    items,
    originalAmount: order.originalAmount,
    discountAmount: order.discountAmount,
    amountPaid: order.finalAmount,
    maskedPhone: maskPhone(order.guestPhone),
    emailProvided: !!order.guestEmail,
  };
};

module.exports = {
  parseCartItems,
  evaluateCoupon,
  computeDiscount,
  buildQuote,
  buildReceipt,
};
