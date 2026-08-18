const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getSettings = async (req, res) => {
  try {
    const rows = await prisma.appsetting.findMany();
    const settings = {};
    rows.forEach((r) => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch settings" });
  }
};

exports.upsertSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ message: "key and value required" });
    }
    const setting = await prisma.appsetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
    res.json(setting);
  } catch (err) {
    console.error("Failed to save setting:", err);
    res.status(500).json({ message: "Failed to save setting" });
  }
};
