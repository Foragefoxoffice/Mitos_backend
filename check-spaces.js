const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const prices = await prisma.neetplanprice.findMany({
        where: { platform: "ANDROID" },
    });

    prices.forEach(p => {
        console.log(`ID: ${p.id}, ProductId: '${p.productId}', Length: ${p.productId?.length}`);
    });
}

main().finally(() => prisma.$disconnect());
