const prisma = require("../utils/prisma");
const Razorpay = require("razorpay");
const crypto = require("crypto");



const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─── Create Razorpay Order ────────────────────────────────────────────────────
exports.createTSOrder = async (req, res) => {
  const userId = req.user.id;
  const { packageId, purchaseType = "ETEST" } = req.body;

  if (!["ETEST", "PHYSICAL"].includes(purchaseType)) {
    return res.status(400).json({ message: "Invalid purchaseType" });
  }

  try {

    const pkg = await prisma.testseriespackage.findUnique({
      where: { id: Number(packageId) },
    });

    if (!pkg || !pkg.isActive) {
      return res.status(404).json({ message: "Package not found" });
    }

    const price = purchaseType === "PHYSICAL" ? pkg.physicalPrice : pkg.price;
    if (!price || price === 0) {
      return res.status(400).json({ message: "This package is free" });
    }

    // Check if already purchased (block if same or better type already owned)
    const existing = await prisma.testseriespurchase.findUnique({
      where: { userId_packageId: { userId, packageId: Number(packageId) } },
    });
    if (existing) {
      if (purchaseType === "ETEST") {
        return res.status(400).json({ message: "Online Test series already purchased" });
      }
      if (purchaseType === "PHYSICAL" && existing.purchaseType === "PHYSICAL") {
        return res.status(400).json({ message: "Physical series already purchased" });
      }
    }

    const order = await razorpay.orders.create({
      amount: price * 100,
      currency: "INR",
      receipt: `ts_pkg_${packageId}_${purchaseType}_${Date.now()}`,
      notes: { packageId: String(packageId), userId: String(userId), purchaseType },
    });

    await prisma.testseriesorder.create({
      data: {
        userId,
        packageId: Number(packageId),
        razorpayOrderId: order.id,
        amount: price,
        status: "PENDING",
        purchaseType,
      },
    });

    return res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
      packageTitle: pkg.title,
      purchaseType,
    });
  } catch (err) {
    console.error("TS create order error:", err);
    res.status(500).json({ message: "Failed to create order", error: err.message });
  }
};

// ─── Verify Payment & Grant Access ────────────────────────────────────────────
// Note: buying a test series (individual package or bundle) does NOT grant
// PREMIUM status — it only grants access to that test series content, via
// the testseriespurchase/testseriesbundlepurchase records below. Only an
// actual Premium plan purchase (verifyPayment/verifyCombinedPayment) should
// set user.status = "PREMIUM".
exports.verifyTSPayment = async (req, res) => {
  const userId = req.user.id;
  const { orderId, paymentId, signature, packageId, shippingDetails, purchaseType = "ETEST" } = req.body;

  try {
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(orderId + "|" + paymentId)
      .digest("hex");

    if (expected !== signature) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    await prisma.testseriesorder.updateMany({
      where: { razorpayOrderId: orderId },
      data: { status: "COMPLETED" },
    });

    const order = await prisma.testseriesorder.findFirst({ where: { razorpayOrderId: orderId } });
    const amount = order?.amount ?? 0;

    await prisma.testseriespurchase.upsert({
      where: { userId_packageId: { userId, packageId: Number(packageId) } },
      create: {
        userId,
        packageId: Number(packageId),
        razorpayOrderId: orderId,
        paymentId,
        amount,
        purchaseType,
        shippingName: shippingDetails?.name ?? null,
        shippingPhone: shippingDetails?.phone ?? null,
        shippingAddress: shippingDetails?.address ?? null,
        shippingCity: shippingDetails?.city ?? null,
        shippingPincode: shippingDetails?.pincode ?? null,
      },
      update: {
        paymentId,
        razorpayOrderId: orderId,
        purchaseType,
        amount,
        shippingName: shippingDetails?.name ?? null,
        shippingPhone: shippingDetails?.phone ?? null,
        shippingAddress: shippingDetails?.address ?? null,
        shippingCity: shippingDetails?.city ?? null,
        shippingPincode: shippingDetails?.pincode ?? null,
      },
    });

    // Record in payments table so it appears in admin panel
    try {
      const pkg = await prisma.testseriespackage.findUnique({
        where: { id: Number(packageId) },
        select: { title: true },
      });
      await prisma.payment.create({
        data: {
          userId,
          amount,
          currency: "INR",
          paymentMethod: "ONLINE",
          paymentStatus: "COMPLETED",
          transactionId: paymentId,
          subscriptionType: pkg?.title ?? `TEST_SERIES_${packageId}`,
          paymentGateway: "Razorpay",
          gatewayResponse: JSON.stringify({ orderId, paymentId, signature }),
          updatedAt: new Date(),
        },
      });
    } catch (payErr) {
      if (payErr.code !== "P2002") console.error("TS payment record error:", payErr.message);
    }

    return res.json({ success: true, message: "Payment verified. Access granted!" });
  } catch (err) {
    // Gracefully handle duplicate paymentId
    if (err.code === "P2002") {
      return res.json({ success: true, message: "Payment already recorded" });
    }
    console.error("TS verify payment error:", err);
    res.status(500).json({ success: false, message: "Verification failed" });
  }
};

// ─── Get My Purchased Packages ────────────────────────────────────────────────
exports.getMyTSPurchases = async (req, res) => {
  const userId = req.user.id;
  try {
    const purchases = await prisma.testseriespurchase.findMany({
      where: { userId },
      select: { packageId: true, purchasedAt: true, amount: true },
    });
    res.json(purchases);
  } catch (err) {
    console.error("TS purchases fetch error:", err);
    res.status(500).json({ message: "Failed to fetch purchases" });
  }
};

// ─── Get Bundle Price ─────────────────────────────────────────────────────────
exports.getBundlePrice = async (req, res) => {
  try {
    const bundle = await prisma.testseriesbundle.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    if (!bundle) return res.status(404).json({ message: "Bundle not configured" });
    res.json(bundle);
  } catch (err) {
    console.error("getBundlePrice error:", err);
    res.status(500).json({ message: "Failed to fetch bundle price" });
  }
};

// ─── Admin: Upsert Bundle Config ──────────────────────────────────────────────
exports.upsertBundleConfig = async (req, res) => {
  const { price, mrp, physicalPrice, physicalMrp, label, isActive, title, features, paymentSubtitle, premiumExpiry } = req.body;
  if (!price || isNaN(Number(price))) {
    return res.status(400).json({ message: "price is required" });
  }
  try {
    const existing = await prisma.testseriesbundle.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    const bundleData = {
      price: Number(price),
      mrp: mrp != null && mrp !== "" ? Number(mrp) : null,
      physicalPrice: physicalPrice != null && physicalPrice !== "" ? Number(physicalPrice) : null,
      physicalMrp: physicalMrp != null && physicalMrp !== "" ? Number(physicalMrp) : null,
      label: label || null,
      title: title || null,
      features: features != null ? (Array.isArray(features) ? features : JSON.parse(features)) : null,
      paymentSubtitle: paymentSubtitle || null,
      isActive: isActive !== false,
      premiumExpiry: premiumExpiry ? new Date(premiumExpiry) : null,
    };
    let bundle;
    if (existing) {
      bundle = await prisma.testseriesbundle.update({ where: { id: existing.id }, data: bundleData });
    } else {
      bundle = await prisma.testseriesbundle.create({ data: bundleData });
    }
    res.json(bundle);
  } catch (err) {
    console.error("upsertBundleConfig error:", err);
    res.status(500).json({ message: "Failed to save bundle config" });
  }
};

// ─── Create Bundle Razorpay Order ─────────────────────────────────────────────
exports.createBundleOrder = async (req, res) => {
  const userId = req.user.id;
  const { purchaseType = "ETEST" } = req.body;

  if (!["ETEST", "PHYSICAL"].includes(purchaseType)) {
    return res.status(400).json({ message: "Invalid purchaseType" });
  }

  try {

    const existingPurchase = await prisma.testseriesbundlepurchase.findUnique({ where: { userId } });
    if (existingPurchase) {
      if (purchaseType === "ETEST") {
        return res.status(400).json({ message: "Bundle already purchased" });
      }
      if (purchaseType === "PHYSICAL" && existingPurchase.purchaseType === "PHYSICAL") {
        return res.status(400).json({ message: "Physical bundle already purchased" });
      }
    }

    const bundle = await prisma.testseriesbundle.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    if (!bundle) return res.status(404).json({ message: "Bundle not available" });

    const price = purchaseType === "PHYSICAL" ? bundle.physicalPrice : bundle.price;
    if (!price) return res.status(400).json({ message: "This bundle option is not available" });

    const order = await razorpay.orders.create({
      amount: price * 100,
      currency: "INR",
      receipt: `ts_bundle_${purchaseType}_${userId}_${Date.now()}`,
      notes: { type: "bundle", userId: String(userId), purchaseType },
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
      packageTitle: bundle.label || "All Tests Bundle",
      purchaseType,
    });
  } catch (err) {
    console.error("createBundleOrder error:", err);
    res.status(500).json({ message: "Failed to create bundle order", error: err.message });
  }
};

// ─── Verify Bundle Payment ────────────────────────────────────────────────────
exports.verifyBundlePayment = async (req, res) => {
  const userId = req.user.id;
  const { orderId, paymentId, signature, shippingDetails, purchaseType = "ETEST" } = req.body;
  try {
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(orderId + "|" + paymentId)
      .digest("hex");

    if (expected !== signature) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    const bundleOrder = await prisma.testseriesbundle.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    const amount = purchaseType === "PHYSICAL"
      ? (bundleOrder?.physicalPrice ?? 0)
      : (bundleOrder?.price ?? 0);

    await prisma.testseriesbundlepurchase.upsert({
      where: { userId },
      create: {
        userId,
        razorpayOrderId: orderId,
        paymentId,
        amount,
        purchaseType,
        shippingName: shippingDetails?.name ?? null,
        shippingPhone: shippingDetails?.phone ?? null,
        shippingAddress: shippingDetails?.address ?? null,
        shippingCity: shippingDetails?.city ?? null,
        shippingPincode: shippingDetails?.pincode ?? null,
      },
      update: {
        paymentId,
        razorpayOrderId: orderId,
        purchaseType,
        amount,
        shippingName: shippingDetails?.name ?? null,
        shippingPhone: shippingDetails?.phone ?? null,
        shippingAddress: shippingDetails?.address ?? null,
        shippingCity: shippingDetails?.city ?? null,
        shippingPincode: shippingDetails?.pincode ?? null,
      },
    });

    // Record in payments table so it appears in admin panel
    try {
      await prisma.payment.create({
        data: {
          userId,
          amount,
          currency: "INR",
          paymentMethod: "ONLINE",
          paymentStatus: "COMPLETED",
          transactionId: paymentId,
          subscriptionType: "TEST_SERIES_BUNDLE",
          paymentGateway: "Razorpay",
          gatewayResponse: JSON.stringify({ orderId, paymentId, signature }),
          updatedAt: new Date(),
        },
      });
    } catch (payErr) {
      if (payErr.code !== "P2002") console.error("Bundle payment record error:", payErr.message);
    }

    return res.json({ success: true, message: "Bundle purchase verified. Access granted!" });
  } catch (err) {
    if (err.code === "P2002") {
      return res.json({ success: true, message: "Payment already recorded" });
    }
    console.error("verifyBundlePayment error:", err);
    res.status(500).json({ success: false, message: "Verification failed" });
  }
};

// ─── Admin: All Bundle Purchases ──────────────────────────────────────────────
exports.getAllBundlePurchases = async (req, res) => {
  try {
    const purchases = await prisma.testseriesbundlepurchase.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, phoneNumber: true } },
      },
      orderBy: { purchasedAt: "desc" },
    });
    res.json(purchases);
  } catch (err) {
    console.error("getAllBundlePurchases error:", err);
    res.status(500).json({ message: "Failed to fetch bundle purchases" });
  }
};

// ─── Receipt (HTML) ───────────────────────────────────────────────────────────
exports.getReceipt = async (req, res) => {
  const { paymentId, type } = req.query; // type: "individual" | "bundle"
  if (!paymentId) return res.status(400).send("<h3>Missing paymentId</h3>");

  try {
    let purchase, user, packageTitle, amount, shippingName, shippingPhone,
      shippingAddress, shippingCity, shippingPincode, purchasedAt;

    if (type === "bundle") {
      purchase = await prisma.testseriesbundlepurchase.findFirst({
        where: { paymentId },
        include: { user: { select: { name: true, email: true, phoneNumber: true } } },
      });
      if (!purchase) return res.status(404).send("<h3>Receipt not found</h3>");
      user = purchase.user;
      packageTitle = "All Tests Bundle";
      amount = purchase.amount;
      shippingName = purchase.shippingName;
      shippingPhone = purchase.shippingPhone;
      shippingAddress = purchase.shippingAddress;
      shippingCity = purchase.shippingCity;
      shippingPincode = purchase.shippingPincode;
      purchasedAt = purchase.purchasedAt;
    } else {
      purchase = await prisma.testseriespurchase.findFirst({
        where: { paymentId },
        include: {
          user: { select: { name: true, email: true, phoneNumber: true } },
          package: { select: { title: true } },
        },
      });
      if (!purchase) return res.status(404).send("<h3>Receipt not found</h3>");
      user = purchase.user;
      packageTitle = purchase.package?.title ?? "Test Series Package";
      amount = purchase.amount;
      shippingName = purchase.shippingName;
      shippingPhone = purchase.shippingPhone;
      shippingAddress = purchase.shippingAddress;
      shippingCity = purchase.shippingCity;
      shippingPincode = purchase.shippingPincode;
      purchasedAt = purchase.purchasedAt;
    }

    const dateStr = new Date(purchasedAt).toLocaleDateString("en-IN", {
      day: "2-digit", month: "long", year: "numeric",
    });

    const hasShipping = shippingName || shippingAddress;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Payment Receipt – MITOS Learning</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6fb; margin: 0; padding: 24px; color: #1a1a2e; }
    .card { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden; }
    .header { background: #693f86; color: #fff; padding: 28px 32px 20px; text-align: center; }
    .header h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: 0.5px; }
    .header p { margin: 0; font-size: 13px; opacity: 0.8; }
    .badge { display: inline-block; background: #fff; color: #693f86; font-weight: 700; font-size: 13px; border-radius: 20px; padding: 4px 14px; margin-top: 12px; }
    .body { padding: 28px 32px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9CA3AF; margin-bottom: 10px; }
    .row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
    .row .label { font-size: 13px; color: #6B7280; }
    .row .value { font-size: 13px; font-weight: 600; color: #111827; text-align: right; max-width: 60%; }
    .amount-box { background: #EDE9FE; border-radius: 12px; padding: 14px 20px; margin: 18px 0; text-align: center; }
    .amount-box .amt { font-size: 32px; font-weight: 900; color: #693f86; }
    .amount-box .amt-label { font-size: 12px; color: #7C3AED; margin-top: 2px; }
    .divider { border: none; border-top: 1px solid #F3F4F6; margin: 18px 0; }
    .shipping-box { background: #F8F9FA; border-radius: 10px; padding: 14px 18px; margin-top: 8px; }
    .shipping-box p { margin: 4px 0; font-size: 13px; color: #374151; }
    .footer { background: #F8F9FA; padding: 16px 32px; text-align: center; font-size: 11px; color: #9CA3AF; }
    .checkmark { font-size: 40px; margin-bottom: 8px; }
    @media print { body { background: #fff; padding: 0; } .card { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="checkmark">✓</div>
      <h1>Payment Successful</h1>
      <p>MITOS Learning – Test Series</p>
      <div class="badge">Official Receipt</div>
    </div>
    <div class="body">
      <div class="amount-box">
        <div class="amt">₹${amount}</div>
        <div class="amt-label">${packageTitle}</div>
      </div>

      <div class="section-title">Payment Details</div>
      <div class="row"><span class="label">Payment ID</span><span class="value" style="font-family:monospace;font-size:11px">${paymentId}</span></div>
      <div class="row"><span class="label">Date</span><span class="value">${dateStr}</span></div>
      <div class="row"><span class="label">Status</span><span class="value" style="color:#16A34A">✓ Completed</span></div>

      <hr class="divider" />

      <div class="section-title">Student Details</div>
      <div class="row"><span class="label">Name</span><span class="value">${user.name ?? "—"}</span></div>
      <div class="row"><span class="label">Email</span><span class="value">${user.email ?? "—"}</span></div>
      ${user.phoneNumber ? `<div class="row"><span class="label">Phone</span><span class="value">${user.phoneNumber}</span></div>` : ""}

      ${hasShipping ? `
      <hr class="divider" />
      <div class="section-title">Delivery Address</div>
      <div class="shipping-box">
        ${shippingName ? `<p><strong>${shippingName}</strong></p>` : ""}
        ${shippingPhone ? `<p>${shippingPhone}</p>` : ""}
        ${shippingAddress ? `<p>${shippingAddress}</p>` : ""}
        ${shippingCity || shippingPincode ? `<p>${[shippingCity, shippingPincode].filter(Boolean).join(" – ")}</p>` : ""}
      </div>
      ` : ""}
    </div>
    <div class="footer">
      This is a computer-generated receipt. No signature required.<br/>
      MITOS Learning · For support contact us via the app.
    </div>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err) {
    console.error("getReceipt error:", err);
    res.status(500).send("<h3>Failed to generate receipt</h3>");
  }
};

// ─── Admin: All Purchases ─────────────────────────────────────────────────────
exports.getAllTSPurchases = async (req, res) => {
  try {
    const purchases = await prisma.testseriespurchase.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, phoneNumber: true } },
        package: { select: { id: true, title: true, price: true } },
      },
      orderBy: { purchasedAt: "desc" },
    });
    res.json(purchases);
  } catch (err) {
    console.error("TS all purchases error:", err);
    res.status(500).json({ message: "Failed to fetch purchases" });
  }
};

// ─── Admin: Manually Grant / Revoke Access ────────────────────────────────────
// Access is pure row-existence in testseriespurchase (one package) or
// testseriesbundlepurchase (all packages) — see verifyTSPayment/
// verifyBundlePayment above. These mirror that exactly, just with a
// synthetic paymentId (amount 0) instead of a real Razorpay transaction, so
// a manually-granted user is indistinguishable from a real purchaser to
// every other part of the app. Deliberately does NOT touch user.status —
// same reasoning as real Test Series purchases, this is independent of
// Premium/trial.

// GET /test-series/admin/users/:userId/access
exports.adminGetUserTSAccess = async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId)) return res.status(400).json({ message: "Invalid userId" });

  try {
    const [packages, purchases, bundlePurchase] = await Promise.all([
      prisma.testseriespackage.findMany({
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true, price: true, isActive: true },
      }),
      prisma.testseriespurchase.findMany({ where: { userId }, select: { packageId: true, purchasedAt: true } }),
      prisma.testseriesbundlepurchase.findUnique({ where: { userId }, select: { purchasedAt: true } }),
    ]);

    const purchaseMap = new Map(purchases.map((p) => [p.packageId, p.purchasedAt]));

    res.json({
      hasBundleAccess: !!bundlePurchase,
      bundlePurchasedAt: bundlePurchase?.purchasedAt ?? null,
      packages: packages.map((pkg) => ({
        ...pkg,
        hasAccess: purchaseMap.has(pkg.id),
        purchasedAt: purchaseMap.get(pkg.id) ?? null,
      })),
    });
  } catch (err) {
    console.error("adminGetUserTSAccess error:", err);
    res.status(500).json({ message: "Failed to load access state" });
  }
};

// POST /test-series/admin/users/:userId/grant-package  { packageId }
exports.adminGrantPackageAccess = async (req, res) => {
  const userId = Number(req.params.userId);
  const packageId = Number(req.body?.packageId);
  if (!Number.isInteger(userId) || !Number.isInteger(packageId)) {
    return res.status(400).json({ message: "userId and packageId are required" });
  }

  try {
    const pkg = await prisma.testseriespackage.findUnique({ where: { id: packageId }, select: { title: true } });
    if (!pkg) return res.status(404).json({ message: "Package not found" });

    const existing = await prisma.testseriespurchase.findUnique({
      where: { userId_packageId: { userId, packageId } },
    });
    // Already has access (real purchase or an earlier grant) — leave
    // whatever's there alone rather than overwrite a real payment's
    // provenance with a synthetic one.
    if (existing) return res.json({ message: `Already has access to "${pkg.title}"` });

    const syntheticPaymentId = `MANUAL_${userId}_${packageId}_${Date.now()}`;
    await prisma.testseriespurchase.create({
      data: { userId, packageId, paymentId: syntheticPaymentId, amount: 0, purchaseType: "ETEST" },
    });

    await prisma.payment
      .create({
        data: {
          userId,
          amount: 0,
          currency: "INR",
          paymentMethod: "ONLINE",
          paymentStatus: "COMPLETED",
          transactionId: syntheticPaymentId,
          subscriptionType: pkg.title,
          paymentGateway: "Manual (Admin Grant)",
          description: `Access manually granted by admin — ${pkg.title}`,
          updatedAt: new Date(),
        },
      })
      .catch((e) => {
        if (e.code !== "P2002") console.error("Manual grant payment record error:", e.message);
      });

    res.json({ message: `Access to "${pkg.title}" granted` });
  } catch (err) {
    console.error("adminGrantPackageAccess error:", err);
    res.status(500).json({ message: "Failed to grant access" });
  }
};

// DELETE /test-series/admin/users/:userId/package/:packageId
exports.adminRevokePackageAccess = async (req, res) => {
  const userId = Number(req.params.userId);
  const packageId = Number(req.params.packageId);
  if (!Number.isInteger(userId) || !Number.isInteger(packageId)) {
    return res.status(400).json({ message: "Invalid userId or packageId" });
  }

  try {
    await prisma.testseriespurchase.deleteMany({ where: { userId, packageId } });
    res.json({ message: "Access revoked" });
  } catch (err) {
    console.error("adminRevokePackageAccess error:", err);
    res.status(500).json({ message: "Failed to revoke access" });
  }
};

// POST /test-series/admin/users/:userId/grant-bundle — overall access to
// every package (present and future — bundle access has no packageId, see
// getActivePackagesForUsers's isPurchased logic).
exports.adminGrantBundleAccess = async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId)) return res.status(400).json({ message: "Invalid userId" });

  try {
    const existing = await prisma.testseriesbundlepurchase.findUnique({ where: { userId } });
    if (existing) return res.json({ message: "Already has overall access" });

    const syntheticPaymentId = `MANUAL_BUNDLE_${userId}_${Date.now()}`;
    await prisma.testseriesbundlepurchase.create({
      data: { userId, paymentId: syntheticPaymentId, amount: 0, purchaseType: "ETEST" },
    });

    await prisma.payment
      .create({
        data: {
          userId,
          amount: 0,
          currency: "INR",
          paymentMethod: "ONLINE",
          paymentStatus: "COMPLETED",
          transactionId: syntheticPaymentId,
          subscriptionType: "TEST_SERIES_BUNDLE",
          paymentGateway: "Manual (Admin Grant)",
          description: "Overall Test Series access manually granted by admin",
          updatedAt: new Date(),
        },
      })
      .catch((e) => {
        if (e.code !== "P2002") console.error("Manual bundle grant payment record error:", e.message);
      });

    res.json({ message: "Overall Test Series access granted" });
  } catch (err) {
    console.error("adminGrantBundleAccess error:", err);
    res.status(500).json({ message: "Failed to grant bundle access" });
  }
};

// DELETE /test-series/admin/users/:userId/bundle
exports.adminRevokeBundleAccess = async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId)) return res.status(400).json({ message: "Invalid userId" });

  try {
    await prisma.testseriesbundlepurchase.deleteMany({ where: { userId } });
    res.json({ message: "Overall access revoked" });
  } catch (err) {
    console.error("adminRevokeBundleAccess error:", err);
    res.status(500).json({ message: "Failed to revoke bundle access" });
  }
};
