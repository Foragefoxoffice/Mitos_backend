const jwt = require("jsonwebtoken");

const generateToken = (user, sessionId) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, sessionId },
    process.env.JWT_SECRET,
    { expiresIn: "7d" } // Access token expires in 7 days
  );
};

const generateRefreshToken = (user, sessionId) => {
  return jwt.sign(
    { id: user.id, sessionId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "30d" } // Refresh token expires in 30 days
  );
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
};
