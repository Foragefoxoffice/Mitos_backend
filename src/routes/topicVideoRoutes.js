const express = require("express");
const { authenticateUser, authorizeRole } = require("../middlewares/authMiddleware");
const {
  upsertTopicVideo,
  getAdminTopicVideos,
  getTopicVideoByTopic,
  getTopicVideosByChapter,
  updateTopicVideo,
  deleteTopicVideo,
} = require("../controllers/topicVideoController");

const router = express.Router();
const admin = [authenticateUser, authorizeRole(["admin"])];

// Admin
router.get("/admin", ...admin, getAdminTopicVideos);
router.post("/", ...admin, upsertTopicVideo);
router.patch("/:id", ...admin, updateTopicVideo);
router.delete("/:id", ...admin, deleteTopicVideo);

// App
router.get("/topic/:topicId", authenticateUser, getTopicVideoByTopic);
router.get("/chapter/:chapterId", authenticateUser, getTopicVideosByChapter);

module.exports = router;
