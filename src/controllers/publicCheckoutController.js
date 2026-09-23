const prisma = require("../utils/prisma");
const razorpay = require("../utils/razorpay");
const { CheckoutError } = require("../services/checkoutError");
const {
  normalizeCheckoutPhone,
  normalizeCheckoutEmail,
} = require("../utils/checkoutPhone");
const { isValidPaymentSignature } = require("../utils/razorpaySignature");
const {
  parseCartItems,
  evaluateCoupon,
  buildQuote,
  buildReceipt,
} = require("../services/checkoutPricing");
const {
  loadCatalog,
  loadPackageDetail,
  resolveCartLines,
} = require("../services/checkoutCatalog");
const {
  fulfillCheckoutOrder,
  markOrderPaidUnfulfilled,
} = require("../services/purchaseFulfillment");

const respondError = (res, err, fallbackMessage) => {
  if (err instanceof CheckoutError) {
    return res.status(err.status).json({ message: err.message });
  }
  console.error("[CHECKOUT]", fallbackMessage, err);
  return res.status(500).json({ message: fallbackMessage });
};

// Looks up the coupon's per-user usage against whichever account this
// checkout resolves to: the logged-in account if there is one, else the
// pre-existing user (if any) that owns the given phone. A brand-new guest
// phone has no payment history, so usedByUser is 0 for them.
const usedByUserFor = async (couponId, account, phone) => {
  if (account) {
    return prisma.payment.count({ where: { userId: account.id, couponId } });
  }
  const existingUser = await prisma.user.findUnique({ where: { phoneNumber: phone } });
  if (!existingUser) return 0;
  return prisma.payment.count({ where: { userId: existingUser.id, couponId } });
};

/* GET /api/public/checkout/catalog */
exports.getCatalog = async (req, res) => {
  try {
    const catalog = await loadCatalog(prisma);
    res.set("Cache-Control", "public, max-age=60");
    res.json(catalog);
  } catch (err) {
    respondError(res, err, "Failed to load catalog");
  }
};

/* GET /api/public/checkout/catalog/packages/:id */
exports.getPackageDetail = async (req, res) => {
  try {
    const pkg = await loadPackageDetail(prisma, req.params.id);
    res.json(pkg);
  } catch (err) {
    respondError(res, err, "Failed to load package");
  }
};

/* POST /api/public/checkout/coupon/validate */
exports.validateCoupon = async (req, res) => {
  try {
    // Spec contract is `code`; `coupon` accepted too (same name /order uses).
    const { items, phone } = req.body;
    const coupon = req.body.code ?? req.body.coupon;
    if (!coupon) throw new CheckoutError(400, "Coupon code is required");

    const parsedItems = parseCartItems(items);
    const lines = await resolveCartLines(prisma, parsedItems);
    if (!lines.some((line) => line.type === "PLAN")) {
      throw new CheckoutError(400, "Coupons apply to NEET plans only");
    }

    const account = req.checkoutUserId
      ? await prisma.user.findUnique({ where: { id: req.checkoutUserId } })
      : null;
    const normalizedPhone = normalizeCheckoutPhone(account?.phoneNumber) || normalizeCheckoutPhone(phone);

    const dbCoupon = await prisma.coupon.findUnique({ where: { code: String(coupon).toUpperCase() } });
    const usedByUser = dbCoupon ? await usedByUserFor(dbCoupon.id, account, normalizedPhone) : 0;

    const evaluation = evaluateCoupon(dbCoupon, { usedByUser });
    if (!evaluation.ok) throw new CheckoutError(400, evaluation.message);

    const quote = buildQuote(lines, dbCoupon);
    res.json({ valid: true, code: dbCoupon.code, ...quote });
  } catch (err) {
    respondError(res, err, "Coupon validation failed");
  }
};

/* POST /api/public/checkout/order */
exports.createOrder = async (req, res) => {
  try {
    const parsedItems = parseCartItems(req.body.items);

    const account = req.checkoutUserId
      ? await prisma.user.findUnique({ where: { id: req.checkoutUserId } })
      : null;

    const phone = normalizeCheckoutPhone(account?.phoneNumber) || normalizeCheckoutPhone(req.body.phone);
    if (!phone) throw new CheckoutError(400, "Enter a valid 10-digit WhatsApp number");

    const email = normalizeCheckoutEmail(account?.email) || normalizeCheckoutEmail(req.body.email);

    const lines = await resolveCartLines(prisma, parsedItems);

    const { coupon } = req.body;
    let dbCoupon = null;
    if (coupon) {
      if (!lines.some((line) => line.type === "PLAN")) {
        throw new CheckoutError(400, "Coupons apply to NEET plans only");
      }
      dbCoupon = await prisma.coupon.findUnique({ where: { code: String(coupon).toUpperCase() } });
      const usedByUser = dbCoupon ? await usedByUserFor(dbCoupon.id, account, phone) : 0;
      const evaluation = evaluateCoupon(dbCoupon, { usedByUser });
      if (!evaluation.ok) throw new CheckoutError(400, evaluation.message);
    }

    const quote = buildQuote(lines, dbCoupon);
    if (quote.finalAmount <= 0) throw new CheckoutError(400, "Invalid final amount");

    const source = account ? "WEB_AUTH" : "WEB_GUEST";

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(quote.finalAmount * 100),
      currency: "INR",
      receipt: `web_${Date.now()}`,
      notes: { checkout: "public", source },
    });

    const order = await prisma.checkoutorder.create({
      data: {
        razorpayOrderId: razorpayOrder.id,
        source,
        userId: account ? account.id : null,
        guestPhone: phone,
        guestEmail: email,
        items: lines,
        originalAmount: quote.originalAmount,
        discountAmount: quote.discountAmount,
        finalAmount: quote.finalAmount,
        couponId: dbCoupon ? dbCoupon.id : null,
      },
    });

    res.json({
      orderId: order.razorpayOrderId,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID,
      prefill: { contact: phone, email },
      ...quote,
    });
  } catch (err) {
    respondError(res, err, "Order creation failed");
  }
};

/* POST /api/public/checkout/verify */
exports.verifyPayment = async (req, res) => {
  const { orderId, paymentId, signature } = req.body;
  try {
    if (!isValidPaymentSignature({ orderId, paymentId, signature }, process.env.RAZORPAY_KEY_SECRET)) {
      throw new CheckoutError(400, "Invalid signature");
    }

    let result;
    try {
      result = await fulfillCheckoutOrder(prisma, orderId, { by: "VERIFY", paymentId });
    } catch (err) {
      if (err instanceof CheckoutError && err.status === 404) throw err;
      await markOrderPaidUnfulfilled(prisma, orderId, {
        paymentId,
        error: err.message || String(err),
      });
      console.error("[CHECKOUT] verify fulfilment error:", err);
      return res.status(202).json({ orderId, state: "PAID" });
    }

    // fulfillCheckoutOrder itself fires notifyPurchaseActivated for a
    // newly-fulfilled order (see services/purchaseFulfillment.js) — no
    // separate notify call needed here.
    res.json(buildReceipt(result.order));
  } catch (err) {
    respondError(res, err, "Verification failed");
  }
};

/* GET /api/public/checkout/status/:orderId */
exports.getOrderStatus = async (req, res) => {
  try {
    const order = await prisma.checkoutorder.findUnique({
      where: { razorpayOrderId: req.params.orderId },
    });
    if (!order) throw new CheckoutError(404, "Order not found");
    res.json(buildReceipt(order));
  } catch (err) {
    respondError(res, err, "Failed to fetch order status");
  }
};

/* GET /api/payments/checkout-orders?status=PAID (admin) */
exports.adminListCheckoutOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const orders = await prisma.checkoutorder.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(orders);
  } catch (err) {
    respondError(res, err, "Failed to fetch checkout orders");
  }
};

/* POST /api/payments/checkout-orders/:orderId/fulfil (admin) */
exports.adminFulfilCheckoutOrder = async (req, res) => {
  try {
    const result = await fulfillCheckoutOrder(prisma, req.params.orderId, { by: "ADMIN" });
    res.json(result);
  } catch (err) {
    respondError(res, err, "Fulfilment failed");
  }
};
