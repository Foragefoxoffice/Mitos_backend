const express = require('express');
const router = express.Router();
const getMulterUpload = require('../middlewares/upload');
const uploadNews = getMulterUpload('news');
const {
  getAllNews,
  getNewsById,
  createNews,
  updateNews,
  deleteNews,
  uploadContentImage
} = require('../controllers/newsController');

// GET all news
router.get('/', getAllNews);

// GET single news item
router.get('/:id', getNewsById);

// POST create new news (with cover image)
router.post('/', uploadNews.single('image'), createNews);

// PUT update news item
router.put('/:id',uploadNews.single('image'), updateNews);  

// POST endpoint for uploading content images
router.post('/upload-content-image', uploadNews.single('file'), uploadContentImage);


// DELETE news item
router.delete('/:id', deleteNews);

module.exports = router;