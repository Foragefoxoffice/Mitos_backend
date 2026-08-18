const { PrismaClient } = require("@prisma/client");

/* =====================================
   PRISMA SINGLETON — optimized for 20k+ users
   connection_limit: max simultaneous DB connections
   pool_timeout:     how long to wait for a free connection (seconds)
   statement_cache_size: prepared statement cache per connection
===================================== */

const clientOptions = {
  errorFormat: process.env.NODE_ENV === "production" ? "minimal" : "pretty",
  log: process.env.NODE_ENV === "production" ? ["error", "warn"] : ["error", "warn"],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
};

let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient(clientOptions);
} else {
  // In development, use global to prevent hot-reload issues
  if (!global.prisma) {
    global.prisma = new PrismaClient(clientOptions);
  }
  prisma = global.prisma;
}

/* =====================================
   GRACEFUL SHUTDOWN
===================================== */
const gracefulShutdown = async () => {
  console.log("🔄 Disconnecting Prisma...");
  await prisma.$disconnect();
  console.log("✅ Prisma disconnected");
  process.exit(0);
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

module.exports = prisma;
