const prisma = require("../utils/prisma");
const multer = require("multer");
const path = require("path");
const admin = require("../../firebase");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `notif_${Date.now()}${ext}`);
  },
});
exports.uploadNotifImage = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }).single("image");

const formatPercent = (value) => (value == null ? "" : `${Math.round(value)}%`);

// Simple template renderer. Mark Booster fields come from
// useranalyticssummary (joined on every findMany below, not a per-user
// query) — see src/utils/userAnalyticsSummary.js for how that gets kept
// current. Falls back to friendly generic phrasing when a user has no
// summary yet (never taken a test), rather than leaving a blank gap.
function renderTemplate(template, user) {
  const summary = user.useranalyticssummary;
  return template
    .replace(/{{name}}/g, user.name || "")
    .replace(/{{email}}/g, user.email || "")
    .replace(/{{phone}}/g, user.phoneNumber || "")
    .replace(/{{weakSubject}}/g, summary?.weakestSubject || "your weak subjects")
    .replace(/{{weakSubjectAccuracy}}/g, formatPercent(summary?.weakestSubjectAccuracy))
    .replace(/{{weakChapter}}/g, summary?.weakestChapter || "your weak chapters")
    .replace(/{{weakChapterAccuracy}}/g, formatPercent(summary?.weakestChapterAccuracy))
    .replace(/{{weakTopic}}/g, summary?.weakestTopic || "your weak topics")
    .replace(/{{weakTopicAccuracy}}/g, formatPercent(summary?.weakestTopicAccuracy))
    .replace(/{{overallAccuracy}}/g, formatPercent(summary?.overallAccuracy))
    .replace(/{{lastScore}}/g, summary?.lastScore != null ? String(summary.lastScore) : "")
    .replace(/{{lastAccuracy}}/g, formatPercent(summary?.lastAccuracy))
    .replace(/{{totalTestsTaken}}/g, summary?.totalTestsTaken != null ? String(summary.totalTestsTaken) : "0");
}

// POST /api/notifications/upload-image  — upload image, get back public URL
exports.uploadNotifImageOnly = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No image file provided" });
  const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const imageUrl = `${baseUrl}/uploads/${req.file.filename}`;
  res.json({ imageUrl });
};

// POST /api/notifications/send
exports.sendNotification = async (req, res) => {
  try {
    const { title, message, sendToAll, subscriptionStatus, deepLinkScreen } = req.body;
    // multer gives a string when only one id is sent via FormData; normalize to array
    let userIds = req.body.userIds;
    if (typeof userIds === 'string') userIds = [userIds];
    if (userIds) userIds = userIds.map(Number);
    const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const imageUrl = req.file
      ? `${baseUrl}/uploads/${req.file.filename}`
      : (req.body.imageUrl || null);

    console.log("DEBUG: sendNotification payload:", JSON.stringify(req.body, null, 2));

    if (!title || !message) {
      return res.status(400).json({
        message: "Title and message are required",
      });
    }

    let users = [];

    /* --------------------------------------------------
       1️⃣ SEND TO USERS BY SUBSCRIPTION STATUS (Priority)
    -------------------------------------------------- */
    if (subscriptionStatus && subscriptionStatus !== 'ALL') {
      const now = new Date();

      if (subscriptionStatus === 'TRIAL') {
        // Active trial: TRIALED users whose trial has NOT expired yet
        users = await prisma.user.findMany({
          where: {
            status: 'TRIALED',
            trialStartedAt: { not: null },
            trialEndsAt: { gte: now },
          },
          include: { useranalyticssummary: true },
        });
      } else if (subscriptionStatus === 'TRIALED') {
        // Expired trial: TRIALED users whose trial HAS expired
        users = await prisma.user.findMany({
          where: {
            status: 'TRIALED',
            trialEndsAt: { lt: now },
          },
          include: { useranalyticssummary: true },
        });
      } else {
        // REGISTERED, PREMIUM, SUSPENDED — direct status match
        users = await prisma.user.findMany({
          where: { status: subscriptionStatus },
          include: { useranalyticssummary: true },
        });
      }
    }
    // "By Status" with "All Statuses" selected
    else if (subscriptionStatus === 'ALL') {
      users = await prisma.user.findMany({ include: { useranalyticssummary: true } });
    }

    /* --------------------------------------------------
       2️⃣ SEND TO MULTIPLE SELECTED USERS
    -------------------------------------------------- */
    else if (Array.isArray(userIds) && userIds.length > 0) {
      users = await prisma.user.findMany({
        where: {
          id: { in: userIds },
        },
        include: { useranalyticssummary: true },
      });
    }

    /* --------------------------------------------------
       3️⃣ SEND TO ALL USERS (Fallback)
    -------------------------------------------------- */
    else if (sendToAll === true || sendToAll === 'true') {
      users = await prisma.user.findMany({ include: { useranalyticssummary: true } });
    }

    console.log(`DEBUG: Found ${users.length} users to send notification to.`);
    if (users.length > 0) {
      console.log("DEBUG: First 3 users:", users.slice(0, 3).map(u => ({ id: u.id, email: u.email, status: u.status })));
    }

    /* --------------------------------------------------
       ❌ INVALID REQUEST
    -------------------------------------------------- */
    else {
      return res.status(400).json({
        message: "Either sendToAll=true, subscriptionStatus, or userIds[] is required",
      });
    }

    if (users.length === 0) {
      return res.status(404).json({
        message: "No users found",
      });
    }

    /* --------------------------------------------------
       CREATE & SEND NOTIFICATIONS
    -------------------------------------------------- */
    const notificationsToCreate = [];

    for (const user of users) {
      const personalizedMessage = renderTemplate(message, user);
      const personalizedTitle = renderTemplate(title, user);

      notificationsToCreate.push({
        title: personalizedTitle,
        message,
        finalMessage: personalizedMessage,
        userId: user.id,
        sentToAll: !!sendToAll,
        imageUrl: imageUrl || null,
        deepLinkScreen: deepLinkScreen || null,
        createdAt: new Date(),
      });

      // Send FCM push (non-blocking)
      if (user.fcmToken) {
        const fcmMsg = {
          token: user.fcmToken,
          notification: {
            title: personalizedTitle,
            body: personalizedMessage,
            ...(imageUrl && { imageUrl }),
          },
          // FCM data payloads are flat string maps — screen is read by the
          // app's getInitialNotification/onNotificationOpenedApp/onMessage
          // handlers to navigate on tap. Omitted (not even an empty
          // string) when there's no deep link, so the app can tell
          // "no link configured" apart from "link is the empty string".
          data: { userId: String(user.id), ...(deepLinkScreen ? { screen: deepLinkScreen } : {}) },
          android: imageUrl ? { notification: { imageUrl } } : undefined,
          apns: imageUrl ? { payload: { aps: {} }, fcmOptions: { imageUrl } } : undefined,
        };
        admin.messaging().send(fcmMsg).catch(err => {
          console.error(`FCM error for user ${user.id}`, err.message);
        });
      }
    }

    await prisma.notification.createMany({
      data: notificationsToCreate,
    });

    return res.json({
      message: sendToAll
        ? "Notification sent to all users"
        : "Notification sent to selected users",
      totalUsers: users.length,
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    return res.status(500).json({
      message: "Error sending notification",
    });
  }
};

// GET /api/notifications/my  (User)
exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ message: "Error fetching notifications" });
  }
};

// PATCH /api/notifications/:id/read
exports.markNotificationRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = Number(req.params.id);

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (notification.userId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return res.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Error marking notification read:", error);
    return res.status(500).json({ message: "Error marking notification read" });
  }
};

// PATCH /api/notifications/read-all
exports.markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error marking all notifications read:", error);
    return res.status(500).json({ message: "Error marking all notifications read" });
  }
};


