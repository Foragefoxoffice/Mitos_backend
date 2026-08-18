const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findUsers() {
  const ids = [8862, 9713, 9637];
  try {
    const users = await prisma.user.findMany({
      where: {
        id: { in: ids }
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        status: true,
        premiumExpiry: true,
        createdAt: true,
        role: true
      }
    });

    console.log('--- FOUND USERS ---');
    console.log(JSON.stringify(users, null, 2));
    console.log('--- END ---');
  } catch (error) {
    console.error('Error finding users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findUsers();
