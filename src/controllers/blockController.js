const prisma = require("../utils/prisma");



const blockEntity = async (req, res) => {
  const { type, id, isPremium } = req.body;

  try {
    let updated;

    switch (type) {
      case 'portion':
        updated = await prisma.portion.update({
          where: { id: Number(id) },
          data: { isPremium }
        });
        break;
      case 'subject':
        updated = await prisma.subject.update({
          where: { id: Number(id) },
          data: { isPremium }
        });
        break;
      case 'chapter':
        updated = await prisma.chapter.update({
          where: { id: Number(id) },
          data: { isPremium }
        });
        break;
      case 'topic':
        updated = await prisma.topic.update({
          where: { id: Number(id) },
          data: { isPremium }
        });
        break;
      case 'pdf':
        updated = await prisma.pdf.update({
          where: { id: Number(id) },
          data: { isPremium }
        });
        break;
      default:
        return res.status(400).json({ error: 'Invalid type' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Block Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { blockEntity };