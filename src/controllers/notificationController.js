const prisma = require("../utils/prisma");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const admin = require("../../firebase");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `notif_${Date.now()}${ext}`);
  },
});
exports.uploadNotifImage = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }).single("image");

// Native Android/iOS notification trays silently drop the image (falling
// back to text-only) once it's roughly over ~500KB — confirmed via a live
// A/B test where a 1.4-1.8MB banner never rendered but the same banner
// compressed to ~176KB did. Admin can upload up to 5MB, so every upload
// gets normalized here rather than relying on whoever's sending to
// remember to pre-compress. Always re-encodes to JPEG (smaller than PNG
// for photo/banner content) and writes a new file — sharp can't read and
// write the same path in place.
const compressNotifImage = async (filePath) => {
  const compressedPath = filePath.replace(/\.[^.]+$/, "") + "_compressed.jpg";
  await sharp(filePath)
    .resize({ width: 1080, withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toFile(compressedPath);
  fs.unlink(filePath, () => {});
  return compressedPath;
};

const formatPercent = (value) => (value == null ? "" : `${Math.round(value)}%`);

// Trial/Premium "active" vs "expired" is always derived from these two
// date columns (trialStartedAt/trialEndsAt/premiumExpiry) compared against
// the current moment — never from a separate cached status flag, which
// could be stale until the next run of cron/expireSubscriptions.js. Same
// convention the existing subscriptionStatus TRIAL/TRIALED branches below
// already use (both query status:'TRIALED', distinguished only by
// trialEndsAt vs now) — this extends that same date-driven approach to
// the "By Date" recipient filter instead of trusting a client-computed
// id list, which can only ever be as fresh as whenever the admin's browser
// tab last loaded the user list.
const VALID_DATE_FIELDS = ["trialStartedAt", "trialEndsAt", "premiumExpiry"];
const buildDateFilterWhere = ({ field, condition, days }) => {
  if (!VALID_DATE_FIELDS.includes(field)) return null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const n = Math.max(1, Number(days) || 1);

  if (condition === "today") {
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    return { [field]: { gte: todayStart, lt: tomorrowStart } };
  }
  if (condition === "in_next") {
    // Inclusive of today through N days ahead (matches admin UI's own
    // "diffDays >= 0 && diffDays <= days" semantics).
    const rangeEnd = new Date(todayStart);
    rangeEnd.setDate(rangeEnd.getDate() + n + 1);
    return { [field]: { gte: todayStart, lt: rangeEnd } };
  }
  if (condition === "expired_within") {
    // Strictly in the past (excludes today), within the last N days.
    const rangeStart = new Date(todayStart);
    rangeStart.setDate(rangeStart.getDate() - n);
    return { [field]: { gte: rangeStart, lt: todayStart } };
  }
  return null;
};

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
  try {
    const compressedPath = await compressNotifImage(req.file.path);
    const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${baseUrl}/uploads/${path.basename(compressedPath)}`;
    res.json({ imageUrl });
  } catch (error) {
    console.error("uploadNotifImageOnly compression error:", error);
    res.status(500).json({ message: "Failed to process image" });
  }
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
      ? `${baseUrl}/uploads/${path.basename(await compressNotifImage(req.file.path))}`
      : (req.body.imageUrl || null);

    console.log("DEBUG: sendNotification payload:", JSON.stringify(req.body, null, 2));

    if (!title || !message) {
      return res.status(400).json({
        message: "Title and message are required",
      });
    }

    let users = [];

    /* --------------------------------------------------
       0️⃣ SEND BY DATE FILTER (highest priority) — recomputed here from
       dateField/condition/days, NOT from any client-supplied userIds.
       The admin panel still shows a live "N users match" count computed
       client-side for instant feedback while adjusting the filter, but
       that's only ever as fresh as whenever the browser tab last loaded
       the user list — trusting it for the actual send meant a stale tab
       left open for hours (or a slow-changing trial/premium date) could
       send to the wrong set. This branch always re-runs the filter
       against live data at the moment Send is actually clicked.
    -------------------------------------------------- */
    if (req.body.recipientMode === 'date' && req.body.dateField) {
      const dateWhere = buildDateFilterWhere({
        field: req.body.dateField,
        condition: req.body.condition,
        days: req.body.days,
      });
      if (!dateWhere) {
        return res.status(400).json({ message: "Invalid date filter (dateField/condition/days)" });
      }
      users = await prisma.user.findMany({
        where: dateWhere,
        include: { useranalyticssummary: true },
      });
    }

    /* --------------------------------------------------
       1️⃣ SEND TO USERS BY SUBSCRIPTION STATUS (Priority)
    -------------------------------------------------- */
    else if (subscriptionStatus && subscriptionStatus !== 'ALL') {
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
       SKIP ALREADY-NOTIFIED USERS — applies to EVERY send type, not just
       "By Date". Originally gated behind recipientMode === 'date' only;
       that gap is exactly what let a "By Status: Trial Users" send
       re-blast the entire active-trial population daily with zero memory
       of who'd already gotten it (confirmed live 2026-08-28: one student
       received the same ~6-message batch every day for 14 days, 80
       notifications total, most while still weeks from their trial
       actually ending). `message` stores the raw un-personalized
       template — same value across all recipients of a given campaign and
       across repeat sends of it — so matching on (userId, message)
       reliably identifies "already got this campaign" regardless of the
       per-user {{name}} in the title.
    -------------------------------------------------- */
    const beforeDedupeCount = users.length;
    const alreadyNotified = await prisma.notification.findMany({
      where: { userId: { in: users.map(u => u.id) }, message },
      select: { userId: true },
      distinct: ['userId'],
    });
    const alreadyNotifiedIds = new Set(alreadyNotified.map(n => n.userId));
    users = users.filter(u => !alreadyNotifiedIds.has(u.id));
    const skippedAlreadyNotified = beforeDedupeCount - users.length;

    if (users.length === 0) {
      return res.status(200).json({
        message: "All matching users already received this notification — nothing new to send.",
        totalUsers: 0,
        skippedAlreadyNotified,
      });
    }

    /* --------------------------------------------------
       CREATE & SEND NOTIFICATIONS
    -------------------------------------------------- */
    const notificationsToCreate = [];
    // Real per-send delivery outcome, not just "a DB row was created for
    // this recipient" — confirmed live 2026-09-02 that a chunk of users
    // matched by a status/date filter (e.g. "Premium Users") have no
    // fcmToken saved at all (39% of PREMIUM-status users at the time),
    // so admin previously saw "sent to N users" with zero visibility into
    // how many of those N actually got a real push vs. just an in-app
    // notification row nobody's device was pinged for. FCM sends are now
    // awaited (were fire-and-forget) so these counts are accurate at
    // response time, not just logged to the server console after the
    // response already went out.
    let noTokenCount = 0;
    const sendPromises = [];

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

      if (!user.fcmToken) {
        noTokenCount++;
        continue;
      }

      {
        const fcmMsg = {
          token: user.fcmToken,
          // TEMPORARILY back to a real `notification` key for Android —
          // see git history for the data-only version and why it exists
          // (stale per-device notification-channel caching silently
          // dropping images). That version REQUIRES the mobile app's
          // Notifee-based setBackgroundMessageHandler (index.js) to
          // actually display the notification itself, since data-only
          // messages give Android nothing to auto-display. That mobile
          // code only ships in a NEW app build — every currently-installed
          // app is still running the old JS with no such handler, so
          // switching the backend to data-only before that build reached
          // users meant NO push notification displayed at all (confirmed
          // live 2026-08-19: in-app list still populated via `data`, but
          // nothing appeared in the OS notification tray). Revert to this
          // until the new app build has actually shipped and rolled out —
          // only then should this go back to data-only, in the SAME
          // deploy as (or after) that mobile release, not before it.
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
          apns: {
            payload: {
              aps: {
                alert: { title: personalizedTitle, body: personalizedMessage },
                // Required for iOS to invoke the Notification Service
                // Extension that downloads fcmOptions.imageUrl below —
                // without this flag the image is silently dropped.
                ...(imageUrl && { 'mutable-content': 1 }),
              },
            },
            ...(imageUrl && { fcmOptions: { imageUrl } }),
          },
        };
        sendPromises.push(
          admin.messaging().send(fcmMsg)
            .then(() => ({ userId: user.id, ok: true }))
            .catch(err => ({ userId: user.id, ok: false, code: err.errorInfo?.code || err.code || null, message: err.message }))
        );
      }
    }

    await prisma.notification.createMany({
      data: notificationsToCreate,
    });

    const sendResults = await Promise.all(sendPromises);
    let delivered = 0;
    let invalidToken = 0;
    let failedOther = 0;
    const staleTokenUserIds = [];
    for (const r of sendResults) {
      if (r.ok) {
        delivered++;
        continue;
      }
      // A stale/uninstalled-app token — normal device churn, not a
      // transient failure. Null it out so future sends stop wasting a
      // request on it and this same user doesn't keep showing up as
      // "matched but undeliverable" send after send.
      if (r.code === 'messaging/registration-token-not-registered' || r.code === 'messaging/invalid-registration-token' || r.code === 'messaging/invalid-argument') {
        invalidToken++;
        staleTokenUserIds.push(r.userId);
      } else {
        failedOther++;
        console.error(`FCM error for user ${r.userId}:`, r.code || r.message);
      }
    }

    if (staleTokenUserIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: staleTokenUserIds } },
        data: { fcmToken: null },
      });
    }

    return res.json({
      message: sendToAll
        ? "Notification sent to all users"
        : "Notification sent to selected users",
      totalUsers: users.length,
      skippedAlreadyNotified,
      delivered,
      noToken: noTokenCount,
      invalidToken,
      failedOther,
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


