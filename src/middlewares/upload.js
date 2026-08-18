const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Supported image MIME types
const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml'
];

// Dynamic storage config generator
const getMulterUpload = (folderName) => {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const dir = path.join('uploads', folderName);
      
      // Create the folder if it doesn't exist
      fs.mkdir(dir, { recursive: true }, (err) => {
        if (err) {
          console.error(`Error creating upload directory: ${dir}`, err);
          return cb(err);
        }
        cb(null, dir);
      });
    },
    filename: function (req, file, cb) {
      const fileExt = path.extname(file.originalname);
      const uniqueName = `${uuidv4()}${fileExt}`;
      cb(null, uniqueName); // eg: '550e8400-e29b-41d4-a716-446655440000.jpg'
    }
  });

  // File filter to only allow images
  const fileFilter = (req, file, cb) => {
    if (SUPPORTED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Only images are allowed.`), false);
    }
  };

  return multer({ 
    storage,
    fileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
      files: 10 // Maximum number of files
    },
    onError: function(err, next) {
      console.error('Multer error:', err);
      next(err);
    }
  });
};

module.exports = getMulterUpload;