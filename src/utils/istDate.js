// "Today" for date-based notification targeting (buildDateFilterWhere in
// notificationController.js) needs to mean an India calendar day — this is
// an India-only product and admins reason about "trial ending in the next
// N days" in IST. `new Date().setHours(0,0,0,0)` resolves against whatever
// OS timezone the executing Node process happens to be in, which is NOT
// guaranteed to be IST — confirmed live 2026-09-15: production (likely a
// UTC-default Linux VPS) computed a day boundary 5.5 hours later than IST
// midnight, so a "trial ending in the next 1 day" send picked up a user
// whose trialEndsAt was 22 minutes past the IST-intended cutoff. IST has
// no DST and a fixed +5:30 offset, so this is plain UTC arithmetic — no
// timezone library or ambient TZ setting involved, deterministic
// regardless of the host machine's configured timezone.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istTodayStart(now = new Date()) {
  const istWallClock = new Date(now.getTime() + IST_OFFSET_MS);
  istWallClock.setUTCHours(0, 0, 0, 0);
  return new Date(istWallClock.getTime() - IST_OFFSET_MS);
}

module.exports = { istTodayStart };
