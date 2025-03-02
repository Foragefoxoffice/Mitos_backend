const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Create portion
const createPortion = async (req, res) => {
  const { name } = req.body;

  try {
    const portion = await prisma.portion.create({
       data: { name } 
      });
    res.status(201).json(portion);
  } catch (error) {
    res.status(500).json({ message: "Error creating portion", error });
  }
};

// Edit portion
const editPortion = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  try {
    const portion = await prisma.portion.update({
      where: { id: parseInt(id) },
      data: { name },
    });
    res.json(portion);
  } catch (error) {
    res.status(500).json({ message: "Error editing portion", error });
  }
};

// Delete portion
const deletePortion = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.portion.delete({ where: { id: parseInt(id) } });
    res.json({ message: "portion deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting portion", error });
  }
};

// Get All portions
const getAllPortions = async (req, res) => {
    try {
      const portions = await prisma.portion.findMany();
      res.json(portions);
    } catch (error) {
      res.status(500).json({ message: "Error fetching portions", error });
    }
  };
  
  // Get portion by ID
  const getPortionById = async (req, res) => {
    const { id } = req.params;
  
    try {
      const portion = await prisma.portion.findUnique({
        where: { id: parseInt(id) },
      });
  
      if (!portion) {
        return res.status(404).json({ message: "portion not found" });
      }
  
      res.json(portion);
    } catch (error) {
      res.status(500).json({ message: "Error fetching portion", error });
    }
  };

module.exports = {
  createPortion,
  editPortion,
  deletePortion,
  getAllPortions,
  getPortionById,
};
