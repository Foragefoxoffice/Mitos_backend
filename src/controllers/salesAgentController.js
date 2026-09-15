const axios = require("axios");
const prisma = require("../utils/prisma");
const sendWhatsappOTP = require("../utils/sendWhatsapp");
const { getSalesAgentConfig } = require("../utils/salesAgentConfig");

const aiServiceClient = axios.create({
  baseURL: process.env.AI_SERVICE_URL,
  headers: { "x-internal-key": process.env.INTERNAL_AI_SERVICE_KEY },
  timeout: 60000,
});

const SALES_PROMPT_VERSION = "whatsapp-sales-agent-mvp-v1";

const toBool = (value, fallback = false) => {
  if (value == null) return fallback;
  return value === true || value === "true";
};

const buildErrorMessage = (error, fallback) =>
  error.response?.data?.message || fallback;

const isMissingSalesTableError = (error) =>
  error?.code === "P2021" || error?.code === "P2022";

const trimPreview = (value, max = 255) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
};

const normalizeInboundText = (message) => {
  if (!message) return "";
  if (message.type === "text") return message.text?.body || "";
  if (message.type === "button") return message.button?.text || "";
  if (message.type === "interactive") {
    return (
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      ""
    );
  }
  return "";
};

const classifySubscriptionState = (user) => {
  const now = new Date();
  if (user?.premiumExpiry && new Date(user.premiumExpiry) > now) return "ACTIVE_PREMIUM";
  if (user?.trialEndsAt && new Date(user.trialEndsAt) > now) return "ACTIVE_TRIAL";
  if (user?.trialEndsAt && new Date(user.trialEndsAt) <= now) return "EXPIRED_TRIAL";
  return user?.status || "REGISTERED";
};

const fetchActivePlans = async () => {
  const plans = await prisma.neetplan.findMany({
    where: { isActive: true },
    orderBy: { expiresAt: "asc" },
    include: {
      neetplanprice: {
        where: { isActive: true, platform: "WEB" },
        orderBy: { finalPrice: "asc" },
      },
    },
  });

  return plans
    .map((plan) => {
      const price = plan.neetplanprice[0];
      if (!price) return null;
      return {
        code: plan.code,
        title: plan.title,
        expiresAt: plan.expiresAt,
        priceId: price.id,
        finalPrice: price.finalPrice || price.price,
        mrp: price.mrp || price.originalPrice || null,
        currency: price.currency,
      };
    })
    .filter(Boolean);
};

const pickPrimaryPlan = (plans) => {
  if (!plans.length) return null;
  return [...plans].sort((a, b) => {
    const aPrice = Number(a.finalPrice || Number.MAX_SAFE_INTEGER);
    const bPrice = Number(b.finalPrice || Number.MAX_SAFE_INTEGER);
    return aPrice - bPrice;
  })[0];
};

const buildSalesLinks = (config, primaryPlan) => {
  const subscriptionUrl = `${config.appBaseUrl}/user/subscription`;
  const checkoutUrl = primaryPlan
    ? `${config.appBaseUrl}/user/checkout?plan=${encodeURIComponent(primaryPlan.code)}`
    : null;
  return { subscriptionUrl, checkoutUrl };
};

const buildUserSalesContext = async (phoneNumber) => {
  const config = getSalesAgentConfig();
  const user = await prisma.user.findUnique({
    where: { phoneNumber },
    include: { useranalyticssummary: true },
  });
  const plans = await fetchActivePlans();
  const primaryPlan = pickPrimaryPlan(plans);
  const links = buildSalesLinks(config, primaryPlan);

  const summary = user?.useranalyticssummary;
  return {
    user: user
      ? {
          id: user.id,
          name: user.name || null,
          email: user.email || null,
          phoneNumber: user.phoneNumber || null,
          className: user.className || null,
          status: user.status,
          premiumExpiry: user.premiumExpiry,
          trialStartedAt: user.trialStartedAt,
          trialEndsAt: user.trialEndsAt,
          hasUsedTrial: user.hasUsedTrial,
          subscriptionState: classifySubscriptionState(user),
          analytics: summary
            ? {
                weakestSubject: summary.weakestSubject,
                weakestChapter: summary.weakestChapter,
                weakestTopic: summary.weakestTopic,
                overallAccuracy: summary.overallAccuracy,
                lastAccuracy: summary.lastAccuracy,
                totalTestsTaken: summary.totalTestsTaken,
              }
            : null,
        }
      : null,
    plans,
    primaryPlan,
    links,
  };
};

const ensureSalesConversation = async ({ phoneNumber, ownerTest, preview, userId }) => {
  try {
    return await prisma.whatsappconversation.upsert({
      where: { phoneNumber },
      update: {
        ownerTest,
        preview,
        userId: userId || null,
      },
      create: {
        phoneNumber,
        ownerTest,
        preview,
        userId: userId || null,
      },
    });
  } catch (error) {
    if (isMissingSalesTableError(error)) return null;
    throw error;
  }
};

const ensureSalesLead = async ({ conversationId, userId, phoneNumber, stage }) => {
  if (!conversationId) return null;
  try {
    return await prisma.saleslead.upsert({
      where: { conversationId },
      update: {
        userId: userId || null,
        phoneNumber,
        stage,
      },
      create: {
        conversationId,
        userId: userId || null,
        phoneNumber,
        stage,
      },
    });
  } catch (error) {
    if (isMissingSalesTableError(error)) return null;
    throw error;
  }
};

const createSalesMessage = async ({
  conversationId,
  waMessageId,
  direction,
  senderRole,
  messageType,
  status,
  text,
  rawPayload,
}) => {
  if (!conversationId) return null;
  try {
    return await prisma.whatsappmessage.create({
      data: {
        conversationId,
        waMessageId: waMessageId || null,
        direction,
        senderRole,
        messageType,
        status,
        text: text || null,
        rawPayload: rawPayload || undefined,
      },
    });
  } catch (error) {
    if (isMissingSalesTableError(error)) return null;
    throw error;
  }
};

const touchConversation = async (conversationId, fields) => {
  if (!conversationId) return;
  try {
    await prisma.whatsappconversation.update({
      where: { id: conversationId },
      data: fields,
    });
  } catch (error) {
    if (isMissingSalesTableError(error)) return;
    throw error;
  }
};

const listHistoryMessages = async (conversationId) => {
  if (!conversationId) return [];
  try {
    const rows = await prisma.whatsappmessage.findMany({
      where: { conversationId, text: { not: null } },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    return rows.map((row) => ({
      role: row.direction === "INBOUND" ? "user" : "assistant",
      content: row.text,
    }));
  } catch (error) {
    if (isMissingSalesTableError(error)) return [];
    throw error;
  }
};

const recordReplyAudit = async ({
  conversationId,
  leadId,
  sourceMessageId,
  provider,
  model,
  systemPrompt,
  promptText,
  replyText,
  toolTrace,
}) => {
  try {
    await prisma.aireplyaudit.create({
      data: {
        conversationId: conversationId || null,
        leadId: leadId || null,
        sourceMessageId: sourceMessageId || null,
        promptVersion: SALES_PROMPT_VERSION,
        provider: provider || null,
        model: model || null,
        systemPrompt: systemPrompt || null,
        promptText: promptText || null,
        replyText: replyText || null,
        toolTrace: toolTrace || undefined,
      },
    });
  } catch (error) {
    if (isMissingSalesTableError(error)) return;
    throw error;
  }
};

const generateSalesReply = async ({
  historyMessages,
  newMessage,
  userContext,
  salesContext,
}) => {
  const response = await aiServiceClient.post("/internal/ai/sales/reply", {
    historyMessages,
    newMessage,
    userContext,
    salesContext,
    promptVersion: SALES_PROMPT_VERSION,
  });
  return response.data;
};

const sendTextMessage = async ({ to, text }) => {
  const response = await sendWhatsappOTP.sendWhatsappText({ to, text });
  return {
    providerResponse: response,
    messageId: response?.messages?.[0]?.id || null,
  };
};

const sendTemplateMessage = async ({ to, templateName, languageCode }) => {
  const response = await sendWhatsappOTP.sendWhatsappTemplate({
    to,
    name: templateName,
    languageCode,
  });
  return {
    providerResponse: response,
    messageId: response?.messages?.[0]?.id || null,
  };
};

const getStatus = async (req, res) => {
  const config = getSalesAgentConfig();
  res.json({
    ownerPhoneConfigured: !!config.ownerPhone,
    ownerAutoReplyEnabled: config.ownerAutoReplyEnabled,
    ownerOpenerTemplateConfigured: !!config.ownerOpenerTemplate,
    webhookVerifyTokenConfigured: !!config.webhookVerifyToken,
    whatsappConfigured: sendWhatsappOTP.isWhatsappConfigured(),
    agentName: config.agentName,
    promptVersion: SALES_PROMPT_VERSION,
  });
};

const sendOwnerTestMessage = async (req, res) => {
  const config = getSalesAgentConfig();
  if (!config.ownerPhone) {
    return res.status(400).json({ message: "WHATSAPP_SALES_OWNER_PHONE is not configured" });
  }

  const {
    message,
    incomingMessage,
    dryRun,
    forceTemplate,
    templateName,
  } = req.body || {};
  const dryRunEnabled = toBool(dryRun, false);
  const forceTemplateEnabled = toBool(forceTemplate, false);

  if (!message && !incomingMessage && !(forceTemplateEnabled || templateName || config.ownerOpenerTemplate)) {
    return res.status(400).json({
      message: "Provide message, incomingMessage, or a configured opener template",
    });
  }

  try {
    const context = await buildUserSalesContext(config.ownerPhone);
    const conversation = await ensureSalesConversation({
      phoneNumber: config.ownerPhone,
      ownerTest: true,
      preview: dryRunEnabled,
      userId: context.user?.id,
    });
    const lead = await ensureSalesLead({
      conversationId: conversation?.id,
      userId: context.user?.id,
      phoneNumber: config.ownerPhone,
      stage: "CONTACTED",
    });

    if (incomingMessage) {
      const history = await listHistoryMessages(conversation?.id);
      const inbound = await createSalesMessage({
        conversationId: conversation?.id,
        direction: "INBOUND",
        senderRole: "OWNER",
        messageType: "text",
        status: "received",
        text: incomingMessage,
        rawPayload: { manual: true, source: "owner-test-endpoint" },
      });
      const aiReply = await generateSalesReply({
        historyMessages: history,
        newMessage: incomingMessage,
        userContext: context.user,
        salesContext: {
          ...context,
          agentName: config.agentName,
          ownerTest: true,
        },
      });

      await recordReplyAudit({
        conversationId: conversation?.id,
        leadId: lead?.id,
        sourceMessageId: inbound?.id,
        provider: aiReply.provider,
        model: aiReply.model,
        systemPrompt: aiReply.system,
        promptText: aiReply.prompt,
        replyText: aiReply.reply,
        toolTrace: {
          links: context.links,
          primaryPlan: context.primaryPlan,
        },
      });

      if (dryRunEnabled) {
        return res.json({
          mode: "reply-preview",
          sent: false,
          ownerPhone: config.ownerPhone,
          reply: aiReply.reply,
          provider: aiReply.provider,
          model: aiReply.model,
        });
      }

      const sent = await sendTextMessage({ to: config.ownerPhone, text: aiReply.reply });
      await createSalesMessage({
        conversationId: conversation?.id,
        waMessageId: sent.messageId,
        direction: "OUTBOUND",
        senderRole: "AGENT",
        messageType: "text",
        status: "accepted",
        text: aiReply.reply,
        rawPayload: sent.providerResponse,
      });
      await touchConversation(conversation?.id, {
        lastMessageAt: new Date(),
        lastInboundAt: new Date(),
        lastOutboundAt: new Date(),
        lastMessagePreview: trimPreview(aiReply.reply),
      });
      return res.json({
        mode: "reply",
        sent: true,
        ownerPhone: config.ownerPhone,
        reply: aiReply.reply,
        provider: aiReply.provider,
        model: aiReply.model,
        messageId: sent.messageId,
      });
    }

    if (forceTemplateEnabled || templateName || config.ownerOpenerTemplate) {
      const name = templateName || config.ownerOpenerTemplate;
      if (!name) {
        return res.status(400).json({ message: "No opener template configured" });
      }
      if (dryRunEnabled) {
        return res.json({
          mode: "template-preview",
          sent: false,
          ownerPhone: config.ownerPhone,
          templateName: name,
          languageCode: config.ownerOpenerTemplateLanguage,
        });
      }
      const sent = await sendTemplateMessage({
        to: config.ownerPhone,
        templateName: name,
        languageCode: config.ownerOpenerTemplateLanguage,
      });
      await createSalesMessage({
        conversationId: conversation?.id,
        waMessageId: sent.messageId,
        direction: "OUTBOUND",
        senderRole: "AGENT",
        messageType: "template",
        status: "accepted",
        text: `[template:${name}]`,
        rawPayload: sent.providerResponse,
      });
      await touchConversation(conversation?.id, {
        lastMessageAt: new Date(),
        lastOutboundAt: new Date(),
        lastMessagePreview: `[template:${name}]`,
      });
      return res.json({
        mode: "template",
        sent: true,
        ownerPhone: config.ownerPhone,
        templateName: name,
        messageId: sent.messageId,
      });
    }

    if (dryRunEnabled) {
      return res.json({
        mode: "text-preview",
        sent: false,
        ownerPhone: config.ownerPhone,
        message,
      });
    }

    const sent = await sendTextMessage({ to: config.ownerPhone, text: message });
    await createSalesMessage({
      conversationId: conversation?.id,
      waMessageId: sent.messageId,
      direction: "OUTBOUND",
      senderRole: "AGENT",
      messageType: "text",
      status: "accepted",
      text: message,
      rawPayload: sent.providerResponse,
    });
    await touchConversation(conversation?.id, {
      lastMessageAt: new Date(),
      lastOutboundAt: new Date(),
      lastMessagePreview: trimPreview(message),
    });
    res.json({
      mode: "text",
      sent: true,
      ownerPhone: config.ownerPhone,
      messageId: sent.messageId,
    });
  } catch (error) {
    console.error("[salesAgentController] sendOwnerTestMessage failed:", error.response?.data || error);
    res.status(error.response?.status || 500).json({
      message: buildErrorMessage(error, "Failed to send owner test message"),
    });
  }
};

const verifyWebhook = async (req, res) => {
  const config = getSalesAgentConfig();
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token && token === config.webhookVerifyToken) {
    return res.status(200).send(challenge);
  }

  res.status(403).json({ message: "Webhook verification failed" });
};

const handleStatusUpdate = async (status) => {
  const waMessageId = status?.id;
  if (!waMessageId) return;
  try {
    const row = await prisma.whatsappmessage.findUnique({ where: { waMessageId } });
    if (!row) return;
    await prisma.whatsappmessage.update({
      where: { id: row.id },
      data: {
        status: status.status || row.status,
        rawPayload: status,
      },
    });
  } catch (error) {
    if (isMissingSalesTableError(error)) return;
    throw error;
  }
};

const handleInboundMessage = async (message, value) => {
  const config = getSalesAgentConfig();
  const from = sendWhatsappOTP.normalizePhone(message.from || "");
  if (!from || from !== config.ownerPhone || !config.ownerAutoReplyEnabled) {
    return { ignored: true };
  }

  const text = normalizeInboundText(message);
  if (!text) {
    return { ignored: true, reason: "unsupported_message_type" };
  }

  const context = await buildUserSalesContext(from);
  const conversation = await ensureSalesConversation({
    phoneNumber: from,
    ownerTest: true,
    preview: false,
    userId: context.user?.id,
  });
  const lead = await ensureSalesLead({
    conversationId: conversation?.id,
    userId: context.user?.id,
    phoneNumber: from,
    stage: "REPLIED",
  });
  const history = await listHistoryMessages(conversation?.id);
  const inbound = await createSalesMessage({
    conversationId: conversation?.id,
    waMessageId: message.id,
    direction: "INBOUND",
    senderRole: "OWNER",
    messageType: message.type || "text",
    status: "received",
    text,
    rawPayload: { message, metadata: value?.metadata || null },
  });

  const aiReply = await generateSalesReply({
    historyMessages: history,
    newMessage: text,
    userContext: context.user,
    salesContext: {
      ...context,
      agentName: config.agentName,
      ownerTest: true,
    },
  });

  await recordReplyAudit({
    conversationId: conversation?.id,
    leadId: lead?.id,
    sourceMessageId: inbound?.id,
    provider: aiReply.provider,
    model: aiReply.model,
    systemPrompt: aiReply.system,
    promptText: aiReply.prompt,
    replyText: aiReply.reply,
    toolTrace: {
      links: context.links,
      primaryPlan: context.primaryPlan,
    },
  });

  const sent = await sendTextMessage({ to: from, text: aiReply.reply });
  await createSalesMessage({
    conversationId: conversation?.id,
    waMessageId: sent.messageId,
    direction: "OUTBOUND",
    senderRole: "AGENT",
    messageType: "text",
    status: "accepted",
    text: aiReply.reply,
    rawPayload: sent.providerResponse,
  });
  await touchConversation(conversation?.id, {
    lastMessageAt: new Date(),
    lastInboundAt: new Date(),
    lastOutboundAt: new Date(),
    lastMessagePreview: trimPreview(aiReply.reply),
  });

  return { ignored: false };
};

const handleWebhook = async (req, res) => {
  try {
    const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change.value || {};
        for (const status of value.statuses || []) {
          await handleStatusUpdate(status);
        }
        for (const message of value.messages || []) {
          await handleInboundMessage(message, value);
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("[salesAgentController] webhook failed:", error.response?.data || error);
    res.status(500).json({
      message: buildErrorMessage(error, "Failed to process WhatsApp webhook"),
    });
  }
};

module.exports = {
  getStatus,
  sendOwnerTestMessage,
  verifyWebhook,
  handleWebhook,
};
