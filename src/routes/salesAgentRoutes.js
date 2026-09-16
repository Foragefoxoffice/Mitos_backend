const express = require("express");
const ctrl = require("../controllers/salesAgentController");
const { verifyAdmin } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/status", verifyAdmin, ctrl.getStatus);
router.post("/owner/test-send", verifyAdmin, ctrl.sendOwnerTestMessage);
router.get("/webhook", ctrl.verifyWebhook);
router.post("/webhook", ctrl.handleWebhook);

router.get("/admin/conversations", verifyAdmin, ctrl.getAdminConversations);
router.get("/admin/conversations/:id", verifyAdmin, ctrl.getAdminConversationDetail);
router.post("/admin/conversations/:id/takeover", verifyAdmin, ctrl.setConversationTakeover);
router.get("/admin/templates", verifyAdmin, ctrl.getAdminTemplates);
router.get("/admin/user-search", verifyAdmin, ctrl.searchRecipientUsers);
router.get("/admin/recipient-candidates", verifyAdmin, ctrl.getRecipientCandidates);
router.post("/admin/campaigns", verifyAdmin, ctrl.createCampaign);
router.get("/admin/campaigns", verifyAdmin, ctrl.getAdminCampaigns);

module.exports = router;
