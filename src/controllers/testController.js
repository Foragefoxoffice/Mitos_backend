const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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
      answered,
      correct,
      wrong,
      unanswered,
      accuracy,
      totalTimeTaken,
      resultsByType,
      resultsByChapter,
    } = req.body;

    const testResult = await prisma.testResult.create({
      data: {
        userId,
        score,
        totalMarks,
        answered,
        correct,
        wrong,
        unanswered,
        accuracy,
        totalTimeTaken: parseTimeToSeconds(totalTimeTaken), // Convert to seconds
        resultsByType,
        resultsByChapter,
      },
    });

    res.status(201).json(testResult);
  } catch (error) {
    console.error("Error saving test result:", error);
    res.status(500).json({ message: "Error saving test result", error: error.message });
  }
};

// Get all test results (Admin only)
const getAllTestResults = async (req, res) => {
  try {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const testResults = await prisma.testResult.findMany({
      where: {
        createdAt: {
          gte: oneMonthAgo, // Filter results created in the last month
        },
      },
      include: { user: true },
    });

    res.status(200).json(testResults);
  } catch (error) {
    console.error("Error fetching test results:", error);
    res.status(500).json({ message: "Error fetching test results" });
  }
};

// Get test results by user ID
const getTestResultsByUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const testResults = await prisma.testResult.findMany({
      where: { userId: parseInt(userId) },
      include: { user: true },
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
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    const leaderboard = await prisma.testResult.groupBy({
      by: ["userId"],
      where: {
        createdAt: {
          gte: startOfMonth, // Fetch results from the beginning of the current month
        },
      },
      _sum: {
        score: true, // Sum of scores for each user
        totalMarks: true, // Total marks for accuracy calculations
      },
      orderBy: {
        _sum: {
          score: "desc", // Sort by total score descending
        },
      },
    });

    // Fetch user details
    const leaderboardWithUsers = await Promise.all(
      leaderboard.map(async (entry) => {
        const user = await prisma.user.findUnique({
          where: { id: entry.userId },
          select: { id: true, name: true, email: true }, // Select user details
        });

        return {
          rank: leaderboard.findIndex((e) => e.userId === entry.userId) + 1, // Assign rank
          userId: entry.userId,
          name: user?.name || "Unknown",
          email: user?.email || "N/A",
          totalScore: entry._sum.score,
          totalMarks: entry._sum.totalMarks,
          accuracy: entry._sum.totalMarks ? ((entry._sum.score / entry._sum.totalMarks) * 100).toFixed(2) : 0, // Calculate accuracy
        };
      })
    );

    res.status(200).json(leaderboardWithUsers);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ message: "Error fetching leaderboard" });
  }
};

module.exports = { createTestResult, getAllTestResults, getTestResultsByUser, getLeaderboard };
