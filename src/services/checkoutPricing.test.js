const { CheckoutError } = require("./checkoutError");
const {
  parseCartItems,
  evaluateCoupon,
  computeDiscount,
  buildQuote,
  buildReceipt,
} = require("./checkoutPricing");

describe("parseCartItems", () => {
  it("throws for non-array input", () => {
    expect(() => parseCartItems(null)).toThrow(CheckoutError);
    expect(() => parseCartItems({})).toThrow(CheckoutError);
  });

  it("throws for empty array", () => {
    expect(() => parseCartItems([])).toThrow(CheckoutError);
  });

  it("throws for unknown type", () => {
    expect(() => parseCartItems([{ type: "FOO" }])).toThrow(CheckoutError);
  });

  it("throws for a PLAN with a bad priceId", () => {
    expect(() => parseCartItems([{ type: "PLAN", priceId: -1 }])).toThrow(CheckoutError);
    expect(() => parseCartItems([{ type: "PLAN" }])).toThrow(CheckoutError);
  });

  it("throws for a TS_PACKAGE with a bad packageId", () => {
    expect(() => parseCartItems([{ type: "TS_PACKAGE", packageId: "abc" }])).toThrow(CheckoutError);
  });

  it("passes through a single plan", () => {
    expect(parseCartItems([{ type: "PLAN", priceId: 5 }])).toEqual([
      { type: "PLAN", priceId: 5 },
    ]);
  });

  it("dedupes an identical repeated plan", () => {
    expect(
      parseCartItems([{ type: "PLAN", priceId: 5 }, { type: "PLAN", priceId: 5 }])
    ).toEqual([{ type: "PLAN", priceId: 5 }]);
  });

  it("throws for 2 different plans", () => {
    expect(() =>
      parseCartItems([{ type: "PLAN", priceId: 5 }, { type: "PLAN", priceId: 6 }])
    ).toThrow(CheckoutError);
  });

  it("throws for more than 1 package", () => {
    expect(() =>
      parseCartItems([
        { type: "TS_PACKAGE", packageId: 1 },
        { type: "TS_PACKAGE", packageId: 1 },
      ])
    ).toThrow(CheckoutError);
  });

  it("allows a plan plus a package", () => {
    expect(
      parseCartItems([{ type: "PLAN", priceId: 5 }, { type: "TS_PACKAGE", packageId: 1 }])
    ).toEqual([{ type: "PLAN", priceId: 5 }, { type: "TS_PACKAGE", packageId: 1 }]);
  });

  it("drops the package when the bundle is also present", () => {
    expect(
      parseCartItems([
        { type: "PLAN", priceId: 5 },
        { type: "TS_PACKAGE", packageId: 1 },
        { type: "TS_BUNDLE" },
      ])
    ).toEqual([{ type: "PLAN", priceId: 5 }, { type: "TS_BUNDLE" }]);
  });
});

describe("evaluateCoupon", () => {
  const now = new Date("2026-09-23T00:00:00Z");

  it("rejects a missing coupon", () => {
    expect(evaluateCoupon(null, { now })).toEqual({ ok: false, message: "Invalid coupon code" });
  });

  it("rejects an inactive coupon", () => {
    expect(evaluateCoupon({ isActive: false }, { now })).toEqual({
      ok: false,
      message: "Invalid coupon code",
    });
  });

  it("rejects an expired coupon", () => {
    expect(
      evaluateCoupon({ isActive: true, expiresAt: new Date("2026-01-01") }, { now })
    ).toEqual({ ok: false, message: "Coupon expired" });
  });

  it("rejects when the global usage limit is reached", () => {
    expect(
      evaluateCoupon({ isActive: true, maxUsage: 10, usedCount: 10 }, { now })
    ).toEqual({ ok: false, message: "Coupon usage limit reached" });
  });

  it("rejects when the per-user limit is reached", () => {
    expect(
      evaluateCoupon({ isActive: true, maxPerUser: 1 }, { now, usedByUser: 1 })
    ).toEqual({ ok: false, message: "Coupon already used" });
  });

  it("accepts a valid coupon", () => {
    expect(
      evaluateCoupon({ isActive: true, maxUsage: null, maxPerUser: null }, { now, usedByUser: 0 })
    ).toEqual({ ok: true });
  });
});

describe("computeDiscount", () => {
  it("rounds a percentage discount", () => {
    expect(computeDiscount({ type: "percentage", value: 33 }, 100)).toBe(33);
    expect(computeDiscount({ type: "percentage", value: 10 }, 999)).toBe(100);
  });

  it("uses a flat value discount", () => {
    expect(computeDiscount({ type: "flat", value: 50 }, 200)).toBe(50);
  });

  it("caps the discount at the amount", () => {
    expect(computeDiscount({ type: "flat", value: 500 }, 200)).toBe(200);
    expect(computeDiscount({ type: "percentage", value: 150 }, 200)).toBe(200);
  });
});

describe("buildQuote", () => {
  it("applies the coupon to the PLAN line only", () => {
    const lines = [
      { type: "PLAN", amount: 1000 },
      { type: "TS_PACKAGE", amount: 500 },
    ];
    const coupon = { type: "flat", value: 100 };
    expect(buildQuote(lines, coupon)).toEqual({
      originalAmount: 1500,
      discountAmount: 100,
      finalAmount: 1400,
    });
  });

  it("has no discount without a coupon", () => {
    const lines = [{ type: "PLAN", amount: 1000 }];
    expect(buildQuote(lines, null)).toEqual({
      originalAmount: 1000,
      discountAmount: 0,
      finalAmount: 1000,
    });
  });

  it("has no discount when there is no PLAN line", () => {
    const lines = [{ type: "TS_PACKAGE", amount: 500 }];
    const coupon = { type: "flat", value: 100 };
    expect(buildQuote(lines, coupon)).toEqual({
      originalAmount: 500,
      discountAmount: 0,
      finalAmount: 500,
    });
  });
});

describe("buildReceipt", () => {
  it("builds a public-safe receipt", () => {
    const order = {
      userId: 42,
      razorpayOrderId: "order_abc",
      status: "FULFILLED",
      items: [
        { type: "PLAN", title: "NEET 2026", expiresAt: "2026-06-01T23:59:59.000Z" },
        { type: "TS_PACKAGE", title: "Daily Challenge" },
      ],
      originalAmount: 1500,
      discountAmount: 100,
      finalAmount: 1400,
      guestPhone: "+919876543210",
      guestEmail: "foo@example.com",
    };
    const receipt = buildReceipt(order);
    expect(receipt).toEqual({
      orderId: "order_abc",
      state: "FULFILLED",
      items: [
        { type: "PLAN", title: "NEET 2026", expiresAt: "2026-06-01T23:59:59.000Z" },
        { type: "TS_PACKAGE", title: "Daily Challenge" },
      ],
      originalAmount: 1500,
      discountAmount: 100,
      amountPaid: 1400,
      maskedPhone: "98xxxxxx10",
      emailProvided: true,
    });
    expect(receipt.userId).toBeUndefined();
    expect(JSON.stringify(receipt)).not.toContain("foo@example.com");
    expect(JSON.stringify(receipt)).not.toContain("9876543210");
  });

  it("marks emailProvided false when no guest email", () => {
    const order = {
      razorpayOrderId: "order_xyz",
      status: "PENDING",
      items: [],
      originalAmount: 100,
      discountAmount: 0,
      finalAmount: 100,
      guestPhone: "+919876543210",
      guestEmail: null,
    };
    expect(buildReceipt(order).emailProvided).toBe(false);
  });
});
