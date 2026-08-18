const prisma = require("../utils/prisma");



/* ======================================================
   GET ALL ACTIVE NEET PLANS (PUBLIC)
   ?platform=WEB | ANDROID | IOS
====================================================== */
exports.getNeetPlans = async (req, res) => {
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
        },
      },
    });

    const transformedPlans = plans.map(p => ({
      ...p,
      prices: p.neetplanprice || [],
      neetplanprice: undefined
    }));

    res.json(transformedPlans);
  } catch (e) {
    console.error("getNeetPlans:", e);
    res.status(500).json({ message: "Failed to fetch plans" });
  }
};

/* ======================================================
   GET NEET PLAN BY ID (ADMIN)
====================================================== */
exports.getNeetPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await prisma.neetplan.findUnique({
      where: { id: Number(id) },
      include: {
        neetplanprice: true,
      },
    });

    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    plan.prices = plan.neetplanprice || [];
    delete plan.neetplanprice;

    res.json(plan);
  } catch (e) {
    console.error("getNeetPlanById:", e);
    res.status(500).json({ message: "Failed to fetch plan" });
  }
};

/* ======================================================
   ADMIN: CREATE NEET PLAN
====================================================== */
exports.createNeetPlan = async (req, res) => {
  try {
    const { code, title, expiresAt } = req.body;

    if (!code || !title || !expiresAt) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const plan = await prisma.neetplan.create({
      data: {
        code: code.toUpperCase(),
        title,
        expiresAt: new Date(expiresAt),
      },
    });

    res.json({ message: "NEET plan created", plan });
  } catch (e) {
    console.error("createNeetPlan:", e);
    res.status(500).json({ message: "Failed to create plan" });
  }
};

/* ======================================================
   ADMIN: UPDATE NEET PLAN
====================================================== */
exports.updateNeetPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, title, expiresAt } = req.body;

    if (!code || !title || !expiresAt) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const plan = await prisma.neetplan.update({
      where: { id: Number(id) },
      data: {
        code: code.toUpperCase(),
        title,
        expiresAt: new Date(expiresAt),
      },
    });

    res.json({ message: "NEET plan updated", plan });
  } catch (e) {
    console.error("updateNeetPlan:", e);
    res.status(500).json({ message: "Failed to update plan" });
  }
};

/* ======================================================
   ADMIN: ADD / UPDATE PLAN PRICE (PLATFORM WISE)
====================================================== */
exports.upsertNeetPlanPrice = async (req, res) => {
  try {
    const { planId, platform, price, originalPrice, discountedPrice, offerPercent, productId } = req.body;

    if (!planId || !platform || price == null) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existing = await prisma.neetplanprice.findFirst({
      where: {
        planId: Number(planId),
        platform,
      },
    });

    // Auto-calculate offerAmount if offerPercent and discountedPrice are provided
    const offerAmount = (offerPercent && discountedPrice)
      ? Math.round(discountedPrice * (offerPercent / 100))
      : null;

    let result;

    const priceData = {
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : null,
      discountedPrice: discountedPrice ? Number(discountedPrice) : null,
      offerPercent: offerPercent ? Number(offerPercent) : null,
      offerAmount: offerAmount,
      productId,
    };

    if (existing) {
      result = await prisma.neetplanprice.update({
        where: { id: existing.id },
        data: priceData,
      });
    } else {
      result = await prisma.neetplanprice.create({
        data: {
          planId: Number(planId),
          platform,
          ...priceData,
        },
      });
    }

    res.json({ message: "Plan price saved", price: result });
  } catch (e) {
    console.error("upsertNeetPlanPrice:", e);
    res.status(500).json({ message: "Failed to save plan price" });
  }
};

/* ======================================================
   ADMIN: TOGGLE PLAN STATUS
====================================================== */
exports.toggleNeetPlan = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await prisma.neetplan.findUnique({
      where: { id: Number(id) },
    });

    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    const updated = await prisma.neetplan.update({
      where: { id: Number(id) },
      data: { isActive: !plan.isActive },
    });

    res.json({ message: "Plan status updated", updated });
  } catch (e) {
    console.error("toggleNeetPlan:", e);
    res.status(500).json({ message: "Failed to toggle plan" });
  }
};

/* ======================================================
   ADMIN: TOGGLE PRICE STATUS
====================================================== */
exports.toggleNeetPlanPrice = async (req, res) => {
  try {
    const { id } = req.params;

    const price = await prisma.neetplanprice.findUnique({
      where: { id: Number(id) },
    });

    if (!price) {
      return res.status(404).json({ message: "Price not found" });
    }

    const updated = await prisma.neetplanprice.update({
      where: { id: Number(id) },
      data: { isActive: !price.isActive },
    });

    res.json({ message: "Price status updated", updated });
  } catch (e) {
    console.error("toggleNeetPlanPrice:", e);
    res.status(500).json({ message: "Failed to toggle price" });
  }
};

/* ======================================================
   ADMIN: DELETE PLAN (SOFT SAFE)
====================================================== */
exports.deleteNeetPlan = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.neetplan.update({
      where: { id: Number(id) },
      data: { isActive: false },
    });

    res.json({ message: "Plan disabled" });
  } catch (e) {
    console.error("deleteNeetPlan:", e);
    res.status(500).json({ message: "Failed to delete plan" });
  }
};
