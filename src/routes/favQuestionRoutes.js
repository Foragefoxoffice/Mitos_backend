const express = require('express');
const router = express.Router();
const {addFavQuestion,getUserFavQuestions,removeFavQuestion} = require('../controllers/favQuestionController');
const { authenticateUser, authorizeRole } = require("../middlewares/authMiddleware");

router.post('/',authenticateUser,addFavQuestion);
router.get('/:userId',authenticateUser,getUserFavQuestions);
router.delete('/',authenticateUser,removeFavQuestion);

module.exports = router;
