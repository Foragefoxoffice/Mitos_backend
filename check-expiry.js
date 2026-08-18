const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const plans = await prisma.neetplan.findMany({
        where: { isActive: true },
    });

    console.log("Code | Title | Expires At");
    console.log("--------------------------");
    plans.forEach(p => {
        console.log(`${p.code} | ${p.title} | ${p.expiresAt}`);
    });
}

main().finally(() => prisma.$disconnect());
