const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const prices = await prisma.neetplanprice.findMany({
        where: { isActive: true },
        include: { neetplan: true },
    });

    console.log("Plan Code | Title | Platform | Product ID | Price");
    console.log("-----------------------------------------------------");
    prices.forEach(p => {
        console.log(`${p.plan.code} | ${p.plan.title} | ${p.platform} | ${p.productId} | ${p.price}`);
    });
}

main().finally(() => prisma.$disconnect());
