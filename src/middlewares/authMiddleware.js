const jwt = require("jsonwebtoken");
const { verifyToken } = require("../utils/jwt");

const authenticateUser = (req, res, next) => {
  try {
    const token = req.header("Authorization")?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Access Denied" });

    const user = verifyToken(token);
    console.log("Decoded User:", user); // ✅ Debugging log

    if (!user || (!user.id && !user.userId)) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.user = { id: user.id || user.userId, role: user.role }; // 🔥 Fix the mismatch
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
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Access Denied" });

    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ message: "Invalid token" });

    if (!req.params.id || decoded.id !== parseInt(req.params.id)) {
      return res.status(403).json({ message: "Access Denied: Unauthorized action" });
    }

    req.user = { id: decoded.id };
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access forbidden: Insufficient role" });
    }
    
    next();
  };
};

module.exports = { authenticateUser, authorizeRole, verifyAdmin, verifyUser };
