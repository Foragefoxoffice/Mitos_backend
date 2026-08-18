/**
 * Picks the purchase record for `productId` out of an Apple verifyReceipt
 * response. Apple returns every product a user has ever bought in the same
 * receipt, so a naive "take the last entry" approach can silently return
 * the wrong plan for a user who owns more than one.
 */
function pickReceiptEntry(appleVerifyResponse, productId) {
  const entries = appleVerifyResponse.latest_receipt_info
    || appleVerifyResponse.receipt?.in_app
    || [];

  const matching = entries.filter((entry) => entry.product_id === productId);
  if (matching.length === 0) return null;

  return matching[matching.length - 1];
}

module.exports = { pickReceiptEntry };
