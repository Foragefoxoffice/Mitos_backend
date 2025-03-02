const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function generateTestData() {
    try {
        console.log('Generating test data...');

        // Create Portions
        const portions = await prisma.portion.createMany({
            data: [
                { name: 'Portion 1' },
                { name: 'Portion 2' }
            ]
        });

        // Fetch created portions
        const createdPortions = await prisma.portion.findMany();

        // Subject names
        const subjectNames = ['Math', 'Science', 'History', 'Geography'];

        // Create Subjects for each Portion
        for (const portion of createdPortions) {
            for (const subjectName of subjectNames) {
                await prisma.subject.create({
                    data: {
                        name: subjectName,
                        portionId: portion.id
                    }
                });
            }
        }

        // Fetch created subjects
        const createdSubjects = await prisma.subject.findMany();

        // Create Chapters (10 per subject)
        for (const subject of createdSubjects) {
            for (let i = 1; i <= 10; i++) {
                await prisma.chapter.create({
                    data: {
                        name: `${subject.name} Chapter ${i}`,
                        subjectId: subject.id
                    }
                });
            }
        }

        // Fetch created chapters
        const createdChapters = await prisma.chapter.findMany();

        // Create Topics (5 per chapter)
        for (const chapter of createdChapters) {
            for (let i = 1; i <= 5; i++) {
                await prisma.topic.create({
                    data: {
                        name: `${chapter.name} Topic ${i}`,
                        chapterId: chapter.id
                    }
                });
            }
        }

        // Fetch created topics
        const createdTopics = await prisma.topic.findMany();

        // Create Question Types
        const questionTypes = await prisma.questionType.createMany({
            data: [
                { name: 'Multiple Choice' },
                { name: 'True/False' },
                { name: 'Short Answer' },
                { name: 'Essay' }
            ]
        });

        // Fetch created question types
        const createdQuestionTypes = await prisma.questionType.findMany();

        // Generate 180 Questions
        for (let i = 0; i < 180; i++) {
            const randomPortion = createdPortions[Math.floor(Math.random() * createdPortions.length)];
            const randomSubject = createdSubjects[Math.floor(Math.random() * createdSubjects.length)];
            const randomChapter = createdChapters[Math.floor(Math.random() * createdChapters.length)];
            const randomTopic = createdTopics[Math.floor(Math.random() * createdTopics.length)];
            const randomQuestionType = createdQuestionTypes[Math.floor(Math.random() * createdQuestionTypes.length)];

            await prisma.question.create({
                data: {
                    questionTypeId: randomQuestionType.id,
                    portionId: randomPortion.id,
                    subjectId: randomSubject.id,
                    chapterId: randomChapter.id,
                    topicId: randomTopic.id,
                    question: `Sample Question ${i + 1}`,
                    optionA: "Option A",
                    optionB: "Option B",
                    optionC: "Option C",
                    optionD: "Option D",
                    correctOption: "A"
                }
            });
        }

        console.log('Test data generated successfully!');
    } catch (error) {
        console.error('Error generating test data:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script
generateTestData();
