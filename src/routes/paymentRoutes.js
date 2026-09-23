const express = require("express");
const router = express.Router();
const { authenticateUser, verifyAdmin } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/paymentController");
const checkoutCtrl = require("../controllers/publicCheckoutController");

// Logged-in user payment history
router.get(
  "/my",
  authenticateUser,
  ctrl.getMyPayments
);

// Admin – all payments
router.get(
  "/all",
  authenticateUser,
  ctrl.getAllPayments
);

// Admin – payment stats (dashboard)
router.get(
  "/stats",
  authenticateUser,
  ctrl.getPaymentStats
);

// Admin – public/guest checkout orders (Task 8, public-guest-checkout plan)
router.get(
  "/checkout-orders",
  verifyAdmin,
  checkoutCtrl.adminListCheckoutOrders
);

router.post(
  "/checkout-orders/:orderId/fulfil",
  verifyAdmin,
  checkoutCtrl.adminFulfilCheckoutOrder
);

module.exports = router;
