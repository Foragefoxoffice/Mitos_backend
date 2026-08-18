const cron = require("node-cron");
const prisma = require("../src/utils/prisma");

/* =====================================
   EXPIRE SUBSCRIPTIONS JOB
===================================== */
cron.schedule("0 2 * * *", async () => {
  // Runs every day at 2 AM

  console.log("🕑 Running subscription expiry job...");

  try {
    const now = new Date();

    /* -------------------------------
       1️⃣ Deactivate expired plans
    -------------------------------- */
    const expiredPlans = await prisma.userneetplan.updateMany({
      where: {
        isActive: true,
        expiresAt: {
          lte: now,
        },
      },
      data: {
        isActive: false,
      },
    });

    /* -------------------------------
       2️⃣ Suspend expired users
    -------------------------------- */
    const expiredUsers = await prisma.user.updateMany({
      where: {
        premiumExpiry: {
          lte: now,
        },
        status: "PREMIUM",
      },
      data: {
        status: "SUSPENDED",
        premiumExpiry: null,
      },
    });

    console.log("✅ Plans expired:", expiredPlans.count);
    console.log("✅ Users suspended:", expiredUsers.count);

  } catch (err) {
    console.error("❌ Expiry cron failed:", err);
  }
});

module.exports = {};
