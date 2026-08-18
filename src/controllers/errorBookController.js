const prisma = require("../utils/prisma");



const getErrorBook = async (req, res) => {
  const { userId } = req.params;
  try {
    const wrongQuestions = await prisma.userwrongquestion.findMany({
      where: { userId: parseInt(userId) },
      include: {
        question: {
          include: {
            chapter: true,
            subject: true,
            topic: true,
            questionType: true,
            portion: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const formatted = wrongQuestions.map(wq => {
      const q = wq.question;
      const rawSub = q.subject?.name ?? 'Unknown Subject';
      const cleanSub = rawSub.replace(/^\d+(?:st|nd|rd|th)?\s*/i, '');

      return {
        ...q,
        rawSubject: rawSub,
        subject: cleanSub,
        chapterName: q.chapter?.name,
        topicName: q.topic?.name,
        portionName: q.portion?.name,
        questionTypeName: q.questionType?.name
      };
    });

    res.status(200).json(formatted);
  } catch (error) {
    console.error("Error fetching error book:", error);
    res.status(500).json({ message: "Error fetching error book" });
  }
};

const removeFromErrorBook = async (req, res) => {
  const { userId, questionId } = req.params;
  try {
    await prisma.userwrongquestion.deleteMany({
      where: {
        userId: parseInt(userId),
        questionId: parseInt(questionId),
      },
    });
    res.status(200).json({ message: 'Removed from error book' });
  } catch (error) {
    console.error('Error removing from error book:', error);
    res.status(500).json({ message: 'Error removing from error book' });
  }
};

// Rebuild error book from stored test responses — removes unanswered questions
const rebuildErrorBook = async (req, res) => {
  const { userId } = req.params;
  const uid = parseInt(userId);
  try {
    const results = await prisma.testresult.findMany({
      where: { userId: uid },
      select: { responses: true },
      orderBy: { createdAt: 'asc' },
    });

    // Replay all tests in order: answered wrong → add, answered correctly → remove
    const wrongSet = new Set();
    for (const result of results) {
      if (!result.responses) continue;
      const responses = typeof result.responses === 'string'
        ? JSON.parse(result.responses)
        : result.responses;
      if (!Array.isArray(responses)) continue;

      for (const resp of responses) {
        const qid = resp.id || resp.questionId;
        if (!qid || resp.userOption == null) continue; // skip unanswered
        if (resp.isCorrect === false) wrongSet.add(qid);
        else if (resp.isCorrect === true) wrongSet.delete(qid);
      }
    }

    const wrongIds = [...wrongSet];

    await prisma.userwrongquestion.deleteMany({ where: { userId: uid } });
    if (wrongIds.length > 0) {
      await prisma.userwrongquestion.createMany({
        data: wrongIds.map((qid) => ({ userId: uid, questionId: qid })),
        skipDuplicates: true,
      });
    }

    res.json({ rebuilt: true, count: wrongIds.length });
  } catch (error) {
    console.error('Error rebuilding error book:', error);
    res.status(500).json({ message: 'Failed to rebuild error book' });
  }
};

module.exports = { getErrorBook, removeFromErrorBook, rebuildErrorBook };
