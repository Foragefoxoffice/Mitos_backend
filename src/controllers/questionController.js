const prisma = require("../utils/prisma");


const _ = require("lodash");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const deleteQuestion = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.question.delete({
      where: { id: Number(id) },
    });

    res.status(200).json({ message: "Question deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete question", error });
  }
};


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

// Get Questions with Pagination + Filters
const getPaginatedQuestions = async (req, res) => {
  try {
    let { page, limit, subjectId, chapterId, topicId, portionId, questionTypeId, search } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 20;
    const skip = (page - 1) * limit;

    const where = {};

    if (subjectId) where.subjectId = Number(subjectId);
    if (chapterId) where.chapterId = Number(chapterId);
    if (topicId) where.topicId = Number(topicId);
    if (portionId) where.portionId = Number(portionId);
    if (questionTypeId) where.questionTypeId = Number(questionTypeId);

    if (search) {
      const searchId = parseInt(search);
      where.OR = [
        { question: { contains: search } },
        { subject: { name: { contains: search } } },
        { chapter: { name: { contains: search } } },
        { topic: { name: { contains: search } } },
        { questionType: { name: { contains: search } } },
      ];

      // If search is a valid number, also check for exact ID match
      if (!isNaN(searchId)) {
        where.OR.push({ id: searchId });
      }
    }

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        skip,
        take: limit,
        include: {
          subject: true,
          chapter: true,
          topic: true,
          portion: true,
          questionType: true,
        },
        orderBy: { id: "asc" },
      }),
      prisma.question.count({ where }),
    ]);

    res.json({
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: questions,
    });
  } catch (error) {
    console.error("Error in getPaginatedQuestions:", error);
    res.status(500).json({ 
      message: "Error fetching questions", 
      error: error.message || "Internal server error" 
    });
  }
};



// Get a Single Question by ID
const getQuestionById = async (req, res) => {
  const { id } = req.params; // Extract the question ID from request parameters

  try {
    const question = await prisma.question.findUnique({
      where: { id: parseInt(id) }, // Ensure ID is an integer
      include: {
        subject: true,
        chapter: true,
        topic: true,
        questionType: true,
        // Include related topic details if needed
      },
    });

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.json(question);
  } catch (error) {
    res.status(500).json({ message: "Error fetching question", error });
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

// Get Questions by Subject
const getQuestionsByPortion = async (req, res) => {
  const { portionId } = req.params;
  try {
    const questions = await prisma.question.findMany({
      where: { portionId: parseInt(portionId) },

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

// Storage for `image`
const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "questions/question/"); // Store question images in `uploads/questions/`
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  },
});

// Storage for `hintImage`
const hintImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "questions/hints/"); // Store hint images in `uploads/hints/`
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  },
});

// Create upload handlers for different storage
const uploadImage = multer({ storage: imageStorage }).single("image");
const uploadHintImage = multer({ storage: hintImageStorage }).single("hintImage");

// Combined Middleware to Handle Both Uploads
const uploadFiles = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      if (file.fieldname === "image") {
        cb(null, "questions/question/");
      } else if (file.fieldname === "hintImage") {
        cb(null, "questions/hints/");
      }
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + "-" + file.originalname);
    }
  })
}).fields([
  { name: "image", maxCount: 1 },
  { name: "hintImage", maxCount: 1 }
]);


// Create Question Function
const createQuestion = async (req, res) => {
  try {
    console.log("Request Body:", req.body); // Log request body
    console.log("Uploaded Files:", req.file, req.files); // Log uploaded files

    const {
      portionId, subjectId, chapterId, topicId, questionTypeId,
      question, optionA, optionB, optionC, optionD, correctOption, hint
    } = req.body;

    // Ensure all required fields exist
    if (!question || !correctOption || !optionA || !optionB || !optionC || !optionD) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Convert numeric values
    const parsedData = {
      subjectId: parseInt(subjectId) || null,
      chapterId: parseInt(chapterId) || null,
      topicId: parseInt(topicId) || null,
      portionId: parseInt(portionId) || null,
      questionTypeId: parseInt(questionTypeId) || null,
      question,
      image: req.files?.image ? req.files.image[0].path : null,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      hint,
      hintImage: req.files?.hintImage ? req.files.hintImage[0].path : null,
    };

    await prisma.question.create({ data: parsedData });

    res.status(201).json({ message: "Question added successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to add question", error: error.message });
  }
};

const updateQuestion = async (req, res) => {
  const { id } = req.params;
  const {
    topicId,
    questionTypeId,
    question,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    hint,
    deleteImage,      // Added for image deletion flag
    deleteHintImage   // Added for hint image deletion flag
  } = req.body;

  try {
    // Fetch the existing question to get the old image paths
    const existingQuestion = await prisma.question.findUnique({
      where: { id: Number(id) },
    });

    if (!existingQuestion) {
      return res.status(404).json({ message: "Question not found" });
    }

    // Prepare the data object for updating the question
    const updateData = {
      question,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      hint,
    };

    // Update topic relationship if topicId is provided
    if (topicId) {
      updateData.topic = {
        connect: { id: parseInt(topicId) },
      };
    }

    // Update questionType relationship if questionTypeId is provided
    if (questionTypeId) {
      updateData.questionType = {
        connect: { id: parseInt(questionTypeId) },
      };
    }

    // Handle image deletion or update
    if (deleteImage === "true") {
      // Delete the existing image if it exists
      if (existingQuestion.image) {
        try {
          fs.unlinkSync(path.resolve(existingQuestion.image));
        } catch (err) {
          console.error("Error deleting image file:", err);
        }
      }
      updateData.image = null; // Set image to null in database
    } else if (req.files?.image) {
      // New image uploaded - delete old one if exists
      if (existingQuestion.image) {
        try {
          fs.unlinkSync(path.resolve(existingQuestion.image));
        } catch (err) {
          console.error("Error deleting old image file:", err);
        }
      }
      updateData.image = req.files.image[0].path;
    }

    // Handle hint image deletion or update
    if (deleteHintImage === "true") {
      // Delete the existing hint image if it exists
      if (existingQuestion.hintImage) {
        try {
          fs.unlinkSync(path.resolve(existingQuestion.hintImage));
        } catch (err) {
          console.error("Error deleting hint image file:", err);
        }
      }
      updateData.hintImage = null; // Set hintImage to null in database
    } else if (req.files?.hintImage) {
      // New hint image uploaded - delete old one if exists
      if (existingQuestion.hintImage) {
        try {
          fs.unlinkSync(path.resolve(existingQuestion.hintImage));
        } catch (err) {
          console.error("Error deleting old hint image file:", err);
        }
      }
      updateData.hintImage = req.files.hintImage[0].path;
    }

    // Update the question in the database
    const updatedQuestion = await prisma.question.update({
      where: { id: Number(id) },
      data: updateData,
    });

    res.status(200).json({ message: "Question updated successfully", updatedQuestion });
  } catch (error) {
    res.status(500).json({ message: "Failed to update question", error: error.message });
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
        image: q.image,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.answer,
        hint: q.hint,
        hintImage: q.hintImage,
      })),
      skipDuplicates: true,
    });

    res.status(201).json({ message: "Questions added successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to import questions", error });
  }
};

const getQuestionsByMultipleTopics = async (req, res) => {
  const { topicIds } = req.query;

  if (!topicIds) {
    return res.status(400).json({ message: "topicIds query parameter is required" });
  }

  try {
    const topicIdArray = topicIds.split(",").map((id) => parseInt(id.trim()));

    // Fetch all questions for the given topics
    const questions = await prisma.question.findMany({
      where: {
        topicId: {
          in: topicIdArray,
        },
      },
    });

    if (questions.length === 0) {
      return res.status(404).json({ message: "No questions found for the given topics" });
    }

    // Shuffle the questions using Fisher-Yates algorithm
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }

    // Return all shuffled questions (no limit)
    res.json(questions);
  } catch (error) {
    console.error("Error fetching questions by multiple topics:", error);
    res.status(500).json({
      message: "Error fetching questions by multiple topics",
      error: error.message
    });
  }
};

const getQuestionsByMultipleTypes = async (req, res) => {
  const { questionTypeIds, chapterId } = req.query;

  if (!chapterId) {
    return res.status(400).json({ message: "chapterId query parameter is required" });
  }

  try {
    // Parse questionTypeIds (handle undefined case if not provided)
    const questionTypeIdArray = questionTypeIds
      ? questionTypeIds.split(",").map((id) => parseInt(id.trim()))
      : []; // If not provided, fetch all question types for the chapter

    // Query questions with filters
    const questions = await prisma.question.findMany({
      where: {
        ...(questionTypeIdArray.length > 0 && { // Only apply if questionTypeIds were provided
          questionTypeId: { in: questionTypeIdArray },
        }),
        chapterId: parseInt(chapterId), // Always filter by chapterId
      },
    });

    if (questions.length === 0) {
      return res.status(404).json({ message: "No questions found for the given criteria" });
    }

    // Shuffle the questions (Fisher-Yates algorithm)
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }

    // Return all shuffled questions (no limit)
    res.json(questions);
  } catch (error) {
    console.error("Error fetching questions by multiple types:", error);
    res.status(500).json({
      message: "Error fetching questions by multiple types",
      error: error.message
    });
  }
};

const getQuestionsBySubjectAndQuestionId = async (req, res) => {
  const { subjectId, questiontypeId } = req.query;

  if (!subjectId || !questiontypeId) {
    return res.status(400).json({ message: "Both subjectId and questiontypeId are required" });
  }

  try {
    const subjectIdInt = parseInt(subjectId);
    const questionTypeIdInt = parseInt(questiontypeId);

    if (isNaN(subjectIdInt) || isNaN(questionTypeIdInt)) {
      return res.status(400).json({ message: "subjectId and questiontypeId must be valid numbers" });
    }

    const question = await prisma.question.findMany({
      where: {
        subjectId: subjectIdInt,
        questionTypeId: questionTypeIdInt,
      },
    });

    if (!question) {
      return res.status(404).json({
        message: "No question found for the given subjectId and questiontypeId",
      });
    }

    res.json(question);
  } catch (error) {
    console.error("Error fetching question by subjectId and questiontypeId:", error);
    res.status(500).json({
      message: "Error fetching question by subjectId and questiontypeId",
      error: error.message,
    });
  }
};

const getQuestionsBySubjectAndChapterId = async (req, res) => {
  const { subjectId, chapterId } = req.query;

  if (!subjectId || !chapterId) {
    return res.status(400).json({ message: "Both subjectId and chapterId are required" });
  }

  try {
    const subjectIdInt = parseInt(subjectId);
    const chapterIdInt = parseInt(chapterId);

    if (isNaN(subjectIdInt) || isNaN(chapterIdInt)) {
      return res.status(400).json({ message: "subjectId and chapterId must be valid numbers" });
    }

    const question = await prisma.question.findMany({
      where: {
        subjectId: subjectIdInt,
        chapterId: chapterIdInt,
      },
    });

    if (!question) {
      return res.status(404).json({
        message: "No question found for the given subjectId and chapterId",
      });
    }

    res.json(question);
  } catch (error) {
    console.error("Error fetching question by subjectId and chapterId:", error);
    res.status(500).json({
      message: "Error fetching question by subjectId and chapterId",
      error: error.message,
    });
  }
};


const getRandomTestQuestions = async (req, res) => {
  try {
    const targetQuestions = {
      "11th Biology": 45,
      "12th Biology": 45,
      "11th Physics": 23,
      "12th Physics": 22,
      "11th Chemistry": 22,
      "12th Chemistry": 23,
    };

    // Validate target questions configuration
    if (Object.keys(targetQuestions).length === 0) {
      return res.status(400).json({ message: "Target questions configuration is empty" });
    }

    // Fetch a lean projection scoped to only the subjects we need — the
    // table has 40,000+ rows across every portion/subject, and the old
    // unfiltered findMany({ include: {...5 joins...} }) pulled and joined
    // ALL of them (~12s+ just for the query) to randomly pick ~180. We only
    // need id/chapterId/subject-name here for the selection algorithm below;
    // full question data (with all relations) is fetched afterward for just
    // the questions actually selected.
    const questions = await prisma.question.findMany({
      where: { subject: { name: { in: Object.keys(targetQuestions) } } },
      select: {
        id: true,
        chapterId: true,
        subject: { select: { name: true } },
      },
    });

    if (!questions.length) {
      return res.status(404).json({ message: "No questions found in database" });
    }

    // Group questions by subject
    const subjectWiseQuestions = {};
    Object.keys(targetQuestions).forEach(subject => {
      subjectWiseQuestions[subject] = questions.filter(q => q.subject.name === subject);
    });

    // Function to select balanced questions across chapters
    const selectBalancedQuestions = (questions, count) => {
      if (!questions.length || count <= 0) return [];
      if (questions.length <= count) return _.shuffle(questions);

      const groupedByChapter = _.groupBy(questions, "chapterId");
      const chapters = Object.keys(groupedByChapter);
      const selected = [];
      let remaining = count;

      while (remaining > 0 && chapters.length > 0) {
        const perChapter = Math.max(1, Math.floor(remaining / chapters.length));

        for (let i = 0; i < chapters.length && remaining > 0; i++) {
          const chapterId = chapters[i];
          const available = groupedByChapter[chapterId].length;
          const take = Math.min(perChapter, available, remaining);

          if (take > 0) {
            selected.push(..._.sampleSize(groupedByChapter[chapterId], take));
            remaining -= take;
          }

          // Remove chapter if no more questions available
          if (groupedByChapter[chapterId].length <= take) {
            chapters.splice(i, 1);
            i--;
          }
        }
      }

      return _.shuffle(selected);
    };

    // Select questions for each subject
    const selectedQuestions = [];
    const extraQuestionsPool = [];
    const allQuestions = [...questions]; // Clone for extra questions pool

    Object.entries(targetQuestions).forEach(([subject, count]) => {
      const availableQuestions = subjectWiseQuestions[subject] || [];
      const selected = selectBalancedQuestions(availableQuestions, count);

      selectedQuestions.push(...selected);

      // Track missing questions
      if (selected.length < count) {
        extraQuestionsPool.push({
          subject,
          missing: count - selected.length,
          usedQuestions: new Set(selected.map(q => q.id))
        });
      }
    });

    // Fill missing questions from other subjects if needed
    if (extraQuestionsPool.length > 0) {
      const unusedQuestions = allQuestions.filter(q =>
        !selectedQuestions.some(sq => sq.id === q.id)
      );

      extraQuestionsPool.forEach(({ subject, missing, usedQuestions }) => {
        const suitableQuestions = unusedQuestions.filter(q =>
          !usedQuestions.has(q.id) &&
          q.subject.name.includes(subject.split(' ')[1]) // Match subject category (Biology/Physics/Chemistry)
        );

        const extra = _.sampleSize(suitableQuestions, Math.min(missing, suitableQuestions.length));
        selectedQuestions.push(...extra);
      });
    }

    // Hydrate only the ~180 selected questions with full relation data —
    // the earlier fetch deliberately stayed lean for the selection pass.
    const fullQuestions = await prisma.question.findMany({
      where: { id: { in: selectedQuestions.map((q) => q.id) } },
      include: {
        subject: { select: { id: true, name: true } },
        chapter: { select: { id: true, name: true } },
        topic: { select: { id: true, name: true } },
        portion: { select: { id: true, name: true } },
        questionType: { select: { id: true, name: true } },
      },
    });

    res.json(_.shuffle(fullQuestions));
  } catch (error) {
    console.error("Error fetching test questions:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    if (error.meta) console.error("Error meta:", error.meta);
    res.status(500).json({
      message: "Error fetching question",
      error: {
        name: error.name,
        message: error.message,
        clientVersion: error.clientVersion
      }
    });
  }
};

const getPortionBasedTestQuestions = async (req, res) => {
  try {
    const { portionId } = req.params;
    const totalQuestions = 180;
    const targetBiologyQuestions = 90;
    const targetChemistryQuestions = 45;
    const targetPhysicsQuestions = 45;

    if (!portionId || isNaN(parseInt(portionId))) {
      return res.status(400).json({ message: "Valid portionId is required" });
    }

    // Fetch a lean projection for the portion — 11th/12th portions have
    // 20,000+ questions each, and the old unfiltered include (subject,
    // chapter, topic, questionType — all full objects) took 6-11s just to
    // fetch/join, to randomly select 180. Only id/topicId/subject-name are
    // needed for the selection algorithm below; full data is hydrated
    // afterward for just the questions actually selected.
    const questions = await prisma.question.findMany({
      where: { portionId: parseInt(portionId) },
      select: {
        id: true,
        topicId: true,
        subject: { select: { name: true } },
      },
    });

    if (!questions.length) {
      return res.status(404).json({ message: "No questions found for this portion" });
    }

    // Subject categorization
    const isBiology = (q) => ['Biology', '11th Biology', '12th Biology'].includes(q.subject.name);
    const isChemistry = (q) => ['Chemistry', '11th Chemistry', '12th Chemistry'].includes(q.subject.name);
    const isPhysics = (q) => ['Physics', '11th Physics', '12th Physics'].includes(q.subject.name);

    const biologyQuestions = questions.filter(isBiology);
    const chemistryQuestions = questions.filter(isChemistry);
    const physicsQuestions = questions.filter(isPhysics);

    // Select with topic coverage
    let selectedBiology = selectQuestionsWithTopicCoverage(biologyQuestions, targetBiologyQuestions);
    let selectedChemistry = selectQuestionsWithTopicCoverage(chemistryQuestions, targetChemistryQuestions);
    let selectedPhysics = selectQuestionsWithTopicCoverage(physicsQuestions, targetPhysicsQuestions);

    // Handle shortages
    const selectedTotal = selectedBiology.length + selectedChemistry.length + selectedPhysics.length;

    let finalSelection;
    if (selectedTotal < totalQuestions) {
      const remaining = totalQuestions - selectedTotal;

      const selectedIds = new Set([
        ...selectedBiology,
        ...selectedChemistry,
        ...selectedPhysics
      ].map(q => q.id));

      const remainingPool = questions.filter(q => !selectedIds.has(q.id));

      const extra = _.sampleSize(remainingPool, remaining);
      finalSelection = [...selectedBiology, ...selectedChemistry, ...selectedPhysics, ...extra];
    } else {
      finalSelection = [...selectedBiology, ...selectedChemistry, ...selectedPhysics];
    }

    // Hydrate only the selected questions with full relation data.
    const fullQuestions = await prisma.question.findMany({
      where: { id: { in: finalSelection.map((q) => q.id) } },
      include: {
        subject: true,
        chapter: true,
        topic: true,
        questionType: true,
      },
    });

    res.json(_.shuffle(fullQuestions));
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      message: "Failed to generate test questions",
      error: error.message
    });
  }
};


// Helper function for topic coverage selection
function selectQuestionsWithTopicCoverage(questions, targetCount) {
  if (!questions.length || targetCount <= 0) return [];
  if (questions.length <= targetCount) return _.shuffle(questions);

  const groupedByTopic = _.groupBy(questions, "topicId");
  const selected = [];

  // First select at least 1 question per topic
  Object.values(groupedByTopic).forEach(topicQuestions => {
    if (topicQuestions.length > 0) {
      selected.push(_.sample(topicQuestions));
    }
  });

  // If we've already met or exceeded target, return a sample
  if (selected.length >= targetCount) {
    return _.sampleSize(selected, targetCount);
  }

  // Select remaining questions from all available
  const remainingQuota = targetCount - selected.length;
  const allQuestions = questions.filter(q =>
    !selected.some(sq => sq.id === q.id)
  );

  selected.push(..._.sampleSize(allQuestions, remainingQuota));
  return selected;
}


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


const getChapterBasedTestQuestions = async (req, res) => {
  try {
    const { portionId, chapterIds, questionLimit } = req.body;

    // Validate input
    if (
      !portionId ||
      isNaN(parseInt(portionId)) ||
      !Array.isArray(chapterIds) ||
      chapterIds.length === 0
    ) {
      return res.status(400).json({
        message: "Valid portionId and non-empty chapterIds array are required",
      });
    }

    const parsedChapterIds = chapterIds
      .map((id) => parseInt(id))
      .filter((id) => !isNaN(id));

    const totalQuestionsNeeded =
      questionLimit && !isNaN(parseInt(questionLimit)) && parseInt(questionLimit) > 0
        ? parseInt(questionLimit)
        : 30;

    // Fetch questions
    const questions = await prisma.question.findMany({
      where: {
        portionId: parseInt(portionId),
        chapterId: { in: parsedChapterIds },
      },
      include: {
        subject: true,
        chapter: true,
        topic: true,
        questionType: true,
      },
    });

    if (!questions.length) {
      return res.status(404).json({
        message: "No questions found for the specified chapters",
      });
    }

    // Group by core subject: remove "11th"/"12th" prefix
    const coreGrouped = questions.reduce((acc, q) => {
      const coreName = q.subject.name.replace(/^\d+\w*\s/, "").trim();
      if (!acc[coreName]) acc[coreName] = [];
      acc[coreName].push(q);
      return acc;
    }, {});

    const selectedSubjects = Object.keys(coreGrouped);
    if (selectedSubjects.length === 0) {
      return res.status(404).json({
        message: "No valid core subjects found from selected chapters",
      });
    }

    // Define default weights
    const defaultRatios = {
      Biology: 0.5,
      Chemistry: 0.25,
      Physics: 0.25,
    };

    const totalWeight = selectedSubjects.reduce(
      (sum, subject) => sum + (defaultRatios[subject] || 0),
      0
    );

    // Determine number of questions per subject
    const subjectQuestionLimits = {};
    selectedSubjects.forEach((subject) => {
      const normalizedRatio = (defaultRatios[subject] || 0) / totalWeight;
      subjectQuestionLimits[subject] = Math.round(
        totalQuestionsNeeded * normalizedRatio
      );
    });

    let selectedQuestions = [];

    // Select questions per subject
    for (const [subjectName, subjectQuestions] of Object.entries(coreGrouped)) {
      const subjectLimit = subjectQuestionLimits[subjectName] || 0;
      if (subjectLimit === 0) continue;

      const chapterGroups = _.groupBy(subjectQuestions, (q) => q.chapter.id);
      const chapterIds = Object.keys(chapterGroups);
      const basePerChapter = Math.floor(subjectLimit / chapterIds.length);
      let remaining = subjectLimit;
      let tempSelected = [];

      // First pass: base per chapter
      chapterIds.forEach((chapterId) => {
        const chapterQs = chapterGroups[chapterId];
        const take = Math.min(basePerChapter, chapterQs.length);
        tempSelected.push(..._.sampleSize(chapterQs, take));
        remaining -= take;
      });

      // Second pass: distribute remaining
      if (remaining > 0) {
        const availableChapters = chapterIds.filter(
          (id) => chapterGroups[id].length > 0
        );
        while (remaining > 0 && availableChapters.length > 0) {
          const perChapter = Math.ceil(remaining / availableChapters.length);
          for (let i = 0; i < availableChapters.length && remaining > 0; i++) {
            const chapterId = availableChapters[i];
            const allQs = chapterGroups[chapterId];
            const already = tempSelected.filter((q) => q.chapter.id == chapterId);
            const available = allQs.filter((q) => !already.includes(q));
            const take = Math.min(perChapter, available.length, remaining);
            if (take > 0) {
              tempSelected.push(..._.sampleSize(available, take));
              remaining -= take;
            }
            if (available.length <= take) {
              availableChapters.splice(i, 1);
              i--;
            }
          }
        }
      }

      selectedQuestions.push(...tempSelected);
    }

    // Final shuffle and trim
    const finalQuestions = _.shuffle(selectedQuestions).slice(0, totalQuestionsNeeded);
    res.json(finalQuestions);
  } catch (error) {
    console.error("Error fetching chapter-based questions:", error);
    res.status(500).json({
      message: "Failed to generate chapter-based questions",
      error: error.message,
    });
  }
};



// Fetch multiple questions by their IDs (for View Answers)
// Fetch multiple questions by their IDs (for View Answers)
const getQuestionsByIds = async (req, res) => {
  const { ids } = req.body; // array of question IDs
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "ids must be a non-empty array" });
  }
  try {
    const questions = await prisma.question.findMany({
      where: { id: { in: ids.map(Number) } },
      include: {
        subject: true,
        chapter: true,
        topic: true,
        questionType: true,
        portion: true,
      },
    });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching questions by ids" });
  }
};

module.exports = {
  getAllQuestions,
  getPaginatedQuestions,
  getQuestionsByTopic,
  getQuestionsByMultipleTopics,
  getQuestionsBySubject,
  getQuestionsByChapter,
  getQuestionsByQuestionType,
  getQuestionsByMultipleTypes,
  getQuestionsBySubjectAndChapterId,
  createQuestion,
  createQuestions,
  getRandomTestQuestions,
  getPortionBasedTestQuestions,
  getSubjectBasedTestQuestions,
  getCustomTestQuestions,
  getChapterBasedTestQuestions,
  updateQuestion,
  deleteQuestion,
  upload: uploadFiles,
  getQuestionById,
  getQuestionsByPortion,
  getQuestionsBySubjectAndQuestionId,
  getQuestionsByIds,
};
