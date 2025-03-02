const bcrypt = require("bcryptjs");
const { generateToken } = require("../utils/jwt");
const { PrismaClient } = require("@prisma/client");
const { OAuth2Client } = require("google-auth-library"); // For verifying Google ID tokens

const prisma = new PrismaClient();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID); // Initialize the client

const register = async (req, res) => {
  const { email, password, name, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, role },
    });

    const token = generateToken(user);
    res.status(201).json({ user, token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(400).json({ message: "Invalid credentials" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

  const token = generateToken(user);
  res.status(200).json({ user, token, role: user.role });
};


const googleAuth = async (req, res) => {
  const { credential } = req.body;

  try {
    // Verify the Google ID token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture } = payload; // Google provides `picture` as profile image URL

    // Check if the user exists in your database
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Create a new user if they don't exist
      user = await prisma.user.create({
        data: {
          email,
          name,
          profile: picture, // Store Google profile picture
          role: "user",
          phoneNumber: null, // Placeholder, can be updated later
          age: null, // Placeholder
          gender: null, // Placeholder
        },
      });
    }

    // Generate a JWT token
    const token = generateToken(user);
    res.status(200).json({ user, token, role: user.role });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


module.exports = { register, login, googleAuth };