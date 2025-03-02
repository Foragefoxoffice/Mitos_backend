const express = require("express");
const { createTestResult, getAllTestResults, getTestResultsByUser,getLeaderboard  } = require("../controllers/testController");
const { authenticateUser, authorizeRole } = require("../middlewares/authMiddleware");

const router = express.Router();

// Create a new test result (Only authenticated users)
router.post("/", authenticateUser, authorizeRole(["admin", "user"]), createTestResult);

// Get all test results (Only admin)
router.get("/", authenticateUser, authorizeRole(["admin"]), getAllTestResults);

// Get all test results (Only admin)
router.get("/a", authenticateUser, authorizeRole(["admin"]), getLeaderboard);

// Get test results for a specific user (User can see their own results)
router.get("/:userId", authenticateUser, authorizeRole(["admin", "user"]), getTestResultsByUser);

module.exports = router;
