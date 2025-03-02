const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Create Question Type
const createQuestionType = async (req, res) => {
  const { name } = req.body;

  try {
    const questionType = await prisma.questionType.create({
      data: {
        name,
      },
    });
    res.status(201).json(questionType);
  } catch (error) {
    res.status(500).json({ message: "Error creating question type", error });
  }
};

const getAllQuestionTypes = async (req, res) => {
    try {
      const questionTypes = await prisma.questionType.findMany();
      res.json(questionTypes);
    } catch (error) {
      res.status(500).json({ message: "Error fetching question types", error });
    }
  };
  
  // Get Question Type by ID
  const getQuestionTypeById = async (req, res) => {
    const { id } = req.params;
  
    try {
      const questionType = await prisma.questionType.findUnique({
        where: { id: parseInt(id) },
      });
  
      if (!questionType) {
        return res.status(404).json({ message: "Question type not found" });
      }
  
      res.json(questionType);
    } catch (error) {
      res.status(500).json({ message: "Error fetching question type", error });
    }
  };
  
// Edit Question Type
const editQuestionType = async (req, res) => {
  const { id } = req.params;
  const { name, parentId } = req.body;

  try {
    const questionType = await prisma.questionType.update({
      where: { id: parseInt(id) },
      data: {
        name,
        parentId,
      },
    });
    res.json(questionType);
  } catch (error) {
    res.status(500).json({ message: "Error editing question type", error });
  }
};

// Delete Question Type
const deleteQuestionType = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.questionType.delete({
      where: { id: parseInt(id) },
    });
    res.json({ message: "Question type deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting question type", error });
  }
};

module.exports = {
  createQuestionType,
  editQuestionType,
  deleteQuestionType,
  getAllQuestionTypes,
  getQuestionTypeById,
};
