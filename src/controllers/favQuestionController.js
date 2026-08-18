const prisma = require("../utils/prisma");
const { PrismaClient } = require('@prisma/client');


const addFavQuestion = async (req, res) => {
  const { userId, questionId } = req.body;
  try {
    const fav = await prisma.userfavquestion.create({
      data: { userId, questionId }
    });
    res.status(201).json(fav);
  } catch (err) {
    res.status(400).json({ error: 'Already favorited or invalid data.' });
  }
};

const getUserFavQuestions = async (req, res) => {
  const userId = parseInt(req.params.userId);
  try {
    const favs = await prisma.userfavquestion.findMany({
      where: { userId },
      include: { question: { include: { subject: true } } }
    });
    res.json(favs);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching favorites.' });
  }
};

const removeFavQuestion = async (req, res) => {
  const { userId, questionId } = req.body;
  try {
    await prisma.userfavquestion.delete({
      where: {
        userId_questionId: { userId, questionId }
      }
    });
    res.json({ message: 'Favorite removed.' });
  } catch (err) {
    res.status(404).json({ error: 'Favorite not found.' });
  }
};

module.exports = {
  addFavQuestion,
  getUserFavQuestions,
  removeFavQuestion
};