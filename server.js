// ===============================================
// 📌 1. IMPORTS
// ===============================================
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

require("./cron/expireSubscriptions");
require("./cron/cleanupNotifications");

dotenv.config();

/* ===============================================
   🛡️ GLOBAL ERROR HANDLERS (CRITICAL FOR PRODUCTION)
=============================================== */
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  // Log to external service in production (e.g., Sentry)
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  // Log to external service in production
  // Gracefully shutdown
  process.exit(1);
});

// Handle SIGTERM for graceful shutdown (PM2, Docker, etc.)
process.on("SIGTERM", () => {
  console.log("🔄 SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

const app = express();


// ===============================================
// 📌 2. MIDDLEWARE
// ===============================================
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));


/* ===============================================
   🔐 CORS CONFIG (Restricted Origins)
=============================================== */

const allowedOrigins = [
  "https://mitoslearning.com",
  "https://mitoslearning.org",
  "https://mitoslearning.in",
  "https://www.mitoslearning.com",
  "https://www.mitoslearning.org",
  "https://www.mitoslearning.in",
  "http://localhost:3000",
  "http://localhost:3002",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
];

app.use(
  cors({
    origin: function (origin, callback) {

      // Allow mobile apps / Postman / curl (no origin)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },

    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],

    credentials: false,
  })
);

// Handle preflight
app.options("*", cors());


/* ===============================================
   📝 SIMPLE LOGGER
=============================================== */
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});


// ===============================================
// 📌 3. STATIC FILES
// ===============================================
const staticOptions = {
  setHeaders: (res, file) => {
    if (file.endsWith(".pdf")) {
      res.set("Content-Type", "application/pdf");
      res.set(
        "Content-Disposition",
        `inline; filename="${path.basename(file)}"`
      );
    }
  },
};

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), staticOptions)
);

app.use(
  "/questions",
  express.static(path.join(__dirname, "questions"), staticOptions)
);

app.use(
  "/pdfuploads",
  express.static(path.join(__dirname, "pdfuploads"), staticOptions)
);

app.use(
  "/reference",
  express.static(path.join(__dirname, "reference"), staticOptions)
);


// PDF direct view
app.get("/pdf/:file", (req, res) => {
  const file = path.join(__dirname, "pdfuploads", req.params.file);

  if (!fs.existsSync(file)) {
    return res.status(404).send("PDF not found");
  }

  res.set("Content-Type", "application/pdf");
  res.sendFile(file);
});


// ===============================================
// 📌 4. IMPORT ROUTES
// ===============================================
const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const questionRoutes = require("./src/routes/questionRoutes");
const testRoutes = require("./src/routes/testRoutes");
const questionTypeRoutes = require("./src/routes/questionTypeRoutes");
const subjectRoutes = require("./src/routes/subjectRoutes");
const portionRoutes = require("./src/routes/portionRoutes");
const chapterRoutes = require("./src/routes/chapterRoutes");
const topicRoutes = require("./src/routes/topicRoutes");
const pdfRoutes = require("./src/routes/pdfRoutes");
const newsRoutes = require("./src/routes/newsRoutes");
const bannerRoutes = require("./src/routes/bannerRoutes");
const favRoutes = require("./src/routes/favQuestionRoutes");
const favTsRoutes = require("./src/routes/favTsQuestionRoutes");
const wrongRoutes = require("./src/routes/wrongQuestionRoutes");
const blockRoutes = require("./src/routes/blockRoutes");
const freeMaterialRoutes = require("./src/routes/freeMaterialRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");
const subscriptionRoutes = require("./src/routes/subscriptionRoutes");
const razorpayLiveTest = require("./src/routes/razorpayLiveTest");
const paymentRoutes = require("./src/routes/paymentRoutes");
const couponRoutes = require("./src/routes/couponRoutes");
const neetPlanRoutes = require("./src/routes/neetPlanRoutes");
const errorBookRoutes = require("./src/routes/errorBookRoutes");
const testSeriesRoutes = require("./src/routes/testSeriesRoutes");
const subscriptionFeatureRoutes = require("./src/routes/subscriptionFeatureRoutes");
const aiRoutes = require("./src/routes/aiRoutes");


// ===============================================
// 📌 5. ROUTE MAPPING
// ===============================================
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/question-types", questionTypeRoutes);
app.use("/api/portions", portionRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/chapters", chapterRoutes);
app.use("/api/topics", topicRoutes);
app.use("/api/pdf", pdfRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/fav-questions", favRoutes);
app.use("/api/fav-ts-questions", favTsRoutes);
app.use("/api/wrong-reports", wrongRoutes);
app.use("/api/block", blockRoutes);
app.use("/api/freematerials", freeMaterialRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/razorpay", razorpayLiveTest);
app.use("/api/payments", paymentRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/neet-plans", neetPlanRoutes);
app.use("/api/error-book", errorBookRoutes);
app.use("/api/test-series", testSeriesRoutes);
app.use("/api/subscription-features", subscriptionFeatureRoutes);
app.use("/api/settings", require("./src/routes/settingRoutes"));
app.use("/api/ai", aiRoutes);


// ===============================================
// 📌 6. HEALTH CHECK
// ===============================================
app.get("/", (req, res) => {
  res.send("🚀 Mitos Learning API is running successfully!");
});


// ===============================================
// 📌 7. ERROR HANDLER (CORS + GENERAL)
// ===============================================
app.use((err, req, res, next) => {

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      message: "CORS blocked: Origin not allowed",
    });
  }

  console.error("Server Error:", err);

  res.status(500).json({
    message: "Internal server error",
  });
});


// ===============================================
// 📌 8. START SERVER
// ===============================================
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📊 Process ID: ${process.pid}`);
});
