const express = require("express");
const router = express.Router();
const {
  createLiveTestOrder,
  verifyLiveTestPayment
} = require("../controllers/razorpayLiveTest");

router.post("/live-test/create-order", createLiveTestOrder);
router.post("/live-test/verify", verifyLiveTestPayment);

module.exports = router;
