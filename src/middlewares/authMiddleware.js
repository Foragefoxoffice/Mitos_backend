const jwt = require("jsonwebtoken");
const { verifyToken } = require("../utils/jwt");

const authenticateUser = (req, res, next) => {
  try {
    const token = req.header("Authorization")?.split(" ")[1];
    
    // If no token, assign guest role and continue
    if (!token) {
      req.user = { role: "guest" };
      return next();
    }

    const user = verifyToken(token);
  
    if (!user || (!user.id && !user.userId)) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.user = { id: user.id || user.userId, role: user.role || "user" }; // Default to "user" role if not specified
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