const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Create Subject
const createSubject = async (req, res) => {
  const { name, parentId } = req.body;

  try {
    const subject = await prisma.subject.create({
       data: { name, portionId:parentId } 
      });
    res.status(201).json(subject);
  } catch (error) {
    res.status(500).json({ message: "Error creating subject", error });
  }
};

// Edit Subject
const editSubject = async (req, res) => {
  const { id } = req.params;
  const { name, portionId } = req.body;

  try {
    const subject = await prisma.subject.update({
      where: { id: parseInt(id) },
      data: { name, portionId },
    });
    res.json(subject);
  } catch (error) {
    res.status(500).json({ message: "Error editing subject", error });
  }
};

// Delete Subject
const deleteSubject = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.subject.delete({ where: { id: parseInt(id) } });
    res.json({ message: "Subject deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting subject", error });
  }
};

// Get All Subjects
const getAllSubjects = async (req, res) => {
    try {
      const subjects = await prisma.subject.findMany();
      res.json(subjects);
    } catch (error) {
      res.status(500).json({ message: "Error fetching subjects", error });
    }
  };
  
  // Get Subject by ID
  const getSubjectById = async (req, res) => {
    const { id } = req.params;
  
    try {
      const subject = await prisma.subject.findUnique({
        where: { id: parseInt(id) },
      });
  
      if (!subject) {
        return res.status(404).json({ message: "Subject not found" });
      }
  
      res.json(subject);
    } catch (error) {
      res.status(500).json({ message: "Error fetching subject", error });
    }
  };

  const getSubjectByParentId = async (req, res) => {
    const { portionId } = req.params;
  
    // Ensure portionId is a valid number
    const parsedPortionId = parseInt(portionId, 10);
    if (isNaN(parsedPortionId)) {
      return res.status(400).json({ message: "Invalid portionId" });
    }
  
    try {
      // Fetch subjects using portionId
      const subjects = await prisma.subject.findMany({
        where: { portionId: parsedPortionId },
        select: {
          id: true,
          name: true,
        },
      });
  
      if (subjects.length === 0) {
        return res.status(404).json({ message: "No subjects found for this portionId" });
      }
  
      res.json(subjects);
    } catch (error) {
      console.error("Error fetching subjects:", error);
      res.status(500).json({ message: "Error fetching subjects", error: error.message });
    }
  };
  

module.exports = {
  createSubject,
  editSubject,
  deleteSubject,
  getAllSubjects,
  getSubjectById,
  getSubjectByParentId,
};
