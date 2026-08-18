const express = require("express");
const { createTestResult, getAllTestResults, getTestResultsByUser,getLeaderboard  } = require("../controllers/testController");
const { authenticateUser, authorizeRole } = require("../middlewares/authMiddleware");

const router = express.Router();

// Create a new test result (Only authenticated users)
router.post("/", createTestResult);

// Get all test results (Only admin)
router.get("/", authenticateUser, authorizeRole(["admin","user"]), getAllTestResults);

// Get all test res authenticateUser, authorizeRole(["admin", "user"]),ults (Only admin)
router.get("/leaders", authenticateUser, authorizeRole(["admin","user"]), getLeaderboard);

// Get test results for a specific user (User can see their own results)
router.get("/:userId", authenticateUser, authorizeRole(["admin", "user"]), getTestResultsByUser);

module.exports = router;
