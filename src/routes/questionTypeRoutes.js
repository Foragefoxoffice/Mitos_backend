const express = require("express");
const {
  createQuestionType,
  editQuestionType,
  deleteQuestionType,
  getAllQuestionTypes,
  getQuestionTypeById,
} = require("../controllers/questionTypeController");

const router = express.Router();

router.post("/", createQuestionType);
router.put("/:id", editQuestionType);
router.delete("/:id", deleteQuestionType);
router.get("/", getAllQuestionTypes); // Get all
router.get("/:id", getQuestionTypeById); // Get by ID

module.exports = router;
