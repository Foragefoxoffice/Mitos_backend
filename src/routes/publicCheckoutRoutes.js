const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/publicCheckoutController");
const { optionalCheckoutUser } = require("../middlewares/optionalCheckoutUser");
const { checkoutRateLimit } = require("../middlewares/checkoutRateLimit");

router.get("/catalog", ctrl.getCatalog);
router.get("/catalog/packages/:id", ctrl.getPackageDetail);
router.post("/coupon/validate", checkoutRateLimit, optionalCheckoutUser, ctrl.validateCoupon);
router.post("/order", checkoutRateLimit, optionalCheckoutUser, ctrl.createOrder);
router.post("/verify", ctrl.verifyPayment);
router.get("/status/:orderId", ctrl.getOrderStatus);

module.exports = router;
