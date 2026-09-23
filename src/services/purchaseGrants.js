const { CheckoutError } = require("./checkoutError");

/**
 * Helper to calculate expiry date based on plan code.
 * Moved verbatim from subscriptionController.js:15-34.
 * @param {string} planCode
 * @returns {Date|null}
 */
function getNeetExpiry(planCode) {
  if (!planCode) return null;
  const code = planCode.toUpperCase();

  // Monthly plan
  if (code.includes('MONTH')) {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date;
  }

  // Yearly plans (Fixed date: June 1st)
  if (code.includes('2025')) return new Date('2025-06-01T23:59:59Z');
  if (code.includes('2026')) return new Date('2026-06-01T23:59:59Z');
  if (code.includes('2027')) return new Date('2027-06-01T23:59:59Z');
  if (code.includes('2028')) return new Date('2028-06-01T23:59:59Z');

  return null;
}

/**
 * Helper to stack remaining trial days if user is currently in a trial.
 * Moved verbatim from subscriptionController.js:36-61, with `db` injected
 * in place of the module-level `prisma`.
 * @param {object} db
 * @param {number} userId
 * @param {Date} baseExpiry The new expiry date calculated for the purchased plan
 * @returns {Promise<Date>}
 */
async function calculateStackedExpiry(db, userId, baseExpiry) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { trialEndsAt: true, status: true }
    });

    const now = new Date();
    // Only stack if user is currently in an active trial
    if (user && user.trialEndsAt && user.trialEndsAt > now) {
      const remainingMs = user.trialEndsAt.getTime() - now.getTime();
      const stackedDate = new Date(baseExpiry.getTime() + remainingMs);
      console.log(`🎁 [STACK_EXPIRY] Adding ${Math.ceil(remainingMs / (1000 * 60 * 60 * 24))} trial days for user ${userId}.`);
      return stackedDate;
    }
  } catch (err) {
    console.error("❌ [STACK_EXPIRY] Error calculating stacked expiry:", err);
  }
  return baseExpiry;
}

/**
 * Grants NEET premium access for `planCode`, stacking any remaining trial
 * days and never shortening an existing premiumExpiry. Returns the new
 * premiumExpiry (or the kept existing one if it was later).
 */
async function grantPremium(db, userId, planCode) {
  const baseExpiry = getNeetExpiry(planCode);
  if (!baseExpiry) throw new CheckoutError(400, "Invalid plan");

  const stackedExpiry = await calculateStackedExpiry(db, userId, baseExpiry);

  const existing = await db.user.findUnique({
    where: { id: userId },
    select: { premiumExpiry: true },
  });

  const premiumExpiry =
    existing && existing.premiumExpiry && existing.premiumExpiry > stackedExpiry
      ? existing.premiumExpiry
      : stackedExpiry;

  await db.user.update({
    where: { id: userId },
    data: { status: "PREMIUM", premiumExpiry },
  });

  return premiumExpiry;
}

const buildShippingFields = (shippingDetails) =>
  shippingDetails
    ? {
        shippingName: shippingDetails.name ?? null,
        shippingPhone: shippingDetails.phone ?? null,
        shippingAddress: shippingDetails.address ?? null,
        shippingCity: shippingDetails.city ?? null,
        shippingPincode: shippingDetails.pincode ?? null,
      }
    : {};

/**
 * Same upsert as testSeriesPaymentController.verifyTSPayment, except the
 * update branch only sets `amount` when it's > 0 (so a repeat/duplicate
 * fulfilment call can't zero out a real purchase amount) and shipping
 * fields only when `shippingDetails` is given.
 */
async function grantPackage(db, { userId, packageId, orderId, paymentId, amount, purchaseType = "ETEST", shippingDetails = null }) {
  const shippingFields = buildShippingFields(shippingDetails);
  return db.testseriespurchase.upsert({
    where: { userId_packageId: { userId, packageId } },
    create: {
      userId,
      packageId,
      razorpayOrderId: orderId,
      paymentId,
      amount,
      purchaseType,
      ...shippingFields,
    },
    update: {
      paymentId,
      razorpayOrderId: orderId,
      purchaseType,
      ...(amount > 0 ? { amount } : {}),
      ...shippingFields,
    },
  });
}

/**
 * Same upsert as testSeriesPaymentController.verifyBundlePayment, with the
 * same amount/shipping update-branch rules as grantPackage.
 */
async function grantBundle(db, { userId, orderId, paymentId, amount, purchaseType = "ETEST", shippingDetails = null }) {
  const shippingFields = buildShippingFields(shippingDetails);
  return db.testseriesbundlepurchase.upsert({
    where: { userId },
    create: {
      userId,
      razorpayOrderId: orderId,
      paymentId,
      amount,
      purchaseType,
      ...shippingFields,
    },
    update: {
      paymentId,
      razorpayOrderId: orderId,
      purchaseType,
      ...(amount > 0 ? { amount } : {}),
      ...shippingFields,
    },
  });
}

/**
 * Records one `payment` row. Returns null (without incrementing the
 * coupon) on a duplicate transactionId (Prisma P2002) so callers can treat
 * it as "already recorded" the same way the old inline try/catches did.
 */
async function recordPayment(db, data) {
  let payment;
  try {
    payment = await db.payment.create({
      data: {
        currency: "INR",
        paymentMethod: "ONLINE",
        paymentStatus: "COMPLETED",
        paymentGateway: "Razorpay",
        updatedAt: new Date(),
        ...data,
      },
    });
  } catch (err) {
    if (err.code === "P2002") return null;
    throw err;
  }

  if (data.couponId) {
    await db.coupon.update({
      where: { id: data.couponId },
      data: { usedCount: { increment: 1 } },
    });
  }

  return payment;
}

module.exports = {
  getNeetExpiry,
  calculateStackedExpiry,
  grantPremium,
  grantPackage,
  grantBundle,
  recordPayment,
};
