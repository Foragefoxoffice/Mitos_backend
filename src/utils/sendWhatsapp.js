const axios = require("axios");

const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
  throw new Error("WhatsApp ENV variables missing");
}

/**
 * Send WhatsApp OTP
 * @param {string} phone
 * @param {string|number} otp
 * @param {object} options
 * @param {boolean} options.includeUrlButton
 */
async function sendWhatsappOTP(phone, otp, options = {}) {
  const formattedPhone = phone.replace(/\D/g, "");
  const otpText = String(otp);

  const components = [
    {
      type: "body",
      parameters: [{ type: "text", text: otpText }],
    },
  ];

  // URL button support
  if (options.includeUrlButton) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: otpText }],
    });
  }

  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: "login_otp",
      language: { code: "en_US" },
      components,
    },
  };

  try {
    const res = await axios.post(
      `https://graph.facebook.com/v22.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    return res.data;
  } catch (error) {
    console.error("🔥 WhatsApp Error:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = sendWhatsappOTP;
