const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("--- NEET Plans ---");
        const plans = await prisma.neetplan.findMany({
            include: {
                neetplanprice: true,
            },
        });
        console.log(JSON.stringify(plans, null, 2));

        console.log("\n--- Active Android Prices ---");
        const androidPrices = await prisma.neetplanprice.findMany({
            where: {
                platform: "ANDROID",
                isActive: true,
            },
        });
        console.log(JSON.stringify(androidPrices, null, 2));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
