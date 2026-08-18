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

// User fetches their notifications
router.get("/my", authenticateUser, getUserNotifications);
// Mark one as read
router.patch("/:id/read", authenticateUser, markNotificationRead);

// Mark all as read
router.patch("/read-all", authenticateUser, markAllNotificationsRead);

module.exports = router;
