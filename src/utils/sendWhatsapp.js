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

// Approved Meta "Authentication" template (copy-code button). Its body text
// is fixed by Meta: "{{1}} is your verification code. For your security, do
// not share this code. Expires in 10 minutes." Override via env if renamed.
const OTP_TEMPLATE_NAME = process.env.WHATSAPP_OTP_TEMPLATE || "whatsapp_otp";
const OTP_TEMPLATE_LANG = process.env.WHATSAPP_OTP_TEMPLATE_LANG || "en_US";

/**
 * Send WhatsApp OTP
 * @param {string} phone
 * @param {string|number} otp
 */
async function sendWhatsappOTP(phone, otp) {
  const otpText = String(otp);

  return postMessage({
    messaging_product: "whatsapp",
    to: normalizePhone(phone),
    type: "template",
    template: {
      name: OTP_TEMPLATE_NAME,
      language: { code: OTP_TEMPLATE_LANG },
      components: [
        { type: "body", parameters: [{ type: "text", text: otpText }] },
        // Authentication templates require the code again for the
        // copy-code button, or Meta rejects the send.
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: otpText }],
        },
      ],
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

// Marks the customer's inbound message as read (blue ticks) AND shows the
// "typing…" indicator in their chat — Meta's Cloud API ties the two
// together in one call. The indicator clears itself as soon as we send our
// next message, or after ~25s, whichever comes first — no separate "stop
// typing" call exists or is needed.
const markReadWithTypingIndicator = async ({ messageId }) =>
  postMessage({
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
    typing_indicator: { type: "text" },
  });

sendWhatsappOTP.sendWhatsappOTP = sendWhatsappOTP;
sendWhatsappOTP.sendWhatsappTemplate = sendWhatsappTemplate;
sendWhatsappOTP.sendWhatsappText = sendWhatsappText;
sendWhatsappOTP.markReadWithTypingIndicator = markReadWithTypingIndicator;
sendWhatsappOTP.normalizePhone = normalizePhone;
sendWhatsappOTP.isWhatsappConfigured = () => !!(WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID);

module.exports = sendWhatsappOTP;
