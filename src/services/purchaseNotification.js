const { sendWhatsappTemplate, isWhatsappConfigured } = require("../utils/sendWhatsapp");

/**
 * Fire-and-forget WhatsApp "your purchase is active" notification. Never
 * throws — callers should not (and don't need to) await this to know
 * whether fulfilment succeeded; a notification failure must never fail the
 * checkout flow.
 */
async function notifyPurchaseActivated(phone) {
  try {
    const name = process.env.WHATSAPP_PURCHASE_TEMPLATE;
    if (!name) {
      console.log("[CHECKOUT] purchase notification skipped: WHATSAPP_PURCHASE_TEMPLATE not set");
      return;
    }
    if (!isWhatsappConfigured()) {
      console.log("[CHECKOUT] purchase notification skipped: WhatsApp not configured");
      return;
    }
    await sendWhatsappTemplate({
      to: phone,
      name,
      languageCode: process.env.WHATSAPP_PURCHASE_TEMPLATE_LANG || "en_US",
    });
  } catch (err) {
    console.error("[CHECKOUT] notifyPurchaseActivated failed:", err.message || err);
  }
}

module.exports = { notifyPurchaseActivated };
