const express = require("express");
const { authenticateUser } = require("../middlewares/authMiddleware");
const { completePractice, getChapterProgress } = require("../controllers/topicProgressController");

const router = express.Router();

router.post("/complete", authenticateUser, completePractice);
router.get("/chapter/:chapterId", authenticateUser, getChapterProgress);

module.exports = router;
