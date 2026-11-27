// Blocks re-use of a deleted account's phone number / email.
//
// deleteMyAccount wipes the user's email/phoneNumber, so without this the
// next OTP/Google login with the same contact auto-created a brand-new
// account (and a fresh free trial). We keep only a salted SHA-256 of each
// normalised contact plus a masked display value for the admin panel —
// never the raw phone/email. See
// docs/superpowers/specs/2026-11-27-deleted-account-block-design.md.
const crypto = require("crypto");

const SALT = process.env.CONTACT_HASH_SALT || "mitos-deleted-contact-v1";

const DELETED_CONTACT_ERROR = Object.freeze({
  code: "ACCOUNT_DELETED",
  message:
    "This account was deleted. This phone number/email can't be used to create a new account. Contact support@mitoslearning.in if you think this is a mistake.",
});

// Phones are stored inconsistently across the DB ("+91XXXXXXXXXX" from OTP
// login, bare 10 digits from profile updates), so canonicalise to
// "91" + last 10 digits before hashing.
function normalizeContact(type, value) {
  if (value === null || value === undefined) return null;
  if (type === "PHONE") {
    const digits = String(value).replace(/\D/g, "");
    if (digits.length < 10) return null;
    return "91" + digits.slice(-10);
  }
  if (type === "EMAIL") {
    const e = String(value).trim().toLowerCase();
    return e || null;
  }
  return null;
}

function hashContact(type, value) {
  const n = normalizeContact(type, value);
  if (!n) return null;
  return crypto.createHash("sha256").update(`${SALT}:${type}:${n}`).digest("hex");
}

function maskContact(type, value) {
  const n = normalizeContact(type, value);
  if (!n) return "";
  if (type === "PHONE") {
    const ten = n.slice(-10);
    return `+91 ${ten.slice(0, 2)}•••••${ten.slice(-3)}`;
  }
  const [local, domain = ""] = n.split("@");
  return `${local.slice(0, 2)}•••@${domain}`;
}

async function isContactBlocked(db, { phone, email } = {}) {
  const hashes = [hashContact("PHONE", phone), hashContact("EMAIL", email)].filter(Boolean);
  if (hashes.length === 0) return false;
  // Fail OPEN: this is an anti-abuse check, login must never depend on it.
  // Real incident 2026-11-27: code reached prod before `prisma migrate
  // deploy` + `generate`, `db.deleted_contact` was undefined, and every
  // OTP request 500'd — nobody could log in.
  try {
    const row = await db.deleted_contact.findFirst({
      where: { hash: { in: hashes } },
      select: { id: true },
    });
    return !!row;
  } catch (err) {
    console.error("[deletedContacts] block check failed, allowing request:", err.message);
    return false;
  }
}

async function recordDeletedContacts(db, user) {
  const data = [];
  for (const [type, value] of [["PHONE", user.phoneNumber], ["EMAIL", user.email]]) {
    const hash = hashContact(type, value);
    if (hash) data.push({ type, hash, masked: maskContact(type, value), userId: user.id });
  }
  if (data.length === 0) return;
  // Stale Prisma client (deploy before `prisma generate`) — don't break
  // account deletion over it; the contact just won't be blocked.
  if (!db.deleted_contact) {
    console.error("[deletedContacts] prisma client has no deleted_contact model — run prisma generate; contact not recorded");
    return;
  }
  await db.deleted_contact.createMany({ data, skipDuplicates: true });
}

module.exports = {
  DELETED_CONTACT_ERROR,
  normalizeContact,
  hashContact,
  maskContact,
  isContactBlocked,
  recordDeletedContacts,
};
