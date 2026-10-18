const express = require("express");
const router = express.Router();
const { authenticateUser, authorizeRole } = require("../middlewares/authMiddleware");
const {
  sendNotification,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  uploadNotifImage,
  uploadNotifImageOnly,
  getNotificationCampaigns,
  getLegacyNotificationHistory,
} = require("../controllers/notificationController");

// Upload image only — returns { imageUrl }
router.post(
  "/upload-image",
  authenticateUser,
  authorizeRole(["admin"]),
  uploadNotifImage,
  uploadNotifImageOnly
);

// Admin sends notification (template)
router.post(
  "/send",
  authenticateUser,
  authorizeRole(["admin"]),
  uploadNotifImage,
  sendNotification
);

// Admin notification history
router.get("/admin/campaigns", authenticateUser, authorizeRole(["admin"]), getNotificationCampaigns);
router.get("/admin/legacy", authenticateUser, authorizeRole(["admin"]), getLegacyNotificationHistory);

// User fetches their notifications
router.get("/my", authenticateUser, getUserNotifications);
// Mark one as read
router.patch("/:id/read", authenticateUser, markNotificationRead);

// Mark all as read
router.patch("/read-all", authenticateUser, markAllNotificationsRead);

module.exports = router;
