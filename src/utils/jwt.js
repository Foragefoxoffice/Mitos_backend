const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  const token = jwt.sign(
    { id: user.id, role: user.role }, // 🔥 Ensure it's `id`, not `userId`
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  return token;
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = { generateToken, verifyToken };
