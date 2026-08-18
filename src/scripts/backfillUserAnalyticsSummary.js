// One-time backfill: recomputes useranalyticssummary for every user who has
// ever taken a test, so notification template variables (weakSubject,
// weakChapter, etc.) aren't empty for existing users on day one — going
// forward, createTestResult keeps each user's row current automatically.
// Run: node src/scripts/backfillUserAnalyticsSummary.js
const prisma = require("../utils/prisma");
const { recomputeUserAnalyticsSummary } = require("../utils/userAnalyticsSummary");

const run = async () => {
  const distinctUsers = await prisma.testresult.findMany({
    distinct: ["userId"],
    select: { userId: true },
  });

  console.log(`Backfilling analytics summary for ${distinctUsers.length} users with test history...`);

  let done = 0;
  let failed = 0;
  for (const { userId } of distinctUsers) {
    try {
      await recomputeUserAnalyticsSummary(userId);
      done++;
    } catch (err) {
      failed++;
      console.error(`Failed for userId ${userId}:`, err.message);
    }
    if ((done + failed) % 50 === 0) {
      console.log(`Progress: ${done + failed} / ${distinctUsers.length}`);
    }
  }

  console.log(`Done. Succeeded: ${done}, Failed: ${failed}`);
  await prisma.$disconnect();
};

run().catch((err) => {
  console.error("Backfill crashed:", err);
  process.exit(1);
});
