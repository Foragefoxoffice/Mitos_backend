// Manually block a phone number / email from logging in or registering —
// for accounts deleted BEFORE the deleted_contact feature went live (their
// contact was wiped without being recorded), or any case support needs.
// Unblock from Admin → Users → Deleted Contacts.
//
// Usage (from the backend folder):
//   node scripts/blockContact.js 6379034696
//   node scripts/blockContact.js someone@gmail.com
//   node scripts/blockContact.js --check 6379034696     (read-only)
const { PrismaClient } = require("@prisma/client");
const { hashContact, maskContact } = require("../src/utils/deletedContacts");

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args[0] === "--check";
  const value = checkOnly ? args[1] : args[0];
  if (!value) {
    console.log("Usage: node scripts/blockContact.js [--check] <phone|email>");
    process.exit(1);
  }

  if (!prisma.deleted_contact) {
    console.error("Prisma client has no deleted_contact model. Run: npx prisma migrate deploy && npx prisma generate");
    process.exit(1);
  }

  const type = value.includes("@") ? "EMAIL" : "PHONE";
  const hash = hashContact(type, value);
  if (!hash) {
    console.error(`Not a valid ${type.toLowerCase()}: ${value}`);
    process.exit(1);
  }
  const masked = maskContact(type, value);

  const existing = await prisma.deleted_contact.findUnique({ where: { hash } });
  if (checkOnly) {
    console.log(existing ? `BLOCKED: ${masked} (since ${existing.deletedAt.toISOString()})` : `NOT blocked: ${masked}`);
    return;
  }
  if (existing) {
    console.log(`Already blocked: ${masked}`);
    return;
  }

  // Refuse to block a contact that a live account still uses — that would
  // lock a real student out of their own account.
  const where = type === "PHONE"
    ? { phoneNumber: { endsWith: value.replace(/\D/g, "").slice(-10) } }
    : { email: value.trim().toLowerCase() };
  const live = await prisma.user.findFirst({ where: { ...where, NOT: { status: "DELETED" } }, select: { id: true } });
  if (live) {
    console.error(`Refusing: ${masked} belongs to active user #${live.id}. Delete that account first.`);
    process.exit(1);
  }

  await prisma.deleted_contact.create({ data: { type, hash, masked, userId: null } });
  console.log(`Blocked: ${masked}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
