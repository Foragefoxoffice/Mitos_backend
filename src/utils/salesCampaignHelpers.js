const MAX_CAMPAIGN_RECIPIENTS = 100;

const buildCampaignDedupeWhere = ({ phoneNumber, templateName, windowDays = 7, now = new Date() }) => {
  const where = {
    conversation: { phoneNumber },
    messageType: "template",
    text: `[template:${templateName}]`,
  };
  if (windowDays > 0) {
    where.createdAt = { gte: new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000) };
  }
  return where;
};

const validateCampaignRecipients = (recipients) => {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return { valid: false, error: "At least one recipient is required" };
  }
  if (recipients.length > MAX_CAMPAIGN_RECIPIENTS) {
    return { valid: false, error: `Cannot send to more than ${MAX_CAMPAIGN_RECIPIENTS} recipients per campaign` };
  }
  return { valid: true };
};

const buildTemplateBodyComponents = ({ bodyVariableCount, recipientName }) => {
  if (bodyVariableCount === 0) return [];
  if (bodyVariableCount === 1) {
    return [
      {
        type: "body",
        parameters: [{ type: "text", text: recipientName || "there" }],
      },
    ];
  }
  throw new Error("Templates with more than one body variable are not supported yet");
};

module.exports = {
  MAX_CAMPAIGN_RECIPIENTS,
  buildCampaignDedupeWhere,
  validateCampaignRecipients,
  buildTemplateBodyComponents,
};
