const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/settingController");

router.get("/", ctrl.getSettings);
router.put("/:key", authenticateUser, ctrl.upsertSetting);

module.exports = router;
