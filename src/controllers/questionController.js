const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const _ = require("lodash"); 

// Get All Questions
const getAllQuestions = async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      
    });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching questions", error });
  }
};

// Get Questions by Topic
const getQuestionsByTopic = async (req, res) => {
  const { topicId } = req.params;
  try {
    const questions = await prisma.question.findMany({
      where: { topicId: parseInt(topicId) },
     
    });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching questions by topic" });
  }
};

// Get Questions by Subject
const getQuestionsBySubject = async (req, res) => {
  const { subjectId } = req.params;
  try {
    const questions = await prisma.question.findMany({
      where: { subjectId: parseInt(subjectId) },
     
    });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching questions by subject" });
  }
};

// Get Questions by Chapter
const getQuestionsByChapter = async (req, res) => {
  const { chapterId } = req.params;
  try {
    const questions = await prisma.question.findMany({
      where: { chapterId: parseInt(chapterId) },
      
    });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching questions by chapter" });
  }
};

// Get Questions by Question Type
const getQuestionsByQuestionType = async (req, res) => {
  const { questionTypeId } = req.params;
  try {
    const questions = await prisma.question.findMany({
      where: { questionTypeId: parseInt(questionTypeId) },
      
    });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching questions by question type" });
  }
};

// Add a Question
const addQuestion = async (req, res) => {
  const {
    questionTypeId,
    portionId,
    subjectId,
    chapterId,
    topicId,
    question,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    hint,
  } = req.body;

  try {
    const question = await prisma.question.create({
      data: {
        questionTypeId,
        portionId,
        subjectId,
        chapterId,
        topicId,
        question,
        image,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption,
        hint,
      },
    });
    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ message: "Error adding question" });
  }
};

// Add Multiple Questions
const createQuestions = async (req, res) => {
  const { questions, portionId, subjectId, chapterId, topicId } = req.body;

  try {
    await prisma.question.createMany({
      data: questions.map((q) => ({
        subjectId,
        chapterId,
        topicId,
        portionId,
        questionTypeId: q.questionTypeId,
        question: q.question,
        image: q.image ,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.answer,
        hint: q.hint,
      })),
      skipDuplicates: true,
    });

    res.status(201).json({ message: "Questions added successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to import questions", error });
  }
};

const getQuestionsByMultipleTopics = async (req, res) => {
  const { topicIds } = req.query; // Expecting a query parameter like ?topicIds=1,2,3

  if (!topicIds) {
    return res.status(400).json({ message: "topicIds query parameter is required" });
  }

  try {
    const topicIdArray = topicIds.split(",").map((id) => parseInt(id.trim()));

    const questions = await prisma.question.findMany({
      where: {
        topicId: {
          in: topicIdArray,
        },
      },
    });

    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching questions by multiple topics", error });
  }
};

const getQuestionsByMultipleTypes = async (req, res) => {
  const { questionTypeIds, chapterId } = req.query; // Expecting a query parameter like ?questionTypeIds=1,2,3

  if (!chapterId) {
    return res.status(400).json({ message: "chapterId query parameter is required" });
  }

  try {
    // Parse questionTypeIds from the query string and convert them to integers
    const questionTypeIdArray = questionTypeIds.split(",").map((id) => parseInt(id.trim()));

    // Query questions with both questionTypeId and chapterId
    const questions = await prisma.question.findMany({
      where: {
        questionTypeId: {
          in: questionTypeIdArray, // Filter by question type IDs
        },
        chapterId: parseInt(chapterId), // Filter by chapter ID
      },
    });

    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching questions by multiple types", error });
  }
};

// Helper function to fetch all questions from portions
const fetchAllQuestions = async () => {
  const portions = await prisma.portion.findMany({
    include: {
      subjects: {
        include: {
          chapters: {
            include: {
              topics: {
                include: {
                  questions: {
                    include: {
                      subject: { select: { id: true, name: true } },
                      chapter: { select: { id: true, name: true } },
                      questionType: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!portions.length) {
    throw new Error('No portions found');
  }

  return portions.flatMap(portion =>
    portion.subjects.flatMap(subject =>
      subject.chapters.flatMap(chapter =>
        chapter.topics.flatMap(topic => topic.questions)
      )
    )
  );
};

// Get Random Test Questions
const getRandomTestQuestions = async (req, res) => {
  try {
    const totalQuestions = 180;
    const allQuestions = await fetchAllQuestions();

    if (allQuestions.length < totalQuestions) {
      return res.status(400).json({
        message: `Not enough questions available. Only ${allQuestions.length} questions found.`,
      });
    }

    const selectedQuestions = _.sampleSize(allQuestions, totalQuestions);
    res.json(selectedQuestions);
  } catch (error) {
    console.error('Error fetching test questions:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Get Random Test Questions by Portion
const getPortionBasedTestQuestions = async (req, res) => {
  try {
    const { portionId } = req.params;

    const portion = await prisma.portion.findUnique({
      where: { id: parseInt(portionId) },
      include: {
        subjects: {
          include: {
            chapters: {
              include: {
                topics: {
                  include: {
                    questions: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!portion) {
      return res.status(404).json({ message: "Portion not found" });
    }

    let selectedQuestions = [];
    const questionsPerSubject = Math.floor(180 / portion.subjects.length);

    portion.subjects.forEach(subject => {
      let subjectQuestions = [];
      const questionsPerChapter = Math.max(1, Math.floor(questionsPerSubject / subject.chapters.length));

      subject.chapters.forEach(chapter => {
        let chapterQuestions = [];
        chapter.topics.forEach(topic => {
          const questions = topic.questions;
          if (questions.length > 0) {
            const topicQuestions = questions
              .sort(() => 0.5 - Math.random())
              .slice(0, Math.max(1, Math.floor(questionsPerChapter / chapter.topics.length)));
            chapterQuestions.push(...topicQuestions);
          }
        });

        subjectQuestions.push(...chapterQuestions.slice(0, questionsPerChapter));
      });

      selectedQuestions.push(...subjectQuestions.slice(0, questionsPerSubject));
    });

    selectedQuestions = selectedQuestions.sort(() => 0.5 - Math.random()).slice(0, 180);
    res.json(selectedQuestions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching portion-based test questions", error });
  }
};


// Get Random Test Questions by Subject

const getChapterBasedTestQuestions = async (req, res) => {
  try {
    const { portionId, subjectId, chapterId } = req.params; // Get portion, subject, and chapter IDs

    // Fetch the portion with the specified subject and chapter, including topics and questions
    const portion = await prisma.portion.findUnique({
      where: { id: parseInt(portionId) },
      include: {
        subjects: {
          where: { id: parseInt(subjectId) }, // Filter by subject ID
          include: {
            chapters: {
              where: { id: parseInt(chapterId) }, // Filter by chapter ID
              include: {
                topics: {
                  include: {
                    questions: true, // Fetch all questions under each topic
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!portion || portion.subjects.length === 0) {
      return res.status(404).json({ message: "Subject not found in the portion" });
    }

    const subject = portion.subjects[0];

    if (!subject.chapters || subject.chapters.length === 0) {
      return res.status(404).json({ message: "Chapter not found in the subject" });
    }

    const chapter = subject.chapters[0];
    let selectedQuestions = [];

    // Collect all questions from the chapter's topics
    chapter.topics.forEach((topic) => {
      if (topic.questions.length > 0) {
        selectedQuestions.push(...topic.questions);
      }
    });

    if (selectedQuestions.length === 0) {
      return res.status(404).json({ message: "No questions found in the chapter" });
    }

    // Shuffle and limit to 180 questions (or the total available if less than 180)
    const totalQuestions = Math.min(180, selectedQuestions.length);
    selectedQuestions = selectedQuestions.sort(() => 0.5 - Math.random()).slice(0, totalQuestions);

    res.json(selectedQuestions);
  } catch (error) {
    console.error('Error fetching chapter-based test questions:', error);
    res.status(500).json({ message: "Error fetching chapter-based test questions", error: error.message });
  }
};

// Get Random Test Questions by Subject
const getSubjectBasedTestQuestions = async (req, res) => {
  try {
    const { portionId, subjectId } = req.params;

    const portion = await prisma.portion.findUnique({
      where: { id: parseInt(portionId) },
      include: {
        subjects: {
          where: { id: parseInt(subjectId) },
          include: {
            chapters: {
              include: {
                topics: {
                  include: {
                    questions: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!portion || portion.subjects.length === 0) {
      return res.status(404).json({ message: "Subject not found in the portion" });
    }

    let selectedQuestions = [];
    const subject = portion.subjects[0];
    const questionsPerChapter = Math.max(1, Math.floor(180 / subject.chapters.length));

    subject.chapters.forEach(chapter => {
      let chapterQuestions = [];
      chapter.topics.forEach(topic => {
        const questions = topic.questions;
        if (questions.length > 0) {
          const topicQuestions = questions
            .sort(() => 0.5 - Math.random())
            .slice(0, Math.max(1, Math.floor(questionsPerChapter / chapter.topics.length)));
          chapterQuestions.push(...topicQuestions);
        }
      });

      selectedQuestions.push(...chapterQuestions.slice(0, questionsPerChapter));
    });

    selectedQuestions = selectedQuestions.sort(() => 0.5 - Math.random()).slice(0, 180);
    res.json(selectedQuestions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching subject-based test questions", error });
  }
};


// Get Random Test Questions by postion chapter 

const getCustomTestQuestions = async (req, res) => {
  try {
    const { portionId, subjectId, chapterId, topicIds, questionCount } = req.body;

    // Validate questionCount
    const validCounts = [40, 80, 120, 180];
    if (!validCounts.includes(questionCount)) {
      return res.status(400).json({ message: "Invalid question count. Choose from 40, 80, 120, or 180." });
    }

    // Fetch the portion, subject, chapters, and topics with questions
    const portion = await prisma.portion.findUnique({
      where: { id: parseInt(portionId) },
      include: {
        subjects: {
          where: { id: parseInt(subjectId) },
          include: {
            chapters: {
              where: { id: parseInt(chapterId) },
              include: {
                topics: {
                  where: { id: { in: topicIds.map(id => parseInt(id)) } }, // Filter selected topics
                  include: {
                    questions: true, // Fetch questions under selected topics
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!portion) {
      return res.status(404).json({ message: "Portion not found" });
    }

    if (!portion.subjects.length) {
      return res.status(404).json({ message: "Subject not found in this portion" });
    }

    let allQuestions = [];

    // Extracting topics and questions
    portion.subjects[0].chapters.forEach((chapter) => {
      chapter.topics.forEach((topic) => {
        if (topic.questions.length > 0) {
          allQuestions.push(...topic.questions);
        }
      });
    });

    if (allQuestions.length === 0) {
      return res.status(404).json({ message: "No questions available for the selected topics" });
    }

    // Shuffle questions
    allQuestions = allQuestions.sort(() => 0.5 - Math.random());

    // Select the exact number of questions needed
    const selectedQuestions = allQuestions.slice(0, questionCount);

    res.json(selectedQuestions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching custom test questions", error });
  }
};



module.exports = {
  getAllQuestions,
  getQuestionsByTopic,
  getQuestionsByMultipleTopics, 
  getQuestionsBySubject,
  getQuestionsByChapter,
  getQuestionsByQuestionType,
  getQuestionsByMultipleTypes,
  addQuestion,
  createQuestions,
  getRandomTestQuestions,
  getPortionBasedTestQuestions,
  getSubjectBasedTestQuestions,
  getCustomTestQuestions,
  getChapterBasedTestQuestions
};
