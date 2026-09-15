const express = require("express");
const ctrl = require("../controllers/salesAgentController");
const { verifyAdmin } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/status", verifyAdmin, ctrl.getStatus);
router.post("/owner/test-send", verifyAdmin, ctrl.sendOwnerTestMessage);
router.get("/webhook", ctrl.verifyWebhook);
router.post("/webhook", ctrl.handleWebhook);

module.exports = router;
