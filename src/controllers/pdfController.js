const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
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
    const pdfs = await prisma.pDF.findMany();
    res.json(pdfs);
  } catch (error) {
    res.status(500).json({ message: "Error fetching PDFs", error });
  }
};

// 📄 Fetch PDF by ID
const getPDFById = async (req, res) => {
  try {
    const { id } = req.params;
    const pdf = await prisma.pDF.findUnique({ where: { id: parseInt(id) } });

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
    const pdf = await prisma.pDF.findUnique({ where: { id: parseInt(id) } });

    if (!pdf) {
      return res.status(404).json({ message: "PDF not found" });
    }

    const filePath = path.join(__dirname, "..", "pdfuploads", pdf.filePath.split("/").pop());

    // Delete the file from the server
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await prisma.pDF.delete({ where: { id: parseInt(id) } });

    res.json({ message: "PDF deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting PDF", error });
  }
};

// 📄 Get PDFs by Portion
const getPDFsByPortion = async (req, res) => {
    try {
      const { portionId } = req.params;
      const pdfs = await prisma.pDF.findMany({
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
      const pdfs = await prisma.pDF.findMany({
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
      const pdfs = await prisma.pDF.findMany({
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
      const pdfs = await prisma.pDF.findMany({
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
  
  module.exports = {
    createPDF,
    getAllPDFs,
    getPDFById,
    deletePDF,
    getPDFsByPortion,
    getPDFsBySubject,
    getPDFsByChapter,
    getPDFsByTopic,
  };
  