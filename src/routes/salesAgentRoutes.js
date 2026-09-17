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
router.get("/admin/variable-field-options", verifyAdmin, ctrl.getVariableFieldOptions);
router.post("/admin/campaigns", verifyAdmin, ctrl.createCampaign);
router.get("/admin/campaigns", verifyAdmin, ctrl.getAdminCampaigns);
router.post("/admin/personal-coupons/import", verifyAdmin, ctrl.importPersonalCoupons);
router.get("/admin/personal-coupons", verifyAdmin, ctrl.getPersonalCoupons);
router.get("/admin/knowledge", verifyAdmin, ctrl.getSalesKnowledgeBase);
router.put("/admin/knowledge", verifyAdmin, ctrl.updateSalesKnowledgeBase);
router.get("/admin/rules", verifyAdmin, ctrl.getSalesRules);
router.post("/admin/rules", verifyAdmin, ctrl.createSalesRule);
router.delete("/admin/rules/:id", verifyAdmin, ctrl.deleteSalesRule);

module.exports = router;
