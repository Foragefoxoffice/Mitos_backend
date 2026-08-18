const express = require('express');
const router = express.Router();
const getMulterUpload = require('../middlewares/upload');
const uploadBanner = getMulterUpload('banners');

const {
  getAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
} = require('../controllers/bannerController');

router.get('/', getAllBanners);
router.get('/:id', getBannerById);
router.post('/', uploadBanner.single('image'), createBanner);
router.put('/:id', uploadBanner.single('image'), updateBanner); // ✅ FIXED
router.delete('/:id', deleteBanner);

module.exports = router;
