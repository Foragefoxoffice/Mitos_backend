const prisma = require("../utils/prisma");
const { PrismaClient } = require('@prisma/client');

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Upload content image (for rich text editor)
const uploadContentImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const imageUrl = `/uploads/news/${req.file.filename}`;
    res.status(200).json({
      success: 1,
      file: {
        url: imageUrl,
        // You can add additional metadata here
      }
    });
  } catch (error) {
    console.error('Error uploading content image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

// Process base64 images in content
const processBase64Images = async (content, uploadPath) => {
  const base64Regex = /<img[^>]+src="data:image\/([^;]+);base64,([^"]+)"[^>]*>/g;
  let matches;
  let updatedContent = content;

  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  while ((matches = base64Regex.exec(content)) !== null) {
    const [fullMatch, extension, base64Data] = matches;
    const filename = `img-${uuidv4()}.${extension}`;
    const filePath = path.join(uploadPath, filename);

    fs.writeFileSync(filePath, base64Data, 'base64');

    updatedContent = updatedContent.replace(
      fullMatch,
      `<img src="https://mitoslearning.in/uploads/news/${filename}" class="rich-text-image">`
    );
  }

  return updatedContent;
};

// Create news article
const createNews = async (req, res) => {
  const { title, content } = req.body;
  const image = req.file?.filename;
  const uploadPath = path.join(__dirname, '../../uploads/news');

  try {
    let processedContent = content;
    if (content.includes('data:image')) {
      processedContent = await processBase64Images(content, uploadPath);
    }

    const news = await prisma.news.create({
      data: {
        title,
        content: processedContent,
        image: image ? `https://mitoslearning.in/uploads/news/${image}` : null,
      },
    });

    res.status(201).json(news);
  } catch (error) {
    console.error('Error creating news:', error);
    res.status(500).json({ message: 'Error creating news', error: error.message });
  }
};



const getAllNews = async (req, res) => {
  try {
    const news = await prisma.news.findMany();
    res.json(news);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching news', error });
  }
};

const getNewsById = async (req, res) => {
  const { id } = req.params;
  try {
    const news = await prisma.news.findUnique({ where: { id: parseInt(id) } });
    if (!news) return res.status(404).json({ message: 'News not found' });
    res.json(news);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching news', error });
  }
};

const updateNews = async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;
  const image = req.file?.filename;
  const uploadPath = path.join(__dirname, '../../uploads/news');

  try {
    let processedContent = content;
    if (content.includes('data:image')) {
      processedContent = await processBase64Images(content, uploadPath);
    }

    const updatedNews = await prisma.news.update({
      where: { id: parseInt(id) },
      data: {
        title,
        content: processedContent,
        image: image ? `https://mitoslearning.in/uploads/news/${image}` : undefined,
      },
    });

    res.json(updatedNews);
  } catch (error) {
    console.error('Error updating news:', error);
    res.status(500).json({ message: 'Error updating news', error: error.message });
  }
};

const deleteNews = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.news.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'News deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting news', error });
  }
};

module.exports = {
  createNews,
  getAllNews,
  getNewsById,
  updateNews,
  deleteNews,
  uploadContentImage
};
