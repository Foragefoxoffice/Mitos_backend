const { PrismaClient, UserStatus } = require("@prisma/client");
const prisma = new PrismaClient();

async function migrateTrialUsers() {
  try {
    // Date boundaries for 16 Dec 2025
    const START = new Date("2025-12-17T00:00:00.000Z");
    const END   = new Date("2025-12-17T23:59:59.999Z");

    const result = await prisma.user.updateMany({
      where: {
        status: UserStatus.TRIALED,      // Only trialed users
        NOT: { status: UserStatus.PREMIUM }, // Never touch premium

        OR: [
          { trialStartedAt: { gte: START, lte: END } }, // Trial started on 16
          {
            trialStartedAt: null,              // If no field exists
            createdAt: { gte: START, lte: END } // Fallback check
          }
        ],
      },
      data: {
        status: UserStatus.REGISTERED,
      },
    });

    console.log(`✅ ${result.count} users updated to REGISTERED (Only 16 Dec users)`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateTrialUsers();
