const { CheckoutError } = require("./checkoutError");
const {
  getNeetExpiry,
  calculateStackedExpiry,
  grantPremium,
  grantPackage,
  grantBundle,
  recordPayment,
} = require("./purchaseGrants");

describe("getNeetExpiry", () => {
  it("returns +30 days for a monthly code", () => {
    const before = Date.now();
    const expiry = getNeetExpiry("PLAN_MONTHLY");
    const diffDays = (expiry.getTime() - before) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(29);
    expect(diffDays).toBeLessThan(31);
  });

  it("returns the fixed June 1 dates for yearly codes", () => {
    expect(getNeetExpiry("NEET2026")).toEqual(new Date("2026-06-01T23:59:59Z"));
    expect(getNeetExpiry("NEET2027")).toEqual(new Date("2027-06-01T23:59:59Z"));
    expect(getNeetExpiry("NEET2028")).toEqual(new Date("2028-06-01T23:59:59Z"));
  });

  it("returns null for an unknown code", () => {
    expect(getNeetExpiry("BOGUS")).toBeNull();
    expect(getNeetExpiry(null)).toBeNull();
  });
});

describe("calculateStackedExpiry", () => {
  it("stacks remaining trial days when the user is in an active trial", async () => {
    const now = Date.now();
    const trialEndsAt = new Date(now + 5 * 24 * 60 * 60 * 1000); // 5 days left
    const db = { user: { findUnique: jest.fn().mockResolvedValue({ trialEndsAt, status: "TRIALED" }) } };
    const baseExpiry = new Date("2026-06-01T23:59:59Z");

    const stacked = await calculateStackedExpiry(db, 1, baseExpiry);
    const expectedMs = baseExpiry.getTime() + (trialEndsAt.getTime() - now);
    expect(Math.abs(stacked.getTime() - expectedMs)).toBeLessThan(1000);
  });

  it("returns baseExpiry unchanged when there is no active trial", async () => {
    const db = { user: { findUnique: jest.fn().mockResolvedValue({ trialEndsAt: null, status: "REGISTERED" }) } };
    const baseExpiry = new Date("2026-06-01T23:59:59Z");
    const result = await calculateStackedExpiry(db, 1, baseExpiry);
    expect(result).toEqual(baseExpiry);
  });

  it("returns baseExpiry when the user lookup throws", async () => {
    const db = { user: { findUnique: jest.fn().mockRejectedValue(new Error("db down")) } };
    const baseExpiry = new Date("2026-06-01T23:59:59Z");
    const result = await calculateStackedExpiry(db, 1, baseExpiry);
    expect(result).toEqual(baseExpiry);
  });
});

describe("grantPremium", () => {
  it("throws CheckoutError(400) for an unknown plan code", async () => {
    const db = { user: { findUnique: jest.fn(), update: jest.fn() } };
    await expect(grantPremium(db, 1, "BOGUS")).rejects.toBeInstanceOf(CheckoutError);
  });

  it("keeps the later of the existing and new premiumExpiry", async () => {
    const laterExisting = new Date("2027-06-01T23:59:59Z");
    const db = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ trialEndsAt: null, status: "REGISTERED" }) // calculateStackedExpiry's read
          .mockResolvedValueOnce({ premiumExpiry: laterExisting }), // grantPremium's own read
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const result = await grantPremium(db, 1, "NEET2026");
    expect(result).toEqual(laterExisting);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "PREMIUM", premiumExpiry: laterExisting },
    });
  });

  it("uses the new expiry when it is later than the existing one", async () => {
    const earlierExisting = new Date("2025-01-01T00:00:00Z");
    const newExpiry = new Date("2026-06-01T23:59:59Z");
    const db = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ trialEndsAt: null, status: "REGISTERED" })
          .mockResolvedValueOnce({ premiumExpiry: earlierExisting }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const result = await grantPremium(db, 1, "NEET2026");
    expect(result).toEqual(newExpiry);
  });
});

describe("grantPackage", () => {
  it("creates a purchase with shipping fields when provided", async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 1 });
    const db = { testseriespurchase: { upsert } };
    await grantPackage(db, {
      userId: 1, packageId: 2, orderId: "order_1", paymentId: "pay_1", amount: 199,
      shippingDetails: { name: "A", phone: "1", address: "addr", city: "c", pincode: "1" },
    });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_packageId: { userId: 1, packageId: 2 } },
      create: expect.objectContaining({ amount: 199, shippingName: "A" }),
      update: expect.objectContaining({ amount: 199, shippingName: "A" }),
    }));
  });

  it("omits amount from the update branch when amount is 0", async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 1 });
    const db = { testseriespurchase: { upsert } };
    await grantPackage(db, { userId: 1, packageId: 2, orderId: "o", paymentId: "p", amount: 0 });
    const call = upsert.mock.calls[0][0];
    expect(call.update).not.toHaveProperty("amount");
    expect(call.update).not.toHaveProperty("shippingName");
    expect(call.create).toMatchObject({ amount: 0 });
  });
});

describe("grantBundle", () => {
  it("upserts by userId", async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 1 });
    const db = { testseriesbundlepurchase: { upsert } };
    await grantBundle(db, { userId: 5, orderId: "o", paymentId: "p", amount: 999 });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 5 } }));
  });

  it("omits amount from the update branch when amount is 0", async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 1 });
    const db = { testseriesbundlepurchase: { upsert } };
    await grantBundle(db, { userId: 5, orderId: "o", paymentId: "p", amount: 0 });
    const call = upsert.mock.calls[0][0];
    expect(call.update).not.toHaveProperty("amount");
  });
});

describe("recordPayment", () => {
  it("creates a payment with the given defaults and increments the coupon", async () => {
    const create = jest.fn().mockResolvedValue({ id: 1 });
    const couponUpdate = jest.fn().mockResolvedValue({});
    const db = { payment: { create }, coupon: { update: couponUpdate } };

    const result = await recordPayment(db, { userId: 1, amount: 100, couponId: 7 });

    expect(result).toEqual({ id: 1 });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        currency: "INR",
        paymentMethod: "ONLINE",
        paymentStatus: "COMPLETED",
        paymentGateway: "Razorpay",
        userId: 1,
        amount: 100,
        couponId: 7,
      }),
    });
    expect(couponUpdate).toHaveBeenCalledWith({ where: { id: 7 }, data: { usedCount: { increment: 1 } } });
  });

  it("does not touch the coupon when couponId is not set", async () => {
    const create = jest.fn().mockResolvedValue({ id: 1 });
    const couponUpdate = jest.fn();
    const db = { payment: { create }, coupon: { update: couponUpdate } };
    await recordPayment(db, { userId: 1, amount: 100 });
    expect(couponUpdate).not.toHaveBeenCalled();
  });

  it("swallows P2002 and returns null without incrementing the coupon", async () => {
    const err = Object.assign(new Error("dup"), { code: "P2002" });
    const create = jest.fn().mockRejectedValue(err);
    const couponUpdate = jest.fn();
    const db = { payment: { create }, coupon: { update: couponUpdate } };
    const result = await recordPayment(db, { userId: 1, amount: 100, couponId: 7 });
    expect(result).toBeNull();
    expect(couponUpdate).not.toHaveBeenCalled();
  });

  it("rethrows any other error", async () => {
    const err = new Error("boom");
    const create = jest.fn().mockRejectedValue(err);
    const db = { payment: { create }, coupon: { update: jest.fn() } };
    await expect(recordPayment(db, { userId: 1, amount: 100 })).rejects.toThrow("boom");
  });
});
