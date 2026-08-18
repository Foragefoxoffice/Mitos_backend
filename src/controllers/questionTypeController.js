const prisma = require("../utils/prisma");



// Create Question Type
const createQuestionType = async (req, res) => {
  const { name } = req.body;

  try {
    const questionType = await prisma.questiontype.create({
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
    const questionTypes = await prisma.questiontype.findMany();
    res.json(questionTypes);
  } catch (error) {
    res.status(500).json({ message: "Error fetching question types", error });
  }
};

// Get Question Type by ID
const getQuestionTypeById = async (req, res) => {
  const { id } = req.params;

  try {
    const questionType = await prisma.questiontype.findUnique({
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
    const questionType = await prisma.questiontype.update({
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
    await prisma.questiontype.delete({
      where: { id: parseInt(id) },
    });
    res.json({ message: "Question type deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting question type", error });
  }
};

// Get Question Types by Chapter with Question Counts
const getQuestionTypesByChapterWithCounts = async (req, res) => {
  const { chapterId } = req.params;

  if (isNaN(chapterId)) {
    return res.status(400).json({ message: "Invalid chapterId" });
  }

  try {
    const questionTypes = await prisma.questiontype.findMany({
      where: {
        question: {
          some: {
            chapterId: parseInt(chapterId),
          },
        },
      },
      select: {
        id: true,
        name: true,
        isPremium: true,
        _count: {
          select: {
            question: {
              where: {
                chapterId: parseInt(chapterId),
              },
            },
          },
        },
      },
    });

    const response = questionTypes.map(type => ({
      id: type.id,
      name: type.name,
      isPremium: type.isPremium,
      questionCount: type._count.question,
    }));

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error fetching question types with counts",
      error: error.message,
    });
  }
};


module.exports = {
  createQuestionType,
  editQuestionType,
  deleteQuestionType,
  getAllQuestionTypes,
  getQuestionTypeById,
  getQuestionTypesByChapterWithCounts,
};
