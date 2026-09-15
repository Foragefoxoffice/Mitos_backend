const axios = require("axios");

const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v22.0";
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

const normalizePhone = (phone) => String(phone || "").replace(/\D/g, "");

const assertConfigured = () => {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error("WhatsApp ENV variables missing");
  }
};

const postMessage = async (payload) => {
  assertConfigured();
  try {
    const res = await axios.post(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
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
};

/**
 * Send WhatsApp OTP
 * @param {string} phone
 * @param {string|number} otp
 * @param {object} options
 * @param {boolean} options.includeUrlButton
 */
async function sendWhatsappOTP(phone, otp, options = {}) {
  const formattedPhone = normalizePhone(phone);
  const otpText = String(otp);

  const components = [
    {
      type: "body",
      parameters: [{ type: "text", text: otpText }],
    },
  ];

  if (options.includeUrlButton) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: otpText }],
    });
  }

  return postMessage({
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: "login_otp",
      language: { code: "en_US" },
      components,
    },
  });
}

const sendWhatsappTemplate = async ({
  to,
  name,
  languageCode = "en_US",
  components = [],
}) =>
  postMessage({
    messaging_product: "whatsapp",
    to: normalizePhone(to),
    type: "template",
    template: {
      name,
      language: { code: languageCode },
      ...(components.length ? { components } : {}),
    },
  });

const sendWhatsappText = async ({ to, text, previewUrl = false }) =>
  postMessage({
    messaging_product: "whatsapp",
    to: normalizePhone(to),
    type: "text",
    text: {
      preview_url: previewUrl,
      body: String(text || ""),
    },
  });

sendWhatsappOTP.sendWhatsappOTP = sendWhatsappOTP;
sendWhatsappOTP.sendWhatsappTemplate = sendWhatsappTemplate;
sendWhatsappOTP.sendWhatsappText = sendWhatsappText;
sendWhatsappOTP.normalizePhone = normalizePhone;
sendWhatsappOTP.isWhatsappConfigured = () => !!(WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID);

module.exports = sendWhatsappOTP;
