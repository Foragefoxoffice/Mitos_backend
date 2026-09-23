const { CheckoutError } = require("./checkoutError");
const grants = require("./purchaseGrants");
const { notifyPurchaseActivated } = require("./purchaseNotification");

const MAX_ERROR_LEN = 1000;

/**
 * Finds the user this phone already belongs to, or creates a bare user
 * record for it (same shape as OTP login's own auto-create: phoneNumber,
 * role:'user', password:''). If an email is given and the user has none,
 * it's attached only when no other user already owns it — otherwise the
 * conflict is logged and the email is left off (never overwrites/merges).
 */
async function findOrCreateUserByPhone(db, phone, email) {
  let user = await db.user.findUnique({ where: { phoneNumber: phone } });
  if (!user) {
    user = await db.user.create({ data: { phoneNumber: phone, role: "user", password: "" } });
  }

  if (email && !user.email) {
    const owner = await db.user.findUnique({ where: { email } });
    if (owner) {
      console.warn(`[CHECKOUT] checkout_email_conflict email=${email} existingUserId=${owner.id} guestUserId=${user.id}`);
    } else {
      user = await db.user.update({ where: { id: user.id }, data: { email } });
    }
  }

  return user;
}

/**
 * Idempotently fulfils a checkout order: finds/creates the user, grants
 * every line item, records the one `payment` row, and marks the order
 * FULFILLED — all inside one transaction, guarded by an atomic
 * `updateMany({ fulfilledAt: null })` claim so a concurrent verify/webhook
 * call for the same order is a no-op (returns `alreadyFulfilled: true`).
 */
async function fulfillCheckoutOrder(db, razorpayOrderId, { by, paymentId } = {}) {
  const result = await db.$transaction(async (tx) => {
    const order = await tx.checkoutorder.findUnique({ where: { razorpayOrderId } });
    if (!order) throw new CheckoutError(404, "Order not found");

    const pid = paymentId || order.razorpayPaymentId;
    if (!pid) throw new CheckoutError(400, "Missing payment id");

    // Row-locking claim: a concurrent verify/webhook blocks here, then sees count 0.
    const claim = await tx.checkoutorder.updateMany({
      where: { id: order.id, fulfilledAt: null },
      data: { fulfilledAt: new Date(), fulfilledBy: by, status: "FULFILLED", razorpayPaymentId: pid },
    });
    if (claim.count === 0) return { alreadyFulfilled: true };

    const user = order.userId
      ? { id: order.userId }
      : await findOrCreateUserByPhone(tx, order.guestPhone, order.guestEmail);

    const items = Array.isArray(order.items) ? order.items : [];
    const grantedLines = [];
    let planLine = null;
    let packageLine = null;
    let bundleLine = null;

    for (const line of items) {
      if (line.type === "PLAN") {
        const premiumExpiry = await grants.grantPremium(tx, user.id, line.planCode);
        planLine = line;
        grantedLines.push({ ...line, expiresAt: premiumExpiry });
      } else if (line.type === "TS_PACKAGE") {
        await grants.grantPackage(tx, {
          userId: user.id,
          packageId: line.packageId,
          orderId: razorpayOrderId,
          paymentId: pid,
          amount: line.amount,
        });
        packageLine = line;
        grantedLines.push(line);
      } else if (line.type === "TS_BUNDLE") {
        await grants.grantBundle(tx, {
          userId: user.id,
          orderId: razorpayOrderId,
          paymentId: pid,
          amount: line.amount,
        });
        bundleLine = line;
        grantedLines.push(line);
      } else {
        grantedLines.push(line);
      }
    }

    const subscriptionType = planLine
      ? planLine.planCode
      : bundleLine
      ? "TEST_SERIES_BUNDLE"
      : packageLine
      ? packageLine.title
      : null;

    await grants.recordPayment(tx, {
      userId: user.id,
      amount: order.finalAmount,
      transactionId: pid,
      subscriptionType,
      couponId: order.couponId,
      discountAmount: order.discountAmount,
      originalAmount: order.originalAmount,
      neetPlanId: planLine ? planLine.planId : null,
      neetPlanPriceId: planLine ? planLine.priceId : null,
      platform: "WEB",
      description: order.source === "WEB_GUEST" ? "Web checkout (guest)" : "Web checkout",
    });

    const updated = await tx.checkoutorder.update({
      where: { id: order.id },
      data: { userId: user.id, items: grantedLines, lastError: null },
    });

    return { order: updated, alreadyFulfilled: false };
  }, { timeout: 15000 });

  if (result.alreadyFulfilled) {
    // Fresh read outside the tx snapshot — the row committed by whichever
    // call actually won the claim.
    result.order = await db.checkoutorder.findUnique({ where: { razorpayOrderId } });
  } else if (result.order && result.order.source === "WEB_GUEST") {
    // Guest purchases only (logged-in buyers already know their account).
    // Fire-and-forget: never let a notification failure affect the result.
    notifyPurchaseActivated(result.order.guestPhone);
  }

  return result;
}

/**
 * Marks an order PAID-but-not-fulfilled — used when payment verification
 * succeeded but the fulfilment transaction itself failed, so a retry
 * (webhook, admin) has something to act on.
 */
async function markOrderPaidUnfulfilled(db, razorpayOrderId, { paymentId, error } = {}) {
  const lastError = error ? String(error).slice(0, MAX_ERROR_LEN) : null;
  return db.checkoutorder.updateMany({
    where: { razorpayOrderId, fulfilledAt: null },
    data: { status: "PAID", razorpayPaymentId: paymentId, lastError },
  });
}

/**
 * Marks a still-PENDING order FAILED (payment never completed / expired).
 */
async function markOrderFailed(db, razorpayOrderId, reason) {
  return db.checkoutorder.updateMany({
    where: { razorpayOrderId, status: "PENDING" },
    data: { status: "FAILED", lastError: reason ? String(reason).slice(0, MAX_ERROR_LEN) : null },
  });
}

module.exports = {
  findOrCreateUserByPhone,
  fulfillCheckoutOrder,
  markOrderPaidUnfulfilled,
  markOrderFailed,
};
