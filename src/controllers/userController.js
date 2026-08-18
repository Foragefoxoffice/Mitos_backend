const prisma = require("../utils/prisma");
// controllers/user.controller.js


const multer = require("multer");
const path = require("path");

/* ------------------------- className helpers ------------------------- */
// Convert client -> Prisma enum
const classIn = (val) => {
  if (!val) return undefined;
  const v = String(val).toUpperCase();
  if (v === "11" || v === "CLASS_11") return "CLASS_11";
  if (v === "12" || v === "CLASS_12") return "CLASS_12";
  if (v === "REPEATER") return "REPEATER";
  return undefined; // ignore invalid values
};
// Convert Prisma enum -> client string
const classOut = (val) => {
  if (!val) return null;
  if (val === "CLASS_11") return "11";
  if (val === "CLASS_12") return "12";
  if (val === "REPEATER") return "REPEATER";
  return val;
};

/* --------------------------- Multer storage -------------------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Ensure this folder exists
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

/* ------------------------------- Routes ------------------------------ */

// Get All Users
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        className: true,
        phoneNumber: true,
        age: true,
        gender: true,
        profile: true,
        createdAt: true,
        updatedAt: true,
        status: true,
        trialStartedAt: true,
        trialEndsAt: true,
        premiumExpiry: true,
        hasUsedTrial: true,
        // sensitive fields NOT included → automatically hidden
      },
    });

    const shaped = users.map(u => ({
      ...u,
      className: classOut(u.className),
    }));

    res.json(shaped);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users", error });
  }
};


// Get User by ID
const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        className: true, // Prisma enum value
        phoneNumber: true,
        age: true,
        gender: true,
        profile: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ ...user, className: classOut(user.className) });
  } catch (error) {
    res.status(500).json({ message: "Error fetching user", error });
  }
};

// Create a New User
const createUser = async (req, res) => {
  const {
    name,
    email,
    password,
    role,
    phoneNumber,
    age,
    gender,
    profile,
    className, // "11" | "12" | "REPEATER"
  } = req.body;

  if (!name || !email || !password || !role) {
    return res
      .status(400)
      .json({ message: "Name, email, password, and role are required" });
  }

  try {
    const data = {
      name,
      email,
      password,
      role,
      phoneNumber,
      gender,
      profile,
    };
    if (typeof age !== "undefined") {
      const a = parseInt(age);
      if (!Number.isNaN(a)) data.age = a;
    }
    const cn = classIn(className);
    if (cn) data.className = cn;

    const newUser = await prisma.user.create({ data });
    res
      .status(201)
      .json({
        message: "User created successfully",
        user: { ...newUser, className: classOut(newUser.className) },
      });
  } catch (error) {
    res.status(500).json({ message: "Error creating user", error });
  }
};

// Update User Profile (Users can update their own profile)
// Update User Profile (Users can update their own profile)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔣 Normalize ID for Prisma
    const where = !Number.isNaN(Number(id)) ? { id: Number(id) } : { id };

    const errs = {};
    const data = {};
    const body = req.body || {};

    /* -------------------- Normalizations -------------------- */

    // ✅ Name
    if (body.name !== undefined) {
      data.name = String(body.name).trim();
    }

    // ✅ Age (must be number)
    if (body.age !== undefined) {
      const a = parseInt(body.age);
      if (!Number.isNaN(a)) {
        data.age = a;
      } else {
        errs.age = "Age must be a number.";
      }
    }

    // ✅ Gender
    if (body.gender !== undefined) {
      data.gender = String(body.gender).trim();
    }

    // ✅ Phone (validate Indian mobile)
    if (body.phoneNumber !== undefined) {
      const phone = String(body.phoneNumber).replace(/\D/g, "");
      if (!/^[6-9]\d{9}$/.test(phone)) {
        errs.phoneNumber =
          "Enter a valid Indian mobile (10 digits, starts 6–9).";
      } else {
        data.phoneNumber = phone;
      }
    }

    // ✅ ClassName (client → Prisma enum)
    if (body.className !== undefined) {
      const v = String(body.className).trim();
      const map = { "11": "CLASS_11", "12": "CLASS_12", REPEATER: "REPEATER" };
      const normalized = map[v] || v;

      const allowed = new Set(["CLASS_11", "CLASS_12", "REPEATER"]);
      if (!allowed.has(normalized)) {
        errs.className = "Invalid class selected.";
      } else {
        data.className = normalized;
      }
    }

    // ✅ Profile (file upload)
    if (req.file) {
      data.profile = `/uploads/${req.file.filename}`;
    }

    /* -------------------- Validation Fail -------------------- */
    if (Object.keys(errs).length) {
      return res.status(400).json({ errors: errs });
    }

    /* -------------------- Update User -------------------- */
    const user = await prisma.user.update({
      where,
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phoneNumber: true,
        className: true,
        age: true,
        gender: true,
        profile: true,
      },
    });

    // ✅ Return client-friendly className
    res.json({
      message: "Profile updated",
      user: { ...user, className: classOut(user.className) },
    });
    console.log("Update request received:", {
      params: req.params,
      body: req.body,
      file: req.file,
    });

  } catch (error) {
    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (typeof target === "string") {
        if (target.includes("phoneNumber")) {
          return res.status(409).json({ message: "Phone number is already associated with another account." });
        }
        if (target.includes("email")) {
          return res.status(409).json({ message: "Email is already associated with another account." });
        }
      }
      // Sometimes target is an array or object depending on prisma version
      // Fallback for generic unique constraint
      return res.status(409).json({ message: "This value is already in use by another account." });
    }

    console.error("update-profile error:", {
      params: req.params,
      body: req.body,
      err: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({ message: "Internal error updating profile" });
  }
};


// Delete User
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.user.delete({ where: { id: parseInt(id) } });
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting user", error });
  }
};

// Get current authenticated user (requires middleware to set req.user.id)
const getCurrentUser = async (req, res) => {
  try {
    const userId = parseInt(req.user.id);

    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        status: true,
        age: true,
        gender: true,
        profile: true,
        role: true,
        trialStartedAt: true,
        trialEndsAt: true,
        premiumExpiry: true,
        className: true, // include it
        createdAt: true,

      },
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ ...user, className: classOut(user.className) });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Error fetching user details", error });
  }
};

const saveFcmToken = async (req, res) => {

  try {
    const userId = req.user?.id;
    if (!userId || req.user?.role === "guest") {
      return res.status(401).json({ message: "Authentication required" });
    }
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ message: "fcmToken is required" });
    }

    // Clear this token from any other user (handles device sharing / re-login)
    await prisma.user.updateMany({
      where: {
        fcmToken,
        id: { not: userId },
      },
      data: { fcmToken: null },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });

    return res.json({ message: "FCM token saved successfully" });
  } catch (error) {
    console.error("Error saving FCM token:", error);
    return res.status(500).json({ message: "Error saving FCM token" });
  }
};

const clearFcmToken = async (req, res) => {
  try {
    const userId = req.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { fcmToken: null },
    });

    return res.json({ message: "FCM token cleared successfully" });
  } catch (error) {
    console.error("Error clearing FCM token:", error);
    return res.status(500).json({ message: "Error clearing FCM token" });
  }
};

// Admin: update a user's subscription status and dates
const updateUserSubscription = async (req, res) => {
  const { id } = req.params;
  const { status, premiumExpiry, trialStartedAt, trialEndsAt, hasUsedTrial } = req.body;

  const VALID_STATUSES = ["REGISTERED", "TRIALED", "PREMIUM", "SUSPENDED"];
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
  }

  try {
    const data = {};
    if (status !== undefined) data.status = status;
    if (premiumExpiry !== undefined) data.premiumExpiry = premiumExpiry ? new Date(premiumExpiry) : null;
    if (trialStartedAt !== undefined) data.trialStartedAt = trialStartedAt ? new Date(trialStartedAt) : null;
    if (trialEndsAt !== undefined) data.trialEndsAt = trialEndsAt ? new Date(trialEndsAt) : null;
    if (hasUsedTrial !== undefined) data.hasUsedTrial = hasUsedTrial;

    const updated = await prisma.user.update({
      where: { id: parseInt(id) },
      data,
      select: {
        id: true, name: true, email: true, status: true,
        premiumExpiry: true, trialStartedAt: true, trialEndsAt: true, hasUsedTrial: true,
      },
    });
    res.json({ message: "Subscription updated", user: updated });
  } catch (error) {
    res.status(500).json({ message: "Error updating subscription", error });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getCurrentUser,
  upload,
  saveFcmToken,
  clearFcmToken,
  updateUserSubscription,
};
