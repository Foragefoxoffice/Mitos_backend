const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
  
const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const questionRoutes = require("./src/routes/questionRoutes");
const testRoutes = require("./src/routes/testRoutes");
const questionTypeRoutes = require("./src/routes/questionTypeRoutes");
const subjectRoutes = require("./src/routes/subjectRoutes");
const portionRoutes = require("./src/routes/portionRoutes");
const chapterRoutes = require("./src/routes/chapterRoutes");
const topicRoutes = require("./src/routes/topicRoutes");
const pdfRoutes=require("./src/routes/pdfRoutes");

dotenv.config();

const app = express();

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const allowedOrigins = ['http://localhost:3000', 'https://mitoslearning.com', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));


app.use(express.json());

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
