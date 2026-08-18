const prisma = require("../utils/prisma");
const { PrismaClient } = require('@prisma/client');


const createBanner = async (req, res) => {
  const {
    title,
    redirectUrl,
    isActive,
    platform = "WEB_DESKTOP",
    targetUsers,
    priority = 0,
    startAt,
    endAt,
    section = "HOME",
  } = req.body;

  const image = req.file?.filename;

  let parsedTargetUsers;
  try {
    parsedTargetUsers = targetUsers ? JSON.parse(targetUsers) : ["ALL"];
    if (!Array.isArray(parsedTargetUsers) || parsedTargetUsers.length === 0) {
      parsedTargetUsers = ["ALL"];
    }
  } catch {
    parsedTargetUsers = ["ALL"];
  }

  try {
    const banner = await prisma.bannerupload.create({
      data: {
        title,
        redirectUrl,
        isActive: isActive === 'true' || isActive === true,
        platform,
        targetUsers: parsedTargetUsers,
        priority: Number(priority),
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
        imageUrl: image ? `/uploads/banners/${image}` : null,
        section,
      },
    });

    res.status(201).json(banner);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating banner' });
  }
};

const getAllBanners = async (req, res) => {
  try {
    const { section, targetUser } = req.query;
    const where = {};
    if (section) where.section = section;

    const banners = await prisma.bannerupload.findMany({
      where,
      orderBy: { priority: 'desc' },
    });

    // Only filter by audience when the caller asked for a specific segment
    // (e.g. the mobile app). Admin listing calls this with no targetUser
    // and should keep seeing every banner regardless of audience.
    const filtered = targetUser
      ? banners.filter((b) => {
          const targets = Array.isArray(b.targetUsers) ? b.targetUsers : ['ALL'];
          return targets.includes('ALL') || targets.includes(targetUser);
        })
      : banners;

    res.json(filtered);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching banners' });
  }
};

const getBannerById = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const banner = await prisma.bannerupload.findUnique({ where: { id } });
    if (!banner) return res.status(404).json({ message: 'Banner not found' });
    res.json(banner);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching banner' });
  }
};

const updateBanner = async (req, res) => {
  const id = Number(req.params.id);
  const {
    title,
    redirectUrl,
    isActive,
    platform,
    targetUsers,
    priority,
    startAt,
    endAt,
    section,
  } = req.body;

  const image = req.file?.filename;

  let parsedTargetUsers;
  if (targetUsers !== undefined) {
    try {
      parsedTargetUsers = JSON.parse(targetUsers);
      if (!Array.isArray(parsedTargetUsers) || parsedTargetUsers.length === 0) {
        parsedTargetUsers = ["ALL"];
      }
    } catch {
      parsedTargetUsers = ["ALL"];
    }
  }

  try {
    const updated = await prisma.bannerupload.update({
      where: { id },
      data: {
        title,
        redirectUrl,
        isActive:
          isActive !== undefined ? isActive === 'true' || isActive === true : undefined,
        platform,
        targetUsers: parsedTargetUsers,
        priority: priority !== undefined ? Number(priority) : undefined,
        startAt: startAt ? new Date(startAt) : undefined,
        endAt: endAt ? new Date(endAt) : undefined,
        imageUrl: image ? `/uploads/banners/${image}` : undefined,
        section: section || undefined,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating banner' });
  }
};

const deleteBanner = async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.bannerupload.delete({ where: { id } });
    res.json({ message: 'Banner deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting banner' });
  }
};

module.exports = {
  createBanner,
  getAllBanners,
  getBannerById,
  updateBanner,
  deleteBanner,
};
