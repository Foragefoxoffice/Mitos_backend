const express = require("express");
const { getErrorBook, removeFromErrorBook, rebuildErrorBook } = require("../controllers/errorBookController");
const { authenticateUser } = require("../middlewares/authMiddleware");

const router = express.Router();

// Get user's error book (all wrong questions stored in DB)
router.get("/:userId", authenticateUser, getErrorBook);

// Remove a specific question from error book (called when answered correctly during practice)
router.delete("/:userId/question/:questionId", authenticateUser, removeFromErrorBook);

// Rebuild error book — removes unanswered questions, keeps only answered wrong
router.post("/:userId/rebuild", authenticateUser, rebuildErrorBook);

module.exports = router;
