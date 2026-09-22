const sendWhatsappOTP = require("./sendWhatsapp");

const parseBool = (value, fallback = false) => {
  if (value == null) return fallback;
  return String(value).toLowerCase() === "true";
};

const getSalesAgentConfig = () => {
  const ownerPhone = sendWhatsappOTP.normalizePhone(process.env.WHATSAPP_SALES_OWNER_PHONE || "");
  const adminHandoffPhone = sendWhatsappOTP.normalizePhone(process.env.WHATSAPP_SALES_ADMIN_PHONE || "");
  const appBaseUrl = (process.env.FRONTEND_URL || process.env.APP_BASE_URL || "https://mitoslearning.com").replace(/\/+$/, "");

  return {
    ownerPhone,
    adminHandoffPhone,
    ownerName: process.env.WHATSAPP_SALES_OWNER_NAME || "Owner Test",
    agentName: process.env.WHATSAPP_SALES_AGENT_NAME || "Mitos Premium Guide",
    webhookVerifyToken: process.env.WHATSAPP_SALES_WEBHOOK_VERIFY_TOKEN || "",
    ownerOpenerTemplate: process.env.WHATSAPP_SALES_OWNER_OPENER_TEMPLATE || "",
    ownerOpenerTemplateLanguage: process.env.WHATSAPP_SALES_OWNER_OPENER_TEMPLATE_LANG || "en_US",
    ownerAutoReplyEnabled: parseBool(process.env.WHATSAPP_SALES_OWNER_AUTO_REPLY, true),
    appBaseUrl,
  };
};

module.exports = { getSalesAgentConfig };
