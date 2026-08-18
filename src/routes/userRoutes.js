const express = require("express");
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getCurrentUser,
  upload,
  saveFcmToken,
  updateUserSubscription,
} = require("../controllers/userController");

const { authenticateUser, verifyAdmin, verifyUser } = require("../middlewares/authMiddleware");

const router = express.Router();

// ✅ User can access their own profile (Only requires authentication)
router.get("/me", authenticateUser, getCurrentUser);

// ✅ Users can update their own profile (Requires authentication and same user ID)
router.put("/update-profile/:id", upload.single("profile"), updateUser);

// 🔒 Admin Routes (Restricted to Admins only)
router.get("/", verifyAdmin, getAllUsers);
router.get("/:id", verifyAdmin, getUserById);
router.post("/", verifyAdmin, createUser);
router.delete("/:id", verifyAdmin, deleteUser);
router.put("/:id/subscription", verifyAdmin, updateUserSubscription);
router.post("/save-fcm-token", authenticateUser, saveFcmToken);

module.exports = router;
