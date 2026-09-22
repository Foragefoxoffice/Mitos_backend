const buildConversationListWhere = ({ search, stage, userId, needsHuman } = {}) => {
  const where = {};

  if (userId != null && userId !== "") {
    const id = Number(userId);
    if (Number.isFinite(id)) where.userId = id;
  }

  if (stage) {
    where.lead = { stage };
  }

  if (needsHuman === true || needsHuman === "true") {
    where.needsHuman = true;
  }

  const term = String(search || "").trim();
  if (term) {
    where.OR = [
      { phoneNumber: { contains: term } },
      { user: { name: { contains: term } } },
      { user: { email: { contains: term } } },
    ];
  }

  return where;
};

module.exports = { buildConversationListWhere };
