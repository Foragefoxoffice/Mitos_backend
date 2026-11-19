const { sendWhatsappTemplate, isWhatsappConfigured } = require("../utils/sendWhatsapp");

/**
 * Fire-and-forget WhatsApp "you're now logged in" message (Meta template
 * `after_otp`), sent after a successful WhatsApp or email OTP login — first
 * sign-up or a later re-login. Never throws: a notification failure must
 * never fail the login, so callers don't await it.
 */
async function notifyOtpLogin(phone) {
  try {
    const name = process.env.WHATSAPP_LOGIN_TEMPLATE;
    if (!name) {
      console.log("[AUTH] login notification skipped: WHATSAPP_LOGIN_TEMPLATE not set");
      return;
    }
    if (!phone) return; // email user who never gave a phone number
    if (!isWhatsappConfigured()) {
      console.log("[AUTH] login notification skipped: WhatsApp not configured");
      return;
    }
    await sendWhatsappTemplate({
      to: phone,
      name,
      languageCode: process.env.WHATSAPP_LOGIN_TEMPLATE_LANG || "en_US",
    });
  } catch (err) {
    console.error("[AUTH] notifyOtpLogin failed:", err.message || err);
  }
}

module.exports = { notifyOtpLogin };
