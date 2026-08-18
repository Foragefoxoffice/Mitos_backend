const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/subscriptionController");

// Free trial
router.post("/start-trial", authenticateUser, ctrl.startFreeTrial);

// Get active plans (for mobile app)
router.get("/plans", authenticateUser, ctrl.getActivePlans);

// Validate status (used on every app/web load)
router.get("/validate", authenticateUser, ctrl.validateSubscription);

// Razorpay (Web)
router.post(
  "/razorpay/create-order",
  authenticateUser,
  ctrl.createRazorpayOrder
);
router.post(
  "/razorpay/verify",
  authenticateUser,
  ctrl.verifyRazorpayPayment
);
router.post(
  "/razorpay/create-combined-order",
  authenticateUser,
  ctrl.createCombinedOrder
);
router.post(
  "/razorpay/verify-combined",
  authenticateUser,
  ctrl.verifyCombinedPayment
);

// Google Play (Android)
router.post(
  "/google/verify",
  authenticateUser,
  ctrl.verifyGooglePurchase
);

// Apple (iOS)
router.post(
  "/apple/verify",
  authenticateUser,
  ctrl.verifyAppleSubscription
);

module.exports = router;
