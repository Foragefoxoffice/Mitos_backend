// `user.phoneNumber` is stored inconsistently across the real userbase:
// the vast majority (mobile-app signups) keep the E.164 "+91..." format,
// a legacy minority store a bare 10-digit number with no country code at
// all, and WhatsApp always delivers the sender's number normalized to
// digits-only with no "+" (e.g. "919913087772"). A literal exact-match
// lookup against a WhatsApp-normalized number therefore missed the "+91"
// majority of real users outright — silently returning "no matching
// account" for almost every real customer's inbound message and every
// campaign send, not just genuinely unregistered numbers. This builds the
// small set of stored formats a given WhatsApp-normalized number could
// actually appear as, so a lookup can check all of them.
const buildPhoneNumberLookupCandidates = (normalizedPhone) => {
  const digits = String(normalizedPhone || "").replace(/\D/g, "");
  if (!digits) return [];

  const candidates = [digits, `+${digits}`];
  if (digits.length === 12 && digits.startsWith("91")) {
    candidates.push(digits.slice(2));
  }
  return candidates;
};

module.exports = { buildPhoneNumberLookupCandidates };
