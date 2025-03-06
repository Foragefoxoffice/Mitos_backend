const express = require("express");
const {
  getAllQuestions,
  getQuestionsByTopic,
  getQuestionsByMultipleTopics, // Import the new function
  getQuestionsByMultipleTypes,
  getQuestionsBySubject,
  getQuestionsByChapter,
  getQuestionsByQuestionType,
  createQuestion,
  createQuestions,
  getRandomTestQuestions,
  getPortionBasedTestQuestions,
  getSubjectBasedTestQuestions,
  getChapterBasedTestQuestions,
  getCustomTestQuestions,
  deleteQuestion,
  updateQuestion,
  upload,
  getQuestionById
} = require("../controllers/questionController");
const { authenticateUser, authorizeRole } = require("../middlewares/authMiddleware");

const router = express.Router();

// Existing routes
router.get("/", authenticateUser, getAllQuestions);
router.get("/:id",authenticateUser,getQuestionById);
router.get("/topic/:topicId", authenticateUser, getQuestionsByTopic);
router.get("/subject/:subjectId", authenticateUser, getQuestionsBySubject);
router.get("/chapter/:chapterId", authenticateUser, getQuestionsByChapter);
router.get("/questiontype/:questionTypeId", authenticateUser, getQuestionsByQuestionType);
router.post("/", authenticateUser, authorizeRole(["admin"]), upload, createQuestion);
router.post("/many", authenticateUser, authorizeRole(["admin"]), createQuestions);
router.delete("/delete/:id", authenticateUser, authorizeRole(["admin"]), deleteQuestion  );
router.put("/update/:id", authenticateUser, authorizeRole(["admin"]), updateQuestion );

// New route for fetching questions by multiple topics
router.get("/topics", authenticateUser, getQuestionsByMultipleTopics);
router.get("/questiontype", authenticateUser, getQuestionsByMultipleTypes);
router.get("/fulltest", authenticateUser, getRandomTestQuestions);
router.get("/portion/:portionId", authenticateUser, getPortionBasedTestQuestions);
router.get("/portion/:portionId/subject/:subjectId", authenticateUser, getSubjectBasedTestQuestions);
router.get("/portion/:portionId/subject/:subjectId/chapter/:chapterId", authenticateUser, getChapterBasedTestQuestions);
router.post("/custom", authenticateUser, getCustomTestQuestions);
module.exports = router;
