const express = require('express');
const router = express.Router();
const {reportWrongQuestion,getAllReports,updateReportStatus} = require('../controllers/wrongQuestionController');
const { authenticateUser, authorizeRole } = require("../middlewares/authMiddleware");

router.post('/', authenticateUser, reportWrongQuestion);
router.get('/', authenticateUser, getAllReports);
router.patch('/:id', authenticateUser, updateReportStatus);

module.exports = router;
