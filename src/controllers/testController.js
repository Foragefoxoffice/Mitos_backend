const prisma = require("../utils/prisma");
const { recomputeUserAnalyticsSummary } = require("../utils/userAnalyticsSummary");



// Create a test result
function parseTimeToSeconds(timeString) {
  const [minutes, seconds] = timeString.split(':').map(Number);
  return minutes * 60 + seconds;
}
const createTestResult = async (req, res) => {
  try {
    const {
      userId,
      score,
      totalMarks,
      allChapters,
      answered,
      correct,
      wrong,
      unanswered,
      accuracy,
      totalTimeTaken,
      resultsByType,
      resultsByChapter,
      resultsBySubject,
      responses, // JSON string or object containing [{questionId, userOption, isCorrect}]
    } = req.body;

    const testResult = await prisma.testresult.create({
      data: {
        userId,
        score,
        totalMarks,
        answered,
        correct,
        wrong,
        unanswered,
        accuracy,
        totalTimeTaken: parseTimeToSeconds(totalTimeTaken),
        resultsByType: JSON.stringify(resultsByType),
        resultsByChapter: JSON.stringify(resultsByChapter),
        resultsBySubject: JSON.stringify(resultsBySubject),
        allChapters: allChapters != null ? JSON.stringify(allChapters) : null,
        responses: typeof responses === 'string' ? responses : JSON.stringify(responses),
      },
    });

    // Handle Error Book (UserWrongQuestion) — batched for performance
    if (responses && Array.isArray(responses)) {
      const wrongIds = [];
      const correctIds = [];

      for (const resp of responses) {
        const qid = resp.id || resp.questionId;
        if (!qid) continue;
        if (resp.userOption != null && resp.isCorrect === false) wrongIds.push(qid);
        else if (resp.userOption != null && resp.isCorrect === true) correctIds.push(qid);
      }

      // Single INSERT for all wrong questions (skip existing duplicates)
      if (wrongIds.length > 0) {
        await prisma.userwrongquestion.createMany({
          data: wrongIds.map((qid) => ({ userId, questionId: qid })),
          skipDuplicates: true,
        });
      }

      // Single DELETE for all questions now answered correctly
      if (correctIds.length > 0) {
        await prisma.userwrongquestion.deleteMany({
          where: { userId, questionId: { in: correctIds } },
        });
      }
    }

    res.status(201).json(testResult);

    // Fire-and-forget, after responding — recomputing the summary parses
    // JSON across this user's recent history, no reason to make the
    // student's own test-submit request wait on it.
    recomputeUserAnalyticsSummary(userId).catch((err) =>
      console.error("recomputeUserAnalyticsSummary failed:", err)
    );
  } catch (error) {
    console.error("Error saving test result:", error);
    res.status(500).json({ message: "Error saving test result", error: error.message });
  }
};

// Get all test results (Admin only) — paginated
const getAllTestResults = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const where = { createdAt: { gte: oneMonthAgo } };

    const [testResults, total] = await Promise.all([
      prisma.testresult.findMany({
        where,
        select: {
          id: true, userId: true, score: true, totalMarks: true,
          correct: true, wrong: true, unanswered: true, accuracy: true,
          totalTimeTaken: true, createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.testresult.count({ where }),
    ]);

    res.status(200).json({ data: testResults, total, page, limit });
  } catch (error) {
    console.error("Error fetching test results:", error);
    res.status(500).json({ message: "Error fetching test results" });
  }
};

// Get test results by user ID — last 50, no full responses blob
const getTestResultsByUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const testResults = await prisma.testresult.findMany({
      where: { userId: parseInt(userId) },
      select: {
        id: true, score: true, totalMarks: true, correct: true, wrong: true,
        unanswered: true, accuracy: true, totalTimeTaken: true,
        resultsBySubject: true, resultsByType: true, resultsByChapter: true, allChapters: true, responses: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    if (testResults.length === 0) {
      return res.status(404).json({ message: "No test results found for this user" });
    }

    res.status(200).json(testResults);
  } catch (error) {
    console.error("Error fetching test results:", error);
    res.status(500).json({ message: "Error fetching test results" });
  }
};

const getLeaderboard = async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const currentUserId = req.query.userId ? parseInt(req.query.userId) : null;

    const [leaderboard, allUsers] = await Promise.all([
      prisma.testresult.groupBy({
        by: ["userId"],
        _sum: { score: true, totalMarks: true },
        orderBy: { _sum: { score: "desc" } },
        take: limit,
      }),
      prisma.testresult.groupBy({ by: ["userId"], _count: { _all: true } }),
    ]);
    const totalUsers = allUsers.length;

    if (leaderboard.length === 0) return res.status(200).json({ entries: [], totalUsers: 0 });

    // Check if current user is in the top list; if not, fetch their data separately
    let currentUserEntry = null;
    if (currentUserId && !leaderboard.find((e) => e.userId === currentUserId)) {
      const allRanked = await prisma.testresult.groupBy({
        by: ["userId"],
        _sum: { score: true, totalMarks: true },
        orderBy: { _sum: { score: "desc" } },
      });
      const userIndex = allRanked.findIndex((e) => e.userId === currentUserId);
      if (userIndex !== -1) {
        const entry = allRanked[userIndex];
        const userRecord = await prisma.user.findUnique({
          where: { id: currentUserId },
          select: { id: true, name: true, email: true, profile: true },
        });
        currentUserEntry = {
          rank: userIndex + 1,
          userId: currentUserId,
          name: userRecord?.name || "Unknown",
          email: userRecord?.email || "N/A",
          profile: userRecord?.profile || "/images/user/default.png",
          totalScore: entry._sum.score,
          totalMarks: entry._sum.totalMarks,
          accuracy: entry._sum.totalMarks
            ? ((entry._sum.score / entry._sum.totalMarks) * 100).toFixed(2)
            : 0,
          isCurrentUser: true,
        };
      }
    }

    // Single query for all users in top list
    const userIds = leaderboard.map((e) => e.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, profile: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const leaderboardWithUsers = leaderboard.map((entry, index) => {
      const user = userMap[entry.userId];
      return {
        rank: index + 1,
        userId: entry.userId,
        name: user?.name || "Unknown",
        email: user?.email || "N/A",
        profile: user?.profile || "/images/user/default.png",
        totalScore: entry._sum.score,
        totalMarks: entry._sum.totalMarks,
        accuracy: entry._sum.totalMarks
          ? ((entry._sum.score / entry._sum.totalMarks) * 100).toFixed(2)
          : 0,
      };
    });

    // Append current user's entry at the end if they're outside the top list
    if (currentUserEntry) leaderboardWithUsers.push(currentUserEntry);

    res.status(200).json({ entries: leaderboardWithUsers, totalUsers });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ message: "Error fetching leaderboard" });
  }
};



module.exports = { createTestResult, getAllTestResults, getTestResultsByUser, getLeaderboard };
