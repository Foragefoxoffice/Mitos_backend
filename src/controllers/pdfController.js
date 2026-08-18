const prisma = require("../utils/prisma");


const path = require("path");
const fs = require("fs");

const createPDF = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        console.log("File Uploaded:", req.file);
        console.log("Request Data:", req.body);

        const { portionId, subjectId, chapterId, topicId, name } = req.body;

        if (!portionId || !subjectId || !chapterId || !topicId || !name) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Check if a PDF already exists for this topic
        const existingPDF = await prisma.pdf.findFirst({
            where: { topicId: Number(topicId) },
        });

        let newPDF;

        if (existingPDF) {
            // Update existing PDF entry
            newPDF = await prisma.pdf.update({
                where: { id: existingPDF.id },
                data: {
                    url: "/pdfuploads/" + req.file.filename, // Replace old file
                    name: name.trim(),
                }
            });
        } else {
            // Create new PDF entry
            newPDF = await prisma.pdf.create({
                data: {
                    url: "/pdfuploads/" + req.file.filename,
                    portionId: Number(portionId),
                    subjectId: Number(subjectId),
                    chapterId: Number(chapterId),
                    topicId: Number(topicId),
                    name: name.trim(),
                }
            });
        }

        res.status(201).json({ message: "PDF uploaded successfully", pdf: newPDF });
    } catch (error) {
        console.error("Error in createPDF:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

// 📄 Fetch All PDFs
const getAllPDFs = async (req, res) => {
  try {
    const pdfs = await prisma.pdf.findMany();
    res.json(pdfs);
  } catch (error) {
    res.status(500).json({ message: "Error fetching PDFs", error });
  }
};

// 📄 Fetch PDF by ID
const getPDFById = async (req, res) => {
  try {
    const { id } = req.params;
    const pdf = await prisma.pdf.findUnique({ where: { id: parseInt(id) } });

    if (!pdf) {
      return res.status(404).json({ message: "PDF not found" });
    }

    res.json(pdf);
  } catch (error) {
    res.status(500).json({ message: "Error fetching PDF", error });
  }
};

// 🗑️ Delete PDF
const deletePDF = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Deleting PDF with ID:", id); // Debugging log

    const pdf = await prisma.pdf.findUnique({ where: { id: parseInt(id) } });
    
    if (!pdf) {
      return res.status(404).json({ message: "PDF not found" });
    }

    console.log("PDF found:", pdf); // Debugging log

    const filePath = path.join(__dirname, "..", "pdfuploads", pdf.url.split("/").pop());
    console.log("File path:", filePath); // Debugging log

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("File deleted from server.");
    } else {
      console.log("File not found on server.");
    }

    await prisma.pdf.delete({ where: { id: parseInt(id) } });
    console.log("PDF deleted from database.");

    res.json({ message: "PDF deleted successfully" });
  } catch (error) {
    console.error("Error deleting PDF:", error);
    res.status(500).json({ message: "Error deleting PDF", error });
  }
};

// 📄 Get PDFs by Portion
const getPDFsByPortion = async (req, res) => {
    try {
      const { portionId } = req.params;
      const pdfs = await prisma.pdf.findMany({
        where: { portionId: parseInt(portionId) },
      });
  
      if (pdfs.length === 0) {
        return res.status(404).json({ message: "No PDFs found for this portion" });
      }
  
      res.json(pdfs);
    } catch (error) {
      res.status(500).json({ message: "Error fetching PDFs", error });
    }
  };
  
  // 📄 Get PDFs by Subject
  const getPDFsBySubject = async (req, res) => {
    try {
      const { subjectId } = req.params;
      const pdfs = await prisma.pdf.findMany({
        where: { subjectId: parseInt(subjectId) },
      });
  
      if (pdfs.length === 0) {
        return res.status(404).json({ message: "No PDFs found for this subject" });
      }
  
      res.json(pdfs);
    } catch (error) {
      res.status(500).json({ message: "Error fetching PDFs", error });
    }
  };
  
  // 📄 Get PDFs by Chapter
  const getPDFsByChapter = async (req, res) => {
    try {
      const { chapterId } = req.params;
      const pdfs = await prisma.pdf.findMany({
        where: { chapterId: parseInt(chapterId) },
      });
  
      if (pdfs.length === 0) {
        return res.status(404).json({ message: "No PDFs found for this chapter" });
      }
  
      res.json(pdfs);
    } catch (error) {
      res.status(500).json({ message: "Error fetching PDFs", error });
    }
  };
  
  // 📄 Get PDFs by Topic
  const getPDFsByTopic = async (req, res) => {
    try {
      const { topicId } = req.params;
      const pdfs = await prisma.pdf.findMany({
        where: { topicId: parseInt(topicId) },
      });
  
      if (pdfs.length === 0) {
        return res.status(404).json({ message: "No PDFs found for this topic" });
      }
  
      res.json(pdfs);
    } catch (error) {
      res.status(500).json({ message: "Error fetching PDFs", error });
    }
  };
  
  /**
 * GET /chapters/:chapterId/topics-with-topic-pdfs
 * Returns topics within a chapter that have at least one PDF attached to a topic,
 * and includes only those topic-level PDFs under each topic.
 */
const getTopicsWithTopicPDFsByChapter = async (req, res) => {
  try {
    const chapterId = Number(req.params.chapterId);
    if (Number.isNaN(chapterId)) {
      return res.status(400).json({ message: "Invalid chapterId" });
    }

    const topics = await prisma.topic.findMany({
      where: {
        chapterId,
        // only topics that have at least one topic-level PDF
        // (topicId is implicitly this topic's id in the relation)
        pdf: { some: {} },
      },
      select: {
        id: true,
        name: true,
        isPremium: true,
        pdf: {
          // include only PDFs that are attached to a topic (topicId not null)
          // (optional) If you want to strictly include PDFs flagged as topic-only, add: isOnlyTopic: true
          where: {
            topicId: { not: null },
            // isOnlyTopic: true, // <- uncomment if you want to restrict to “topic-only” PDFs
          },
          select: {
            id: true,
            name: true,
            url: true,
            isOnlyTopic: true,
            isPremium: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    });

    // Filter out any topics that ended up with zero PDFs after the inner where
    const topicsWithPDFs = topics.filter((t) => t.pdf && t.pdf.length > 0);

    if (topicsWithPDFs.length === 0) {
      return res
        .status(404)
        .json({ message: "No topics with PDFs found for this chapter" });
    }

    return res.json({ chapterId, topics: topicsWithPDFs });
  } catch (error) {
    console.error("Error fetching topics with topic PDFs by chapter:", error);
    return res.status(500).json({
      message: "Error fetching topics with topic PDFs by chapter",
      error: error.message,
    });
  }
};
  
  
  // PATCH /pdfs/:id/premium
const updatePdfPremium = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid PDF id" });
    }

    // accept boolean, "true"/"false", 1/0
    let { isPremium } = req.body;
    if (typeof isPremium === "string") {
      isPremium = ["true", "1", "yes", "on"].includes(isPremium.toLowerCase());
    } else if (typeof isPremium === "number") {
      isPremium = isPremium === 1;
    } else if (typeof isPremium !== "boolean") {
      return res.status(400).json({ message: "isPremium must be boolean" });
    }

    const updated = await prisma.pdf.update({
      where: { id },
      data: { isPremium },
    });

    return res.json({
      message: "PDF premium flag updated",
      pdf: updated,
    });
  } catch (error) {
    // Prisma not-found
    if (error.code === "P2025") {
      return res.status(404).json({ message: "PDF not found" });
    }
    console.error("Error updating PDF premium:", error);
    return res
      .status(500)
      .json({ message: "Error updating PDF premium", error: error.message });
  }
};


  module.exports = {
    createPDF,
    getAllPDFs,
    getPDFById,
    deletePDF,
    getPDFsByPortion,
    getPDFsBySubject,
    getPDFsByChapter,
    getPDFsByTopic,
    getTopicsWithTopicPDFsByChapter,
    updatePdfPremium
  };
  