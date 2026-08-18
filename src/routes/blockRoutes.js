const express = require("express");
const router = express.Router();
const {blockEntity} = require('../controllers/blockController');
const { authenticateUser, authorizeRole } = require("../middlewares/authMiddleware");

// Admin block/unblock content
router.post('/', authenticateUser, authorizeRole(["admin"]),  blockEntity);

module.exports = router;
    