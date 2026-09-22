const axios = require("axios");

const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v22.0";

const countBodyVariables = (bodyText) => {
  const matches = String(bodyText || "").match(/\{\{\d+\}\}/g);
  return matches ? new Set(matches).size : 0;
};

const hasDynamicUrl = (url) => /\{\{\d+\}\}/.test(String(url || ""));

const parseTemplateComponents = (components) => {
  const list = Array.isArray(components) ? components : [];
  const header = list.find((c) => c.type === "HEADER");
  const body = list.find((c) => c.type === "BODY");
  const footer = list.find((c) => c.type === "FOOTER");
  const buttonsComponent = list.find((c) => c.type === "BUTTONS");
  const bodyText = body?.text || "";

  return {
    headerFormat: header?.format || null,
    headerText: header?.format === "TEXT" ? header.text || "" : "",
    bodyText,
    bodyVariableCount: countBodyVariables(bodyText),
    footerText: footer?.text || "",
    buttons: (buttonsComponent?.buttons || []).map((b) => ({
      type: b.type,
      text: b.text || "",
      hasDynamicUrl: b.type === "URL" && hasDynamicUrl(b.url),
    })),
  };
};

const fetchApprovedTemplates = async () => {
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!wabaId) {
    throw new Error("WHATSAPP_BUSINESS_ACCOUNT_ID is not configured");
  }

  const response = await axios.get(
    `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${wabaId}/message_templates`,
    {
      params: { fields: "name,status,category,language,components", limit: 100 },
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
    }
  );

  const templates = response.data?.data || [];
  return templates
    .filter((t) => t.status === "APPROVED" && t.category !== "AUTHENTICATION")
    .map((t) => ({
      name: t.name,
      language: t.language,
      category: t.category,
      ...parseTemplateComponents(t.components),
    }));
};

module.exports = { parseTemplateComponents, countBodyVariables, hasDynamicUrl, fetchApprovedTemplates };
