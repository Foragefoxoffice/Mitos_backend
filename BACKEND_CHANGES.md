# Backend Changes Log

Running notes of changes made to files in this `backend/` directory. Newest entries at the top.

## 2026-08-18

- `cron/cleanupNotifications.js` (new), `server.js` — `notification` table had grown to 1.7GB (one row per recipient, so broadcast sends fan out to every user). New daily cron (2:30 AM) batch-deletes rows older than 10 days, 5,000 at a time, to avoid a long-running lock. Wired into `server.js` next to the existing `expireSubscriptions` cron. One-time backfill cleanup run live against the shared DB: table went from ~4M rows (1.7GB) to 407,901 rows (everything within the last 10 days) — no schema/data-loss risk, this only ever deletes past-retention rows.
- `prisma/schema.prisma` — added `@@index([createdAt])` to `notification` (the cleanup job and this backfill both filter/scan by `createdAt`; the existing composite `[userId, createdAt]` index doesn't help a query with no `userId` filter). Applied via `prisma db push`.
- `src/controllers/favQuestionController.js`, `src/controllers/favTsQuestionController.js` — `getUserFavQuestions`/`getUserFavTsQuestions` now `include: { question: { include: { subject: true } } }` (previously just `question: true`) so the mobile Favorites screen can group/filter by subject.
- `src/controllers/testSeriesController.js` — several additions:
  - `getActivePackagesForUsers`'s test `_count` was filtered to `isPublished: true` only; changed to an unfiltered count so package cards show active+inactive test totals (matches the admin-side count, which was already unfiltered).
  - New `getTodaysDailyChallengeTest` — resolves the package flagged `isDailyChallenge: true`, then its newest published test, preferring an exact match against the admin's `[DD/MM/YYYY]` naming convention in the test name, falling back to most-recently-created. Powers the mobile Home screen's "Daily Challenge" card.
  - `createPackage`/`updatePackage` now accept `isDailyChallenge`, enforced as a single-package radio flag (setting it true on one package force-clears it on all others).
  - New `notesUpload` multer config (PDF-only, 20MB cap, `uploads/test-notes/`) plus `uploadTestNotes`/`deleteTestNotes` — lets admin attach one PDF ("notes") per Test Series test; replacing a file deletes the old one from disk. Both exported and admin-only.
- `prisma/schema.prisma` — added `notesUrl String?` / `notesFileName String?` to `testseriestest` (backs the notes-PDF feature above). Applied via `db push`.
- `prisma/schema.prisma` — added `isDailyChallenge Boolean @default(false)` to `testseriespackage` (backs the Daily Challenge feature above). Applied via `db push`. The real "Daily Challenge Series 🔥" package (id 5) was manually flagged `isDailyChallenge: true` directly in the DB.
- `src/routes/testSeriesRoutes.js` — new routes: `GET/POST/DELETE /test-series/admin/users/:userId/...` (admin manual grant/revoke of Test Series access, package-level and bundle-level — see `testSeriesPaymentController.js` below), `GET /test-series/user/daily-challenge/today`, `POST/DELETE /test-series/tests/:id/notes`.
- `src/controllers/testSeriesPaymentController.js` — added `adminGetUserTSAccess`, `adminGrantPackageAccess`, `adminRevokePackageAccess`, `adminGrantBundleAccess`, `adminRevokeBundleAccess` — lets admin manually grant/revoke a user's Test Series access (per-package or bundle/"overall") from the User Details modal. Grants create a `testseriespurchase`/`testseriesbundlepurchase` row with a synthetic `MANUAL_<userId>_<packageId>_<timestamp>` paymentId and a `payment` audit row (`paymentGateway: "Manual (Admin Grant)"`) — deliberately does NOT overwrite an existing purchase row, to protect real payment provenance.
- `src/controllers/aiController.js` — `sendChatMessage` no longer requires `questionId`. When omitted (Home screen "Ask Mitos AI" card, no question in view), builds a `userContext` object instead (`useranalyticssummary`'s weakest subject/chapter/topic + accuracies, last score, and a live leaderboard rank computed the same way `testController.js`'s `getLeaderboard` does) and forwards it to ai-service for a general-mode reply scoped to the student's own app data. Per-question flow unchanged.
- `src/controllers/notificationController.js` — `renderTemplate` gained `{{weakTopic}}`/`{{weakTopicAccuracy}}` template variables (mirrors the existing `{{weakSubject}}`/`{{weakChapter}}` pattern), pulling from the new `useranalyticssummary` fields below.
- `src/utils/userAnalyticsSummary.js` — `recomputeUserAnalyticsSummary` now also computes `weakestTopic`/`weakestTopicAccuracy` (parsed from the raw `responses` JSON on test results, since there's no `resultsByTopic` blob). Re-run via the existing `src/scripts/backfillUserAnalyticsSummary.js` for all 2,716 users with test history.
- `prisma/schema.prisma` — added `weakestTopic String?` / `weakestTopicAccuracy Float?` to `useranalyticssummary`. Applied via `db push`.

**Note:** all `prisma db push` runs above went directly against the shared production DB (31.97.202.82) — the *data/schema* side of every change listed is already live. What still needs manual deployment is the **application code** in the files listed (controllers/routes/cron/server.js) to wherever the backend actually runs in production, if that's a separate deploy from this local checkout.

## 2026-07-03

- `prisma/schema.prisma`, `src/controllers/settingController.js` — Fixed "Failed to save setting" when saving the admin App Settings page's `trial_modal` field (the premium-modal copy/features config), while `telegram_link`/`trial_days` saved fine. `appsetting.value` was a plain `String` with no length annotation, which Prisma maps to `VARCHAR(191)` on MySQL; `trial_modal`'s serialized JSON (title + 7 feature objects) is well over that, so the DB rejected the write with "Data too long," silently swallowed by the generic catch block. Added `@db.Text` to the column and a `console.error` in the catch so future DB-level failures actually show up in server logs. Migration `20260703170330_widen_appsetting_value_to_text` created and applied via `prisma migrate deploy` against the live DB (31.97.202.82) — confirmed column is now `TEXT`.

## 2026-07-02 (4)

- `src/controllers/questionController.js` — Same fix as the NEET Full Test one, applied to `getPortionBasedTestQuestions` (11th/12th Full Test). 11th/12th portions have 23,671/19,724 questions each; fetching all of them with full relations just to pick 180 measured at 10.9s/6.3s. Rewrote to the same lean-projection-then-hydrate pattern. Verified live: 200 OK in 1.36s/0.79s. Custom chapter test (`getChapterBasedTestQuestions`) checked and confirmed already fast (0.93s, properly scoped by chapterId) — no change needed.

## 2026-07-02 (3)

- `src/controllers/questionController.js` — Fixed the recurring "NEET Full Test" `AxiosError: Network Error`. `getRandomTestQuestions` (`GET /questions/fulltest`) was fetching all 43,395 rows in `question` with 5 joined relations, unfiltered, just to randomly pick ~180 — measured at 12.6s for the query alone (server was never sending a response at all, not a client connectivity issue). Rewrote to fetch a lean id/chapterId/subject-name-only projection scoped to the 6 needed subjects for the selection algorithm, then hydrate full relation data only for the ~180 selected questions. Verified live: 200 OK in 1.1-1.7s, correct 180-item response, same shape as before. Restarted the backend process (plain `node server.js`, no auto-reload) to pick up the change.

## 2026-07-02 (2)

- `src/controllers/testSeriesPaymentController.js` — Fixed: buying a test series package or bundle was incorrectly promoting the user's account to `status: "PREMIUM"` via a `promoteUserToPremium()` helper called from both `verifyTSPayment` and `verifyBundlePayment`. Confirmed test-series content access is gated entirely by `testseriespurchase`/`testseriesbundlepurchase` records (checked in `testSeriesController.js:getActivePackagesForUsers`), not `user.status`, so removing the promotion doesn't affect legitimate access — only buying an actual Premium plan (`verifyPayment`/`verifyCombinedPayment`, different controller) should set PREMIUM now. Note: this only stops the bug going forward; any user previously promoted to PREMIUM by a test-series-only purchase still has that stale status in the DB and would need a manual data fix if that matters.

## 2026-07-02

- `src/controllers/bannerController.js` — `getAllBanners` (serves `GET /banners`, used by both the mobile app and admin banner list) only ever filtered by `section`; it silently ignored the `targetUser` query param the mobile app sends, so every banner in a section showed to every user regardless of the "Target Audience" configured in the admin panel. Now filters by `targetUsers` array containment (`"ALL"` or the requested segment) when `targetUser` is present, and leaves admin's unscoped listing calls unaffected.

## 2026-07-01

- `src/controllers/couponController.js`, `prisma/schema.prisma` — Fixed "Failed to create coupon": `coupon.updatedAt` was a required `DateTime` with no default and no `@updatedAt` directive (unlike every other model in the schema), so `prisma.coupon.create()` always failed on the missing field. Added `@updatedAt` to the schema and explicitly set `updatedAt: new Date()` in both `createCoupon` and `updateCoupon` so the fix takes effect immediately without needing `prisma generate`/a migration.
