const express = require("express");
const {
  createChapter,
  editChapter,
  deleteChapter,
  getChapterByParentId,
  getAllChapters,
  getChapterById,
} = require("../controllers/chapterController");

const router = express.Router();

// Create a new chapter
router.post("/", createChapter);

// Edit a chapter by ID
router.put("/:id", editChapter);

// Delete a chapter by ID
router.delete("/:id", deleteChapter);

// Get all chapters
router.get("/", getAllChapters);

// Get a chapter by its ID
router.get("/:id", getChapterById);

// Get chapters by subjectId
router.get("/chapter/:subjectId", getChapterByParentId);

module.exports = router;
