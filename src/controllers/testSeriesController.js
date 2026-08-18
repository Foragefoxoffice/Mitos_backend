const prisma = require("../utils/prisma");


const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ─── Multer setup (same folder structure as main questions) ───────────────────
const tsUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const dir =
        file.fieldname === "hintImage"
          ? "questions/hints/"
          : "questions/question/";
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + "-" + file.originalname);
    },
  }),
}).fields([
  { name: "image", maxCount: 1 },
  { name: "hintImage", maxCount: 1 },
]);

// ─── Banner upload multer ──────────────────────────────────────────────────────
const bannerUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const dir = "uploads/banners/";
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      cb(null, `banner-${Date.now()}${path.extname(file.originalname)}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).array("banners", 10); // Changed to array, up to 10 banners

// ─── Test notes (PDF) upload multer ────────────────────────────────────────────
const notesUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const dir = "uploads/test-notes/";
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      cb(null, `notes-${Date.now()}${path.extname(file.originalname)}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files allowed"), false);
  },
  limits: { fileSize: 20 * 1024 * 1024 },
}).single("notes");

// ─────────────────────────────────────────────
// PACKAGE CRUD
// ─────────────────────────────────────────────

const getAllPackages = async (req, res) => {
  try {
    const packages = await prisma.testseriespackage.findMany({
      include: {
        _count: { select: { tests: true } },
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    res.json(packages);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch packages", error });
  }
};

const reorderPackages = async (req, res) => {
  const { order } = req.body; // [{id, position}]
  if (!Array.isArray(order)) return res.status(400).json({ message: "order must be an array" });
  try {
    await Promise.all(
      order.map(({ id, position }) =>
        prisma.testseriespackage.update({ where: { id: Number(id) }, data: { position: Number(position) } })
      )
    );
    res.json({ message: "Package order updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to reorder packages", error });
  }
};

const getPackageById = async (req, res) => {
  const { id } = req.params;
  try {
    const pkg = await prisma.testseriespackage.findUnique({
      where: { id: Number(id) },
      include: {
        tests: {
          include: {
            subjectConfigs: true,
            _count: { select: { questions: true } },
          },
          orderBy: { order: "asc" },
        },
      },
    });
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    res.json(pkg);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch package", error });
  }
};

const createPackage = async (req, res) => {
  const { title, description, isActive, isDailyChallenge, price, mrp, physicalPrice, physicalMrp, features, paymentSubtitle } = req.body;
  if (!title) return res.status(400).json({ message: "Title is required" });
  try {
    // Only one package can be "the" daily challenge package at a time —
    // getTodaysDailyChallengeTest picks whichever one has this flag, so
    // treat it like a radio button, not an independent checkbox.
    if (isDailyChallenge === true) {
      await prisma.testseriespackage.updateMany({ data: { isDailyChallenge: false } });
    }

    const pkg = await prisma.testseriespackage.create({
      data: {
        title,
        description,
        isActive: isActive !== false,
        isDailyChallenge: isDailyChallenge === true,
        price: Number(price) || 0,
        mrp: mrp != null ? Number(mrp) : null,
        physicalPrice: physicalPrice != null && physicalPrice !== "" ? Number(physicalPrice) : null,
        physicalMrp: physicalMrp != null && physicalMrp !== "" ? Number(physicalMrp) : null,
        features: features != null ? (Array.isArray(features) ? features : JSON.parse(features)) : null,
        paymentSubtitle: paymentSubtitle || null,
        bannerImages: [], 
      },
    });
    res.status(201).json(pkg);
  } catch (error) {
    res.status(500).json({ message: "Failed to create package", error });
  }
};

const updatePackage = async (req, res) => {
  const { id } = req.params;
  const { title, description, isActive, isDailyChallenge, price, mrp, physicalPrice, physicalMrp, features, paymentSubtitle, bannerImages } = req.body;
  console.log("updatePackage body:", JSON.stringify(req.body));
  try {
    const dailyChallengeValue = isDailyChallenge !== undefined ? (isDailyChallenge === true || isDailyChallenge === 'true') : undefined;
    // Same radio-button reasoning as createPackage — unset every other
    // package first so exactly one ends up flagged.
    if (dailyChallengeValue === true) {
      await prisma.testseriespackage.updateMany({
        where: { id: { not: Number(id) } },
        data: { isDailyChallenge: false },
      });
    }

    const data = {
      title,
      description,
      isActive: isActive !== undefined ? (isActive === true || isActive === 'true') : undefined,
      isDailyChallenge: dailyChallengeValue,
      price: price != null ? Number(price) : undefined,
      mrp: mrp != null ? Number(mrp) : null,
      physicalPrice: physicalPrice != null && physicalPrice !== "" ? Number(physicalPrice) : null,
      physicalMrp: physicalMrp != null && physicalMrp !== "" ? Number(physicalMrp) : null,
      features: features !== undefined ? (features == null ? null : Array.isArray(features) ? features : JSON.parse(features)) : undefined,
      paymentSubtitle: paymentSubtitle !== undefined ? (paymentSubtitle || null) : undefined,
    };

    if (bannerImages && Array.isArray(bannerImages)) {
      data.bannerImages = bannerImages;
      // Sync legacy bannerImage with the first banner's URL
      const firstB = bannerImages[0];
      data.bannerImage = firstB ? (typeof firstB === 'string' ? firstB : firstB.imageUrl) : null;
    }

    const pkg = await prisma.testseriespackage.update({
      where: { id: Number(id) },
      data,
    });
    res.json(pkg);
  } catch (error) {
    console.error("updatePackage error:", error.message || error);
    res.status(500).json({ message: "Failed to update package", error: { name: error.name, message: error.message } });
  }
};

const deletePackage = async (req, res) => {
  const { id } = req.params;
  try {
    const pkg = await prisma.testseriespackage.findUnique({ where: { id: Number(id) } });
    if (pkg) {
      // Delete all banners from storage
      const banners = Array.isArray(pkg.bannerImages) ? pkg.bannerImages : [];
      let bannerUrls = banners.map(b => typeof b === 'string' ? b : b.imageUrl);
      
      if (pkg.bannerImage && !bannerUrls.includes(pkg.bannerImage)) {
        bannerUrls.push(pkg.bannerImage);
      }
      
      bannerUrls.forEach(url => {
        const filePath = path.join(__dirname, "../../", url.replace(/^\//, ""));
        if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
      });
    }

    await prisma.testseriespackage.delete({ where: { id: Number(id) } });
    res.json({ message: "Package deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete package", error });
  }
};

const uploadPackageBanner = (req, res) => {
  bannerUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    const { id } = req.params;
    try {
      const pkg = await prisma.testseriespackage.findUnique({ where: { id: Number(id) } });
      if (!pkg) return res.status(404).json({ message: "Package not found" });

      const newBanners = req.files ? req.files.map(f => ({ 
        imageUrl: `/uploads/banners/${f.filename}`, 
        redirectUrl: "" 
      })) : [];
      
      let currentBanners = Array.isArray(pkg.bannerImages) ? pkg.bannerImages : [];
      
      // Normalize any existing legacy strings to objects
      currentBanners = currentBanners.map(b => typeof b === 'string' ? { imageUrl: b, redirectUrl: "" } : b);
      
      const updatedBanners = [...currentBanners, ...newBanners];
      
      const updated = await prisma.testseriespackage.update({
        where: { id: Number(id) },
        data: { 
          bannerImages: updatedBanners,
          bannerImage: updatedBanners[0]?.imageUrl || null
        },
      });
      res.json({ bannerImages: updated.bannerImages, bannerImage: updated.bannerImage });
    } catch (error) {
      console.error("uploadPackageBanner error:", error);
      res.status(500).json({ message: "Failed to upload banner", error });
    }
  });
};

const deletePackageBanner = async (req, res) => {
  const { id } = req.params;
  const { bannerUrl } = req.body; // Expect specific banner to delete
  try {
    const pkg = await prisma.testseriespackage.findUnique({ where: { id: Number(id) } });
    if (!pkg) return res.status(404).json({ message: "Package not found" });

    let currentBanners = Array.isArray(pkg.bannerImages) ? pkg.bannerImages : [];

    if (bannerUrl && typeof bannerUrl === "string") {
      // Delete specific banner from storage
      const filePath = path.join(__dirname, "../../", bannerUrl.replace(/^\//, ""));
      if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
      
      // Filter out the banner by matching its URL
      currentBanners = currentBanners.filter(b => {
        const url = typeof b === 'string' ? b : b?.imageUrl;
        return url !== bannerUrl;
      });
    } else if (!bannerUrl) {
      // Delete ALL banners (legacy behavior)
      currentBanners.forEach(b => {
        const url = typeof b === 'string' ? b : b?.imageUrl;
        if (url && typeof url === "string") {
          const filePath = path.join(__dirname, "../../", url.replace(/^\//, ""));
          if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
        }
      });
      if (pkg.bannerImage && typeof pkg.bannerImage === "string") {
        const filePath = path.join(__dirname, "../../", pkg.bannerImage.replace(/^\//, ""));
        if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
      }
      currentBanners = [];
    }

    const firstBanner = currentBanners[0];
    const bannerImageToSave = firstBanner ? (typeof firstBanner === 'string' ? firstBanner : firstBanner.imageUrl) : null;

    const updated = await prisma.testseriespackage.update({
      where: { id: Number(id) },
      data: { 
        bannerImages: currentBanners, 
        bannerImage: bannerImageToSave 
      }
    });
    res.json({ message: "Banner(s) removed", bannerImages: updated.bannerImages, bannerImage: updated.bannerImage });
  } catch (error) {
    console.error("deletePackageBanner error:", error);
    res.status(500).json({ message: "Failed to remove banner", error: error.message || error });
  }
};

const uploadBundleBanner = (req, res) => {
  bannerUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    try {
      const bundle = await prisma.testseriesbundle.findFirst({ orderBy: { createdAt: 'desc' } });
      if (!bundle) return res.status(404).json({ message: 'Bundle not found' });

      const newBanners = (req.files || []).map(f => ({
        imageUrl: `/uploads/banners/${f.filename}`,
        redirectUrl: '',
      }));
      const current = Array.isArray(bundle.bannerImages)
        ? bundle.bannerImages.map(b => typeof b === 'string' ? { imageUrl: b, redirectUrl: '' } : b)
        : [];
      const updated = await prisma.testseriesbundle.update({
        where: { id: bundle.id },
        data: { bannerImages: [...current, ...newBanners] },
      });
      res.json({ bannerImages: updated.bannerImages });
    } catch (error) {
      res.status(500).json({ message: 'Failed to upload bundle banner', error: error.message });
    }
  });
};

const deleteBundleBanner = async (req, res) => {
  const { bannerUrl } = req.body;
  try {
    const bundle = await prisma.testseriesbundle.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!bundle) return res.status(404).json({ message: 'Bundle not found' });

    let current = Array.isArray(bundle.bannerImages) ? bundle.bannerImages : [];
    if (bannerUrl) {
      const filePath = path.join(__dirname, '../../', bannerUrl.replace(/^\//, ''));
      if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
      current = current.filter(b => (typeof b === 'string' ? b : b?.imageUrl) !== bannerUrl);
    }
    const updated = await prisma.testseriesbundle.update({
      where: { id: bundle.id },
      data: { bannerImages: current },
    });
    res.json({ bannerImages: updated.bannerImages });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete bundle banner', error: error.message });
  }
};

const togglePackageStatus = async (req, res) => {
  const { id } = req.params;
  try {
    const pkg = await prisma.testseriespackage.findUnique({ where: { id: Number(id) } });
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    const updated = await prisma.testseriespackage.update({
      where: { id: Number(id) },
      data: { isActive: !pkg.isActive },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to toggle package status", error });
  }
};

// ─────────────────────────────────────────────
// TEST CRUD
// ─────────────────────────────────────────────

const getTestsByPackage = async (req, res) => {
  const { packageId } = req.params;
  try {
    const tests = await prisma.testseriestest.findMany({
      where: { packageId: Number(packageId) },
      include: {
        subjectConfigs: true,
        _count: { select: { questions: true } },
      },
      orderBy: { order: "asc" },
    });
    res.json(tests);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch tests", error });
  }
};

const getTestById = async (req, res) => {
  const { id } = req.params;
  try {
    const test = await prisma.testseriestest.findUnique({
      where: { id: Number(id) },
      include: {
        subjectConfigs: true,
        package: true,
        _count: { select: { questions: true } },
      },
    });
    if (!test) return res.status(404).json({ message: "Test not found" });
    res.json(test);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch test", error });
  }
};

const createTest = async (req, res) => {
  const { packageId } = req.params;
  const { name, duration, totalQuestions, subjectConfigs, videoUrl, syllabus } = req.body;

  if (!name) return res.status(400).json({ message: "Test name is required" });
  if (!subjectConfigs || !Array.isArray(subjectConfigs) || subjectConfigs.length === 0) {
    return res.status(400).json({ message: "Subject configs are required" });
  }

  try {
    // Auto-assign next order value
    const lastTest = await prisma.testseriestest.findFirst({
      where: { packageId: Number(packageId) },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const nextOrder = (lastTest?.order ?? -1) + 1;

    const test = await prisma.testseriestest.create({
      data: {
        packageId: Number(packageId),
        name,
        duration: duration || 200,
        totalQuestions: totalQuestions || 180,
        order: nextOrder,
        videoUrl: videoUrl || null,
        syllabus: syllabus || null,
        subjectConfigs: {
          create: subjectConfigs.map((sc) => ({
            subjectName: sc.subjectName,
            questionCount: sc.questionCount,
          })),
        },
      },
      include: { subjectConfigs: true },
    });
    res.status(201).json(test);
  } catch (error) {
    res.status(500).json({ message: "Failed to create test", error });
  }
};

// Reorder tests within a package
const reorderTests = async (req, res) => {
  const { packageId } = req.params;
  const { order } = req.body; // [{id, order}]
  if (!Array.isArray(order)) return res.status(400).json({ message: "order must be an array" });
  try {
    await prisma.$transaction(
      order.map(({ id, order: o }) =>
        prisma.testseriestest.update({
          where: { id: Number(id), packageId: Number(packageId) },
          data: { order: Number(o) },
        })
      )
    );
    res.json({ message: "Order updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to reorder tests", error });
  }
};

const updateTest = async (req, res) => {
  const { id } = req.params;
  const { name, duration, totalQuestions, isPublished, subjectConfigs, videoUrl, syllabus, order } = req.body;

  try {
    // Update test and replace subject configs
    const updated = await prisma.$transaction(async (tx) => {
      const test = await tx.testseriestest.update({
        where: { id: Number(id) },
        data: {
          name,
          duration,
          totalQuestions,
          isPublished,
          videoUrl: videoUrl ?? undefined,
          syllabus: syllabus ?? undefined,
          ...(order !== undefined && { order: Number(order) }),
        },
      });

      if (subjectConfigs && Array.isArray(subjectConfigs)) {
        await tx.testseriessubjectconfig.deleteMany({ where: { testId: Number(id) } });
        await tx.testseriessubjectconfig.createMany({
          data: subjectConfigs.map((sc) => ({
            testId: Number(id),
            subjectName: sc.subjectName,
            questionCount: sc.questionCount,
          })),
        });
      }

      return tx.testseriestest.findUnique({
        where: { id: Number(id) },
        include: { subjectConfigs: true },
      });
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update test", error });
  }
};

const deleteTest = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.testseriestest.delete({ where: { id: Number(id) } });
    res.json({ message: "Test deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete test", error });
  }
};

// One PDF per test (e.g. detailed solutions/notes) — replaces any existing
// file the same way uploadPackageBanner replaces a single banner slot.
const uploadTestNotes = (req, res) => {
  notesUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    const { id } = req.params;
    try {
      const test = await prisma.testseriestest.findUnique({ where: { id: Number(id) } });
      if (!test) return res.status(404).json({ message: "Test not found" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      if (test.notesUrl) {
        const oldPath = path.join(__dirname, "../../", test.notesUrl.replace(/^\//, ""));
        if (fs.existsSync(oldPath)) fs.unlink(oldPath, () => {});
      }

      const updated = await prisma.testseriestest.update({
        where: { id: Number(id) },
        data: {
          notesUrl: `/uploads/test-notes/${req.file.filename}`,
          notesFileName: req.file.originalname,
        },
      });
      res.json({ notesUrl: updated.notesUrl, notesFileName: updated.notesFileName });
    } catch (error) {
      console.error("uploadTestNotes error:", error);
      res.status(500).json({ message: "Failed to upload notes", error: error.message });
    }
  });
};

const deleteTestNotes = async (req, res) => {
  const { id } = req.params;
  try {
    const test = await prisma.testseriestest.findUnique({ where: { id: Number(id) } });
    if (!test) return res.status(404).json({ message: "Test not found" });

    if (test.notesUrl) {
      const filePath = path.join(__dirname, "../../", test.notesUrl.replace(/^\//, ""));
      if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
    }

    const updated = await prisma.testseriestest.update({
      where: { id: Number(id) },
      data: { notesUrl: null, notesFileName: null },
    });
    res.json({ message: "Notes removed", notesUrl: updated.notesUrl });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove notes", error: error.message });
  }
};

const toggleTestPublish = async (req, res) => {
  const { id } = req.params;
  try {
    const test = await prisma.testseriestest.findUnique({ where: { id: Number(id) } });
    if (!test) return res.status(404).json({ message: "Test not found" });
    const updated = await prisma.testseriestest.update({
      where: { id: Number(id) },
      data: { isPublished: !test.isPublished },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to toggle publish status", error });
  }
};

// ─────────────────────────────────────────────
// TEST QUESTIONS (assign/remove)
// ─────────────────────────────────────────────

const getQuestionsInTest = async (req, res) => {
  const { testId } = req.params;
  try {
    const items = await prisma.testseriesquestion.findMany({
      where: { testId: Number(testId) },
      include: {
        question: {
          include: { subject: true, chapter: true, topic: true },
        },
      },
      orderBy: { order: "asc" },
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch test questions", error });
  }
};

const addQuestionsToTest = async (req, res) => {
  const { testId } = req.params;
  const { questionIds } = req.body; // array of question IDs

  if (!questionIds || !Array.isArray(questionIds)) {
    return res.status(400).json({ message: "questionIds array is required" });
  }

  try {
    // Get current max order
    const lastItem = await prisma.testseriesquestion.findFirst({
      where: { testId: Number(testId) },
      orderBy: { order: "desc" },
    });
    let nextOrder = (lastItem?.order ?? -1) + 1;

    const data = questionIds.map((qId) => ({
      testId: Number(testId),
      questionId: Number(qId),
      order: nextOrder++,
    }));

    await prisma.testseriesquestion.createMany({
      data,
      skipDuplicates: true,
    });

    res.json({ message: `${questionIds.length} question(s) added to test` });
  } catch (error) {
    res.status(500).json({ message: "Failed to add questions to test", error });
  }
};

const removeQuestionFromTest = async (req, res) => {
  const { testId, questionId } = req.params;
  try {
    await prisma.testseriesquestion.deleteMany({
      where: { testId: Number(testId), questionId: Number(questionId) },
    });
    res.json({ message: "Question removed from test" });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove question", error });
  }
};

// ─────────────────────────────────────────────
// TEST SERIES QUESTION BANK CRUD
// ─────────────────────────────────────────────

const getTSQuestions = async (req, res) => {
  try {
    let { page, limit, subjectId, chapterId, topicId, questionTypeId, search } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 20;
    const skip = (page - 1) * limit;

    const where = {};
    if (subjectId) where.subjectId = Number(subjectId);
    if (chapterId) where.chapterId = Number(chapterId);
    if (topicId) where.topicId = Number(topicId);
    if (questionTypeId) where.questionTypeId = Number(questionTypeId);

    if (search) {
      where.question = { contains: search };
    }

    const [questions, total] = await Promise.all([
      prisma.testseriesquestionbank.findMany({
        where,
        skip,
        take: limit,
        include: {
          subject: true,
          chapter: true,
          topic: true,
          questionType: true,
        },
        orderBy: { id: "desc" },
      }),
      prisma.testseriesquestionbank.count({ where }),
    ]);

    res.json({
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: questions,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch questions", error });
  }
};

const getTSQuestionById = async (req, res) => {
  const { id } = req.params;
  try {
    const q = await prisma.testseriesquestionbank.findUnique({
      where: { id: Number(id) },
      include: { subject: true, chapter: true, topic: true, questionType: true },
    });
    if (!q) return res.status(404).json({ message: "Question not found" });
    res.json(q);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch question", error });
  }
};

const createTSQuestion = async (req, res) => {
  const {
    subjectId, chapterId, topicId, questionTypeId,
    question, optionA, optionB, optionC, optionD,
    correctOption, hint, difficulty, videoUrl,
  } = req.body;

  if (!subjectId || !chapterId || !question ||
    !optionA || !optionB || !optionC || !optionD || !correctOption) {
    return res.status(400).json({ message: "All required fields must be provided" });
  }

  try {
    const created = await prisma.testseriesquestionbank.create({
      data: {
        subjectId: Number(subjectId),
        chapterId: Number(chapterId),
        topicId: topicId ? Number(topicId) : null,
        questionTypeId: questionTypeId ? Number(questionTypeId) : null,
        question,
        image: req.files?.image ? req.files.image[0].path : null,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption,
        hint: hint || null,
        hintImage: req.files?.hintImage ? req.files.hintImage[0].path : null,
        difficulty: difficulty ? Number(difficulty) : 1,
        videoUrl: videoUrl || null,
      },
    });
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: "Failed to create question", error });
  }
};

const updateTSQuestion = async (req, res) => {
  const { id } = req.params;
  const {
    subjectId, chapterId, topicId, questionTypeId,
    question, optionA, optionB, optionC, optionD,
    correctOption, hint, difficulty, videoUrl,
    deleteImage, deleteHintImage,
  } = req.body;

  try {
    const existing = await prisma.testseriesquestionbank.findUnique({ where: { id: Number(id) } });
    if (!existing) return res.status(404).json({ message: "Question not found" });

    const data = {
      subjectId: subjectId ? Number(subjectId) : undefined,
      chapterId: chapterId ? Number(chapterId) : undefined,
      topicId: topicId ? Number(topicId) : undefined,
      questionTypeId: questionTypeId ? Number(questionTypeId) : undefined,
      question,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      hint,
      difficulty: difficulty ? Number(difficulty) : undefined,
      videoUrl: videoUrl !== undefined ? (videoUrl || null) : undefined,
    };

    if (req.files?.image) {
      if (existing.image && fs.existsSync(existing.image)) fs.unlinkSync(existing.image);
      data.image = req.files.image[0].path;
    } else if (deleteImage === "true") {
      if (existing.image && fs.existsSync(existing.image)) fs.unlinkSync(existing.image);
      data.image = null;
    }

    if (req.files?.hintImage) {
      if (existing.hintImage && fs.existsSync(existing.hintImage)) fs.unlinkSync(existing.hintImage);
      data.hintImage = req.files.hintImage[0].path;
    } else if (deleteHintImage === "true") {
      if (existing.hintImage && fs.existsSync(existing.hintImage)) fs.unlinkSync(existing.hintImage);
      data.hintImage = null;
    }

    const updated = await prisma.testseriesquestionbank.update({
      where: { id: Number(id) },
      data,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update question", error });
  }
};

const deleteTSQuestion = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.testseriesquestionbank.delete({ where: { id: Number(id) } });
    res.json({ message: "Question deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete question", error });
  }
};

// Create a brand-new question AND immediately assign it to a test (one-step)
const createAndAssignQuestion = async (req, res) => {
  const { testId } = req.params;
  const {
    subjectId, chapterId, topicId, questionTypeId,
    question, optionA, optionB, optionC, optionD,
    correctOption, hint, difficulty, videoUrl,
  } = req.body;

  if (!subjectId || !chapterId || !topicId || !questionTypeId || !question ||
    !optionA || !optionB || !optionC || !optionD || !correctOption) {
    return res.status(400).json({ message: "All required fields must be provided" });
  }

  try {
    const lastItem = await prisma.testseriesquestion.findFirst({
      where: { testId: Number(testId) },
      orderBy: { order: "desc" },
    });
    const nextOrder = (lastItem?.order ?? -1) + 1;

    const result = await prisma.$transaction(async (tx) => {
      const newQuestion = await tx.testseriesquestionbank.create({
        data: {
          subjectId: Number(subjectId),
          chapterId: Number(chapterId),
          topicId: Number(topicId),
          questionTypeId: Number(questionTypeId),
          question,
          image: req.files?.image ? req.files.image[0].path : null,
          optionA,
          optionB,
          optionC,
          optionD,
          correctOption,
          hint: hint || null,
          hintImage: req.files?.hintImage ? req.files.hintImage[0].path : null,
          difficulty: difficulty ? Number(difficulty) : 1,
          videoUrl: videoUrl || null,
        },
      });

      await tx.testseriesquestion.create({
        data: { testId: Number(testId), questionId: newQuestion.id, order: nextOrder },
      });

      return newQuestion;
    });

    res.status(201).json({ message: "Question created and assigned to test", question: result });
  } catch (error) {
    res.status(500).json({ message: "Failed to create and assign question", error });
  }
};

// Get TS questions not yet in a specific test (for assignment UI)
const getTSQuestionsNotInTest = async (req, res) => {
  const { testId } = req.params;
  try {
    let { subjectId, chapterId, topicId, page, limit } = req.query;
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 20;
    const skip = (page - 1) * limit;

    const assignedIds = await prisma.testseriesquestion.findMany({
      where: { testId: Number(testId) },
      select: { questionId: true },
    });
    const excludeIds = assignedIds.map((a) => a.questionId);

    const where = { id: { notIn: excludeIds.length ? excludeIds : [0] } };
    if (subjectId) where.subjectId = Number(subjectId);
    if (chapterId) where.chapterId = Number(chapterId);
    if (topicId) where.topicId = Number(topicId);

    const [questions, total] = await Promise.all([
      prisma.testseriesquestionbank.findMany({
        where,
        skip,
        take: limit,
        include: { subject: true, chapter: true, topic: true },
        orderBy: { id: "desc" },
      }),
      prisma.testseriesquestionbank.count({ where }),
    ]);

    res.json({ total, page, totalPages: Math.ceil(total / limit), data: questions });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch available questions", error });
  }
};

// ─────────────────────────────────────────────
// USER-FACING (app/frontend) READ ENDPOINTS
// ─────────────────────────────────────────────

// Active packages with published test count + purchase status (individual + bundle + premium)
const getActivePackagesForUsers = async (req, res) => {
  const userId = req.user?.id;
  try {
    const [packages, purchases, bundlePurchase] = await Promise.all([
      prisma.testseriespackage.findMany({
        include: {
          // All tests, published or not — the admin asked for the card's
          // test count to reflect everything in the package, not just
          // what's currently live.
          _count: { select: { tests: true } },
        },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      }),
      userId
        ? prisma.testseriespurchase.findMany({
            where: { userId },
            select: { packageId: true, purchaseType: true },
          })
        : [],
      userId
        ? prisma.testseriesbundlepurchase.findUnique({ where: { userId }, select: { purchaseType: true } })
        : null,
    ]);

    const hasBundlePurchase = !!bundlePurchase;
    const bundleIsPhysical = bundlePurchase?.purchaseType === "PHYSICAL";
    const purchaseMap = new Map(purchases.map((p) => [p.packageId, p.purchaseType]));

    const result = packages.map((pkg) => {
      const purchaseType = purchaseMap.get(pkg.id) ?? null;
      const isPurchased = hasBundlePurchase || pkg.price === 0 || !!purchaseType;
      const isPhysicalPurchased = bundleIsPhysical || purchaseType === "PHYSICAL";
      return { ...pkg, isPurchased, purchaseType, isPhysicalPurchased };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch packages", error });
  }
};

// Published tests for a package
const getPublishedTestsForUser = async (req, res) => {
  const { packageId } = req.params;
  try {
    const tests = await prisma.testseriestest.findMany({
      where: { packageId: Number(packageId) },
      include: {
        subjectConfigs: true,
        _count: { select: { questions: true } },
      },
      orderBy: { order: "asc" },
    });
    res.json(tests);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch tests", error });
  }
};

// Home screen's "Today's Test" card — the newest published test in
// whichever package the admin flagged isDailyChallenge (e.g. "Daily
// Challenge Series"). Test names follow an established admin convention
// embedding the date, e.g. "Daily Challenge #012 [17/08/2026]" — tries to
// match today's date exactly first (correct even if tomorrow's test gets
// uploaded a day early, or a day gets skipped), falling back to simply the
// most recently published test if no exact match is found (a new test
// might not be up yet today) or if the admin hasn't adopted that naming
// convention at all.
const getTodaysDailyChallengeTest = async (req, res) => {
  try {
    const pkg = await prisma.testseriespackage.findFirst({
      where: { isDailyChallenge: true, isActive: true },
      select: { id: true, title: true },
    });
    if (!pkg) return res.json({ test: null });

    const tests = await prisma.testseriestest.findMany({
      where: { packageId: pkg.id, isPublished: true },
      orderBy: { createdAt: "desc" },
      take: 20, // only need to search recent ones for today's date
      select: { id: true, name: true, totalQuestions: true, duration: true, createdAt: true },
    });
    if (tests.length === 0) return res.json({ test: null });

    const now = new Date();
    const todayStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    const exactMatch = tests.find((t) => t.name.includes(`[${todayStr}]`));
    const chosen = exactMatch || tests[0];

    res.json({
      test: {
        id: chosen.id,
        name: chosen.name,
        totalQuestions: chosen.totalQuestions,
        duration: chosen.duration,
      },
      packageId: pkg.id,
      packageTitle: pkg.title,
      isToday: !!exactMatch,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch today's test", error: error.message });
  }
};

// Full test data with questions (for taking the test in app)
const getTestForPlay = async (req, res) => {
  const { testId } = req.params;
  try {
    const test = await prisma.testseriestest.findUnique({
      where: { id: Number(testId), isPublished: true },
      include: {
        subjectConfigs: true,
        package: { select: { id: true, title: true } },
        questions: {
          include: {
            question: {
              include: {
                subject: true,
                chapter: true,
                topic: true,
                questionType: true,
              },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!test) return res.status(404).json({ message: "Test not found or not published" });

    // Flatten questions into the format expected by the app
    const questions = test.questions.map((tq) => ({
      ...tq.question,
      order: tq.order,
    }));

    res.json({
      id: test.id,
      name: test.name,
      duration: test.duration,
      totalQuestions: test.totalQuestions,
      subjectConfigs: test.subjectConfigs,
      package: test.package,
      questions,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch test", error });
  }
};

// Returns subjects and chapters that actually have TS questions (used by admin filter)
const getTSFilterMeta = async (req, res) => {
  try {
    const { subjectId } = req.query;

    if (subjectId) {
      const rows = await prisma.testseriesquestionbank.findMany({
        where: { subjectId: Number(subjectId) },
        select: { chapter: { select: { id: true, name: true } } },
        distinct: ["chapterId"],
      });
      const chapters = rows
        .map((r) => r.chapter)
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
      return res.json({ chapters });
    }

    const rows = await prisma.testseriesquestionbank.findMany({
      select: { subject: { select: { id: true, name: true } } },
      distinct: ["subjectId"],
    });
    const subjects = rows
      .map((r) => r.subject)
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
    return res.json({ subjects });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch filter metadata", error: err.message });
  }
};

module.exports = {
  tsUpload,
  createAndAssignQuestion,
  // Packages
  getAllPackages,
  reorderPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
  uploadPackageBanner,
  deletePackageBanner,
  uploadBundleBanner,
  deleteBundleBanner,
  togglePackageStatus,
  // Tests
  getTestsByPackage,
  getTestById,
  createTest,
  updateTest,
  deleteTest,
  uploadTestNotes,
  deleteTestNotes,
  toggleTestPublish,
  reorderTests,
  // Test Questions
  getQuestionsInTest,
  addQuestionsToTest,
  removeQuestionFromTest,
  // User-facing
  getActivePackagesForUsers,
  getPublishedTestsForUser,
  getTodaysDailyChallengeTest,
  getTestForPlay,
  // TS Question Bank
  getTSQuestions,
  getTSQuestionById,
  createTSQuestion,
  updateTSQuestion,
  deleteTSQuestion,
  getTSQuestionsNotInTest,
  getTSFilterMeta,
  // Results
  saveResult,
  getResult,
  getUserResults,
  updateReattemptAnswers,
  getMyTestRanks,
};

// ─────────────────────────────────────────────────────────────────────────────
// TEST SERIES RESULTS
// ─────────────────────────────────────────────────────────────────────────────

// Save or update result after test completion
async function saveResult(req, res) {
  try {
    const userId = req.user.id;
    const { testId, score, totalMarks, correct, wrong, unanswered, accuracy, timeTaken, userAnswers, resultsBySubject, resultsByType } = req.body;
    const result = await prisma.testseriesresult.upsert({
      where: { userId_testId: { userId, testId: Number(testId) } },
      create: {
        userId, testId: Number(testId), score, totalMarks, correct, wrong,
        unanswered, accuracy, timeTaken,
        userAnswers, resultsBySubject: resultsBySubject ?? {}, resultsByType: resultsByType ?? {},
      },
      update: {
        score, totalMarks, correct, wrong, unanswered, accuracy, timeTaken,
        userAnswers, resultsBySubject: resultsBySubject ?? {}, resultsByType: resultsByType ?? {},
      },
    });
    res.json(result);
  } catch (err) {
    console.error('saveResult error:', err);
    res.status(500).json({ error: 'Failed to save result' });
  }
}

// Get single result with questions (for analytics / view answers / error book)
async function getResult(req, res) {
  try {
    const userId = req.user.id;
    const testId = Number(req.params.testId);
    const result = await prisma.testseriesresult.findUnique({
      where: { userId_testId: { userId, testId } },
    });
    if (!result) return res.status(404).json({ error: 'No result found' });

    const testQuestions = await prisma.testseriesquestion.findMany({
      where: { testId },
      include: {
        question: { include: { subject: true, chapter: true, topic: true, questionType: true } },
      },
      orderBy: { order: 'asc' },
    });

    const questions = testQuestions.map(tq => {
      const q = tq.question;
      return {
        id: q.id,
        question: q.question,
        options: [q.optionA, q.optionB, q.optionC, q.optionD],
        correctOption: q.correctOption,
        hint: q.hint,
        image: q.image,
        hintImage: q.hintImage,
        videoUrl: q.videoUrl,
        subject: q.subject?.name,
        subjectId: q.subjectId,
        rawSubject: q.subject?.name,
        chapter: q.chapter?.name,
        chapterId: q.chapterId,
        type: q.questionType?.name,
        typeId: q.questionTypeId,
      };
    });

    res.json({ ...result, questions });
  } catch (err) {
    console.error('getResult error:', err);
    res.status(500).json({ error: 'Failed to fetch result' });
  }
}

// Get all results for current user (for history / web dashboard)
async function getUserResults(req, res) {
  try {
    const userId = req.user.id;
    const results = await prisma.testseriesresult.findMany({
      where: { userId },
      include: {
        test: { select: { name: true, package: { select: { title: true } } } },
      },
      orderBy: { attemptedAt: 'desc' },
    });
    res.json(results);
  } catch (err) {
    console.error('getUserResults error:', err);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
}

// Get rank for each attempted test for the current user (one call, all tests)
async function getMyTestRanks(req, res) {
  try {
    const userId = req.user.id;

    // All results by this user
    const myResults = await prisma.testseriesresult.findMany({
      where: { userId },
      select: { testId: true, score: true },
    });

    if (myResults.length === 0) return res.json({});

    // For each test: count users with higher score (= rank - 1) and total users
    const ranks = {};
    await Promise.all(
      myResults.map(async ({ testId, score }) => {
        const [higher, total] = await Promise.all([
          prisma.testseriesresult.count({ where: { testId, score: { gt: score } } }),
          prisma.testseriesresult.count({ where: { testId } }),
        ]);
        ranks[testId] = { rank: higher + 1, total };
      })
    );

    res.json(ranks);
  } catch (err) {
    console.error('getMyTestRanks error:', err);
    res.status(500).json({ error: 'Failed to fetch ranks' });
  }
}

// Patch reattempt answers and recalculate score
async function updateReattemptAnswers(req, res) {
  try {
    const userId = req.user.id;
    const testId = Number(req.params.testId);
    const { userAnswers: newAnswers } = req.body;

    const existing = await prisma.testseriesresult.findUnique({
      where: { userId_testId: { userId, testId } },
    });

    const testQuestions = await prisma.testseriesquestion.findMany({
      where: { testId },
      include: { question: true },
    });

    // Merge: if no existing DB result yet (result only in AsyncStorage), use newAnswers as base
    const mergedAnswers = existing
      ? { ...existing.userAnswers, ...newAnswers }
      : { ...newAnswers };
    let score = 0, correct = 0, wrong = 0;
    testQuestions.forEach(tq => {
      const ans = mergedAnswers[String(tq.question.id)];
      if (ans) {
        if (ans === tq.question.correctOption) { score += 4; correct++; }
        else { score -= 1; wrong++; }
      }
    });
    const attempted = Object.keys(mergedAnswers).length;
    const unanswered = testQuestions.length - attempted;
    const accuracy = attempted === 0 ? 0 : Math.round((correct / attempted) * 100);

    const totalMarks = testQuestions.length * 4;
    const updated = await prisma.testseriesresult.upsert({
      where: { userId_testId: { userId, testId } },
      update: { userAnswers: mergedAnswers, score, correct, wrong, unanswered, accuracy },
      create: {
        userId, testId, score, totalMarks, correct, wrong, unanswered, accuracy,
        timeTaken: '0:00', userAnswers: mergedAnswers, resultsBySubject: {}, resultsByType: {},
      },
    });
    res.json(updated);
  } catch (err) {
    console.error('updateReattemptAnswers error:', err);
    res.status(500).json({ error: 'Failed to update answers' });
  }
}
