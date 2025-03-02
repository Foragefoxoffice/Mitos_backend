const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Create Chapter
const createChapter = async (req, res) => {
  const { name, parentId } = req.body;

  try {
    const chapter = await prisma.chapter.create({
      data: { name, subjectId:parentId },
    });
    res.status(201).json(chapter);
  } catch (error) {
    res.status(500).json({ message: "Error creating chapter", error });
  }
};

// Edit Chapter
const editChapter = async (req, res) => {
  const { id } = req.params;
  const { name, subjectId } = req.body;

  try {
    const chapter = await prisma.chapter.update({
      where: { id: parseInt(id) },
      data: { name, subjectId },
    });
    res.json(chapter);
  } catch (error) {
    res.status(500).json({ message: "Error editing chapter", error });
  }
};

// Delete Chapter
const deleteChapter = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.chapter.delete({ where: { id: parseInt(id) } });
    res.json({ message: "Chapter deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting chapter", error });
  }
};

// Get All Chapters
const getAllChapters = async (req, res) => {
    try {
      const chapters = await prisma.chapter.findMany();
      res.json(chapters);
    } catch (error) {
      res.status(500).json({ message: "Error fetching chapters", error });
    }
  };
  
  // Get Chapter by ID
  const getChapterById = async (req, res) => {
    const { id } = req.params;
  
    try {
      const chapter = await prisma.chapter.findUnique({
        where: { id: parseInt(id) },
      });
  
      if (!chapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }
  
      res.json(chapter);
    } catch (error) {
      res.status(500).json({ message: "Error fetching chapter", error });
    }
  };
  
  const getChapterByParentId = async (req, res) => {
    const { subjectId } = req.params;
  
    try {
      // Use findMany if subjectId is not unique
      const chapters = await prisma.chapter.findMany({
        where: { subjectId: parseInt(subjectId) },
        select: {
          id: true,
          name: true,
        
        },
      });
  
      if (!chapters || chapters.length === 0) {
        return res.status(404).json({ message: "No chapters found for this subject" });
      }
  
      res.json(chapters);
    } catch (error) {
      console.error("Error fetching chapters:", error);
      res.status(500).json({ message: "Error fetching chapters", error: error.message });
    }
  };
module.exports = {
  createChapter,
  editChapter,
  getChapterByParentId,
  deleteChapter,
  getAllChapters,
  getChapterById,

};
