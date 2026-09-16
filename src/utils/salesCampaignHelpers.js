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

const VARIABLE_FIELD_OPTIONS = [
  { value: "name", label: "Recipient's name" },
  { value: "className", label: "Recipient's class (11 / 12 / Repeater)" },
  { value: "phoneNumber", label: "Recipient's phone number" },
  { value: "trialStartedAt", label: "Trial start date" },
  { value: "trialEndsAt", label: "Trial end date" },
  { value: "premiumExpiry", label: "Premium expiry date" },
  { value: "currentDate", label: "Today's date" },
  { value: "custom", label: "Fixed text for everyone" },
];

const VALID_VARIABLE_FIELDS = VARIABLE_FIELD_OPTIONS.map((o) => o.value);

const CLASS_LABELS = { CLASS_11: "Class 11", CLASS_12: "Class 12", REPEATER: "Repeater" };

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatDateValue = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
};

const resolveTemplateVariableValue = ({ field, customValue, userRecord, now = new Date() }) => {
  if (field === "className") {
    const raw = userRecord?.className;
    return raw ? CLASS_LABELS[raw] || raw : null;
  }
  if (field === "phoneNumber") return userRecord?.phoneNumber || null;
  if (field === "trialStartedAt") return formatDateValue(userRecord?.trialStartedAt);
  if (field === "trialEndsAt") return formatDateValue(userRecord?.trialEndsAt);
  if (field === "premiumExpiry") return formatDateValue(userRecord?.premiumExpiry);
  if (field === "currentDate") return formatDateValue(now);
  if (field === "custom") return customValue || null;
  return userRecord?.name || null;
};

const validateVariableMappings = ({ bodyVariableCount, variableMappings }) => {
  if (!bodyVariableCount) return { valid: true };
  const mappings = Array.isArray(variableMappings) ? variableMappings : [];
  if (mappings.length !== bodyVariableCount) {
    return { valid: false, error: `This template needs ${bodyVariableCount} variable mapping(s)` };
  }
  for (const mapping of mappings) {
    if (!VALID_VARIABLE_FIELDS.includes(mapping?.field)) {
      return { valid: false, error: "Invalid variable field selected" };
    }
    if (mapping.field === "custom" && !String(mapping.customValue || "").trim()) {
      return { valid: false, error: "Enter a value for each fixed-text variable" };
    }
  }
  return { valid: true };
};

const buildTemplateBodyComponents = ({ bodyVariableCount, variableValues }) => {
  if (!bodyVariableCount) return [];
  const values = Array.isArray(variableValues) ? variableValues : [];
  const parameters = [];
  for (let i = 0; i < bodyVariableCount; i++) {
    parameters.push({ type: "text", text: values[i] || "there" });
  }
  return [{ type: "body", parameters }];
};

module.exports = {
  MAX_CAMPAIGN_RECIPIENTS,
  buildCampaignDedupeWhere,
  validateCampaignRecipients,
  VARIABLE_FIELD_OPTIONS,
  VALID_VARIABLE_FIELDS,
  formatDateValue,
  resolveTemplateVariableValue,
  validateVariableMappings,
  buildTemplateBodyComponents,
};
