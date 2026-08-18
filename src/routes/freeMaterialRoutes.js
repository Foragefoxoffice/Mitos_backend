// routes/freeMaterialRoutes.js
const express = require("express");
const multer = require("multer");
const { authenticateUser, authorizeRole } = require("../middlewares/authMiddleware");

const {
  uploadFreeMaterial,
  getFreeMaterialsBySubject,
  getFreeMaterialsByChapter,
  deleteFreeMaterial,
  getAllFreeMaterials,
  getChaptersWithFreeMaterials,
} = require("../controllers/freeMaterialController");

const fs = require("fs");
const path = require("path");

const router = express.Router();

// ✅ Directory for uploads: /uploads/freematerials
const uploadDir = path.join(__dirname, "/../../uploads/freematerials/");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer Storage
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

// ⭐ Admin Upload
router.post(
  "/",
  authenticateUser,
  authorizeRole(["admin"]),
  upload.single("file"),
  uploadFreeMaterial
);

// ⭐ Get chapters that have materials for a subject
router.get("/chapters/:subjectId", getChaptersWithFreeMaterials);

// ⭐ Get by subject
router.get("/subject/:subjectId", getFreeMaterialsBySubject);

// ⭐ Get by chapter
router.get("/chapter/:chapterId", getFreeMaterialsByChapter);

// ⭐ Get All
router.get("/", getAllFreeMaterials);

// ⭐ Delete
router.delete(
  "/:id",
  authenticateUser,
  authorizeRole(["admin"]),
  deleteFreeMaterial
);

module.exports = router;
