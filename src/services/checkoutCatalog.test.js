const { CheckoutError } = require("./checkoutError");
const { loadCatalog, loadPackageDetail, resolveCartLines } = require("./checkoutCatalog");

describe("loadCatalog", () => {
  it("shapes plans, packages, bundle, and features", async () => {
    const db = {
      neetplan: {
        findMany: jest.fn().mockResolvedValue([
          {
            code: "NEET2026",
            title: "NEET 2026",
            expiresAt: new Date("2026-06-01"),
            neetplanprice: [
              { id: 10, finalPrice: 999, price: 1200, mrp: null, originalPrice: 1500, additionalOfferPercent: null, offerPercent: 20 },
            ],
          },
          { code: "NEET2027", title: "NEET 2027", expiresAt: new Date("2027-06-01"), neetplanprice: [] },
        ]),
      },
      testseriespackage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1, title: "Daily Challenge", description: "d", price: 199, mrp: 299,
            features: ["a"], paymentSubtitle: "sub", bannerImage: "img.png",
            _count: { tests: 5 },
          },
        ]),
      },
      testseriesbundle: {
        findFirst: jest.fn().mockResolvedValue({
          price: 999, mrp: 1999, title: "Bundle", label: "All Access", features: ["x"], paymentSubtitle: "sub2",
        }),
      },
      subscriptionfeaturecategory: {
        findMany: jest.fn().mockResolvedValue([
          {
            name: "Access", features: [
              { name: "Mock tests", freeValue: "false", premValue: "true" },
            ],
          },
        ]),
      },
    };

    const catalog = await loadCatalog(db);

    expect(catalog.plans).toEqual([
      {
        code: "NEET2026",
        title: "NEET 2026",
        expiresAt: new Date("2026-06-01"),
        priceId: 10,
        finalPrice: 999,
        mrp: 1500,
        offerPercent: 20,
      },
    ]);
    expect(catalog.packages).toEqual([
      {
        id: 1, title: "Daily Challenge", description: "d", price: 199, mrp: 299,
        features: ["a"], paymentSubtitle: "sub", bannerImage: "img.png", testCount: 5,
      },
    ]);
    expect(catalog.bundle).toEqual({
      price: 999, mrp: 1999, title: "Bundle", label: "All Access", features: ["x"], paymentSubtitle: "sub2",
    });
    expect(catalog.features).toEqual([
      { category: "Access", items: [{ name: "Mock tests", freeValue: "false", premValue: "true" }] },
    ]);
  });

  it("returns bundle:null when none active", async () => {
    const db = {
      neetplan: { findMany: jest.fn().mockResolvedValue([]) },
      testseriespackage: { findMany: jest.fn().mockResolvedValue([]) },
      testseriesbundle: { findFirst: jest.fn().mockResolvedValue(null) },
      subscriptionfeaturecategory: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const catalog = await loadCatalog(db);
    expect(catalog.bundle).toBeNull();
  });
});

describe("loadPackageDetail", () => {
  const makeDb = (pkg, tests = []) => ({
    testseriespackage: { findUnique: jest.fn().mockResolvedValue(pkg) },
    testseriestest: { findMany: jest.fn().mockResolvedValue(tests) },
  });

  it("returns the package with its tests when active and paid", async () => {
    const db = makeDb(
      { id: 1, title: "Pkg", isActive: true, price: 199 },
      [{ id: 5, name: "Test 1", duration: 200, totalQuestions: 180, isPublished: true }]
    );
    const detail = await loadPackageDetail(db, 1);
    expect(detail.title).toBe("Pkg");
    expect(detail.tests).toEqual([{ id: 5, name: "Test 1", duration: 200, totalQuestions: 180, isPublished: true }]);
  });

  it("throws 404 when package is missing", async () => {
    const db = makeDb(null);
    await expect(loadPackageDetail(db, 99)).rejects.toMatchObject({ status: 404 });
  });

  it("throws 404 when package is inactive", async () => {
    const db = makeDb({ id: 1, isActive: false, price: 199 });
    await expect(loadPackageDetail(db, 1)).rejects.toBeInstanceOf(CheckoutError);
  });

  it("throws 404 when package is free", async () => {
    const db = makeDb({ id: 1, isActive: true, price: 0 });
    await expect(loadPackageDetail(db, 1)).rejects.toMatchObject({ status: 404 });
  });
});

describe("resolveCartLines", () => {
  it("resolves a PLAN line", async () => {
    const db = {
      neetplanprice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 10, isActive: true, platform: "WEB", finalPrice: 999, price: 1200,
          neetplan: { id: 3, code: "NEET2026", title: "NEET 2026", isActive: true, expiresAt: new Date("2026-06-01") },
        }),
      },
    };
    const lines = await resolveCartLines(db, [{ type: "PLAN", priceId: 10 }]);
    expect(lines).toEqual([{
      type: "PLAN", priceId: 10, planId: 3, planCode: "NEET2026", title: "NEET 2026",
      amount: 999, expiresAt: new Date("2026-06-01"),
    }]);
  });

  it("throws 400 for an inactive plan price", async () => {
    const db = {
      neetplanprice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 10, isActive: false, platform: "WEB",
          neetplan: { id: 3, isActive: true },
        }),
      },
    };
    await expect(resolveCartLines(db, [{ type: "PLAN", priceId: 10 }])).rejects.toMatchObject({ status: 400 });
  });

  it("throws 400 for an inactive plan itself", async () => {
    const db = {
      neetplanprice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 10, isActive: true, platform: "WEB",
          neetplan: { id: 3, isActive: false },
        }),
      },
    };
    await expect(resolveCartLines(db, [{ type: "PLAN", priceId: 10 }])).rejects.toMatchObject({ status: 400 });
  });

  it("resolves a TS_PACKAGE line", async () => {
    const db = {
      testseriespackage: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, isActive: true, price: 199, title: "Pkg" }),
      },
    };
    const lines = await resolveCartLines(db, [{ type: "TS_PACKAGE", packageId: 1 }]);
    expect(lines).toEqual([{ type: "TS_PACKAGE", packageId: 1, title: "Pkg", amount: 199 }]);
  });

  it("throws 400 for a zero-price package", async () => {
    const db = {
      testseriespackage: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, isActive: true, price: 0 }),
      },
    };
    await expect(resolveCartLines(db, [{ type: "TS_PACKAGE", packageId: 1 }])).rejects.toMatchObject({ status: 400 });
  });

  it("resolves a TS_BUNDLE line", async () => {
    const db = {
      testseriesbundle: {
        findFirst: jest.fn().mockResolvedValue({ id: 7, price: 999, title: "Bundle" }),
      },
    };
    const lines = await resolveCartLines(db, [{ type: "TS_BUNDLE" }]);
    expect(lines).toEqual([{ type: "TS_BUNDLE", bundleId: 7, title: "Bundle", amount: 999 }]);
  });

  it("throws 400 when no bundle is configured", async () => {
    const db = {
      testseriesbundle: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    await expect(resolveCartLines(db, [{ type: "TS_BUNDLE" }])).rejects.toMatchObject({ status: 400 });
  });
});
