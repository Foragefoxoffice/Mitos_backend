const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Public: get all active categories with features (for mobile app)
const getFeatures = async (req, res) => {
  try {
    const categories = await prisma.subscriptionfeaturecategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        features: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, freeValue: true, premValue: true, sortOrder: true },
        },
      },
    });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Admin: get all categories with all features (including inactive)
const getAdminFeatures = async (req, res) => {
  try {
    const categories = await prisma.subscriptionfeaturecategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        features: { orderBy: { sortOrder: "asc" } },
      },
    });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Admin: create category
const createCategory = async (req, res) => {
  const { name, sortOrder = 0 } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  try {
    const category = await prisma.subscriptionfeaturecategory.create({
      data: { name, sortOrder: Number(sortOrder) },
    });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Admin: update category
const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, sortOrder, isActive } = req.body;
  try {
    const updated = await prisma.subscriptionfeaturecategory.update({
      where: { id: Number(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Admin: delete category (cascades features)
const deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.subscriptionfeaturecategory.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Admin: create feature
const createFeature = async (req, res) => {
  const { categoryId, name, freeValue = "false", premValue = "true", sortOrder = 0 } = req.body;
  if (!categoryId || !name) return res.status(400).json({ error: "categoryId and name are required" });
  try {
    const feature = await prisma.subscriptionfeature.create({
      data: {
        categoryId: Number(categoryId),
        name,
        freeValue: String(freeValue),
        premValue: String(premValue),
        sortOrder: Number(sortOrder),
      },
    });
    res.json(feature);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Admin: update feature
const updateFeature = async (req, res) => {
  const { id } = req.params;
  const { name, freeValue, premValue, sortOrder, isActive, categoryId } = req.body;
  try {
    const updated = await prisma.subscriptionfeature.update({
      where: { id: Number(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(freeValue !== undefined && { freeValue: String(freeValue) }),
        ...(premValue !== undefined && { premValue: String(premValue) }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
        ...(isActive !== undefined && { isActive }),
        ...(categoryId !== undefined && { categoryId: Number(categoryId) }),
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Admin: delete feature
const deleteFeature = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.subscriptionfeature.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getFeatures,
  getAdminFeatures,
  createCategory,
  updateCategory,
  deleteCategory,
  createFeature,
  updateFeature,
  deleteFeature,
};
