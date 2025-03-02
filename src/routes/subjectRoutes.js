const express = require("express");
const {
  createSubject,
  editSubject,
  deleteSubject,
  getAllSubjects,
  getSubjectById,
  getSubjectByParentId,
} = require("../controllers/subjectController");

const router = express.Router();

router.post("/", createSubject);
router.put("/:id", editSubject);
router.delete("/:id", deleteSubject);
router.get("/", getAllSubjects); // Get all
router.get("/:id", getSubjectById); // Get by ID
// Get chapters by subjectId
router.get("/subject/:portionId", getSubjectByParentId);

module.exports = router;
