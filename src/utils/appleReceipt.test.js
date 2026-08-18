const { pickReceiptEntry } = require('./appleReceipt');

describe('pickReceiptEntry', () => {
  it('returns null when there are no in_app entries', () => {
    const result = pickReceiptEntry({ receipt: { in_app: [] } }, 'com.mitoslearning.app.neet2027');
    expect(result).toBeNull();
  });

  it('returns null when no entry matches the requested productId', () => {
    const appleData = {
      receipt: {
        in_app: [
          { product_id: 'com.mitoslearning.app.neet2028', transaction_id: 'txn_1' },
        ],
      },
    };
    const result = pickReceiptEntry(appleData, 'com.mitoslearning.app.neet2027');
    expect(result).toBeNull();
  });

  it('picks the entry matching productId, ignoring unrelated products the user also owns', () => {
    const appleData = {
      receipt: {
        in_app: [
          { product_id: 'com.mitoslearning.app.neet2027', transaction_id: 'txn_old' },
          { product_id: 'com.mitoslearning.app.neet2028', transaction_id: 'txn_other' },
        ],
      },
    };
    const result = pickReceiptEntry(appleData, 'com.mitoslearning.app.neet2028');
    expect(result).toEqual({ product_id: 'com.mitoslearning.app.neet2028', transaction_id: 'txn_other' });
  });

  it('when multiple entries match productId (repeat purchase), picks the most recent one', () => {
    const appleData = {
      receipt: {
        in_app: [
          { product_id: 'com.mitoslearning.app.neet2027', transaction_id: 'txn_first' },
          { product_id: 'com.mitoslearning.app.neet2027', transaction_id: 'txn_second' },
        ],
      },
    };
    const result = pickReceiptEntry(appleData, 'com.mitoslearning.app.neet2027');
    expect(result.transaction_id).toBe('txn_second');
  });

  it('prefers latest_receipt_info over receipt.in_app when both are present', () => {
    const appleData = {
      latest_receipt_info: [
        { product_id: 'com.mitoslearning.app.neet2027', transaction_id: 'txn_from_latest' },
      ],
      receipt: {
        in_app: [
          { product_id: 'com.mitoslearning.app.neet2027', transaction_id: 'txn_from_in_app' },
        ],
      },
    };
    const result = pickReceiptEntry(appleData, 'com.mitoslearning.app.neet2027');
    expect(result.transaction_id).toBe('txn_from_latest');
  });
});
