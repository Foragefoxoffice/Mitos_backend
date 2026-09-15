const isEligibleSender = ({ isOwner, ownerAutoReplyEnabled, conversationExists }) => {
  if (isOwner) return !!ownerAutoReplyEnabled;
  return !!conversationExists;
};

const shouldGenerateAiReply = ({ conversationStatus }) => conversationStatus !== "PAUSED";

module.exports = { isEligibleSender, shouldGenerateAiReply };
