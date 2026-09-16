const { buildDateFilterWhere } = require("./dateFilter");

const buildRecipientCandidateWhere = ({ filterType, status, field, condition, days, includeContacted, now = new Date() }) => {
  const conditions = [{ phoneNumber: { not: null } }, { status: { not: "DELETED" } }];

  if (filterType === "status") {
    if (!status) return null;
    conditions.push({ status });
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
