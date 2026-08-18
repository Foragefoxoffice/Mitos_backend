const prisma = require("./prisma");

// A subject/chapter only counts as a real weak-point candidate once it has
// enough attempts — otherwise one unlucky question on a topic touched once
// would misleadingly get crowned "weakest".
const MIN_ATTEMPTS_FOR_WEAK_POINT = 5;

// Same window the mobile app's own Mark Booster screen uses
// (getTestResultsByUser take: 50) — keeps this consistent with what a
// student actually sees, and bounds the per-user computation cost.
const HISTORY_WINDOW = 50;

// resultsBySubject / resultsByChapter are stored as JSON strings shaped
// like { [id]: { attempted, correct, wrong, subjectName|chapterName, ... } }
// (see TestScreen.jsx's calculateResultsBy). Sums attempted/correct across
// every row in the window, per key, then returns whichever key has the
// lowest accuracy among those meeting MIN_ATTEMPTS_FOR_WEAK_POINT.
const findWeakestFromRows = (rows, jsonField, nameField) => {
  const totals = new Map();

  for (const row of rows) {
    let parsed;
    try {
      parsed = JSON.parse(row[jsonField] || "{}");
    } catch {
      continue;
    }

    for (const val of Object.values(parsed)) {
      const name = val?.[nameField];
      if (!name) continue;

      const entry = totals.get(name) || { name, attempted: 0, correct: 0 };
      entry.attempted += val.attempted ?? (val.correct || 0) + (val.wrong || 0);
      entry.correct += val.correct || 0;
      totals.set(name, entry);
    }
  }

  let weakest = null;
  for (const entry of totals.values()) {
    if (entry.attempted < MIN_ATTEMPTS_FOR_WEAK_POINT) continue;
    const accuracy = (entry.correct / entry.attempted) * 100;
    if (!weakest || accuracy < weakest.accuracy) {
      weakest = { name: entry.name, accuracy };
    }
  }
  return weakest;
};

// Unlike subject/chapter, there's no pre-aggregated resultsByTopic blob —
// topic only exists per-question inside the raw `responses` array (each
// entry carries the full question record spread in, including `topic` and
// `isCorrect` — see TestScreen.jsx's `responses = filteredQuestions.map(q
// => ({...q, userOption, isCorrect}))`). Unanswered questions have
// userOption === null and isCorrect === null, and are excluded here the
// same way calculateResultsBy's client-side counterpart only counts
// attempted questions.
const findWeakestTopicFromRows = (rows) => {
  const totals = new Map();

  for (const row of rows) {
    let responses;
    try {
      responses = JSON.parse(row.responses || "[]");
    } catch {
      continue;
    }
    if (!Array.isArray(responses)) continue;

    for (const r of responses) {
      if (r.userOption == null || !r.topic) continue;

      const entry = totals.get(r.topic) || { name: r.topic, attempted: 0, correct: 0 };
      entry.attempted += 1;
      if (r.isCorrect === true) entry.correct += 1;
      totals.set(r.topic, entry);
    }
  }

  let weakest = null;
  for (const entry of totals.values()) {
    if (entry.attempted < MIN_ATTEMPTS_FOR_WEAK_POINT) continue;
    const accuracy = (entry.correct / entry.attempted) * 100;
    if (!weakest || accuracy < weakest.accuracy) {
      weakest = { name: entry.name, accuracy };
    }
  }
  return weakest;
};

// Recomputes and upserts one user's analytics summary from their recent
// test history. Deliberately not awaited by callers that are mid-response
// to a student's own action (e.g. submitting a test) — this does a full
// scan + JSON parse of up to HISTORY_WINDOW rows, which is fine as a
// background fire-and-forget for ONE user but shouldn't block their
// request. Safe to call for a user with zero test history (no-ops).
const recomputeUserAnalyticsSummary = async (userId) => {
  const rows = await prisma.testresult.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_WINDOW,
    select: {
      resultsBySubject: true,
      resultsByChapter: true,
      responses: true,
      score: true,
      totalMarks: true,
      accuracy: true,
      createdAt: true,
    },
  });

  if (rows.length === 0) return null;

  const weakSubject = findWeakestFromRows(rows, "resultsBySubject", "subjectName");
  const weakChapter = findWeakestFromRows(rows, "resultsByChapter", "chapterName");
  const weakTopic = findWeakestTopicFromRows(rows);
  const overallAccuracy = rows.reduce((sum, r) => sum + (r.accuracy || 0), 0) / rows.length;
  const latest = rows[0];

  const fields = {
    weakestSubject: weakSubject?.name ?? null,
    weakestSubjectAccuracy: weakSubject?.accuracy ?? null,
    weakestChapter: weakChapter?.name ?? null,
    weakestChapterAccuracy: weakChapter?.accuracy ?? null,
    weakestTopic: weakTopic?.name ?? null,
    weakestTopicAccuracy: weakTopic?.accuracy ?? null,
    overallAccuracy,
    totalTestsTaken: rows.length,
    lastScore: latest.score,
    lastTotalMarks: latest.totalMarks,
    lastAccuracy: latest.accuracy,
    lastTestDate: latest.createdAt,
  };

  return prisma.useranalyticssummary.upsert({
    where: { userId },
    update: fields,
    create: { userId, ...fields },
  });
};

module.exports = { recomputeUserAnalyticsSummary, MIN_ATTEMPTS_FOR_WEAK_POINT, HISTORY_WINDOW };
