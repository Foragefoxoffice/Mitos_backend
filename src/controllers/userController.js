const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const multer = require("multer");
const path = require("path");

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Ensure this folder exists
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Get All Users
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phoneNumber: true,
        age: true,
        gender: true,
        profile: true,
      },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users", error });
  }
};

// Get User by ID
const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phoneNumber: true,
        age: true,
        gender: true,
        profile: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user", error });
  }
};

// Create a New User
const createUser = async (req, res) => {
  const { name, email, password, role, phoneNumber, age, gender, profile } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "Name, email, password, and role are required" });
  }

  try {
    const newUser = await prisma.user.create({
      data: { name, email, password, role, phoneNumber, age, gender, profile },
    });
    res.status(201).json({ message: "User created successfully", user: newUser });
  } catch (error) {
    res.status(500).json({ message: "Error creating user", error });
  }
};


// Update User Profile (Users can update their own profile)
// Update User Profile
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, phoneNumber, age, gender, password } = req.body;
  const profile = req.file ? `/uploads/${req.file.filename}` : undefined;

  if (req.user.id !== parseInt(id)) {
    return res.status(403).json({ message: "Unauthorized to update this profile" });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        name,
        phoneNumber,
        age: parseInt(age),
        gender,
        ...(profile && { profile }), // Update profile image if uploaded
        ...(password && { password }),
      },
    });

    res.json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Error updating profile", error });
  }
};



// Delete User
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.user.delete({ where: { id: parseInt(id) } });
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting user", error });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const userId = parseInt(req.user.id); // Ensure it's a number

    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }, // Make sure id is an integer
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        age: true,
        gender: true,
        profile: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Error fetching user details", error });
  }
};


module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getCurrentUser,
  upload,
};
