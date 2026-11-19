// YouTube video IDs are exactly 11 chars of [A-Za-z0-9_-].
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/**
 * Extract the 11-char video ID from any common YouTube link form
 * (watch?v=, youtu.be/, /embed/, /shorts/, /live/, /v/) or a bare ID.
 * Returns null for anything that isn't a recognisable YouTube video.
 */
const parseYoutubeId = (input) => {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;
  if (ID_RE.test(raw)) return raw;

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  let id = null;
  if (host === "youtu.be" || host === "www.youtu.be") {
    id = parts[0];
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (parts[0] === "watch") id = url.searchParams.get("v");
    else if (["embed", "shorts", "live", "v"].includes(parts[0])) id = parts[1];
  }
  return id && ID_RE.test(id) ? id : null;
};

const youtubeWatchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;
const youtubeThumbnailUrl = (id) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

module.exports = { parseYoutubeId, youtubeWatchUrl, youtubeThumbnailUrl };
