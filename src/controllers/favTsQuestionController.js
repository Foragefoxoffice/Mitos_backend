const prisma = require("../utils/prisma");

const addFavTsQuestion = async (req, res) => {
  const { userId, questionId } = req.body;
  try {
    const fav = await prisma.userfavtsquestion.create({
      data: { userId: parseInt(userId, 10), questionId: parseInt(questionId, 10) },
    });
    res.status(201).json(fav);
  } catch (err) {
    res.status(400).json({ error: "Already favorited or invalid data." });
  }
};

const getUserFavTsQuestions = async (req, res) => {
  const userId = parseInt(req.params.userId);
  try {
    const favs = await prisma.userfavtsquestion.findMany({
      where: { userId },
      include: { question: { include: { subject: true } } },
    });
    res.json(favs);
  } catch (err) {
    res.status(500).json({ error: "Error fetching favorites." });
  }
};

const removeFavTsQuestion = async (req, res) => {
  const { userId, questionId } = req.body;
  try {
    await prisma.userfavtsquestion.delete({
      where: {
        userId_questionId: {
          userId: parseInt(userId, 10),
          questionId: parseInt(questionId, 10),
        },
      },
    });
    res.json({ message: "Favorite removed." });
  } catch (err) {
    res.status(404).json({ error: "Favorite not found." });
  }
};

module.exports = { addFavTsQuestion, getUserFavTsQuestions, removeFavTsQuestion };
