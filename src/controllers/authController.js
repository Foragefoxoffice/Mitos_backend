const prisma = require("../utils/prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { OAuth2Client } = require("google-auth-library");

const { generateToken, generateRefreshToken } = require("../utils/jwt");
const sendEmail = require("../utils/sendEmail");
const welcomeEmail = require("../templates/welcomeEmail");
const emailOtpTemplate = require("../templates/emailOtp");
const sendWhatsappOTP = require("../utils/sendWhatsapp");


const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/* ======================================================
   HELPERS
====================================================== */
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizePhone(phone) {
  if (!phone) return null;
  let p = phone.replace(/\s+/g, "");
  if (!p.startsWith("+")) p = "+91" + p;
  return p;
}

/* ======================================================
   DUMMY TESTER CONSTANTS
====================================================== */
const DUMMY_OTP = "123456";

// App Store / Play Store reviewer accounts. Each bypasses real OTP delivery
// (fixed DUMMY_OTP, no SMS sent) so a reviewer can sign in with just the
// phone number + this code. `seed`, when set, is re-applied on every OTP
// verify so the account's subscription state stays consistent across
// review rounds regardless of what a previous reviewer did in-app.
const DUMMY_TEST_ACCOUNTS = {
  "+919844444455": {
    email: "tester@playstore.com",
    name: "Play Store Tester",
    seed: null, // pre-existing premium demo account; state managed manually
  },
  "+919844444456": {
    email: "tester.expired@appreview.com",
    name: "App Review Tester (Expired Premium)",
    seed: { status: "SUSPENDED", premiumExpiry: null, trialEndsAt: null, hasUsedTrial: true },
  },
  "+919844444457": {
    email: "tester.registered@appreview.com",
    name: "App Review Tester (Registered)",
    seed: { status: "REGISTERED", premiumExpiry: null, trialEndsAt: null, hasUsedTrial: false },
  },
};

/* ======================================================
   REGISTER (email/password)
====================================================== */
const register = async (req, res) => {
  const { email, password, name, role = "user" } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, role },
    });

    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // fire & forget welcome email
    (async () => {
      try {
        const html = welcomeEmail(
          user.name || "User",
          `${process.env.FRONTEND_URL}/login`
        );
        await sendEmail(user.email, "Welcome to Mitoslearning 🎉", html);
      } catch (_) { }
    })();

    res.status(201).json({
      user,
      accessToken,
      refreshToken,
      role: user.role,
      message: "Registration successful",
    });
  } catch (error) {
    console.error("Register error:", error);
    if (error.code === 'P1008') return res.status(503).json({ message: "Server is temporarily busy. Please try again." });
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

/* ======================================================
   LOGIN (email/password)
====================================================== */
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({ user, accessToken, refreshToken, role: user.role });
  } catch (error) {
    console.error("Login error:", error);
    if (error.code === 'P1008') return res.status(503).json({ message: "Server is temporarily busy. Please try again." });
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

/* ======================================================
   GOOGLE AUTH
====================================================== */
const googleAuth = async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ message: "Missing credential" });

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: [
        process.env.GOOGLE_WEB_CLIENT_ID,
        process.env.GOOGLE_ANDROID_CLIENT_ID,
      ],
    });

    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          profile: picture || null,
          role: "user",
          password: "",
        },
      });
    }

    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({ user, accessToken, refreshToken, role: user.role });
  } catch (error) {
    console.error("Google auth error:", error);
    if (error.code === 'P1008') return res.status(503).json({ message: "Server is temporarily busy. Please try again." });
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

/* ======================================================
   REFRESH TOKEN
====================================================== */
const refreshTokenHandler = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(401).json({ message: "No refresh token provided" });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) return res.status(403).json({ message: "Invalid token" });

    res.json({
      accessToken: generateToken(user),
      refreshToken: generateRefreshToken(user),
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(403).json({ message: "Token expired or invalid" });
  }
};

const sendWhatsappOtp = async (req, res) => {
  let { phoneNumber } = req.body;
  if (!phoneNumber)
    return res.status(400).json({ message: "Phone number is required" });

  try {
    phoneNumber = normalizePhone(phoneNumber);

    // Dummy tester
    if (DUMMY_TEST_ACCOUNTS[phoneNumber]) {
      return res.json({
        message: "OTP sent (TEST MODE)",
        otp: DUMMY_OTP,
        testMode: true,
      });
    }

    const otp = generateOtp();
    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    let user = await prisma.user.findUnique({ where: { phoneNumber } });

    if (!user) {
      user = await prisma.user.create({
        data: { phoneNumber, role: "user", password: "" },
      });
    }

    await prisma.user.update({
      where: { phoneNumber },
      data: { whatsappOtp: otp, whatsappOtpExp: expiry },
    });

    await sendWhatsappOTP(phoneNumber, otp, {
      includeUrlButton: true, // 🔥 IMPORTANT
    });

    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Send WhatsApp OTP error:", error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};

/* ================= VERIFY WHATSAPP OTP ================= */

const verifyWhatsappOtp = async (req, res) => {
  let { phoneNumber, otp, name, email, className } = req.body;

  if (!phoneNumber || !otp)
    return res.status(400).json({ message: "Phone & OTP required" });

  try {
    phoneNumber = normalizePhone(phoneNumber);

    // Dummy tester
    const dummyAccount = DUMMY_TEST_ACCOUNTS[phoneNumber];
    if (dummyAccount && otp === DUMMY_OTP) {
      let user = await prisma.user.findFirst({
        where: { phoneNumber },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            phoneNumber,
            email: dummyAccount.email,
            name: dummyAccount.name,
            role: "user",
            password: "",
            ...(dummyAccount.seed || {}),
          },
        });
      } else if (dummyAccount.seed) {
        user = await prisma.user.update({
          where: { phoneNumber },
          data: dummyAccount.seed,
        });
      }

      return res.json({
        user,
        accessToken: generateToken(user),
        refreshToken: generateRefreshToken(user),
        role: user.role,
        testMode: true,
      });
    }

    const user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (!user) return res.status(400).json({ message: "User not found" });

    const cleanOtp = String(otp).trim();

    if (!user.whatsappOtpExp || new Date() > user.whatsappOtpExp)
      return res.status(400).json({ message: "OTP expired. Please request a new one." });

    if (user.whatsappOtp !== cleanOtp)
      return res.status(400).json({ message: "Invalid OTP. Please check and try again." });

    const needsReg = !user.name || !user.email || !user.className;

    if (needsReg && (!name || !email || !className)) {
      return res.json({ requiresRegistration: true });
    }

    if (needsReg) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail && existingEmail.phoneNumber !== phoneNumber) {
        return res.status(400).json({ message: "Email already exists" });
      }

      await prisma.user.update({
        where: { phoneNumber },
        data: { name, email, className },
      });
    }

    await prisma.user.update({
      where: { phoneNumber },
      data: { whatsappOtp: null, whatsappOtpExp: null },
    });

    const finalUser = await prisma.user.findUnique({ where: { phoneNumber } });

    res.json({
      user: finalUser,
      accessToken: generateToken(finalUser),
      refreshToken: generateRefreshToken(finalUser),
      role: finalUser.role,
    });
  } catch (error) {
    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (typeof target === "string" && target.includes("email")) {
        return res.status(409).json({ message: "This email is already associated with another account." });
      }
      return res.status(409).json({ message: "This email or phone number is already in use." });
    }
    console.error("Verify WhatsApp OTP error:", error);
    res.status(500).json({ message: "OTP verification failed" });
  }
};
/* ======================================================
   SEND EMAIL OTP
====================================================== */
const sendEmailOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const otp = generateOtp();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: { email, role: "user", password: "" },
      });
    }

    await prisma.user.update({
      where: { email },
      data: { emailOtp: otp, emailOtpExp: expiry },
    });

    try {
      await sendEmail(
        email,
        "Your Mitos Learning Verification Code",
        emailOtpTemplate(otp),
        `Your Mitos Learning verification code is: ${otp}. Valid for 10 minutes.`
      );
    } catch (emailErr) {
      console.error("Failed to send OTP email:", emailErr.message);
      return res.status(500).json({ message: "Failed to send OTP email. Please try again or use WhatsApp login." });
    }

    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Send email OTP error:", error);
    // P1008 = DB socket timeout (usually during heavy load / backup restore)
    if (error.code === 'P1008') {
      return res.status(503).json({ message: "Server is temporarily busy. Please wait a moment and try again." });
    }
    res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }
};

/* ======================================================
   VERIFY EMAIL OTP
====================================================== */
const verifyEmailOtp = async (req, res) => {
  const { email, otp, name, className, phoneNumber } = req.body;

  if (!email || !otp)
    return res.status(400).json({ message: "Email & OTP required" });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ message: "User not found" });

    const cleanOtp = String(otp).trim();

    if (!user.emailOtpExp || new Date() > user.emailOtpExp)
      return res.status(400).json({ message: "OTP expired. Please request a new one." });

    if (user.emailOtp !== cleanOtp)
      return res.status(400).json({ message: "Invalid OTP. Please check and try again." });

    const needsReg = !user.name || !user.className;

    if (needsReg && (!name || !className)) {
      return res.json({ requiresRegistration: true });
    }

    if (needsReg) {
      const normalizedPhone = normalizePhone(phoneNumber);

      if (normalizedPhone) {
        const existingPhone = await prisma.user.findUnique({
          where: { phoneNumber: normalizedPhone },
        });

        if (existingPhone && existingPhone.email !== email) {
          return res.status(400).json({
            message: "Phone number already exists",
          });
        }
      }

      await prisma.user.update({
        where: { email },
        data: {
          name,
          className,
          phoneNumber: normalizedPhone,
        },
      });
    }

    await prisma.user.update({
      where: { email },
      data: { emailOtp: null, emailOtpExp: null },
    });

    const finalUser = await prisma.user.findUnique({ where: { email } });

    res.json({
      user: finalUser,
      accessToken: generateToken(finalUser),
      refreshToken: generateRefreshToken(finalUser),
      role: finalUser.role,
    });
  } catch (error) {
    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (typeof target === "string" && target.includes("phoneNumber")) {
        return res.status(409).json({ message: "This phone number is already associated with another account." });
      }
      return res.status(409).json({ message: "This email or phone number is already in use." });
    }
    console.error("Verify email OTP error:", error);
    if (error.code === 'P1008') return res.status(503).json({ message: "Server is temporarily busy. Please try again." });
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

/* ======================================================
   EXPORTS
====================================================== */
module.exports = {
  register,
  login,
  googleAuth,
  sendWhatsappOtp,
  verifyWhatsappOtp,
  sendEmailOtp,
  verifyEmailOtp,
  refreshToken: refreshTokenHandler,
};
