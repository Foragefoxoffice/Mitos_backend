const express = require("express");
const router = express.Router();
const {
  authenticateUser,
  authorizeRole,
} = require("../middlewares/authMiddleware");

const {
  createTSOrder,
  verifyTSPayment,
  getMyTSPurchases,
  getAllTSPurchases,
  getBundlePrice,
  upsertBundleConfig,
  createBundleOrder,
  verifyBundlePayment,
  getAllBundlePurchases,
  getReceipt,
  adminGetUserTSAccess,
  adminGrantPackageAccess,
  adminRevokePackageAccess,
  adminGrantBundleAccess,
  adminRevokeBundleAccess,
} = require("../controllers/testSeriesPaymentController");

const {
  tsUpload,
  createAndAssignQuestion,
  getActivePackagesForUsers,
  getTodaysDailyChallengeTest,
  getPublishedTestsForUser,
  getTestForPlay,
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
  getTestsByPackage,
  getTestById,
  createTest,
  updateTest,
  deleteTest,
  uploadTestNotes,
  deleteTestNotes,
  toggleTestPublish,
  reorderTests,
  getQuestionsInTest,
  addQuestionsToTest,
  removeQuestionFromTest,
  getTSQuestions,
  getTSQuestionById,
  createTSQuestion,
  updateTSQuestion,
  deleteTSQuestion,
  getTSQuestionsNotInTest,
  getTSFilterMeta,
  saveResult,
  getResult,
  getUserResults,
  updateReattemptAnswers,
  getMyTestRanks,
} = require("../controllers/testSeriesController");

const adminOnly = [authenticateUser, authorizeRole(["admin"])];
const userAccess = [authenticateUser, authorizeRole(["user", "admin"])];

// ─── Individual Package Payment ───────────────
router.post("/payment/create-order", ...userAccess, createTSOrder);
router.post("/payment/verify", ...userAccess, verifyTSPayment);
router.get("/payment/my-purchases", ...userAccess, getMyTSPurchases);
router.get("/payment/all", ...adminOnly, getAllTSPurchases);
// Receipt (public HTML — paymentId acts as token)
router.get("/receipt", getReceipt);

// ─── Bundle Payment ───────────────────────────
router.get("/bundle/price", ...userAccess, getBundlePrice);
router.post("/bundle/payment/create-order", ...userAccess, createBundleOrder);
router.post("/bundle/payment/verify", ...userAccess, verifyBundlePayment);
router.put("/bundle/config", ...adminOnly, upsertBundleConfig);
router.post("/bundle/banner", ...adminOnly, uploadBundleBanner);
router.delete("/bundle/banner", ...adminOnly, deleteBundleBanner);
router.get("/bundle/purchases", ...adminOnly, getAllBundlePurchases);

// ─── Admin: manually grant/revoke a user's Test Series access ───────────────
router.get("/admin/users/:userId/access", ...adminOnly, adminGetUserTSAccess);
router.post("/admin/users/:userId/grant-package", ...adminOnly, adminGrantPackageAccess);
router.delete("/admin/users/:userId/package/:packageId", ...adminOnly, adminRevokePackageAccess);
router.post("/admin/users/:userId/grant-bundle", ...adminOnly, adminGrantBundleAccess);
router.delete("/admin/users/:userId/bundle", ...adminOnly, adminRevokeBundleAccess);

// ─── User-facing (app) ──────────────────────
router.get("/user/packages", ...userAccess, getActivePackagesForUsers);
router.get("/user/daily-challenge/today", ...userAccess, getTodaysDailyChallengeTest);
router.get("/user/packages/:packageId/tests", ...userAccess, getPublishedTestsForUser);
router.get("/user/tests/:testId/play", ...userAccess, getTestForPlay);

// ─── Results ────────────────────────────────
router.post("/results", ...userAccess, saveResult);
router.get("/results", ...userAccess, getUserResults);
router.get("/results/ranks", ...userAccess, getMyTestRanks);
router.get("/results/:testId", ...userAccess, getResult);
router.patch("/results/:testId/reattempt", ...userAccess, updateReattemptAnswers);

// ─── Packages ───────────────────────────────
router.get("/packages", ...adminOnly, getAllPackages);
router.get("/packages/:id", ...adminOnly, getPackageById);
router.post("/packages", ...adminOnly, createPackage);
router.put("/packages/:id", ...adminOnly, updatePackage);
router.delete("/packages/:id", ...adminOnly, deletePackage);
router.patch("/packages/:id/toggle", ...adminOnly, togglePackageStatus);
router.post("/packages/:id/banner", ...adminOnly, uploadPackageBanner);
router.delete("/packages/:id/banner", ...adminOnly, deletePackageBanner);
router.patch("/packages/reorder", ...adminOnly, reorderPackages);

// ─── Tests ──────────────────────────────────
router.get("/packages/:packageId/tests", ...adminOnly, getTestsByPackage);
router.get("/tests/:id", ...adminOnly, getTestById);
router.post("/packages/:packageId/tests", ...adminOnly, createTest);
router.put("/tests/:id", ...adminOnly, updateTest);
router.delete("/tests/:id", ...adminOnly, deleteTest);
router.post("/tests/:id/notes", ...adminOnly, uploadTestNotes);
router.delete("/tests/:id/notes", ...adminOnly, deleteTestNotes);
router.patch("/tests/:id/toggle-publish", ...adminOnly, toggleTestPublish);
router.patch("/packages/:packageId/tests/reorder", ...adminOnly, reorderTests);

// ─── Test Questions (assign/remove) ─────────
router.get("/tests/:testId/questions", ...adminOnly, getQuestionsInTest);
router.post("/tests/:testId/questions", ...adminOnly, addQuestionsToTest);
router.delete("/tests/:testId/questions/:questionId", ...adminOnly, removeQuestionFromTest);
router.get("/tests/:testId/available-questions", ...adminOnly, getTSQuestionsNotInTest);
// Create question + assign to test in one step
router.post("/tests/:testId/create-question", ...adminOnly, tsUpload, createAndAssignQuestion);

// ─── Filter metadata (subjects/chapters that exist in the question bank) ─────
router.get("/filter-meta", ...adminOnly, getTSFilterMeta);

// ─── Test Series Question Bank ───────────────
router.get("/questions", ...adminOnly, getTSQuestions);
router.get("/questions/:id", ...adminOnly, getTSQuestionById);
router.post("/questions", ...adminOnly, tsUpload, createTSQuestion);
router.put("/questions/:id", ...adminOnly, tsUpload, updateTSQuestion);
router.delete("/questions/:id", ...adminOnly, deleteTSQuestion);

module.exports = router;
