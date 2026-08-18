const express = require("express");
const { register, login, googleAuth,sendWhatsappOtp,verifyWhatsappOtp,  sendEmailOtp,
  verifyEmailOtp, refreshToken } = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google-auth", googleAuth);
router.post("/refresh-token", refreshToken); // ✅ New route
router.post("/whatsapp/send-otp", sendWhatsappOtp);
router.post("/whatsapp/verify-otp", verifyWhatsappOtp);
router.post("/email/send-otp", sendEmailOtp);
router.post("/email/verify-otp", verifyEmailOtp);

module.exports = router;
