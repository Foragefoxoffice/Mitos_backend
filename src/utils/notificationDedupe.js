// Pure builder for the "skip users who already got this exact
// notification" filter used by notificationController.js. Kept dependency-
// free (no prisma) so the window-vs-forever branching is unit-testable
// without a real database — mirrors the pickReceiptEntry extraction in
// appleReceipt.js.
//
// windowDays > 0: only treats a prior notification as "already sent" if it
// was created within the last windowDays days, so a legitimately recurring
// campaign (same template text, sent again weeks later) isn't blocked
// forever just because the wording didn't change.
// windowDays <= 0: no time limit — the original forever-dedupe behavior
// from the 2026-08-28 incident fix (see notificationController.js).
function buildAlreadyNotifiedWhere({ userIds, message, windowDays, now = new Date() }) {
  const where = { userId: { in: userIds }, message };
  if (windowDays > 0) {
    where.createdAt = { gte: new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000) };
  }
  return where;
}

module.exports = { buildAlreadyNotifiedWhere };
