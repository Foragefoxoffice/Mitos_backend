const express = require("express");
const router = express.Router();
const { authenticateUser, verifyAdmin } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/subscriptionFeatureController");

// Public (mobile app)
router.get("/", authenticateUser, ctrl.getFeatures);

// Admin only
router.get("/admin", verifyAdmin, ctrl.getAdminFeatures);
router.post("/categories", verifyAdmin, ctrl.createCategory);
router.put("/categories/:id", verifyAdmin, ctrl.updateCategory);
router.delete("/categories/:id", verifyAdmin, ctrl.deleteCategory);
router.post("/features", verifyAdmin, ctrl.createFeature);
router.put("/features/:id", verifyAdmin, ctrl.updateFeature);
router.delete("/features/:id", verifyAdmin, ctrl.deleteFeature);

module.exports = router;
