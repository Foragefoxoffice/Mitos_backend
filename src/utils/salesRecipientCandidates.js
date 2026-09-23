const { buildDateFilterWhere } = require("./dateFilter");

const buildRecipientCandidateWhere = ({ filterType, status, field, condition, days, includeContacted, now = new Date() }) => {
  const conditions = [{ phoneNumber: { not: null } }, { status: { not: "DELETED" } }];

  if (filterType === "status") {
    if (!status) return null;
    // A user's status stays TRIALED after the trial runs out (nothing resets
    // it), so trial state is derived from trialEndsAt.
    if (status === "TRIAL_ACTIVE") {
      conditions.push({ status: "TRIALED" }, { trialEndsAt: { gt: now } });
    } else if (status === "TRIAL_ENDED") {
      conditions.push({ status: { in: ["TRIALED", "REGISTERED"] } }, { trialEndsAt: { lte: now } });
    } else {
      conditions.push({ status });
    }
  } else if (filterType === "date") {
    const dateWhere = buildDateFilterWhere({ field, condition, days, now });
    if (!dateWhere) return null;
    conditions.push(dateWhere);
  } else {
    return null;
  }

  if (!includeContacted) {
    conditions.push({ whatsappConversations: { none: {} } });
  }

  return { AND: conditions };
};

module.exports = { buildRecipientCandidateWhere };
