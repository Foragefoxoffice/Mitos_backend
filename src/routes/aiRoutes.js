const express = require("express");
const router = express.Router();
const { verifyAdmin, authenticateUser } = require("../middlewares/authMiddleware");
const { requirePremium } = require("../middlewares/premiumMiddleware");
const ctrl = require("../controllers/aiController");

// Admin-only: batch generation controls.
router.post("/dictionary/generate-batch", verifyAdmin, ctrl.runDictionaryBatch);
router.post("/dictionary/auto/start", verifyAdmin, ctrl.startDictionaryAutoRun);
router.post("/dictionary/auto/stop", verifyAdmin, ctrl.stopDictionaryAutoRun);
router.get("/dictionary/progress", verifyAdmin, ctrl.getDictionaryProgress);
router.get("/dictionary/entries", verifyAdmin, ctrl.getDictionaryEntries);
router.post("/dictionary/retry", verifyAdmin, ctrl.retryDictionaryTerm);
router.post("/dictionary/retry-failed", verifyAdmin, ctrl.retryFailedDictionaryTerms);

// Student-facing: read-only, already-generated content. Explanation
// content (the actual premium value) is gated; the term list that drives
// in-text highlighting is NOT — non-premium students should still see
// which words are AI-explainable, they just hit the premium gate when
// they tap one. getTermsForQuestion only ever returns {id, term} (no
// explanation fields), so it's safe to leave open here.
router.get("/dictionary/for-question/:questionId", authenticateUser, ctrl.getTermsForQuestion);
router.get("/dictionary/term/:term", authenticateUser, requirePremium, ctrl.getTermExplanation);

// Test Series — same shape, separate job/question source (see
// aiController.js). listEntries/retry endpoints aren't duplicated: terms
// are shared across sources, so the existing dictionary/entries page
// already shows everything both jobs produce.
router.post("/test-series-dictionary/generate-batch", verifyAdmin, ctrl.runTestSeriesDictionaryBatch);
router.post("/test-series-dictionary/auto/start", verifyAdmin, ctrl.startTestSeriesDictionaryAutoRun);
router.post("/test-series-dictionary/auto/stop", verifyAdmin, ctrl.stopTestSeriesDictionaryAutoRun);
router.get("/test-series-dictionary/progress", verifyAdmin, ctrl.getTestSeriesDictionaryProgress);
router.get(
  "/test-series-dictionary/for-question/:questionId",
  authenticateUser,
  ctrl.getTestSeriesTermsForQuestion
);

// Student-facing: per-question AI chat. Writes user-attributed data and
// has a daily cap to enforce (see CHAT_DAILY_MESSAGE_CAP in ai-service).
router.post("/chat/message", authenticateUser, requirePremium, ctrl.sendChatMessage);
router.get("/chat/history/:questionId", authenticateUser, requirePremium, ctrl.getChatHistory);
router.get("/chat/quota", authenticateUser, requirePremium, ctrl.getChatQuota);

// Admin-only: usage/cost analytics.
router.get("/chat/usage", verifyAdmin, ctrl.getChatUsage);

module.exports = router;
