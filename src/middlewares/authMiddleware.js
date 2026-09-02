const jwt = require("jsonwebtoken");
const { verifyToken } = require("../utils/jwt");
const prisma = require("../utils/prisma");

const authenticateUser = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.split(" ")[1];

    // If no token, assign guest role and continue
    if (!token) {
      req.user = { role: "guest" };
      return next();
    }

    const decoded = verifyToken(token);

    if (!decoded || (!decoded.id && !decoded.userId)) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const userId = decoded.id || decoded.userId;

    // Single-device login: every token minted since the 2026-09-02 session
    // feature carries the sessionId active at issuance time. Compare it to
    // the CURRENT value on the user row — a mismatch means a newer login
    // elsewhere replaced this session. A null user.activeSessionId means
    // this user hasn't logged in again since the migration — deliberately
    // not enforced yet for them, so no mass logout on deploy day (see
    // spec's Edge Cases).
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { activeSessionId: true },
    });

    if (!current) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    if (current.activeSessionId && decoded.sessionId !== current.activeSessionId) {
      return res.status(401).json({
        code: "SESSION_REVOKED",
        message: "You've been logged out because this account was used on another device.",
      });
    }

    req.user = { id: userId, role: decoded.role || "user" }; // Default to "user" role if not specified
    next();
  } catch (error) {
    res.status(401).json({ message: "Authentication failed" });
  }
};

const verifyAdmin = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Access Denied" });

    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

const verifyUser = (req, res, next) => {
  try {
    // Allow guests to access some user routes if needed
    if (req.user?.role === "guest") {
      return next(); // or return res.status(403) if guests shouldn't access
    }

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Access Denied" });

    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ message: "Invalid token" });

    if (!req.params.id || decoded.id !== parseInt(req.params.id)) {
      return res.status(403).json({ message: "Access Denied: Unauthorized action" });
    }

    req.user = { id: decoded.id, role: decoded.role || "user" };
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    // Allow guests if 'guest' is included in the allowed roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access forbidden: Insufficient role" });
    }
    
    next();
  };
};

module.exports = { authenticateUser, authorizeRole, verifyAdmin, verifyUser };