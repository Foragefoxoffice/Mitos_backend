const prisma = require("../utils/prisma");
const { completedTopics, accuracyPercent } = require("../utils/topicCompletion");

// All-users "N students completed" counts, per chapter. They change slowly and
// every Practice topic list reads them, so cache briefly in memory.
const COUNT_TTL_MS = 10 * 60 * 1000;
const countCache = new Map(); // chapterId -> { at, counts }

const toIdArray = (v, max) =>
  (Array.isArray(v) ? v : [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, max);

const chapterCounts = async (chapterId) => {
  const hit = countCache.get(chapterId);
  if (hit && Date.now() - hit.at < COUNT_TTL_MS) return hit.counts;

  const rows = await prisma.usertopiccompletion.groupBy({
    by: ["topicId"],
    where: { topic: { chapterId } },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(rows.map((r) => [r.topicId, r._count._all]));
  countCache.set(chapterId, { at: Date.now(), counts });
  return counts;
};

// POST /topic-progress/complete
// Body: { topicIds, questionIds (every question the finished session showed), correct, answered }
// Marks each topic the session fully covered; returns the ids it marked.
const completePractice = async (req, res) => {
  try {
    const userId = req.user.id;
    const topicIds = [...new Set(toIdArray(req.body.topicIds, 50))];
    const questionIds = [...new Set(toIdArray(req.body.questionIds, 5000))];
    if (!topicIds.length || !questionIds.length) {
      return res.status(400).json({ message: "topicIds and questionIds are required" });
    }

    const [covered, totals] = await Promise.all([
      prisma.question.groupBy({
        by: ["topicId"],
        where: { id: { in: questionIds }, topicId: { in: topicIds } },
        _count: { _all: true },
      }),
      prisma.question.groupBy({
        by: ["topicId"],
        where: { topicId: { in: topicIds } },
        _count: { _all: true },
      }),
    ]);
    const done = completedTopics(
      new Map(covered.map((r) => [r.topicId, r._count._all])),
      new Map(totals.map((r) => [r.topicId, r._count._all]))
    );
    if (!done.length) return res.json({ completedTopicIds: [] });

    const accuracy = accuracyPercent(req.body.correct, req.body.answered);
    const existing = await prisma.usertopiccompletion.findMany({
      where: { userId, topicId: { in: done } },
      select: { topicId: true, bestAccuracy: true },
    });
    const best = new Map(existing.map((r) => [r.topicId, r.bestAccuracy]));

    await prisma.$transaction([
      ...(done.some((t) => !best.has(t))
        ? [prisma.usertopiccompletion.createMany({
            data: done.filter((t) => !best.has(t)).map((topicId) => ({ userId, topicId, bestAccuracy: accuracy })),
            skipDuplicates: true, // a double-submit race just keeps the first row
          })]
        : []),
      ...done
        .filter((t) => best.has(t) && accuracy > best.get(t))
        .map((topicId) => prisma.usertopiccompletion.update({
          where: { userId_topicId: { userId, topicId } },
          data: { bestAccuracy: accuracy },
        })),
    ]);

    // A new completion changes that chapter's counts — let the student see it now.
    if (done.some((t) => !best.has(t))) {
      const chapters = await prisma.topic.findMany({ where: { id: { in: done } }, select: { chapterId: true } });
      chapters.forEach((c) => countCache.delete(c.chapterId));
    }

    res.json({ completedTopicIds: done });
  } catch (error) {
    console.error("completePractice error:", error);
    res.status(500).json({ message: "Failed to save topic progress" });
  }
};

// GET /topic-progress/chapter/:chapterId
// -> { completedTopicIds: [this user's], counts: { [topicId]: students completed } }
const getChapterProgress = async (req, res) => {
  try {
    const chapterId = Number(req.params.chapterId);
    if (!Number.isInteger(chapterId) || chapterId <= 0) {
      return res.status(400).json({ message: "Invalid chapterId" });
    }
    const [mine, counts] = await Promise.all([
      prisma.usertopiccompletion.findMany({
        where: { userId: req.user.id, topic: { chapterId } },
        select: { topicId: true },
      }),
      chapterCounts(chapterId),
    ]);
    res.json({ completedTopicIds: mine.map((r) => r.topicId), counts });
  } catch (error) {
    console.error("getChapterProgress error:", error);
    res.status(500).json({ message: "Failed to load topic progress" });
  }
};

// Per-subject "students who completed a topic in this chapter" counts, for the
// chapter cards. Same slow-changing data, same short cache.
const subjectCache = new Map(); // subjectId -> { at, counts }

// GET /topic-progress/subject/:subjectId
// -> { counts: { [chapterId]: distinct students with >=1 completed topic } }
const getSubjectChapterCounts = async (req, res) => {
  try {
    const subjectId = Number(req.params.subjectId);
    if (!Number.isInteger(subjectId) || subjectId <= 0) {
      return res.status(400).json({ message: "Invalid subjectId" });
    }
    const hit = subjectCache.get(subjectId);
    if (hit && Date.now() - hit.at < COUNT_TTL_MS) return res.json({ counts: hit.counts });

    const rows = await prisma.$queryRaw`
      SELECT t.chapterId AS chapterId, COUNT(DISTINCT u.userId) AS students
      FROM usertopiccompletion u
      JOIN topic t ON t.id = u.topicId
      JOIN chapter c ON c.id = t.chapterId
      WHERE c.subjectId = ${subjectId}
      GROUP BY t.chapterId`;
    const counts = Object.fromEntries(rows.map((r) => [Number(r.chapterId), Number(r.students)]));
    subjectCache.set(subjectId, { at: Date.now(), counts });
    res.json({ counts });
  } catch (error) {
    console.error("getSubjectChapterCounts error:", error);
    res.status(500).json({ message: "Failed to load chapter counts" });
  }
};

module.exports = { completePractice, getChapterProgress, getSubjectChapterCounts };
