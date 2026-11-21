/**
 * Picks the purchase record for `productId` out of an Apple verifyReceipt
 * response. Apple returns every product a user has ever bought in the same
 * receipt, so a naive "take the last entry" approach can silently return
 * the wrong plan for a user who owns more than one.
 *
 * The monthly plan is a Non-Renewing Subscription, so the same productId
 * shows up once per month bought. When the app sends the `transactionId`
 * it just paid for, that exact entry wins (searched in both arrays);
 * otherwise the newest by purchase_date_ms — Apple doesn't guarantee array
 * order, and picking an older month's already-used transaction would be
 * treated as "already verified" and never extend premium.
 */
function pickReceiptEntry(appleVerifyResponse, productId, transactionId = null) {
  if (transactionId) {
    const all = [
      ...(appleVerifyResponse.latest_receipt_info || []),
      ...(appleVerifyResponse.receipt?.in_app || []),
    ];
    const exact = all.find(
      (entry) => entry.product_id === productId && String(entry.transaction_id) === String(transactionId)
    );
    if (exact) return exact;
  }

  const entries = appleVerifyResponse.latest_receipt_info
    || appleVerifyResponse.receipt?.in_app
    || [];

  const matching = entries.filter((entry) => entry.product_id === productId);
  if (matching.length === 0) return null;

  // Stable: entries without a purchase date keep their array order.
  return matching.reduce((best, entry) =>
    Number(entry.purchase_date_ms || 0) >= Number(best.purchase_date_ms || 0) ? entry : best
  );
}

module.exports = { pickReceiptEntry };
