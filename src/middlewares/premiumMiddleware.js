const prisma = require("../utils/prisma");

// "Active premium" definition mirrors subscriptionController.js's
// validateSubscription exactly: an unexpired trial or an unexpired
// premiumExpiry counts, everything else doesn't. Read-only on purpose —
// unlike validateSubscription (called explicitly, occasionally) this runs
// on every gated request, so it doesn't also self-heal stale
// status/premiumExpiry back to REGISTERED; that cleanup stays
// validateSubscription's job.
const requirePremium = async (req, res, next) => {
  try {
    if (!req.user?.id || req.user.role === "guest") {
      return res.status(401).json({ message: "Login required" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const now = new Date();
    const isTrialActive = !!(user.trialEndsAt && user.trialEndsAt > now);
    const isPremiumActive = !!(user.premiumExpiry && user.premiumExpiry > now);

    if (!isTrialActive && !isPremiumActive) {
      return res.status(403).json({
        message: "This feature is available to premium members only",
        code: "PREMIUM_REQUIRED",
      });
    }

    // Downstream handlers (e.g. chat's cap check) need to tell trial and
    // paid-premium apart — a trial gets one fixed lifetime allowance, paid
    // premium gets a daily-resetting one. Attached here so they don't have
    // to re-query the user row we already just fetched.
    req.subscriptionTier = isTrialActive ? "trial" : "premium";
    next();
  } catch (error) {
    console.error("requirePremium:", error);
    res.status(500).json({ message: "Could not verify subscription" });
  }
};

module.exports = { requirePremium };
