const prisma = require("../utils/prisma");
const { parseYoutubeId, youtubeWatchUrl, youtubeThumbnailUrl } = require("../utils/youtube");

const toBool = (v) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") return ["true", "1", "yes", "on"].includes(v.toLowerCase());
  return undefined;
};

const withThumb = (video) => video && { ...video, thumbnailUrl: youtubeThumbnailUrl(video.youtubeId) };

const topicInclude = {
  topic: {
    select: {
      id: true,
      name: true,
      chapter: { select: { id: true, name: true, subject: { select: { id: true, name: true } } } },
    },
  },
};

// POST /topic-videos — create, or replace the topic's existing video (one per topic)
const upsertTopicVideo = async (req, res) => {
  try {
    const topicId = Number(req.body.topicId);
    if (!Number.isInteger(topicId) || topicId <= 0) {
      return res.status(400).json({ message: "topicId is required" });
    }
    const youtubeId = parseYoutubeId(req.body.youtubeUrl);
    if (!youtubeId) {
      return res.status(400).json({ message: "Enter a valid YouTube video link" });
    }

    const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { id: true, name: true } });
    if (!topic) return res.status(404).json({ message: "Topic not found" });

    const title = String(req.body.title || "").trim() || topic.name;
    const isPremium = toBool(req.body.isPremium);
    const data = {
      title,
      youtubeId,
      youtubeUrl: youtubeWatchUrl(youtubeId),
      ...(isPremium !== undefined ? { isPremium } : {}),
    };

    const existing = await prisma.topicvideo.findUnique({ where: { topicId }, select: { id: true } });
    const video = await prisma.topicvideo.upsert({
      where: { topicId },
      create: { topicId, ...data },
      update: data,
      include: topicInclude,
    });

    return res.status(existing ? 200 : 201).json({
      message: existing ? "Video replaced for this topic" : "Video added",
      replaced: Boolean(existing),
      video: withThumb(video),
    });
  } catch (error) {
    console.error("Error saving topic video:", error);
    return res.status(500).json({ message: "Error saving topic video" });
  }
};

// GET /topic-videos/admin?subjectId=&chapterId= — admin list with topic/chapter/subject names
const getAdminTopicVideos = async (req, res) => {
  try {
    const subjectId = Number(req.query.subjectId) || undefined;
    const chapterId = Number(req.query.chapterId) || undefined;
    const where = {};
    if (chapterId) where.topic = { chapterId };
    else if (subjectId) where.topic = { chapter: { subjectId } };

    const videos = await prisma.topicvideo.findMany({
      where,
      include: topicInclude,
      orderBy: { updatedAt: "desc" },
    });
    return res.json(videos.map(withThumb));
  } catch (error) {
    console.error("Error fetching topic videos:", error);
    return res.status(500).json({ message: "Error fetching topic videos" });
  }
};

// GET /topic-videos/topic/:topicId — { video } (null when the topic has none)
const getTopicVideoByTopic = async (req, res) => {
  try {
    const topicId = Number(req.params.topicId);
    if (!Number.isInteger(topicId)) return res.status(400).json({ message: "Invalid topicId" });
    const video = await prisma.topicvideo.findUnique({ where: { topicId } });
    return res.json({ video: withThumb(video) });
  } catch (error) {
    console.error("Error fetching topic video:", error);
    return res.status(500).json({ message: "Error fetching topic video" });
  }
};

// GET /topic-videos/chapter/:chapterId — videos for every topic in a chapter
const getTopicVideosByChapter = async (req, res) => {
  try {
    const chapterId = Number(req.params.chapterId);
    if (!Number.isInteger(chapterId)) return res.status(400).json({ message: "Invalid chapterId" });
    const videos = await prisma.topicvideo.findMany({
      where: { topic: { chapterId } },
      include: { topic: { select: { id: true, name: true } } },
      orderBy: { topic: { name: "asc" } },
    });
    return res.json(videos.map(withThumb));
  } catch (error) {
    console.error("Error fetching chapter topic videos:", error);
    return res.status(500).json({ message: "Error fetching chapter topic videos" });
  }
};

// PATCH /topic-videos/:id — edit title / link / premium flag
const updateTopicVideo = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });

    const data = {};
    if (req.body.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) return res.status(400).json({ message: "Title cannot be empty" });
      data.title = title;
    }
    if (req.body.youtubeUrl !== undefined) {
      const youtubeId = parseYoutubeId(req.body.youtubeUrl);
      if (!youtubeId) return res.status(400).json({ message: "Enter a valid YouTube video link" });
      data.youtubeId = youtubeId;
      data.youtubeUrl = youtubeWatchUrl(youtubeId);
    }
    if (req.body.isPremium !== undefined) {
      const isPremium = toBool(req.body.isPremium);
      if (isPremium === undefined) return res.status(400).json({ message: "isPremium must be boolean" });
      data.isPremium = isPremium;
    }
    if (!Object.keys(data).length) return res.status(400).json({ message: "Nothing to update" });

    const video = await prisma.topicvideo.update({ where: { id }, data, include: topicInclude });
    return res.json({ message: "Video updated", video: withThumb(video) });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Video not found" });
    console.error("Error updating topic video:", error);
    return res.status(500).json({ message: "Error updating topic video" });
  }
};

// DELETE /topic-videos/:id
const deleteTopicVideo = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    await prisma.topicvideo.delete({ where: { id } });
    return res.json({ message: "Video deleted" });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Video not found" });
    console.error("Error deleting topic video:", error);
    return res.status(500).json({ message: "Error deleting topic video" });
  }
};

module.exports = {
  upsertTopicVideo,
  getAdminTopicVideos,
  getTopicVideoByTopic,
  getTopicVideosByChapter,
  updateTopicVideo,
  deleteTopicVideo,
};
