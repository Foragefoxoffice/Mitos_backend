const express = require("express");
const {
  createTopic,
  editTopic,
  deleteTopic,
  getTopicByParentId,
  getAllTopics,
  getTopicById,
  getTopicByChapter,
  getTopicsByChapterWithCounts,
} = require("../controllers/topicController");

const router = express.Router();

router.post("/", createTopic);
router.put("/:id", editTopic);
router.delete("/:id", deleteTopic);
router.get("/", getAllTopics); // Get all
router.get("/by-chapter-with-counts/:chapterId", getTopicsByChapterWithCounts); // Get topics with counts
router.get("/:id", getTopicById); // Get by ID
router.get("/chapter/:chapterId", getTopicByChapter);
// Get chapters by subjectId
router.get("/topic/:chapterId", getTopicByParentId);

module.exports = router;
