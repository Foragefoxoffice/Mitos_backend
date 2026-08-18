const prisma = require("../utils/prisma");



/* ======================================================
   GET USER PAYMENTS
====================================================== */
exports.getMyPayments = async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { userId: req.user.id },
    include: { coupon: true },
    orderBy: { createdAt: "desc" },
  });

  res.json(payments);
};

/* ======================================================
   ADMIN – ALL PAYMENTS
====================================================== */
exports.getAllPayments = async (req, res) => {
  const payments = await prisma.payment.findMany({
    include: {
      user: { select: { email: true, name: true } },
      coupon: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(payments);
};

/* ======================================================
   PAYMENT STATS (ADMIN DASHBOARD)
====================================================== */
exports.getPaymentStats = async (req, res) => {
  const totalRevenue = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: { paymentStatus: "COMPLETED" },
  });

  const totalDiscount = await prisma.payment.aggregate({
    _sum: { discountAmount: true },
  });

  res.json({
    revenue: totalRevenue._sum.amount || 0,
    discountGiven: totalDiscount._sum.discountAmount || 0,
  });
};
