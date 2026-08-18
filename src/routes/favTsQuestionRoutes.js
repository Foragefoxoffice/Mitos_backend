const express = require("express");
const router = express.Router();
const { addFavTsQuestion, getUserFavTsQuestions, removeFavTsQuestion } = require("../controllers/favTsQuestionController");
const { authenticateUser } = require("../middlewares/authMiddleware");

router.get("/:userId", authenticateUser, getUserFavTsQuestions);
router.post("/", authenticateUser, addFavTsQuestion);
router.delete("/", authenticateUser, removeFavTsQuestion);

module.exports = router;
