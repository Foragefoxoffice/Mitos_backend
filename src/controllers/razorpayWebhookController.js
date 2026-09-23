const prisma = require("../utils/prisma");
const { isValidWebhookSignature } = require("../utils/razorpaySignature");
const {
  fulfillCheckoutOrder,
  markOrderPaidUnfulfilled,
  markOrderFailed,
} = require("../services/purchaseFulfillment");

/**
 * Razorpay webhook: backup path to `verifyPayment` in case the client
 * never calls it back (tab closed, network drop, etc). Mounted with
 * `express.raw` so the exact bytes Razorpay signed are available for
 * signature verification — see server.js.
 *
 * Per plan: process first, respond after. A fulfilment failure returns
 * 500 so Razorpay retries; everything else (including "not our order")
 * returns 200 so Razorpay stops retrying.
 */
const handleRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.get("X-Razorpay-Signature");
    if (!isValidWebhookSignature(req.body, signature, process.env.RAZORPAY_WEBHOOK_SECRET)) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    const body = JSON.parse(req.body.toString("utf8"));
    const { event, payload } = body || {};

    const orderId = payload?.payment?.entity?.order_id || payload?.order?.entity?.id;
    if (!orderId) {
      // Not a payment/order event we care about.
      return res.status(200).json({ ignored: true });
    }

    const order = await prisma.checkoutorder.findUnique({ where: { razorpayOrderId: orderId } });
    if (!order) {
      // Logged-in/app orders (createRazorpayOrder/createCombinedOrder)
      // aren't checkoutorder rows — nothing for the guest-checkout webhook
      // to do with them.
      return res.status(200).json({ ignored: true });
    }

    if (event === "payment.captured" || event === "order.paid") {
      const paymentId = payload?.payment?.entity?.id;
      try {
        const result = await fulfillCheckoutOrder(prisma, orderId, { by: "WEBHOOK", paymentId });
        // fulfillCheckoutOrder itself fires notifyPurchaseActivated for a
        // newly-fulfilled order — no separate notify call needed here.
        return res.status(200).json({ ok: true, alreadyFulfilled: result.alreadyFulfilled });
      } catch (err) {
        await markOrderPaidUnfulfilled(prisma, orderId, {
          paymentId,
          error: err.message || String(err),
        });
        console.error("[CHECKOUT] webhook fulfilment error:", err);
        return res.status(500).json({ message: "Fulfilment failed" });
      }
    }

    if (event === "payment.failed") {
      await markOrderFailed(prisma, orderId, "payment.failed webhook");
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ignored: true });
  } catch (err) {
    console.error("[CHECKOUT] webhook error:", err);
    return res.status(500).json({ message: "Webhook processing failed" });
  }
};

module.exports = { handleRazorpayWebhook };
