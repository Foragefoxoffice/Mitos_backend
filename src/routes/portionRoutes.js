const express = require("express");
const {
  createPortion,
  editPortion,
  deletePortion,
  getAllPortions,
  getPortionById,
} = require("../controllers/portionController");

const router = express.Router();

router.post("/", createPortion);
router.put("/:id", editPortion);
router.delete("/:id", deletePortion);
router.get("/", getAllPortions); // Get all
router.get("/:id", getPortionById); // Get by ID

module.exports = router;
