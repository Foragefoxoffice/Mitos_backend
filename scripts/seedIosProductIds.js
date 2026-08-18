const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Matches the currently-active Android prices exactly (see neetplanprice
// rows for platform: ANDROID) so iOS users pay the same amount as Android
// users for the same plan. NEET_2026 (planId 4) is skipped: its plan window
// already ended and it's currently inactive.
const IOS_PRICES = [
  { planId: 9, price: 1999, productId: "com.mitoslearning.app.neet2027" },
  { planId: 10, price: 2299, productId: "com.mitoslearning.app.neet2028" },
  { planId: 8, price: 399, productId: "com.mitoslearning.app.neetmonth" },
];

async function main() {
  for (const { planId, price, productId } of IOS_PRICES) {
    const existing = await prisma.neetplanprice.findFirst({
      where: { planId, platform: "IOS" },
    });

    const data = { price, productId, isActive: true, updatedAt: new Date() };

    const result = existing
      ? await prisma.neetplanprice.update({ where: { id: existing.id }, data })
      : await prisma.neetplanprice.create({ data: { planId, platform: "IOS", ...data } });

    console.log(`✅ planId=${planId} -> IOS price row id=${result.id}, productId=${result.productId}`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
