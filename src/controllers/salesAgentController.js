const axios = require("axios");
const prisma = require("../utils/prisma");
const sendWhatsappOTP = require("../utils/sendWhatsapp");
const { getSalesAgentConfig } = require("../utils/salesAgentConfig");
const { buildConversationListWhere } = require("../utils/salesConversationQuery");
const { isEligibleSender, shouldGenerateAiReply } = require("../utils/salesReplyGate");
const { fetchApprovedTemplates } = require("../utils/whatsappTemplates");
const { buildUserSearchWhere } = require("../utils/salesRecipientSearch");
const { buildRecipientCandidateWhere } = require("../utils/salesRecipientCandidates");
const { sendInBatches } = require("../utils/batch");
const {
  MAX_CAMPAIGN_RECIPIENTS,
  buildCampaignDedupeWhere,
  validateCampaignRecipients,
  buildTemplateBodyComponents,
  resolveTemplateVariableValue,
  validateVariableMappings,
  VARIABLE_FIELD_OPTIONS,
} = require("../utils/salesCampaignHelpers");

const aiServiceClient = axios.create({
  baseURL: process.env.AI_SERVICE_URL,
  headers: { "x-internal-key": process.env.INTERNAL_AI_SERVICE_KEY },
  timeout: 60000,
});

const SALES_PROMPT_VERSION = "whatsapp-sales-agent-mvp-v1-deploycheck-20260918";

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
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
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
  try {
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
  } catch (error) {
    if (isMissingSalesTableError(error)) return [];
    throw error;
  }
};

const fetchActiveCoupons = async () => {
  try {
    const now = new Date();
    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    return coupons
      .filter((c) => !c.maxUsage || c.usedCount < c.maxUsage)
      .map((c) => ({ code: c.code, type: c.type, value: c.value, expiresAt: c.expiresAt }));
  } catch (error) {
    if (isMissingSalesTableError(error)) return [];
    throw error;
  }
};

// The same FREE-vs-PREMIUM comparison table shown in the app and managed
// by admin at /admin/subscription-features — fetched fresh on every
// message (not baked into the static knowledge doc) so it can never drift
// out of sync with what admin actually configured.
const fetchFeatureComparison = async () => {
  try {
    const categories = await prisma.subscriptionfeaturecategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        features: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    return categories.map((cat) => ({
      category: cat.name,
      features: cat.features.map((f) => ({ name: f.name, free: f.freeValue, premium: f.premValue })),
    }));
  } catch (error) {
    if (isMissingSalesTableError(error)) return [];
    throw error;
  }
};

// `appsetting` is a generic key/value store (also holds unrelated internal
// config like notification dedup windows) — only pull the keys that are
// actually safe/useful for the sales agent to reference, same admin page
// (/admin/settings) as everything else here, fetched live so an admin edit
// (e.g. changing the trial length) shows up on the AI's next reply.
const SALES_RELEVANT_SETTING_KEYS = ["telegram_link", "trial_days", "ai_chat_daily_cap", "ai_chat_trial_cap"];

const EMPTY_SALES_APP_SETTINGS = {
  telegramLink: null,
  trialDurationDays: null,
  premiumDailyAiChatCredits: null,
  trialTotalAiChatCredits: null,
};

const fetchAppSettingsForSales = async () => {
  try {
    const rows = await prisma.appsetting.findMany({
      where: { key: { in: SALES_RELEVANT_SETTING_KEYS } },
    });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      telegramLink: byKey.telegram_link || null,
      trialDurationDays: byKey.trial_days || null,
      premiumDailyAiChatCredits: byKey.ai_chat_daily_cap || null,
      trialTotalAiChatCredits: byKey.ai_chat_trial_cap || null,
    };
  } catch (error) {
    if (isMissingSalesTableError(error)) return EMPTY_SALES_APP_SETTINGS;
    throw error;
  }
};

const fetchPersonalCoupon = async ({ phoneNumber, email }) => {
  const identifiers = [phoneNumber, email].filter(Boolean);
  if (!identifiers.length) return null;

  try {
    const now = new Date();
    const assignment = await prisma.personalcouponassignment.findFirst({
      where: {
        identifier: { in: identifiers },
        coupon: {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      },
      orderBy: { createdAt: "desc" },
      include: { coupon: true },
    });

    if (!assignment || (assignment.coupon.maxUsage && assignment.coupon.usedCount >= assignment.coupon.maxUsage)) {
      return null;
    }

    return {
      code: assignment.coupon.code,
      type: assignment.coupon.type,
      value: assignment.coupon.value,
      expiresAt: assignment.coupon.expiresAt,
    };
  } catch (error) {
    if (isMissingSalesTableError(error)) return null;
    throw error;
  }
};

// Best-effort only — a prospective (never-yet-converted) user has no
// payment or plan row at all, so this is frequently null. That's expected,
// not a bug: the AI is instructed to ask directly when this is unknown
// rather than guess, since offering the wrong coupon type (a general code
// to an iOS user, or vice versa) is worse than asking one extra question.
const fetchKnownPlatform = async (userId) => {
  if (!userId) return null;

  try {
    const [lastPayment, lastPlan] = await Promise.all([
      prisma.payment.findFirst({
        where: { userId, platform: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { platform: true, createdAt: true },
      }),
      prisma.userneetplan.findFirst({
        where: { userId },
        orderBy: { purchasedAt: "desc" },
        select: { platform: true, purchasedAt: true },
      }),
    ]);

    if (!lastPayment && !lastPlan) return null;
    if (!lastPlan) return lastPayment.platform;
    if (!lastPayment) return lastPlan.platform;
    return lastPayment.createdAt > lastPlan.purchasedAt ? lastPayment.platform : lastPlan.platform;
  } catch (error) {
    if (isMissingSalesTableError(error)) return null;
    throw error;
  }
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
  const activeCoupons = await fetchActiveCoupons();
  const personalCoupon = await fetchPersonalCoupon({ phoneNumber, email: user?.email });
  const knownPlatform = await fetchKnownPlatform(user?.id);
  const featureComparison = await fetchFeatureComparison();
  const appSettings = await fetchAppSettingsForSales();

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
    activeCoupons,
    personalCoupon,
    knownPlatform,
    featureComparison,
    appSettings,
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

// WhatsApp can and does redeliver the same inbound webhook (Meta's own
// documented retry behavior when a response doesn't arrive fast enough) —
// without this, the retry hits the unique constraint on waMessageId and
// crashes the whole reply flow instead of being a harmless no-op.
const findExistingMessageByWaId = async (waMessageId) => {
  if (!waMessageId) return null;
  try {
    return await prisma.whatsappmessage.findUnique({ where: { waMessageId } });
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
  campaignId,
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
        campaignId: campaignId || undefined,
      },
    });
  } catch (error) {
    if (isMissingSalesTableError(error)) return null;
    // Same redelivery race as above, just caught here as a fallback in case
    // two retries land close enough together to both pass the earlier check.
    if (error.code === "P2002" && waMessageId) return findExistingMessageByWaId(waMessageId);
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

const sendTemplateMessage = async ({ to, templateName, languageCode, components }) => {
  const response = await sendWhatsappOTP.sendWhatsappTemplate({
    to,
    name: templateName,
    languageCode,
    ...(components && components.length ? { components } : {}),
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
  if (!from) {
    return { ignored: true };
  }

  const isOwner = from === config.ownerPhone;
  let existingConversation = null;
  try {
    existingConversation = await prisma.whatsappconversation.findUnique({ where: { phoneNumber: from } });
  } catch (error) {
    if (!isMissingSalesTableError(error)) throw error;
  }

  if (
    !isEligibleSender({
      isOwner,
      ownerAutoReplyEnabled: config.ownerAutoReplyEnabled,
      conversationExists: !!existingConversation,
    })
  ) {
    return { ignored: true };
  }

  const text = normalizeInboundText(message);
  if (!text) {
    return { ignored: true, reason: "unsupported_message_type" };
  }

  // WhatsApp redelivers webhooks that don't get a fast enough response —
  // if we've already stored this exact message, this is a retry of
  // something we already (or are already) handling. Bail out before doing
  // any of the expensive work (AI call included) rather than just avoiding
  // a crash further down.
  if (await findExistingMessageByWaId(message.id)) {
    return { ignored: true, reason: "duplicate_webhook_delivery" };
  }

  const context = await buildUserSalesContext(from);
  const conversation = await ensureSalesConversation({
    phoneNumber: from,
    ownerTest: isOwner,
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
    senderRole: isOwner ? "OWNER" : "USER",
    messageType: message.type || "text",
    status: "received",
    text,
    rawPayload: { message, metadata: value?.metadata || null },
  });

  if (!shouldGenerateAiReply({ conversationStatus: conversation?.status })) {
    await touchConversation(conversation?.id, {
      lastMessageAt: new Date(),
      lastInboundAt: new Date(),
      lastMessagePreview: trimPreview(text),
    });
    return { ignored: true, reason: "manual_takeover" };
  }

  const aiReply = await generateSalesReply({
    historyMessages: history,
    newMessage: text,
    userContext: context.user,
    salesContext: {
      ...context,
      agentName: config.agentName,
      ownerTest: isOwner,
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

const getAdminConversations = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
  const where = buildConversationListWhere({
    search: req.query.search,
    stage: req.query.stage,
    userId: req.query.userId,
  });

  try {
    const [conversations, total] = await Promise.all([
      prisma.whatsappconversation.findMany({
        where,
        orderBy: { lastMessageAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          phoneNumber: true,
          status: true,
          ownerTest: true,
          lastMessagePreview: true,
          lastMessageAt: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          lead: { select: { stage: true, leadScore: true } },
        },
      }),
      prisma.whatsappconversation.count({ where }),
    ]);

    res.json({ conversations, total, page, pageSize });
  } catch (error) {
    if (isMissingSalesTableError(error)) {
      return res.json({ conversations: [], total: 0, page, pageSize });
    }
    console.error("[salesAgentController] getAdminConversations failed:", error);
    res.status(500).json({ message: "Failed to load conversations" });
  }
};

const getAdminConversationDetail = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: "Invalid conversation id" });
  }

  try {
    const conversation = await prisma.whatsappconversation.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            className: true,
            status: true,
            premiumExpiry: true,
            trialStartedAt: true,
            trialEndsAt: true,
            hasUsedTrial: true,
          },
        },
        lead: true,
        messages: { orderBy: { createdAt: "asc" }, take: 300 },
        audits: {
          orderBy: { createdAt: "asc" },
          select: {
            sourceMessageId: true,
            provider: true,
            model: true,
            promptVersion: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const auditByMessageId = {};
    for (const audit of conversation.audits) {
      if (audit.sourceMessageId != null) auditByMessageId[audit.sourceMessageId] = audit;
    }

    const user = conversation.user
      ? { ...conversation.user, subscriptionState: classifySubscriptionState(conversation.user) }
      : null;

    res.json({
      conversation: {
        id: conversation.id,
        phoneNumber: conversation.phoneNumber,
        status: conversation.status,
        ownerTest: conversation.ownerTest,
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
      },
      user,
      lead: conversation.lead,
      messages: conversation.messages,
      auditByMessageId,
    });
  } catch (error) {
    if (isMissingSalesTableError(error)) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    console.error("[salesAgentController] getAdminConversationDetail failed:", error);
    res.status(500).json({ message: "Failed to load conversation" });
  }
};

const setConversationTakeover = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: "Invalid conversation id" });
  }
  const takeover = toBool(req.body?.takeover, false);

  try {
    const conversation = await prisma.whatsappconversation.update({
      where: { id },
      data: { status: takeover ? "PAUSED" : "ACTIVE" },
      select: { id: true, status: true },
    });
    res.json({ conversation });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Conversation not found" });
    }
    console.error("[salesAgentController] setConversationTakeover failed:", error);
    res.status(500).json({ message: "Failed to update conversation" });
  }
};

const getAdminTemplates = async (req, res) => {
  try {
    const templates = await fetchApprovedTemplates();
    res.json({ templates });
  } catch (error) {
    console.error("[salesAgentController] getAdminTemplates failed:", error.response?.data || error);
    res.status(500).json({ message: "Failed to load WhatsApp templates" });
  }
};

const searchRecipientUsers = async (req, res) => {
  const where = buildUserSearchWhere(req.query.q);
  if (!where) return res.json({ users: [] });

  try {
    const users = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, phoneNumber: true },
      take: 10,
    });
    res.json({ users: users.filter((u) => !!u.phoneNumber) });
  } catch (error) {
    console.error("[salesAgentController] searchRecipientUsers failed:", error);
    res.status(500).json({ message: "Failed to search users" });
  }
};

const getRecipientCandidates = async (req, res) => {
  const { filterType, status, field, condition } = req.query;
  const days = req.query.days != null ? Number(req.query.days) : undefined;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 100));

  const where = buildRecipientCandidateWhere({
    filterType,
    status,
    field,
    condition,
    days,
    includeContacted: toBool(req.query.includeContacted, false),
  });

  if (!where) {
    return res.status(400).json({ message: "Invalid filter parameters" });
  }

  try {
    const [users, totalMatching] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, name: true, phoneNumber: true },
        orderBy: { id: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, totalMatching, page, pageSize });
  } catch (error) {
    console.error("[salesAgentController] getRecipientCandidates failed:", error);
    res.status(500).json({ message: "Failed to load recipient candidates" });
  }
};

const CAMPAIGN_BATCH_SIZE = 5;

const sendCampaignToRecipient = async ({ recipient, template, campaignId, variableMappings }) => {
  const phoneNumber = sendWhatsappOTP.normalizePhone(recipient.phoneNumber || "");
  if (!phoneNumber) {
    return { phoneNumber: recipient.phoneNumber || "", status: "failed", error: "Invalid phone number" };
  }

  try {
    const existingRecent = await prisma.whatsappmessage.findFirst({
      where: buildCampaignDedupeWhere({ phoneNumber, templateName: template.name }),
    });
    if (existingRecent && !recipient.forceResend) {
      return { phoneNumber, status: "skipped", error: "Already sent this template recently" };
    }

    let userRecord = null;
    if (recipient.userId) {
      userRecord = await prisma.user.findUnique({ where: { id: Number(recipient.userId) } });
    } else {
      userRecord = await prisma.user.findUnique({ where: { phoneNumber } });
    }

    const conversation = await ensureSalesConversation({
      phoneNumber,
      ownerTest: false,
      preview: false,
      userId: userRecord?.id,
    });

    const existingLead = conversation?.id
      ? await prisma.saleslead.findUnique({ where: { conversationId: conversation.id } })
      : null;
    if (conversation?.id && !existingLead) {
      await ensureSalesLead({
        conversationId: conversation.id,
        userId: userRecord?.id,
        phoneNumber,
        stage: "CONTACTED",
      });
    }

    const variableValues = (variableMappings || []).map((mapping) =>
      resolveTemplateVariableValue({ field: mapping?.field, customValue: mapping?.customValue, userRecord })
    );
    const components = buildTemplateBodyComponents({
      bodyVariableCount: template.bodyVariableCount,
      variableValues,
    });

    const sent = await sendTemplateMessage({
      to: phoneNumber,
      templateName: template.name,
      languageCode: template.language,
      components,
    });

    await createSalesMessage({
      conversationId: conversation?.id,
      waMessageId: sent.messageId,
      direction: "OUTBOUND",
      senderRole: "AGENT",
      messageType: "template",
      status: "accepted",
      text: `[template:${template.name}]`,
      rawPayload: sent.providerResponse,
      campaignId,
    });
    await touchConversation(conversation?.id, {
      lastMessageAt: new Date(),
      lastOutboundAt: new Date(),
      lastMessagePreview: `[template:${template.name}]`,
    });

    return { phoneNumber, status: "sent" };
  } catch (error) {
    return {
      phoneNumber,
      status: "failed",
      error: error.response?.data?.error?.message || error.message || "Send failed",
    };
  }
};

const getVariableFieldOptions = (req, res) => {
  res.json({ options: VARIABLE_FIELD_OPTIONS });
};

const createCampaign = async (req, res) => {
  const { templateName, templateLanguage, recipients, forceResend, variableMappings } = req.body || {};

  const validation = validateCampaignRecipients(recipients);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.error });
  }

  let templates;
  try {
    templates = await fetchApprovedTemplates();
  } catch (error) {
    console.error("[salesAgentController] createCampaign template fetch failed:", error.response?.data || error);
    return res.status(502).json({ message: "Failed to verify template with WhatsApp" });
  }

  const template = templates.find((t) => t.name === templateName && t.language === templateLanguage);
  if (!template) {
    return res.status(400).json({ message: "Template not found or not approved" });
  }

  const mappingValidation = validateVariableMappings({ bodyVariableCount: template.bodyVariableCount, variableMappings });
  if (!mappingValidation.valid) {
    return res.status(400).json({ message: mappingValidation.error });
  }

  let campaign;
  try {
    campaign = await prisma.salescampaign.create({
      data: {
        templateName: template.name,
        templateLanguage: template.language,
        templateCategory: template.category,
        totalTargeted: recipients.length,
      },
    });
  } catch (error) {
    if (isMissingSalesTableError(error)) {
      campaign = { id: null };
    } else {
      console.error("[salesAgentController] createCampaign failed to create campaign row:", error);
      return res.status(500).json({ message: "Failed to start campaign" });
    }
  }

  const forceResendFlag = toBool(forceResend, false);
  const results = await sendInBatches(
    recipients.map((r) => ({ ...r, forceResend: forceResendFlag })),
    CAMPAIGN_BATCH_SIZE,
    (recipient) => sendCampaignToRecipient({ recipient, template, campaignId: campaign.id, variableMappings })
  );

  const sentCount = results.filter((r) => r.status === "sent").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  if (campaign.id) {
    try {
      await prisma.salescampaign.update({
        where: { id: campaign.id },
        data: { sentCount, skippedCount, failedCount },
      });
    } catch (error) {
      if (!isMissingSalesTableError(error)) {
        console.error("[salesAgentController] createCampaign failed to update counts:", error);
      }
    }
  }

  res.json({
    campaignId: campaign.id,
    templateName: template.name,
    sentCount,
    skippedCount,
    failedCount,
    results,
  });
};

const getAdminCampaigns = async (req, res) => {
  try {
    const campaigns = await prisma.salescampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ campaigns });
  } catch (error) {
    if (isMissingSalesTableError(error)) {
      return res.json({ campaigns: [] });
    }
    console.error("[salesAgentController] getAdminCampaigns failed:", error);
    res.status(500).json({ message: "Failed to load campaigns" });
  }
};

const importPersonalCoupons = async (req, res) => {
  const { rows } = req.body || {};
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: "At least one row is required" });
  }
  if (rows.length > 500) {
    return res.status(400).json({ message: "Cannot import more than 500 rows at once" });
  }

  const results = [];
  for (const row of rows) {
    const identifier = String(row.identifier || "").trim();
    const couponCode = String(row.couponCode || "").trim();
    const couponType = String(row.couponType || "").trim();
    const couponValue = Number(row.couponValue);
    const expiresAt = row.expiresAt ? new Date(row.expiresAt) : null;

    if (!identifier || !couponCode || !couponType || !Number.isFinite(couponValue)) {
      results.push({ identifier: identifier || "(blank)", status: "failed", error: "Missing or invalid required field(s)" });
      continue;
    }

    try {
      const existing = await prisma.coupon.findUnique({ where: { code: couponCode } });
      if (existing) {
        results.push({ identifier, status: "failed", error: `Coupon code ${couponCode} already exists` });
        continue;
      }

      const coupon = await prisma.coupon.create({
        data: {
          code: couponCode,
          type: couponType,
          value: couponValue,
          isActive: true,
          maxUsage: 1,
          maxPerUser: 1,
          expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
        },
      });

      await prisma.personalcouponassignment.create({
        data: { identifier, couponId: coupon.id, note: row.note || null },
      });

      results.push({ identifier, status: "created", couponCode });
    } catch (error) {
      results.push({ identifier, status: "failed", error: error.message || "Failed to create" });
    }
  }

  const createdCount = results.filter((r) => r.status === "created").length;
  const failedCount = results.filter((r) => r.status === "failed").length;
  res.json({ createdCount, failedCount, results });
};

const getPersonalCoupons = async (req, res) => {
  try {
    const assignments = await prisma.personalcouponassignment.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { coupon: true },
    });
    res.json({
      assignments: assignments.map((a) => ({
        id: a.id,
        identifier: a.identifier,
        note: a.note,
        createdAt: a.createdAt,
        couponCode: a.coupon.code,
        couponType: a.coupon.type,
        couponValue: a.coupon.value,
        couponExpiresAt: a.coupon.expiresAt,
        couponUsedCount: a.coupon.usedCount,
      })),
    });
  } catch (error) {
    console.error("[salesAgentController] getPersonalCoupons failed:", error);
    res.status(500).json({ message: "Failed to load personal coupons" });
  }
};

const getSalesKnowledgeBase = async (req, res) => {
  try {
    const response = await aiServiceClient.get("/internal/ai/sales/knowledge");
    res.json(response.data);
  } catch (error) {
    console.error("[salesAgentController] getSalesKnowledgeBase failed:", error.response?.data || error);
    res.status(error.response?.status || 500).json({
      message: buildErrorMessage(error, "Failed to load knowledge base"),
    });
  }
};

const updateSalesKnowledgeBase = async (req, res) => {
  const { content } = req.body || {};
  if (typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ message: "content is required" });
  }
  try {
    const response = await aiServiceClient.put("/internal/ai/sales/knowledge", { content });
    res.json(response.data);
  } catch (error) {
    console.error("[salesAgentController] updateSalesKnowledgeBase failed:", error.response?.data || error);
    res.status(error.response?.status || 500).json({
      message: buildErrorMessage(error, "Failed to update knowledge base"),
    });
  }
};

const getSalesRules = async (req, res) => {
  try {
    const response = await aiServiceClient.get("/internal/ai/sales/rules");
    res.json(response.data);
  } catch (error) {
    console.error("[salesAgentController] getSalesRules failed:", error.response?.data || error);
    res.status(error.response?.status || 500).json({
      message: buildErrorMessage(error, "Failed to load rules"),
    });
  }
};

const createSalesRule = async (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ message: "text is required" });
  }
  try {
    const response = await aiServiceClient.post("/internal/ai/sales/rules", { text: text.trim() });
    res.json(response.data);
  } catch (error) {
    console.error("[salesAgentController] createSalesRule failed:", error.response?.data || error);
    res.status(error.response?.status || 500).json({
      message: buildErrorMessage(error, "Failed to create rule"),
    });
  }
};

const deleteSalesRule = async (req, res) => {
  try {
    const response = await aiServiceClient.delete(`/internal/ai/sales/rules/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    console.error("[salesAgentController] deleteSalesRule failed:", error.response?.data || error);
    res.status(error.response?.status || 500).json({
      message: buildErrorMessage(error, "Failed to delete rule"),
    });
  }
};

module.exports = {
  getStatus,
  sendOwnerTestMessage,
  verifyWebhook,
  handleWebhook,
  getAdminConversations,
  getAdminConversationDetail,
  setConversationTakeover,
  getAdminTemplates,
  searchRecipientUsers,
  getRecipientCandidates,
  getVariableFieldOptions,
  createCampaign,
  getAdminCampaigns,
  importPersonalCoupons,
  getPersonalCoupons,
  getSalesKnowledgeBase,
  updateSalesKnowledgeBase,
  getSalesRules,
  createSalesRule,
  deleteSalesRule,
};
