const crypto = require("crypto");
const prisma = require("./prisma");
const { generateToken, generateRefreshToken } = require("./jwt");

const mintSessionId = () => crypto.randomUUID();

// Single-device-session enforcement is only meaningful for the mobile
// student app, where "your account was used on someone else's device" is a
// real account-sharing concern. Admins run the web panel from several
// machines/browser profiles/tabs as normal day-to-day work — enforcing it
// there just means the SAME person's earlier tab gets silently logged out
// (with an in-flight action, e.g. a notification send, failing 401) the
// moment they open the panel on a second device. Removed entirely for
// admin accounts per explicit request (2026-09-11) rather than working
// around it per-tab — regular users are unaffected.
const isSessionEnforced = (role) => role !== 'admin';

// Shared conflict predicate — exported so callers that mutate other state
// (clearing an OTP, writing registration fields) can check for a conflict
// BEFORE doing anything irreversible, instead of only finding out via
// issueSessionTokens after the fact. Real bug this fixes (found via manual
// device testing, 2026-09-02): verifyWhatsappOtp/verifyEmailOtp used to
// clear the one-time OTP unconditionally, THEN call issueSessionTokens —
// so a 409 conflict (no tokens issued) still consumed the OTP, and the
// client's force:true retry (same OTP, per the modal's design) failed with
// "OTP expired" because the OTP was already gone. See those two
// controllers for the actual fix.
const hasSessionConflict = (user, { deviceId, force = false } = {}) => {
  if (!isSessionEnforced(user.role)) return false;
  const isSameDevice = !!user.activeSessionDeviceId && !!deviceId && user.activeSessionDeviceId === deviceId;
  return !!user.activeSessionDeviceId && !isSameDevice && !force;
};

// Establishes or continues the single-active-device session for `user`.
// - No prior active device, or the SAME device (matched by deviceId) is
//   re-logging in: always allowed, mints a fresh sessionId, overwrites the
//   4 activeSession* columns.
// - A DIFFERENT device already holds the session and `force` isn't set:
//   returns a conflict descriptor instead of touching the DB or minting
//   tokens — the caller (a controller) turns this into a 409.
// - `force: true` (the user confirmed "log out that device") always wins,
//   regardless of whose device it currently is.
const issueSessionTokens = async (user, { deviceId, deviceLabel, force = false } = {}) => {
  if (hasSessionConflict(user, { deviceId, force })) {
    return {
      conflict: true,
      label: user.activeSessionLabel,
      since: user.activeSessionAt,
    };
  }

  const sessionId = mintSessionId();
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      activeSessionId: sessionId,
      activeSessionDeviceId: deviceId || null,
      activeSessionLabel: deviceLabel || null,
      activeSessionAt: new Date(),
    },
  });

  return {
    accessToken: generateToken(updated, sessionId),
    refreshToken: generateRefreshToken(updated, sessionId),
    sessionId,
    user: updated,
  };
};

module.exports = { issueSessionTokens, mintSessionId, hasSessionConflict, isSessionEnforced };
