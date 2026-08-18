const prisma = require("../utils/prisma");


const reportWrongQuestion = async (req, res) => {
  const { questionId, reason, sourceType = "mock" } = req.body;
  try {
    const report = await prisma.wrongquestionreport.create({
      data: { questionId, reason, sourceType }
    });
    res.status(201).json(report);
  } catch (err) {
    res.status(400).json({ error: 'Invalid data.' });
  }
};

const getAllReports = async (req, res) => {
  try {
    const reports = await prisma.wrongquestionreport.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching reports.' });
  }
};

const updateReportStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const updated = await prisma.wrongquestionreport.update({
      where: { id: parseInt(id) },
      data: { status }
    });
    res.json(updated);
  } catch (err) {
    res.status(404).json({ error: 'Report not found.' });
  }
};

module.exports = {
  reportWrongQuestion,
  getAllReports,
  updateReportStatus,
};