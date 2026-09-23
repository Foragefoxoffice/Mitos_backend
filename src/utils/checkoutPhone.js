/**
 * Pure phone/email helpers for public/guest checkout.
 *
 * Phone format stored and looked up everywhere else in this codebase is
 * "+91" + 10 digits (see authController.normalizePhone, used by OTP login's
 * exact `findUnique`), so the checkout flow must normalize to the same
 * shape or a guest's later OTP login won't find their order.
 */

const normalizeCheckoutPhone = (input) => {
  let digits = String(input ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = (s) => typeof s === "string" && EMAIL_RE.test(s.trim());

const normalizeCheckoutEmail = (input) => {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  return isValidEmail(trimmed) ? trimmed : null;
};

const maskPhone = (phone) => {
  const digits = String(phone ?? "").replace(/\D/g, "");
  const last10 = digits.slice(-10);
  if (last10.length !== 10) return "";
  return `${last10.slice(0, 2)}xxxxxx${last10.slice(-2)}`;
};

module.exports = {
  normalizeCheckoutPhone,
  normalizeCheckoutEmail,
  isValidEmail,
  maskPhone,
};
