const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/couponController");

router.post("/create", authenticateUser, ctrl.createCoupon);
router.post("/validate", authenticateUser, ctrl.validateCoupon);
router.get("/list", authenticateUser, ctrl.getCoupons);

router.put("/:id", authenticateUser, ctrl.updateCoupon);
router.patch("/:id/toggle", authenticateUser, ctrl.toggleCoupon);
router.delete("/:id", authenticateUser, ctrl.deleteCoupon);

module.exports = router;
