const express = require("express");
const {
  getAllQuestions,
  getPaginatedQuestions,
  getQuestionsByTopic,
  getQuestionsByMultipleTopics, 
  getQuestionsByMultipleTypes,
  getQuestionsBySubjectAndQuestionId,
  getQuestionsBySubject,
  getQuestionsByChapter,
  getQuestionsByQuestionType,
  createQuestion,
  createQuestions,
  getRandomTestQuestions,
  getPortionBasedTestQuestions,
  getSubjectBasedTestQuestions,
  getChapterBasedTestQuestions,
  getQuestionsBySubjectAndChapterId,
  getCustomTestQuestions,
  deleteQuestion,
  updateQuestion,
  upload,
  getQuestionById,
  getQuestionsByPortion,
  getQuestionsByIds,
} = require("../controllers/questionController");
const { authenticateUser, authorizeRole } = require("../middlewares/authMiddleware");

const router = express.Router();

// New route for fetching questions by multiple topics
router.get("/topics", authenticateUser,authorizeRole(["guest","user"]), getQuestionsByMultipleTopics);
router.get("/questiontype", authenticateUser,authorizeRole(["user"]), getQuestionsByMultipleTypes);
router.get("/by-subject-and-id", authenticateUser,authorizeRole(["user"]), getQuestionsBySubjectAndQuestionId);
router.get("/by-subject-and-chapter-id", authenticateUser,authorizeRole(["user"]), getQuestionsBySubjectAndChapterId);
router.get("/fulltest", authenticateUser,authorizeRole(["user"]), getRandomTestQuestions);
router.get("/portion/:portionId", authenticateUser,authorizeRole(["user"]), getPortionBasedTestQuestions);
router.get("/portion/:portionId/subject/:subjectId",authorizeRole(["user"]), authenticateUser, getSubjectBasedTestQuestions);
router.post("/custom", authenticateUser,authorizeRole(["user"]), getChapterBasedTestQuestions);
router.post("/by-ids", authenticateUser, authorizeRole(["user", "admin"]), getQuestionsByIds);

// Existing routes
router.get("/", authenticateUser, getAllQuestions);
router.get("/paginated", authenticateUser, getPaginatedQuestions);
router.get("/:id",authenticateUser,getQuestionById);
router.get("/topic/:topicId", authenticateUser, getQuestionsByTopic);
router.get("/getportion/:portionId", authenticateUser,authorizeRole(["guest","user"]), getQuestionsByPortion);
router.get("/subject/:subjectId", authenticateUser,authorizeRole(["guest","user"]), getQuestionsBySubject);
router.get("/chapter/:chapterId", authenticateUser,authorizeRole(["guest","user"]), getQuestionsByChapter);
router.get("/questiontype/:questionTypeId",authorizeRole(["guest","user"]), authenticateUser, getQuestionsByQuestionType);
router.post("/", authenticateUser, authorizeRole(["admin"]), upload, createQuestion);
router.post("/many", authenticateUser, authorizeRole(["admin"]), createQuestions);
router.delete("/delete/:id", authenticateUser, authorizeRole(["admin"]), deleteQuestion  );
router.put("/update/:id", authenticateUser, authorizeRole(["admin"]),upload, updateQuestion );


module.exports = router;
