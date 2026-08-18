const prisma = require("../utils/prisma");



/* ===============================
   CREATE COUPON
================================ */
exports.createCoupon = async (req, res) => {
  try {
    let {
      code,
      type,
      value,
      maxUsage,
      maxPerUser,
      expiresAt,
    } = req.body;

    code = code.toUpperCase();
    value = Number(value);
    maxUsage = maxUsage ? Number(maxUsage) : null;
    maxPerUser = maxPerUser ? Number(maxPerUser) : null;
    expiresAt = expiresAt ? new Date(expiresAt) : null;

    if (!code || !type || isNaN(value)) {
      return res.status(400).json({ message: "Invalid coupon data" });
    }

    const coupon = await prisma.coupon.create({
      data: {
        code,
        type,
        value,
        maxUsage,
        maxPerUser,
        expiresAt,
        updatedAt: new Date(),
      },
    });

    res.json({ message: "Coupon created", coupon });
  } catch (e) {
    console.error("createCoupon:", e);
    res.status(500).json({ message: "Failed to create coupon" });
  }
};

/* ===============================
   VALIDATE COUPON
================================ */
exports.validateCoupon = async (req, res) => {
  try {
    const { code, plan, planPrice } = req.body;
    const userId = req.user.id;

    if (!code || !plan) {
      return res.status(400).json({ message: "Missing coupon or plan" });
    }

    // 1️⃣ Get plan price — use actual price from frontend if provided
    const PRICE_MAP = {
      NEET_2026: 1399,
      NEET_2027: 3599,
      NEET_2028: 6299,
    };

    const originalAmount = (planPrice && Number(planPrice) > 0)
      ? Number(planPrice)
      : PRICE_MAP[plan];

    if (!originalAmount) {
      return res.status(400).json({ message: "Invalid plan" });
    }

    // 2️⃣ Find coupon
    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!coupon || !coupon.isActive) {
      return res.status(400).json({ message: "Invalid coupon code" });
    }

    // 3️⃣ Expiry check
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return res.status(400).json({ message: "Coupon expired" });
    }

    // 4️⃣ Global usage limit
    if (coupon.maxUsage && coupon.usedCount >= coupon.maxUsage) {
      return res.status(400).json({ message: "Coupon usage limit reached" });
    }

    // 5️⃣ Per-user usage limit
    if (coupon.maxPerUser) {
      const usedByUser = await prisma.payment.count({
        where: {
          userId,
          couponId: coupon.id,
        },
      });

      if (usedByUser >= coupon.maxPerUser) {
        return res.status(400).json({ message: "Coupon already used" });
      }
    }

    // 6️⃣ Calculate discount
    let discountAmount =
      coupon.type === "percentage"
        ? Math.round((originalAmount * coupon.value) / 100)
        : coupon.value;

    if (discountAmount > originalAmount) {
      discountAmount = originalAmount;
    }

    const finalAmount = originalAmount - discountAmount;

    // 7️⃣ Send FULL response (IMPORTANT)
    res.json({
      valid: true,
      code: coupon.code,
      originalAmount,
      discountAmount,
      finalAmount,
    });
  } catch (e) {
    console.error("validateCoupon error:", e);
    res.status(500).json({ message: "Coupon validation failed" });
  }
};


/* ===============================
   LIST COUPONS
================================ */
exports.getCoupons = async (req, res) => {
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(coupons);
};


/* ===============================
   UPDATE COUPON
================================ */
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    let {
      type,
      value,
      maxUsage,
      maxPerUser,
      expiresAt,
      isActive,
    } = req.body;

    value = Number(value);
    maxUsage = maxUsage ? Number(maxUsage) : null;
    maxPerUser = maxPerUser ? Number(maxPerUser) : null;
    expiresAt = expiresAt ? new Date(expiresAt) : null;

    const coupon = await prisma.coupon.update({
      where: { id: Number(id) },
      data: {
        type,
        value,
        maxUsage,
        maxPerUser,
        expiresAt,
        isActive,
        updatedAt: new Date(),
      },
    });

    res.json({ message: "Coupon updated", coupon });
  } catch (e) {
    console.error("updateCoupon:", e);
    res.status(500).json({ message: "Failed to update coupon" });
  }
};

/* ===============================
   TOGGLE COUPON STATUS
================================ */
exports.toggleCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await prisma.coupon.findUnique({
      where: { id: Number(id) },
    });

    if (!coupon)
      return res.status(404).json({ message: "Coupon not found" });

    const updated = await prisma.coupon.update({
      where: { id: Number(id) },
      data: { isActive: !coupon.isActive },
    });

    res.json({ message: "Coupon status updated", updated });
  } catch (e) {
    console.error("toggleCoupon:", e);
    res.status(500).json({ message: "Failed to toggle coupon" });
  }
};

/* ===============================
   DELETE COUPON
================================ */
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.coupon.delete({
      where: { id: Number(id) },
    });

    res.json({ message: "Coupon deleted" });
  } catch (e) {
    console.error("deleteCoupon:", e);
    res.status(500).json({ message: "Failed to delete coupon" });
  }
};

