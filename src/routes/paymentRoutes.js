const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/paymentController");

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

module.exports = router;
