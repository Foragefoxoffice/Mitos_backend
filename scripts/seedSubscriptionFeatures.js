const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const data = [
  {
    name: "NEET Mark Booster - Your personalized improvement plan",
    sortOrder: 1,
    features: [
      { name: "Mark Booster for Weak Chapter", freeValue: "false", premValue: "true", sortOrder: 1 },
      { name: "Mark Booster for Weak Question Type", freeValue: "false", premValue: "true", sortOrder: 2 },
    ],
  },
  {
    name: "Test & Analysis",
    sortOrder: 2,
    features: [
      { name: "Unlimited Full length NEET mock test", freeValue: "false", premValue: "true", sortOrder: 1 },
      { name: "Custom Chapter Test(50Q, 100Q, 180Q)", freeValue: "false", premValue: "true", sortOrder: 2 },
      { name: "Error Book", freeValue: "false", premValue: "true", sortOrder: 3 },
      { name: "Create Test from Specific Chapter", freeValue: "false", premValue: "true", sortOrder: 4 },
      { name: "Weekly Subject-wise Accuracy Analysis", freeValue: "false", premValue: "true", sortOrder: 5 },
      { name: "Weekly and Monthly Personal Insights", freeValue: "false", premValue: "true", sortOrder: 6 },
    ],
  },
  {
    name: "NCERT at Fingertips",
    sortOrder: 3,
    features: [
      { name: "Line by Line NCERT Qs", freeValue: "8000 Selected Qs", premValue: "42000+ Complete Qs", sortOrder: 1 },
      { name: "Multiple Statement Qs", freeValue: "false", premValue: "true", sortOrder: 2 },
      { name: "Correct-Incorrect Statement Qs", freeValue: "false", premValue: "true", sortOrder: 3 },
      { name: "Theoretical and Analytical Qs", freeValue: "false", premValue: "true", sortOrder: 4 },
      { name: "High Value Numerical Qs for Phy and Chem", freeValue: "false", premValue: "true", sortOrder: 5 },
      { name: "Odd One Out, Fillups and Match Qs", freeValue: "false", premValue: "true", sortOrder: 6 },
      { name: "Picture Based Qs", freeValue: "false", premValue: "true", sortOrder: 7 },
      { name: "Topic-Wise Qs from each Chapter", freeValue: "Limited", premValue: "true", sortOrder: 8 },
      { name: "Assertion & Reason Qs", freeValue: "Limited", premValue: "true", sortOrder: 9 },
      { name: "35 years NEET PYQs", freeValue: "true", premValue: "true", sortOrder: 10 },
      { name: "JEE Mains PYQs", freeValue: "false", premValue: "true", sortOrder: 11 },
    ],
  },
  {
    name: "NEET Aligned Study Material",
    sortOrder: 4,
    features: [
      { name: "Comprehensive HD notes", freeValue: "true", premValue: "true", sortOrder: 1 },
      { name: "Practice Questions from Specific Notes", freeValue: "false", premValue: "true", sortOrder: 2 },
    ],
  },
  {
    name: "Revision and Score Predictor",
    sortOrder: 5,
    features: [
      { name: "Bookmark and Revise Questions", freeValue: "true", premValue: "true", sortOrder: 1 },
      { name: "NEET Score Predictor", freeValue: "false", premValue: "true", sortOrder: 2 },
    ],
  },
  {
    name: "Free Materials & NCERT Corner",
    sortOrder: 6,
    features: [
      { name: "4000 Qs Containing Downloadable DPPs", freeValue: "true", premValue: "true", sortOrder: 1 },
      { name: "NCERT Exemplar Qs", freeValue: "true", premValue: "true", sortOrder: 2 },
      { name: "NCERT Solved Examples", freeValue: "true", premValue: "true", sortOrder: 3 },
      { name: "NCERT very Short, Short & Long QAs", freeValue: "true", premValue: "true", sortOrder: 4 },
    ],
  },
];

async function main() {
  console.log("Seeding subscription features...");
  for (const cat of data) {
    const created = await prisma.subscriptionfeaturecategory.create({
      data: {
        name: cat.name,
        sortOrder: cat.sortOrder,
        features: {
          create: cat.features,
        },
      },
    });
    console.log(`Created category: ${created.name} (id: ${created.id})`);
  }
  console.log("Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
