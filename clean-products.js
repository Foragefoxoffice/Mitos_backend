const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const prices = await prisma.neetplanprice.findMany();

    for (const price of prices) {
        if (price.productId && price.productId !== price.productId.trim()) {
            const trimmed = price.productId.trim();
            console.log(`Updating ID ${price.id}: '${price.productId}' -> '${trimmed}'`);
            await prisma.neetplanprice.update({
                where: { id: price.id },
                data: { productId: trimmed },
            });
        }
    }
}

main().finally(() => prisma.$disconnect());
