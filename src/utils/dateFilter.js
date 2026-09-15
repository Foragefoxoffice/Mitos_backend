const { istTodayStart } = require("./istDate");

// Trial/Premium "active" vs "expired" is always derived from these two
// date columns (trialStartedAt/trialEndsAt/premiumExpiry) compared against
// the current moment — never from a separate cached status flag, which
// could be stale until the next run of cron/expireSubscriptions.js. Same
// convention notificationController.js's subscriptionStatus TRIAL/TRIALED
// branches use (both query status:'TRIALED', distinguished only by
// trialEndsAt vs now) — this extends that same date-driven approach to
// the admin "By Date" recipient filter instead of trusting a
// client-computed id list, which can only ever be as fresh as whenever
// the admin's browser tab last loaded the user list.
const VALID_DATE_FIELDS = ["trialStartedAt", "trialEndsAt", "premiumExpiry"];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function buildDateFilterWhere({ field, condition, days, now }) {
  if (!VALID_DATE_FIELDS.includes(field)) return null;

  // istTodayStart pins "today" to the IST calendar day regardless of the
  // executing process's own OS timezone (see istDate.js — this bit
  // production live, 2026-09-15: the old `new Date().setHours(0,0,0,0)`
  // resolved against the server's local timezone, not IST, so a "trial
  // ending in the next 1 day" send picked up a user 22 minutes past the
  // IST-intended cutoff). Every offset below is plain millisecond
  // arithmetic off that anchor, NOT `.setDate()` — `.setDate()`/`.getDate()`
  // are themselves local-timezone-dependent and would silently reintroduce
  // the same bug class when advancing/receding days.
  const todayStart = istTodayStart(now);

  if (condition === "exactly_days_ago") {
    // Matches exactly ONE IST calendar day, `days` days before today —
    // days=0 is today, days=6 is "exactly 7 days ago". Powers the admin's
    // "Day N of Trial" staged targeting (trialStartedAt): unlike
    // in_next/expired_within, which match a ROLLING RANGE and therefore
    // re-match the same still-in-trial population every time a campaign
    // is resent, this isolates the single cohort currently on day N —
    // confirmed live 2026-09-15 that a "By Status: Trial" style broad
    // resend was hitting one real trial user on every one of their 10
    // trial days (37 notifications total) instead of once per stage.
    const n = Math.max(0, Number(days) || 0);
    const dayStart = new Date(todayStart.getTime() - n * ONE_DAY_MS);
    const dayEnd = new Date(dayStart.getTime() + ONE_DAY_MS);
    return { [field]: { gte: dayStart, lt: dayEnd } };
  }

  const n = Math.max(1, Number(days) || 1);

  if (condition === "today") {
    const tomorrowStart = new Date(todayStart.getTime() + ONE_DAY_MS);
    return { [field]: { gte: todayStart, lt: tomorrowStart } };
  }
  if (condition === "in_next") {
    // Inclusive of today through N days ahead (matches admin UI's own
    // "diffDays >= 0 && diffDays <= days" semantics).
    const rangeEnd = new Date(todayStart.getTime() + (n + 1) * ONE_DAY_MS);
    return { [field]: { gte: todayStart, lt: rangeEnd } };
  }
  if (condition === "expired_within") {
    // Strictly in the past (excludes today), within the last N days.
    const rangeStart = new Date(todayStart.getTime() - n * ONE_DAY_MS);
    return { [field]: { gte: rangeStart, lt: todayStart } };
  }
  return null;
}

module.exports = { buildDateFilterWhere, VALID_DATE_FIELDS };
