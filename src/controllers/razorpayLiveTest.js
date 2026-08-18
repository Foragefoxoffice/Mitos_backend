const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,       // rzp_live_xxx
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * CREATE ₹10 LIVE TEST ORDER
 */
exports.createLiveTestOrder = async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 1000, // ✅ ₹10 = 1000 paise
      currency: "INR",
      receipt: "live_test_10_" + Date.now(),
    });

    return res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error("Live test order error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * VERIFY PAYMENT (₹10 TEST)
 */
exports.verifyLiveTestPayment = async (req, res) => {
  const { orderId, paymentId, signature } = req.body;

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(orderId + "|" + paymentId)
    .digest("hex");

  if (expected !== signature) {
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  return res.json({ success: true, message: "₹10 Payment verified" });
};
