const { verifyToken } = require("../utils/jwt");

/**
 * Decodes the Bearer token if one is present, but never blocks the
 * request. A missing or stale/invalid token just means "buy as a guest" —
 * req.checkoutUserId stays null instead of a 401. Public checkout must
 * work for logged-out visitors, and a logged-in visitor with an expired
 * token shouldn't be locked out of buying.
 */
const optionalCheckoutUser = (req, res, next) => {
  req.checkoutUserId = null;
  const token = req.header("Authorization")?.split(" ")[1];
  if (token) {
    const decoded = verifyToken(token);
    const id = decoded?.id || decoded?.userId;
    if (id) req.checkoutUserId = id;
  }
  next();
};

module.exports = { optionalCheckoutUser };
