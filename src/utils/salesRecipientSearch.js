const buildUserSearchWhere = (q) => {
  const term = String(q || "").trim();
  if (!term) return null;
  return {
    OR: [
      { name: { contains: term } },
      { email: { contains: term } },
      { phoneNumber: { contains: term } },
    ],
  };
};

module.exports = { buildUserSearchWhere };
