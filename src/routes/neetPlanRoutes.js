const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/authMiddleware");


const ctrl = require("../controllers/neetPlanController");

/* ======================================================
   PUBLIC ROUTES (APP / WEB)
====================================================== */

/**
 * Get all active NEET plans
 * Query:
 *   ?platform=WEB | ANDROID | IOS
 *
 * Used by:
 *  - Web pricing page
 *  - Android app
 *  - iOS app
 */
router.get("/", ctrl.getNeetPlans);

/**
 * Get single NEET plan by ID (for editing)
 */
router.get(
  "/:id",
  authenticateUser,
  ctrl.getNeetPlanById
);

/* ======================================================
   ADMIN ROUTES
====================================================== */

/**
 * Create NEET plan
 * Body:
 *  { code, title, expiresAt }
 */
router.post(
  "/",
  authenticateUser,
  ctrl.createNeetPlan
);

/**
 * Update NEET plan
 * Body:
 *  { code, title, expiresAt }
 */
router.put(
  "/:id",
  authenticateUser,
  ctrl.updateNeetPlan
);

/**
 * Add / update plan price
 * Body:
 *  { planId, platform, price, productId }
 */
router.post(
  "/price",
  authenticateUser,
  ctrl.upsertNeetPlanPrice
);

/**
 * Toggle plan active/inactive
 */
router.patch(
  "/:id/toggle",
  authenticateUser,
  ctrl.toggleNeetPlan
);

/**
 * Toggle plan price active/inactive
 */
router.patch(
  "/price/:id/toggle",
  authenticateUser,
  ctrl.toggleNeetPlanPrice
);

/**
 * Soft delete (disable) plan
 */
router.delete(
  "/:id",
  authenticateUser,
  ctrl.deleteNeetPlan
);

module.exports = router;
