const prisma = require("../utils/prisma");



// Create Topic
const createTopic = async (req, res) => {
  const { name, parentId } = req.body;

  try {
    const topic = await prisma.topic.create({
      data: { name, chapterId: parentId },
    });
    res.status(201).json(topic);
  } catch (error) {
    res.status(500).json({ message: "Error creating topic", error });
  }
};

// Edit Topic
const editTopic = async (req, res) => {
  const { id } = req.params;
  const { name, chapterId } = req.body;

  try {
    const topic = await prisma.topic.update({
      where: { id: parseInt(id) },
      data: { name, chapterId },
    });
    res.json(topic);
  } catch (error) {
    res.status(500).json({ message: "Error editing topic", error });
  }
};

// Delete Topic
const deleteTopic = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.topic.delete({ where: { id: parseInt(id) } });
    res.json({ message: "Topic deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting topic", error });
  }
};

// Get All Topics
const getAllTopics = async (req, res) => {
  try {
    const topics = await prisma.topic.findMany();
    res.json(topics);
  } catch (error) {
    res.status(500).json({ message: "Error fetching topics", error });
  }
};

// Get Topic by ID
const getTopicById = async (req, res) => {
  const { id } = req.params;

  try {
    const topic = await prisma.topic.findUnique({
      where: { id: parseInt(id) },
    });

    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    res.json(topic);
  } catch (error) {
    res.status(500).json({ message: "Error fetching topic", error });
  }
};

// Get Topics by Chapter ID
const getTopicByChapter = async (req, res) => {
  const { chapterId } = req.params;

  try {
    const topics = await prisma.topic.findMany({
      where: { chapterId: parseInt(chapterId) }, // Ensuring chapterId is an integer if needed
    });

    if (topics.length === 0) {
      return res.status(404).json({ message: "No topics found for this chapter" });
    }

    res.json(topics);
  } catch (error) {
    res.status(500).json({ message: "Error fetching topics", error: error.message });
  }
};


const getTopicByParentId = async (req, res) => {
  const { chapterId } = req.params;

  try {
    // Use findMany if subjectId is not unique
    const topics = await prisma.topic.findMany({
      where: { chapterId: parseInt(chapterId) },
      select: {
        id: true,
        name: true,
        isPremium: true,
      },
    });

    if (!topics || topics.length === 0) {
      return res.status(404).json({ message: "No chapters found for this subject" });
    }

    res.json(topics);
  } catch (error) {
    console.error("Error fetching chapters:", error);
    res.status(500).json({ message: "Error fetching chapters", error: error.message });
  }
};

// Get Topics by Chapter with Question Counts
const getTopicsByChapterWithCounts = async (req, res) => {
  const { chapterId } = req.params;

  try {
    const topics = await prisma.topic.findMany({
      where: { chapterId: parseInt(chapterId) },
      select: {
        id: true,
        name: true,
        isPremium: true,
        _count: {
          select: {
            questions: true,
          },
        },
      },
    });

    if (!topics || topics.length === 0) {
      return res.status(404).json({ message: "No topics found for this chapter" });
    }

    // Transform the response
    const topicsWithCounts = topics.map(topic => ({
      id: topic.id,
      name: topic.name,
      isPremium: topic.isPremium,
      questionCount: topic._count.questions,
    }));

    res.json(topicsWithCounts);
  } catch (error) {
    console.error("Error fetching topics with counts:", error);
    res.status(500).json({ message: "Error fetching topics with counts", error: error.message });
  }
};

module.exports = {
  createTopic,
  editTopic,
  deleteTopic,
  getAllTopics,
  getTopicById,
  getTopicByParentId,
  getTopicByChapter,
  getTopicsByChapterWithCounts,
};
