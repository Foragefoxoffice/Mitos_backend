const prisma = require("../utils/prisma");



// Create Chapter
const createChapter = async (req, res) => {
  const { name, parentId } = req.body;

  try {
    const chapter = await prisma.chapter.create({
      data: { name, subjectId: parentId },
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

// Get Chapters by Subject with Topic and Question Counts
const getChaptersBySubjectWithCounts = async (req, res) => {
  const { subjectId } = req.params;

  try {
    const chapters = await prisma.chapter.findMany({
      where: { subjectId: parseInt(subjectId) },
      select: {
        id: true,
        name: true,
        subjectId: true,
        _count: {
          select: {
            topics: true,
            questions: true,
          },
        },
      },
    });

    if (!chapters || chapters.length === 0) {
      return res.status(404).json({ message: "No chapters found for this subject" });
    }

    const chapterIds = chapters.map(c => c.id);
    const freeMaterialCounts = await prisma.freematerial.groupBy({
      by: ['chapterId'],
      where: { chapterId: { in: chapterIds } },
      _count: { id: true },
    });
    const freeMaterialMap = {};
    freeMaterialCounts.forEach(r => { freeMaterialMap[r.chapterId] = r._count.id; });

    const chaptersWithCounts = chapters.map(chapter => ({
      id: chapter.id,
      name: chapter.name,
      subjectId: chapter.subjectId,
      topicCount: chapter._count.topics,
      questionCount: chapter._count.questions,
      freeMaterialCount: freeMaterialMap[chapter.id] ?? 0,
    }));

    res.json(chaptersWithCounts);
  } catch (error) {
    console.error("Error fetching chapters with counts:", error);
    res.status(500).json({ message: "Error fetching chapters with counts", error: error.message });
  }
};


module.exports = {
  createChapter,
  editChapter,
  getChapterByParentId,
  getChaptersBySubjectWithCounts,
  deleteChapter,
  getAllChapters,
  getChapterById,
};
