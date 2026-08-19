const axios = require("axios");
const prisma = require("../utils/prisma");

// backend never talks to any AI provider itself — it only proxies to
// ai-service, a separate process/deploy (see
// mitos/docs/MITOS_AI_Platform_Implementation_Plan_REVISED.md). Auth here
// is the same admin check every other admin route uses; ai-service trusts
// this service key, not the user's JWT, since it's never reachable from
// clients directly.
const aiServiceClient = axios.create({
  baseURL: process.env.AI_SERVICE_URL,
  headers: { "x-internal-key": process.env.INTERNAL_AI_SERVICE_KEY },
  timeout: 15000,
});

const forwardError = (res, error) => {
  const status = error.response?.status || 500;
  // A response from ai-service carries a message it deliberately crafted
  // for the client (e.g. the daily chat cap message) — safe to forward.
  // No response at all means ai-service itself was unreachable, and
  // error.message is then axios's own internal string (e.g. "connect
  // ECONNREFUSED 127.0.0.1:4001") — never meant for a user to see.
  const message = error.response?.data?.message || "Something went wrong. Please try again in a moment.";
  if (!error.response) console.error("[aiController] ai-service unreachable:", error.message);
  res.status(status).json({ message });
};

const runDictionaryBatch = async (req, res) => {
  try {
    const { batchSize } = req.body || {};
    const response = await aiServiceClient.post("/internal/ai/dictionary/generate-batch", { batchSize });
    res.status(response.status).json(response.data);
  } catch (error) {
    forwardError(res, error);
  }
};

const getDictionaryProgress = async (req, res) => {
  try {
    const response = await aiServiceClient.get("/internal/ai/dictionary/progress");
    res.json(response.data);
  } catch (error) {
    forwardError(res, error);
  }
};

const getDictionaryEntries = async (req, res) => {
  try {
    const response = await aiServiceClient.get("/internal/ai/dictionary/entries", { params: req.query });
    res.json(response.data);
  } catch (error) {
    forwardError(res, error);
  }
};

// Single term, synchronous — for both retrying a "failed" row and manually
// adding a term the extractor missed (ai-service upserts either way).
const retryDictionaryTerm = async (req, res) => {
  try {
    const { term } = req.body || {};
    const response = await aiServiceClient.post("/internal/ai/dictionary/retry", { term });
    res.status(response.status).json(response.data);
  } catch (error) {
    forwardError(res, error);
  }
};

// Fire-and-forget sweep of failed rows — mirrors runDictionaryBatch.
const retryFailedDictionaryTerms = async (req, res) => {
  try {
    const { limit } = req.body || {};
    const response = await aiServiceClient.post("/internal/ai/dictionary/retry-failed", { limit });
    res.status(response.status).json(response.data);
  } catch (error) {
    forwardError(res, error);
  }
};

const getTermsForQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const response = await aiServiceClient.get(`/internal/ai/dictionary/for-question/${questionId}`);
    res.json(response.data);
  } catch (error) {
    forwardError(res, error);
  }
};

const getTermExplanation = async (req, res) => {
  try {
    const term = encodeURIComponent(req.params.term);
    const response = await aiServiceClient.get(`/internal/ai/dictionary/term/${term}`);
    res.json(response.data);
  } catch (error) {
    forwardError(res, error);
  }
};

const startDictionaryAutoRun = async (req, res) => {
  try {
    const response = await aiServiceClient.post("/internal/ai/dictionary/auto/start");
    res.status(response.status).json(response.data);
  } catch (error) {
    forwardError(res, error);
  }
};

const stopDictionaryAutoRun = async (req, res) => {
  try {
    const response = await aiServiceClient.post("/internal/ai/dictionary/auto/stop");
    res.status(response.status).json(response.data);
  } catch (error) {
    forwardError(res, error);
  }
};

// Home screen's "Ask Mitos AI" card has no question in view — builds the
// student's own Mark Booster/Score Predictor/Leaderboard data instead, so
// ai-service's general-mode prompt (chatPrompt.js's buildGeneralSystemPrompt)
// can answer questions about it. Rank computed the same way
// testController.js's getLeaderboard falls back for an out-of-top-list
// user — no separate leaderboard table to look up directly.
const buildGeneralUserContext = async (userId) => {
  const [summary, allRanked] = await Promise.all([
    prisma.useranalyticssummary.findUnique({ where: { userId } }),
    prisma.testresult.groupBy({
      by: ["userId"],
      _sum: { score: true, totalMarks: true },
      orderBy: { _sum: { score: "desc" } },
    }),
  ]);

  const rankIndex = allRanked.findIndex((e) => e.userId === userId);

  return {
    weakestSubject: summary?.weakestSubject || null,
    weakestSubjectAccuracy: summary?.weakestSubjectAccuracy ?? null,
    weakestChapter: summary?.weakestChapter || null,
    weakestChapterAccuracy: summary?.weakestChapterAccuracy ?? null,
    weakestTopic: summary?.weakestTopic || null,
    weakestTopicAccuracy: summary?.weakestTopicAccuracy ?? null,
    overallAccuracy: summary?.overallAccuracy ?? null,
    totalTestsTaken: summary?.totalTestsTaken ?? 0,
    lastScore: summary?.lastScore ?? null,
    lastTotalMarks: summary?.lastTotalMarks ?? null,
    lastAccuracy: summary?.lastAccuracy ?? null,
    leaderboardRank: rankIndex !== -1 ? rankIndex + 1 : null,
    leaderboardTotal: allRanked.length,
  };
};

const sendChatMessage = async (req, res) => {
  try {
    const { questionId, message, hasAnswered, sourceType } = req.body || {};
    if (!message) {
      return res.status(400).json({ message: "message is required" });
    }

    let questionContext = null;
    let userContext = null;
    // "Ask AI" is reachable from Favorites, which mixes rows from TWO
    // independent question tables with their own autoincrement PKs — the
    // main `question` bank and `testseriesquestionbank` (Test Series). The
    // same numeric questionId can legitimately point at two unrelated
    // questions depending on which table it came from, so which table to
    // query is NOT optional — guessing wrong (previously this always
    // queried `question`) silently builds AI context from the wrong
    // question entirely (confirmed live: a Test Series Biology question
    // got answered using an unrelated Physics mock question's context).
    // sourceType mirrors reportWrongQuestion's existing convention.
    const isTestSeries = sourceType === "test-series";

    if (questionId) {
      const question = isTestSeries
        ? await prisma.testseriesquestionbank.findUnique({
            where: { id: Number(questionId) },
            include: { subject: true, chapter: true, topic: true, questionType: true },
          })
        : await prisma.question.findUnique({
            where: { id: Number(questionId) },
            include: { subject: true, chapter: true, topic: true, portion: true, questionType: true },
          });

      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }

      questionContext = {
        question: question.question,
        optionA: question.optionA,
        optionB: question.optionB,
        optionC: question.optionC,
        optionD: question.optionD,
        hint: question.hint,
        portion: question.portion?.name ?? null, // Test Series questions have no portion
        subject: question.subject?.name,
        chapter: question.chapter?.name,
        topic: question.topic?.name,
        questionType: question.questionType?.name ?? null,
        correctOption: hasAnswered ? question.correctOption : null,
      };
    } else {
      userContext = await buildGeneralUserContext(req.user.id);
    }

    const response = await aiServiceClient.post("/internal/ai/chat/message", {
      userId: req.user.id,
      questionId: questionId ? Number(questionId) : null,
      message,
      questionContext,
      userContext,
      isTrial: req.subscriptionTier === "trial",
      source: isTestSeries ? "test-series" : "mock",
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    forwardError(res, error);
  }
};

const getChatHistory = async (req, res) => {
  try {
    // Must match sendChatMessage's source resolution — history for the same
    // numeric questionId belongs to different sessions depending on which
    // question table it came from (see the comment there).
    const source = req.query.sourceType === "test-series" ? "test-series" : "mock";
    const response = await aiServiceClient.get(`/internal/ai/chat/history/${req.params.questionId}`, {
      params: { userId: req.user.id, source },
    });
    res.json(response.data);
  } catch (error) {
    forwardError(res, error);
  }
};

// "How many AI Chat messages does this student have left" — trial vs
// premium determines whether that's a daily-resetting cap or a one-time
// lifetime allowance (see chatService.js in ai-service); req.subscriptionTier
// comes from requirePremium, which already looked this up for the route gate.
const getChatQuota = async (req, res) => {
  try {
    const response = await aiServiceClient.get("/internal/ai/chat/quota", {
      params: { userId: req.user.id, isTrial: req.subscriptionTier === "trial" },
    });
    res.json(response.data);
  } catch (error) {
    forwardError(res, error);
  }
};

// ai-service only knows raw userIds (its DB has no access to backend's
// user table by design — see questionSource.js's read-only grant scoped to
// just `question`). This joins ai-service's per-user aggregates against
// the real user rows so the admin page can show a name/email/subscription
// status instead of a bare id, following the same "backend enriches
// ai-service's response" pattern sendChatMessage already uses for question
// context.
const getChatUsage = async (req, res) => {
  try {
    const response = await aiServiceClient.get("/internal/ai/chat/usage");
    const { overall, byUser, byDay } = response.data;

    const userIds = byUser.map((row) => row.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, status: true, trialEndsAt: true, premiumExpiry: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    const enrichedByUser = byUser.map((row) => ({
      ...row,
      // A userId with no matching row means that account was deleted after
      // sending messages — still show the usage, just without identity.
      user: userById.get(row.userId) || null,
    }));

    res.json({ overall, byUser: enrichedByUser, byDay });
  } catch (error) {
    forwardError(res, error);
  }
};

module.exports = {
  runDictionaryBatch,
  getDictionaryProgress,
  getDictionaryEntries,
  getTermsForQuestion,
  getTermExplanation,
  startDictionaryAutoRun,
  stopDictionaryAutoRun,
  retryDictionaryTerm,
  retryFailedDictionaryTerms,
  sendChatMessage,
  getChatHistory,
  getChatQuota,
  getChatUsage,
};
