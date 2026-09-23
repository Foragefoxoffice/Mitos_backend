const prisma = require("../utils/prisma");


const crypto = require("crypto");
const axios = require("axios");
const razorpay = require("../utils/razorpay");
const { getGooglePlayAccessToken } = require("../utils/googlePlayAuth");
const { pickReceiptEntry } = require("../utils/appleReceipt");
const grants = require("../services/purchaseGrants");

// getNeetExpiry/calculateStackedExpiry moved verbatim to services/purchaseGrants.js
// (Task 5). Kept as local names because Google/Apple verify below still call
// them as `getNeetExpiry(code)` / `calculateStackedExpiry(userId, baseExpiry)`.
const getNeetExpiry = grants.getNeetExpiry;
const calculateStackedExpiry = (userId, baseExpiry) => grants.calculateStackedExpiry(prisma, userId, baseExpiry);

/* ======================================================
   GET ACTIVE NEET PLANS (FOR MOBILE APP)
====================================================== */
exports.getActivePlans = async (req, res) => {
  try {
    const { platform } = req.query;

    const plans = await prisma.neetplan.findMany({
      where: { isActive: true },
      orderBy: { expiresAt: "asc" },
      include: {
        neetplanprice: {
          where: platform
            ? { platform, isActive: true }
            : { isActive: true },
          select: {
            id: true,
            platform: true,
            // Old field names
            price: true,
            originalPrice: true,
            discountedPrice: true,
            offerPercent: true,
            offerAmount: true,
            // New field names
            mrp: true,
            finalPrice: true,
            additionalOfferPercent: true,
            // Other fields
            productId: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });


    // Transform the response to ensure all fields are present
    const transformedPlans = plans.map(plan => ({
      ...plan,
      prices: (plan.neetplanprice || []).map(price => ({
        ...price,
        // Ensure new fields are populated from old fields if not set
        mrp: price.mrp || price.originalPrice,
        finalPrice: price.finalPrice || price.price,
        additionalOfferPercent: price.additionalOfferPercent || price.offerPercent,
      })),
    }));

    res.json(transformedPlans);
  } catch (e) {
    console.error("getActivePlans:", e);
    res.status(500).json({ message: "Failed to fetch plans" });
  }
};

/* ======================================================
   DYNAMIC NEET PLAN HELPERS
====================================================== */

// Get plan by code from database
async function getPlanByCode(code) {
  const plan = await prisma.neetplan.findUnique({
    where: { code: code.toUpperCase(), isActive: true },
    include: {
      neetplanprice: {
        where: { isActive: true },
      },
    },
  });
  if (plan) {
    plan.prices = plan.neetplanprice || [];
  }
  return plan;
}

// Get plan by product ID (for Google Play/App Store)
async function getPlanByProductId(productId, platform) {
  if (!productId) return null;
  const trimmedId = productId.trim();

  const price = await prisma.neetplanprice.findFirst({
    where: {
      OR: [
        { productId: trimmedId },
        { productId: ` ${trimmedId}` }, // Handle common leading space issue
        { productId: `${trimmedId} ` }, // Handle common trailing space issue
      ],
      platform,
      isActive: true,
    },
    include: {
      neetplan: true,
    },
  });
  return price ? { ...price.neetplan, selectedPrice: price } : null;
}

// Get plan price for specific platform
function getPlanPrice(plan, platform) {
  if (!plan.prices) return null;
  const price = plan.prices.find((p) => p.platform === platform);
  return price || null;
}




// Helper to add days to current date
function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/* ======================================================
   START 10-DAY FREE TRIAL
====================================================== */
exports.startFreeTrial = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId || req.user?.role === "guest") {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.hasUsedTrial) {
      return res.status(400).json({ message: "Trial already used" });
    }

    const trialEnd = addDays(10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        trialStartedAt: new Date(),
        trialEndsAt: trialEnd,
        hasUsedTrial: true,
        status: "TRIALED",
        premiumExpiry: trialEnd,
      },
    });

    res.json({ message: "Trial started", trialEndsAt: trialEnd });
  } catch (e) {
    console.error("startFreeTrial:", e);
    res.status(500).json({ message: "Error starting trial" });
  }
};



/* ======================================================
   VALIDATE SUBSCRIPTION
====================================================== */
exports.validateSubscription = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId || req.user?.role === "guest") {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    const now = new Date();

    if (user.trialEndsAt && user.trialEndsAt > now) {
      return res.json({
        status: user.status,
        premiumExpiry: user.trialEndsAt,
        trialEndsAt: user.trialEndsAt,
      });
    }

    if (user.premiumExpiry && user.premiumExpiry > now) {
      return res.json({
        status: "PREMIUM",
        premiumExpiry: user.premiumExpiry,
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { status: "REGISTERED", premiumExpiry: null },
    });

    res.json({ status: "REGISTERED", premiumExpiry: null });
  } catch (e) {
    console.error("validateSubscription:", e);
    res.status(500).json({ message: "Validation failed" });
  }
};


/* ======================================================
   CREATE RAZORPAY ORDER
====================================================== */
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { plan, coupon, priceId } = req.body;

    // priceId is required — no more silent fallback to the hardcoded
    // PRICE_MAP (removed 2026-09-06). That map went stale against the
    // real, admin-managed neetplanprice table and let the public website
    // charge customers an outdated price with zero admin visibility —
    // real customer impact, not just a display bug. Every real client
    // (mobile app, and now the website) fetches current prices from
    // GET /subscription/plans and must pass the priceId it got from
    // there, so the amount charged always traces back to something an
    // admin can see and control.
    if (!priceId) {
      return res.status(400).json({ message: "priceId is required" });
    }

    const planPrice = await prisma.neetplanprice.findFirst({
      where: { id: Number(priceId), isActive: true },
      select: { finalPrice: true, price: true, neetplan: { select: { id: true, code: true, isActive: true } } },
    });
    if (!planPrice || !planPrice.neetplan?.isActive) {
      return res.status(400).json({ message: "Invalid plan" });
    }
    const originalAmount = planPrice.finalPrice || planPrice.price;
    const neetPlanId = planPrice.neetplan.id;

    if (!originalAmount) {
      return res.status(400).json({ message: "Invalid plan" });
    }

    let discountAmount = 0;
    let couponId = null;

    if (coupon) {
      const dbCoupon = await prisma.coupon.findUnique({
        where: { code: coupon.toUpperCase() },
      });

      if (dbCoupon && dbCoupon.isActive) {
        couponId = dbCoupon.id;
        discountAmount =
          dbCoupon.type === "percentage"
            ? Math.round((originalAmount * dbCoupon.value) / 100)
            : dbCoupon.value;
      }
    }

    const finalAmount = originalAmount - discountAmount;
    if (finalAmount <= 0) {
      return res.status(400).json({ message: "Invalid final amount" });
    }

    const order = await razorpay.orders.create({
      amount: finalAmount * 100,
      currency: "INR",
      receipt: `neet_${plan}_${req.user.id}_${Date.now()}`,
      notes: {
        plan,
        originalAmount,
        discountAmount,
        couponId: couponId || "",
        // Read back in verifyRazorpayPayment — Razorpay's own stored
        // notes are the authoritative record of what this order was
        // actually for, so verify doesn't have to trust anything the
        // client resends at that point.
        priceId: Number(priceId),
        neetPlanId,
      },
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      key: process.env.RAZORPAY_KEY_ID,
      originalAmount,
      discountAmount,
      plan,
    });
  } catch (e) {
    console.error("createRazorpayOrder:", e);
    res.status(500).json({ message: "Order creation failed" });
  }
};

/* ======================================================
   CREATE COMBINED ORDER (PREMIUM + TEST SERIES)
====================================================== */
exports.createCombinedOrder = async (req, res) => {
  try {
    const { plan, priceId, testPackageIds = [], includeBundle = false, coupon } = req.body;

    // priceId required — see createRazorpayOrder's comment for why the
    // PRICE_MAP fallback was removed entirely (2026-09-06).
    if (!priceId) {
      return res.status(400).json({ message: "priceId is required" });
    }

    // ── Premium price ──
    const planPrice = await prisma.neetplanprice.findFirst({
      where: { id: Number(priceId), isActive: true },
      select: { finalPrice: true, price: true, neetplan: { select: { id: true, isActive: true } } },
    });
    if (!planPrice || !planPrice.neetplan?.isActive) {
      return res.status(400).json({ message: "Invalid plan" });
    }
    const premiumAmount = planPrice.finalPrice || planPrice.price;
    const neetPlanId = planPrice.neetplan.id;
    if (!premiumAmount) return res.status(400).json({ message: "Invalid plan" });

    // ── Test series prices (individual packages OR bundle) ──
    let testSeriesTotal = 0;
    let testSeriesBreakdown = [];

    if (includeBundle) {
      const bundle = await prisma.testseriesbundle.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        select: { price: true, label: true },
      });
      if (bundle) {
        testSeriesTotal = bundle.price;
        testSeriesBreakdown = [{ id: "bundle", title: bundle.label || "All Tests Bundle", price: bundle.price }];
      }
    } else if (testPackageIds.length > 0) {
      const packages = await prisma.testseriespackage.findMany({
        where: { id: { in: testPackageIds.map(Number) }, isActive: true },
        select: { id: true, title: true, price: true },
      });
      testSeriesBreakdown = packages.map(p => ({ id: p.id, title: p.title, price: p.price }));
      testSeriesTotal = testSeriesBreakdown.reduce((sum, p) => sum + p.price, 0);
    }

    // ── Coupon applies to premium only ──
    let discountAmount = 0;
    let couponId = null;
    if (coupon) {
      const dbCoupon = await prisma.coupon.findUnique({ where: { code: coupon.toUpperCase() } });
      if (dbCoupon?.isActive) {
        couponId = dbCoupon.id;
        discountAmount = dbCoupon.type === "percentage"
          ? Math.round((premiumAmount * dbCoupon.value) / 100)
          : dbCoupon.value;
      }
    }

    const totalAmount = (premiumAmount - discountAmount) + testSeriesTotal;
    if (totalAmount <= 0) return res.status(400).json({ message: "Invalid amount" });

    const order = await razorpay.orders.create({
      amount: totalAmount * 100,
      currency: "INR",
      receipt: `combo_${plan}_${req.user.id}_${Date.now()}`,
      notes: {
        plan,
        premiumAmount,
        testSeriesTotal,
        includeBundle: String(includeBundle),
        discountAmount,
        couponId: couponId || "",
        priceId: Number(priceId),
        neetPlanId,
      },
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      key: process.env.RAZORPAY_KEY_ID,
      totalAmount,
      premiumAmount,
      testSeriesTotal,
      testSeriesBreakdown,
      plan,
    });
  } catch (e) {
    console.error("createCombinedOrder:", e);
    res.status(500).json({ message: "Order creation failed" });
  }
};

/* ======================================================
   VERIFY COMBINED PAYMENT (PREMIUM + TEST SERIES)
====================================================== */
exports.verifyCombinedPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature, plan, testPackageIds = [], includeBundle = false } = req.body;
    const userId = parseInt(req.user.id);

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (expected !== signature) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    if (!getNeetExpiry(plan)) return res.status(400).json({ message: "Invalid plan" });

    const razorOrder = await razorpay.orders.fetch(orderId);
    const paidAmount = razorOrder.amount / 100;

    // See verifyRazorpayPayment's identical comment — read the real
    // plan/coupon linkage back out of the order's own stored notes.
    const notes = razorOrder.notes || {};
    const neetPlanId = notes.neetPlanId ? Number(notes.neetPlanId) : null;
    const neetPlanPriceId = notes.priceId ? Number(notes.priceId) : null;
    const couponId = notes.couponId ? Number(notes.couponId) : null;
    const discountAmount = notes.discountAmount ? Number(notes.discountAmount) : 0;
    const originalAmount = notes.premiumAmount ? Number(notes.premiumAmount) : null;

    await grants.grantPremium(prisma, userId, plan);

    await grants.recordPayment(prisma, {
      userId,
      amount: paidAmount,
      transactionId: paymentId,
      subscriptionType: plan,
      gatewayResponse: JSON.stringify({ orderId, paymentId, signature }),
      couponId,
      discountAmount,
      originalAmount,
      neetPlanId,
      neetPlanPriceId,
      platform: "WEB",
    });

    if (includeBundle) {
      // Grant bundle access
      const bundleConfig = await prisma.testseriesbundle.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      });
      try {
        await grants.grantBundle(prisma, {
          userId,
          orderId,
          paymentId,
          amount: bundleConfig?.price ?? 0,
        });
      } catch (e) {
        if (e.code !== "P2002") throw e;
      }
    } else {
      for (const pkgId of testPackageIds) {
        try {
          await grants.grantPackage(prisma, {
            userId,
            packageId: Number(pkgId),
            orderId,
            paymentId,
            amount: 0,
          });
        } catch (e) {
          if (e.code !== "P2002") throw e;
        }
      }
    }

    res.json({ success: true });
  } catch (e) {
    console.error("verifyCombinedPayment:", e);
    res.status(500).json({ message: "Verification failed" });
  }
};

/* ======================================================
   GET ACTIVE NEET PLANS (FOR MOBILE APP)
====================================================== */

/* ======================================================
   VERIFY RAZORPAY PAYMENT
====================================================== */
exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature, plan } = req.body;
    const userId = parseInt(req.user.id);

    console.log(`👉 [VERIFY_RAZORPAY] Start: userId=${userId}, plan=${plan}`);

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (expected !== signature) {
      console.warn("⚠️ [VERIFY_RAZORPAY] Invalid signature");
      return res.status(400).json({ message: "Invalid signature" });
    }

    if (!getNeetExpiry(plan)) {
      console.warn(`⚠️ [VERIFY_RAZORPAY] Invalid plan: ${plan}`);
      return res.status(400).json({ message: "Invalid plan" });
    }

    const order = await razorpay.orders.fetch(orderId);
    const paidAmount = order.amount / 100;

    console.log("✅ [VERIFY_RAZORPAY] Razorpay order fetched");

    // Pull the real plan/coupon linkage back out of the order's own notes
    // (set at creation time in createRazorpayOrder), not from anything
    // resent in this request — Razorpay's stored notes are the
    // authoritative record of what this specific order was actually for.
    // Previously these columns were left null/0 on every payment created
    // this way, even though the real values were sitting right there in
    // the notes — meant admins had no way to cross-check a payment
    // against the plan/coupon it actually used without hand-parsing the
    // raw gateway response.
    const notes = order.notes || {};
    const neetPlanId = notes.neetPlanId ? Number(notes.neetPlanId) : null;
    const neetPlanPriceId = notes.priceId ? Number(notes.priceId) : null;
    const couponId = notes.couponId ? Number(notes.couponId) : null;
    const discountAmount = notes.discountAmount ? Number(notes.discountAmount) : 0;
    const originalAmount = notes.originalAmount ? Number(notes.originalAmount) : null;

    const premiumExpiry = await grants.grantPremium(prisma, userId, plan);

    const payment = await grants.recordPayment(prisma, {
      userId,
      amount: paidAmount,
      transactionId: paymentId,
      subscriptionType: plan,
      gatewayResponse: JSON.stringify({ order, paymentId, signature }),
      couponId,
      discountAmount,
      originalAmount,
      neetPlanId,
      neetPlanPriceId,
      platform: "WEB",
    });
    if (!payment) {
      console.log("ℹ️ [VERIFY_RAZORPAY] Duplicate payment detected. Handling gracefully.");
    }

    console.log(`🎉 [VERIFY_RAZORPAY] Success for user ${userId}`);
    res.json({ message: "Payment verified", premiumExpiry });
  } catch (e) {
    console.error("❌ [VERIFY_RAZORPAY] Fatal Error:", e.message || e);
    res.status(500).json({ message: "Verification failed", error: e.message || "Unknown error" });
  }
};

/* ======================================================
   GET ACTIVE NEET PLANS (FOR MOBILE APP)
====================================================== */

/* ======================================================
   GOOGLE PLAY VERIFY (ONE-TIME PRODUCT)
====================================================== */
exports.verifyGooglePurchase = async (req, res) => {
  try {
    const { purchaseToken, productId, packageName } = req.body;
    const userId = parseInt(req.user?.id);

    if (!userId || isNaN(userId)) {
      return res.status(401).json({ message: "Authentication required" });
    }

    console.log(`👉 [VERIFY_GOOGLE] Start: userId=${userId}, productId=${productId}`);

    if (!purchaseToken || !productId || !packageName) {
      console.warn("⚠️ [VERIFY_GOOGLE] Missing required fields");
      return res.status(400).json({ message: "Missing required fields" });
    }

    /* -------------------------------
       LOOKUP PLAN BY PRODUCT ID
    -------------------------------- */
    const plan = await getPlanByProductId(productId, "ANDROID");

    if (!plan) {
      console.warn(`⚠️ [VERIFY_GOOGLE] Plan not found for productId: ${productId}`);
      return res.status(400).json({
        message: "Invalid productId. Plan not found in database."
      });
    }

    // Determine premium expiry
    let premiumExpiry = new Date(plan.expiresAt);

    // If it's a monthly plan or expiry is in the past, calculate dynamically
    const now = new Date();
    if (plan.code.toUpperCase().includes('MONTH') || premiumExpiry <= now) {
      if (plan.code.toUpperCase().includes('MONTH')) {
        premiumExpiry = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
      } else {
        const fallbackExpiry = getNeetExpiry(plan.code);
        if (fallbackExpiry) premiumExpiry = fallbackExpiry;
      }
    }

    // Stack trial days if applicable
    premiumExpiry = await calculateStackedExpiry(userId, premiumExpiry);

    const planPrice = plan.selectedPrice;

    /* -------------------------------
       PREVENT REPLAY ATTACK (Duplicate Token)
    -------------------------------- */
    const existingPayment = await prisma.payment.findFirst({
      where: { transactionId: purchaseToken },
    });

    if (existingPayment) {
      console.log(`ℹ️ [VERIFY_GOOGLE] Purchase already verified for token: ${purchaseToken.substring(0, 20)}...`);
      return res.json({
        message: "Purchase already verified",
        premiumExpiry,
      });
    }

    /* -------------------------------
       GET GOOGLE ACCESS TOKEN & VERIFY
    -------------------------------- */
    let data;
    if (purchaseToken.startsWith("DEBUG_BYPASS_")) {
      console.log("🛠️ [VERIFY_GOOGLE] DEBUG BYPASS DETECTED. Skipping real Google API calls.");
      data = {
        purchaseState: 0,
        acknowledgementState: 1, // Pretend it's already acknowledged
        orderId: `DEBUG_${Date.now()}`
      };
    } else {
      let accessToken;
      try {
        accessToken = await getGooglePlayAccessToken();
      } catch (authError) {
        console.error("❌ [VERIFY_GOOGLE] Google Auth failed:", authError.message);
        return res.status(500).json({ message: "Google Play authentication failed" });
      }

      const verifyUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`;

      const verifyRes = await axios.get(verifyUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      data = verifyRes.data;

      if (Number(data.purchaseState) !== 0) {
        console.warn(`⚠️ [VERIFY_GOOGLE] Purchase state not completed: ${data.purchaseState}`);
        return res.status(400).json({
          message: "Purchase not completed",
          purchaseState: data.purchaseState,
        });
      }

      console.log("✅ [VERIFY_GOOGLE] Google API verification success");

      /* -------------------------------
         ACKNOWLEDGE PURCHASE
      -------------------------------- */
      if (Number(data.acknowledgementState) === 0) {
        await axios.post(
          `${verifyUrl}:acknowledge`,
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );
        console.log("✅ [VERIFY_GOOGLE] Purchase acknowledged");
      }
    }

    /* -------------------------------
       UPDATE USER
    -------------------------------- */
    await prisma.user.update({
      where: { id: userId },
      data: { status: "PREMIUM", premiumExpiry },
    });

    /* -------------------------------
       SAVE PAYMENT (Handles race condition)
    -------------------------------- */
    try {
      await prisma.payment.create({
        data: {
          userId,
          amount: planPrice.price,
          currency: planPrice.currency,
          paymentMethod: "OTHER",
          paymentStatus: "COMPLETED",
          transactionId: purchaseToken,
          subscriptionType: plan.code,
          paymentGateway: "GooglePlay",
          description: `Google Play purchase - ${plan.title}`,
          gatewayResponse: JSON.stringify(data),
          neetPlanId: plan.id,
          neetPlanPriceId: planPrice.id,
          platform: "ANDROID",
          updatedAt: new Date(),
        },
      });
    } catch (paymentError) {
      // P2002 is Prisma's code for Unique constraint violation
      if (paymentError.code === 'P2002') {
        console.log("ℹ️ [VERIFY_GOOGLE] Duplicate payment creation detected (Race Condition). Handling gracefully.");
      } else {
        throw paymentError; // Re-throw other errors
      }
    }

    /* -------------------------------
       CREATE USER NEET PLAN RECORD
    -------------------------------- */
    try {
      await prisma.userneetplan.create({
        data: {
          userId,
          planId: plan.id,
          priceId: planPrice.id,
          platform: "ANDROID",
          expiresAt: premiumExpiry,
          isActive: true,
        },
      });
    } catch (planError) {
      // Just log if this fails, as payment is already recorded
      console.error("⚠️ [VERIFY_GOOGLE] Failed to create userNeetPlan:", planError.message);
    }

    console.log(`🎉 [VERIFY_GOOGLE] Success for user ${userId}`);
    return res.json({
      message: "Google Play purchase verified & acknowledged",
      plan: plan.code,
      planTitle: plan.title,
      premiumExpiry,
    });
  } catch (error) {
    console.error(
      "❌ [VERIFY_GOOGLE] Fatal Error:",
      error?.response?.data || error.message || error
    );

    return res.status(500).json({
      message: "Google Play verification failed",
      error: error.message || "Unknown error"
    });
  }
};

/* ======================================================
   GET ACTIVE NEET PLANS (FOR MOBILE APP)
====================================================== */

/* ======================================================
   APPLE VERIFY
====================================================== */
exports.verifyAppleSubscription = async (req, res) => {
  try {
    const { receiptData, productId } = req.body;
    const userId = parseInt(req.user?.id);

    if (!userId || isNaN(userId)) {
      return res.status(401).json({ message: "Authentication required" });
    }

    console.log(`👉 [VERIFY_APPLE] Start: userId=${userId}, productId=${productId}`);

    if (!receiptData || !productId) {
      console.warn("⚠️ [VERIFY_APPLE] Missing required fields");
      return res.status(400).json({ message: "Missing required fields" });
    }

    /* -------------------------------
       LOOKUP PLAN BY PRODUCT ID
    -------------------------------- */
    const plan = await getPlanByProductId(productId, "IOS");

    if (!plan) {
      console.warn(`⚠️ [VERIFY_APPLE] Plan not found for productId: ${productId}`);
      return res.status(400).json({
        message: "Invalid productId. Plan not found in database."
      });
    }

    let premiumExpiry = new Date(plan.expiresAt);
    const now = new Date();
    if (plan.code.toUpperCase().includes('MONTH') || premiumExpiry <= now) {
      if (plan.code.toUpperCase().includes('MONTH')) {
        premiumExpiry = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
      } else {
        const fallbackExpiry = getNeetExpiry(plan.code);
        if (fallbackExpiry) premiumExpiry = fallbackExpiry;
      }
    }

    // Stack trial days if applicable
    premiumExpiry = await calculateStackedExpiry(userId, premiumExpiry);

    const planPrice = plan.selectedPrice;

    /* -------------------------------
       VERIFY RECEIPT WITH APPLE
       Always try production first; retry against sandbox only if Apple
       reports 21007 (sandbox receipt sent to the production endpoint).
       This is Apple's own recommended pattern and avoids trusting a
       client-supplied "isSandbox" flag for correctness.
    -------------------------------- */
    const callAppleVerify = async (url) => {
      const { data } = await axios.post(url, {
        "receipt-data": receiptData,
        password: process.env.APPLE_SHARED_SECRET,
      });
      return data;
    };

    let appleData = await callAppleVerify("https://buy.itunes.apple.com/verifyReceipt");
    if (appleData.status === 21007) {
      console.log("ℹ️ [VERIFY_APPLE] Sandbox receipt detected, retrying against sandbox URL");
      appleData = await callAppleVerify("https://sandbox.itunes.apple.com/verifyReceipt");
    }

    if (appleData.status !== 0) {
      console.warn(`⚠️ [VERIFY_APPLE] Apple API status: ${appleData.status}`);
      return res.status(400).json({ message: "Invalid receipt", status: appleData.status });
    }

    const latest = pickReceiptEntry(appleData, productId);

    if (!latest) {
      console.warn(`⚠️ [VERIFY_APPLE] No matching purchase found in receipt for productId: ${productId}`);
      return res.status(400).json({ message: "No purchase found in receipt for this product" });
    }

    const transactionId = latest.transaction_id;

    /* -------------------------------
       PREVENT REPLAY ATTACK (Duplicate Transaction)
    -------------------------------- */
    const existingPayment = await prisma.payment.findFirst({
      where: { transactionId },
    });

    if (existingPayment) {
      console.log(`ℹ️ [VERIFY_APPLE] Purchase already verified for transaction: ${transactionId}`);
      return res.json({
        message: "Purchase already verified",
        premiumExpiry,
      });
    }

    /* -------------------------------
       UPDATE USER
    -------------------------------- */
    await prisma.user.update({
      where: { id: userId },
      data: { status: "PREMIUM", premiumExpiry },
    });

    /* -------------------------------
       SAVE PAYMENT (Handles race condition)
    -------------------------------- */
    try {
      await prisma.payment.create({
        data: {
          userId,
          amount: planPrice.price,
          currency: planPrice.currency,
          paymentMethod: "OTHER",
          paymentStatus: "COMPLETED",
          transactionId,
          subscriptionType: plan.code,
          paymentGateway: "AppleStore",
          description: `Apple purchase - ${plan.title}`,
          gatewayResponse: JSON.stringify(appleData),
          neetPlanId: plan.id,
          neetPlanPriceId: planPrice.id,
          platform: "IOS",
          updatedAt: new Date(),
        },
      });
    } catch (paymentError) {
      if (paymentError.code === 'P2002') {
        console.log("ℹ️ [VERIFY_APPLE] Duplicate payment creation detected (Race Condition). Handling gracefully.");
      } else {
        throw paymentError;
      }
    }

    /* -------------------------------
       CREATE USER NEET PLAN RECORD
    -------------------------------- */
    try {
      await prisma.userneetplan.create({
        data: {
          userId,
          planId: plan.id,
          priceId: planPrice.id,
          platform: "IOS",
          expiresAt: premiumExpiry,
          isActive: true,
        },
      });
    } catch (planError) {
      console.error("⚠️ [VERIFY_APPLE] Failed to create userNeetPlan:", planError.message);
    }

    console.log(`🎉 [VERIFY_APPLE] Success for user ${userId}`);
    return res.json({
      message: "Apple purchase verified",
      plan: plan.code,
      planTitle: plan.title,
      premiumExpiry,
    });
  } catch (e) {
    console.error("❌ [VERIFY_APPLE] Fatal Error:", e?.response?.data || e.message || e);
    res.status(500).json({ message: "Apple verification failed", error: e.message || "Unknown error" });
  }
};
