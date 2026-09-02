const crypto = require("crypto");
const prisma = require("./prisma");
const { generateToken, generateRefreshToken } = require("./jwt");

const mintSessionId = () => crypto.randomUUID();

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
  const isSameDevice = !!user.activeSessionDeviceId && !!deviceId && user.activeSessionDeviceId === deviceId;
  const hasConflict = !!user.activeSessionDeviceId && !isSameDevice && !force;

  if (hasConflict) {
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

module.exports = { issueSessionTokens, mintSessionId };
