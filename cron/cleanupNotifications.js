const cron = require("node-cron");
const prisma = require("../src/utils/prisma");

const RETENTION_DAYS = 10;
// One notification row per recipient (broadcasts fan out to every user), so
// this table grows fast — kept it at 1.7GB before this job existed. Deleted
// in bounded batches rather than one deleteMany() so a multi-million-row
// cleanup doesn't hold a single long-running lock against a shared
// production DB other requests are also hitting.
const BATCH_SIZE = 5000;

/* =====================================
   CLEANUP OLD NOTIFICATIONS JOB
===================================== */
cron.schedule("30 2 * * *", async () => {
  // Runs every day at 2:30 AM — after expireSubscriptions' 2 AM run

  console.log("🧹 Running notification cleanup job...");

  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    let totalDeleted = 0;

    while (true) {
      const rows = await prisma.notification.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (rows.length === 0) break;

      const { count } = await prisma.notification.deleteMany({
        where: { id: { in: rows.map((r) => r.id) } },
      });
      totalDeleted += count;
    }

    console.log("✅ Old notifications deleted:", totalDeleted);
  } catch (err) {
    console.error("❌ Notification cleanup cron failed:", err);
  }
});

module.exports = {};
