const prisma = require("../utils/prisma");
// controllers/freeMaterialController.js


const path = require("path");
const fs = require("fs");

// ⭐ Admin Upload Free Material (subject + chapter only)
const uploadFreeMaterial = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { title, description, subjectId, chapterId } = req.body;

    if (!title || !subjectId || !chapterId) {
      return res.status(400).json({
        message: "title, subjectId and chapterId are required",
      });
    }

    const newMaterial = await prisma.freematerial.create({
      data: {
        title: title.trim(),
        description: description || null,
        // ✅ Save with /uploads/freematerials/
        fileUrl: "/uploads/freematerials/" + req.file.filename,
        subjectId: Number(subjectId),
        chapterId: Number(chapterId),
      },
    });

    res.status(201).json({
      message: "Free Material uploaded successfully",
      material: newMaterial,
    });
  } catch (error) {
    console.error("Error uploading free material:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// ⭐ Get All by subject
const getFreeMaterialsBySubject = async (req, res) => {
  try {
    const { subjectId } = req.params;

    const materials = await prisma.freematerial.findMany({
      where: { subjectId: Number(subjectId) },
      orderBy: { createdAt: "desc" },
    });

    res.json(materials);
  } catch (error) {
    res.status(500).json({ message: "Error fetching materials", error });
  }
};

// ⭐ Get All by chapter
const getFreeMaterialsByChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;

    const materials = await prisma.freematerial.findMany({
      where: { chapterId: Number(chapterId) },
      orderBy: { createdAt: "desc" },
    });

    res.json(materials);
  } catch (error) {
    res.status(500).json({ message: "Error fetching materials", error });
  }
};

// ⭐ Delete Material
const deleteFreeMaterial = async (req, res) => {
  try {
    const { id } = req.params;

    const material = await prisma.freematerial.findUnique({
      where: { id: Number(id) },
    });

    if (!material) {
      return res.status(404).json({ message: "Material not found" });
    }

    // ✅ Build correct physical path: /uploads/freematerials/<filename>
    const filename = material.fileUrl.split("/").pop();
    const filePath = path.join(__dirname, "..", "uploads", "freematerials", filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.freematerial.delete({ where: { id: Number(id) } });

    res.json({ message: "Material deleted successfully" });
  } catch (error) {
    console.error("Error deleting material:", error);
    res.status(500).json({ message: "Error deleting material", error });
  }
};

// ⭐ Get All Materials
const getAllFreeMaterials = async (req, res) => {
  try {
    const materials = await prisma.freematerial.findMany({
      include: {
        // We might want to include subject/chapter names if needed
        // But the schema doesn't show explicit relations for freematerial, just indexes.
        // Let's check if there are relations in the schema I missed.
      },
      orderBy: { createdAt: "desc" },
    });

    // Since freematerial doesn't have explicit relations in prisma schema (just Int fields),
    // we might need to manually fetch subject and chapter names if the frontend needs them.
    // However, for now, let's just return all materials.
    
    // Actually, I should check if I can add relations to the schema or just join manually.
    // The schema showed:
    // model freematerial {
    //   subjectId   Int
    //   chapterId   Int
    // }
    // It doesn't have `subject subject @relation(...)`
    
    const results = await Promise.all(
      materials.map(async (m) => {
        const subject = await prisma.subject.findUnique({ where: { id: m.subjectId }, select: { name: true } });
        const chapter = await prisma.chapter.findUnique({ where: { id: m.chapterId }, select: { name: true } });
        return {
          ...m,
          subjectName: subject ? subject.name : "Unknown",
          chapterName: chapter ? chapter.name : "Unknown",
        };
      })
    );

    res.json(results);
  } catch (error) {
    console.error("Error fetching all materials:", error);
    res.status(500).json({ message: "Error fetching materials", error });
  }
};

// ⭐ Get chapters that have free materials for a subject
const getChaptersWithFreeMaterials = async (req, res) => {
  try {
    const { subjectId } = req.params;

    const rows = await prisma.freematerial.groupBy({
      by: ['chapterId'],
      where: { subjectId: Number(subjectId) },
      _count: { id: true },
    });

    if (!rows.length) return res.json([]);

    const chapterIds = rows.map(r => r.chapterId);
    const chapters = await prisma.chapter.findMany({
      where: { id: { in: chapterIds } },
      select: { id: true, name: true },
    });

    const countMap = {};
    rows.forEach(r => { countMap[r.chapterId] = r._count.id; });

    const result = chapters.map(c => ({
      id: c.id,
      name: c.name,
      freeMaterialCount: countMap[c.id] ?? 0,
    }));

    res.json(result);
  } catch (error) {
    console.error("Error fetching chapters with free materials:", error);
    res.status(500).json({ message: "Error fetching chapters", error: error.message });
  }
};

module.exports = {
  uploadFreeMaterial,
  getFreeMaterialsBySubject,
  getFreeMaterialsByChapter,
  deleteFreeMaterial,
  getAllFreeMaterials,
  getChaptersWithFreeMaterials,
};
