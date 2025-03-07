const express = require("express");
const multer = require("multer");
const {
  createPDF,
  getAllPDFs,
  getPDFById,
  deletePDF,
  getPDFsByPortion,
  getPDFsBySubject,
  getPDFsByChapter,
  getPDFsByTopic,
} = require("../controllers/pdfController");
const { authenticateUser, authorizeRole } = require("../middlewares/authMiddleware");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, "../pdfuploads/");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDFs are allowed!"), false);
    }
    cb(null, true);
  },
});

// Routes
router.post("/", authenticateUser, authorizeRole(["admin"]), upload.single("pdf"), createPDF);
router.get("/", authenticateUser, getAllPDFs);
router.get("/:id", authenticateUser, getPDFById);
router.get("/portion/:portionId", authenticateUser, getPDFsByPortion);
router.get("/subject/:subjectId", authenticateUser, getPDFsBySubject);
router.get("/chapter/:chapterId", authenticateUser, getPDFsByChapter);
router.get("/topic/:topicId", authenticateUser, getPDFsByTopic);
router.delete("/:id", authenticateUser, deletePDF);

module.exports = router;
