const { CheckoutError } = require("./checkoutError");

/**
 * Everything the public /plans and /test-series pages need to render, in
 * one call. `db` is a Prisma client (or transaction client) — never
 * required directly, so this can be unit tested with a fake.
 */
const loadCatalog = async (db) => {
  const [neetPlans, packages, bundle, categories] = await Promise.all([
    db.neetplan.findMany({
      where: { isActive: true },
      orderBy: { expiresAt: "asc" },
      include: {
        neetplanprice: { where: { platform: "WEB", isActive: true } },
      },
    }),
    db.testseriespackage.findMany({
      where: { isActive: true, price: { gt: 0 } },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { tests: true } } },
    }),
    db.testseriesbundle.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    }),
    db.subscriptionfeaturecategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        features: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      },
    }),
  ]);

  const plans = neetPlans.flatMap((plan) => {
    const price = (plan.neetplanprice || [])[0];
    if (!price) return [];
    return [{
      code: plan.code,
      title: plan.title,
      expiresAt: plan.expiresAt,
      priceId: price.id,
      finalPrice: price.finalPrice ?? price.price,
      mrp: price.mrp ?? price.originalPrice,
      offerPercent: price.additionalOfferPercent ?? price.offerPercent,
    }];
  });

  return {
    plans,
    packages: packages.map((pkg) => ({
      id: pkg.id,
      title: pkg.title,
      description: pkg.description,
      price: pkg.price,
      mrp: pkg.mrp,
      features: pkg.features,
      paymentSubtitle: pkg.paymentSubtitle,
      bannerImage: pkg.bannerImage,
      testCount: pkg._count?.tests ?? 0,
    })),
    bundle: bundle
      ? {
          price: bundle.price,
          mrp: bundle.mrp,
          title: bundle.title,
          label: bundle.label,
          features: bundle.features,
          paymentSubtitle: bundle.paymentSubtitle,
        }
      : null,
    features: categories.map((cat) => ({
      category: cat.name,
      items: (cat.features || []).map((f) => ({
        name: f.name,
        freeValue: f.freeValue,
        premValue: f.premValue,
      })),
    })),
  };
};

/**
 * Package detail (for the public package page). 404s via CheckoutError if
 * the package doesn't exist, isn't active, or is free (nothing to buy).
 */
const loadPackageDetail = async (db, id) => {
  const pkg = await db.testseriespackage.findUnique({ where: { id: Number(id) } });
  if (!pkg || !pkg.isActive || !(pkg.price > 0)) {
    throw new CheckoutError(404, "Package not found");
  }
  const tests = await db.testseriestest.findMany({
    where: { packageId: pkg.id },
    orderBy: { order: "asc" },
    select: { id: true, name: true, duration: true, totalQuestions: true, isPublished: true },
  });
  return { ...pkg, tests };
};

/**
 * Turn parsed cart intents (checkoutPricing.parseCartItems output) into
 * priced lines, re-checking availability against the DB (never trust a
 * price the client sent).
 */
const resolveCartLines = async (db, items) => {
  const lines = [];
  for (const item of items) {
    if (item.type === "PLAN") {
      const price = await db.neetplanprice.findUnique({
        where: { id: item.priceId },
        include: { neetplan: true },
      });
      if (
        !price ||
        !price.isActive ||
        price.platform !== "WEB" ||
        !price.neetplan ||
        !price.neetplan.isActive
      ) {
        throw new CheckoutError(400, "This plan isn't available right now");
      }
      lines.push({
        type: "PLAN",
        priceId: price.id,
        planId: price.neetplan.id,
        planCode: price.neetplan.code,
        title: price.neetplan.title,
        amount: price.finalPrice ?? price.price,
        expiresAt: price.neetplan.expiresAt,
      });
    } else if (item.type === "TS_PACKAGE") {
      const pkg = await db.testseriespackage.findUnique({ where: { id: item.packageId } });
      if (!pkg || !pkg.isActive || !(pkg.price > 0)) {
        throw new CheckoutError(400, "This test series package isn't available right now");
      }
      lines.push({
        type: "TS_PACKAGE",
        packageId: pkg.id,
        title: pkg.title,
        amount: pkg.price,
      });
    } else if (item.type === "TS_BUNDLE") {
      const bundle = await db.testseriesbundle.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      });
      if (!bundle || !(bundle.price > 0)) {
        throw new CheckoutError(400, "This bundle isn't available right now");
      }
      lines.push({
        type: "TS_BUNDLE",
        bundleId: bundle.id,
        title: bundle.title || bundle.label || "All Tests Bundle",
        amount: bundle.price,
      });
    }
  }
  return lines;
};

module.exports = { loadCatalog, loadPackageDetail, resolveCartLines };
