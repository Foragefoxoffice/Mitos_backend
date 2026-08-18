const multer = require("multer");
const path = require("path");

// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === "image") {
      cb(null, "uploads/questions/question/"); // Save question images here
    } else if (file.fieldname === "hintImage") {
      cb(null, "uploads/questions/hints/"); // Save hint images here
    }
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname); // Unique filename
  },
});

// Create the multer instance
const upload = multer({ storage: storage });

// Middleware for handling file uploads
const uploadFiles = upload.fields([
  { name: "image", maxCount: 1 }, // Allow 1 file for "image"
  { name: "hintImage", maxCount: 1 }, // Allow 1 file for "hintImage"
]);

module.exports = uploadFiles;