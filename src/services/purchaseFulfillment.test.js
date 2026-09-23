jest.mock("./purchaseGrants");
jest.mock("./purchaseNotification", () => ({ notifyPurchaseActivated: jest.fn() }));

const grants = require("./purchaseGrants");
const { notifyPurchaseActivated } = require("./purchaseNotification");
const { CheckoutError } = require("./checkoutError");
const {
  findOrCreateUserByPhone,
  fulfillCheckoutOrder,
  markOrderPaidUnfulfilled,
  markOrderFailed,
} = require("./purchaseFulfillment");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("findOrCreateUserByPhone", () => {
  it("creates a new user for an unknown phone", async () => {
    const db = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 1, phoneNumber: "+919876543210", email: null }),
        update: jest.fn(),
      },
    };
    const user = await findOrCreateUserByPhone(db, "+919876543210", null);
    expect(db.user.create).toHaveBeenCalledWith({
      data: { phoneNumber: "+919876543210", role: "user", password: "" },
    });
    expect(user.id).toBe(1);
  });

  it("does not create a user for an existing phone", async () => {
    const db = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 9, phoneNumber: "+919876543210", email: null }),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const user = await findOrCreateUserByPhone(db, "+919876543210", null);
    expect(db.user.create).not.toHaveBeenCalled();
    expect(user.id).toBe(9);
  });

  it("does not attach an email already owned by another user", async () => {
    const db = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 9, phoneNumber: "+919876543210", email: null }) // phone lookup
          .mockResolvedValueOnce({ id: 42, email: "taken@example.com" }), // email owner lookup
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const user = await findOrCreateUserByPhone(db, "+919876543210", "taken@example.com");
    expect(db.user.update).not.toHaveBeenCalled();
    expect(user.email).toBeNull();
  });

  it("attaches a free email", async () => {
    const db = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 9, phoneNumber: "+919876543210", email: null })
          .mockResolvedValueOnce(null), // no owner
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 9, email: "free@example.com" }),
      },
    };
    const user = await findOrCreateUserByPhone(db, "+919876543210", "free@example.com");
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 9 }, data: { email: "free@example.com" } });
    expect(user.email).toBe("free@example.com");
  });
});

describe("fulfillCheckoutOrder", () => {
  const makeDb = (order) => {
    const state = { order };
    const checkoutorder = {
      findUnique: jest.fn(async () => state.order),
      updateMany: jest.fn(async ({ where }) => {
        if (state.order && state.order.fulfilledAt == null && where.fulfilledAt === null) {
          state.order = { ...state.order, fulfilledAt: new Date(), status: "FULFILLED" };
          return { count: 1 };
        }
        return { count: 0 };
      }),
      update: jest.fn(async ({ data }) => {
        state.order = { ...state.order, ...data };
        return state.order;
      }),
    };
    const user = {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 5, phoneNumber: "+919876543210", email: null }),
      update: jest.fn(),
    };
    const db = {
      checkoutorder,
      user,
      $transaction: jest.fn(async (fn) => fn(db)),
    };
    return db;
  };

  it("throws 404 when the order is missing", async () => {
    const db = makeDb(null);
    await expect(fulfillCheckoutOrder(db, "order_missing", { by: "VERIFY", paymentId: "pay_1" })).rejects.toBeInstanceOf(CheckoutError);
  });

  it("grants and creates a user for a new-phone guest order", async () => {
    grants.grantPremium.mockResolvedValue(new Date("2026-06-01T23:59:59Z"));
    grants.recordPayment.mockResolvedValue({ id: 1 });

    const db = makeDb({
      id: 1,
      razorpayOrderId: "order_1",
      userId: null,
      guestPhone: "+919876543210",
      guestEmail: null,
      source: "WEB_GUEST",
      fulfilledAt: null,
      finalAmount: 999,
      discountAmount: 0,
      originalAmount: 999,
      couponId: null,
      items: [{ type: "PLAN", priceId: 10, planId: 3, planCode: "NEET2026", title: "NEET 2026", amount: 999 }],
    });

    const result = await fulfillCheckoutOrder(db, "order_1", { by: "VERIFY", paymentId: "pay_1" });

    expect(result.alreadyFulfilled).toBe(false);
    expect(db.user.create).toHaveBeenCalled();
    expect(grants.grantPremium).toHaveBeenCalledWith(db, 5, "NEET2026");
    expect(grants.recordPayment).toHaveBeenCalledWith(db, expect.objectContaining({
      userId: 5, transactionId: "pay_1", subscriptionType: "NEET2026", description: "Web checkout (guest)",
    }));
    expect(notifyPurchaseActivated).toHaveBeenCalledWith("+919876543210");
  });

  it("does not look up a phone when order.userId is already set", async () => {
    grants.grantPackage.mockResolvedValue({});
    grants.recordPayment.mockResolvedValue({ id: 1 });

    const db = makeDb({
      id: 2,
      razorpayOrderId: "order_2",
      userId: 77,
      guestPhone: "+919876543210",
      guestEmail: null,
      source: "WEB_AUTH",
      fulfilledAt: null,
      finalAmount: 199,
      discountAmount: 0,
      originalAmount: 199,
      couponId: null,
      items: [{ type: "TS_PACKAGE", packageId: 1, title: "Pkg", amount: 199 }],
    });

    const result = await fulfillCheckoutOrder(db, "order_2", { by: "WEBHOOK", paymentId: "pay_2" });

    expect(result.alreadyFulfilled).toBe(false);
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.user.create).not.toHaveBeenCalled();
    expect(grants.grantPackage).toHaveBeenCalledWith(db, expect.objectContaining({ userId: 77, packageId: 1 }));
    expect(notifyPurchaseActivated).not.toHaveBeenCalled();
  });

  it("returns alreadyFulfilled with a fresh read and grants nothing when the claim loses", async () => {
    const db = makeDb({
      id: 3,
      razorpayOrderId: "order_3",
      userId: 1,
      fulfilledAt: new Date("2026-01-01T00:00:00Z"), // already fulfilled
      guestPhone: "+919876543210",
      source: "WEB_GUEST",
      razorpayPaymentId: "pay_existing",
    });

    const result = await fulfillCheckoutOrder(db, "order_3", { by: "WEBHOOK" });

    expect(result.alreadyFulfilled).toBe(true);
    expect(grants.grantPremium).not.toHaveBeenCalled();
    expect(grants.grantPackage).not.toHaveBeenCalled();
    expect(grants.grantBundle).not.toHaveBeenCalled();
    expect(grants.recordPayment).not.toHaveBeenCalled();
    // fresh read outside the tx snapshot
    expect(db.checkoutorder.findUnique).toHaveBeenCalledWith({ where: { razorpayOrderId: "order_3" } });
    expect(notifyPurchaseActivated).not.toHaveBeenCalled();
  });

  it("throws 400 when there is no payment id available", async () => {
    const db = makeDb({
      id: 4,
      razorpayOrderId: "order_4",
      userId: 1,
      fulfilledAt: null,
      razorpayPaymentId: null,
    });
    await expect(fulfillCheckoutOrder(db, "order_4", { by: "VERIFY" })).rejects.toMatchObject({ status: 400 });
  });
});

describe("markOrderPaidUnfulfilled", () => {
  it("updates PENDING/PAID unfulfilled rows to PAID with a truncated error", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const db = { checkoutorder: { updateMany } };
    const longError = "x".repeat(2000);
    await markOrderPaidUnfulfilled(db, "order_5", { paymentId: "pay_5", error: longError });
    const call = updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ razorpayOrderId: "order_5", fulfilledAt: null });
    expect(call.data.status).toBe("PAID");
    expect(call.data.razorpayPaymentId).toBe("pay_5");
    expect(call.data.lastError.length).toBe(1000);
  });
});

describe("markOrderFailed", () => {
  it("updates PENDING rows to FAILED", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const db = { checkoutorder: { updateMany } };
    await markOrderFailed(db, "order_6", "timeout");
    expect(updateMany).toHaveBeenCalledWith({
      where: { razorpayOrderId: "order_6", status: "PENDING" },
      data: { status: "FAILED", lastError: "timeout" },
    });
  });
});
