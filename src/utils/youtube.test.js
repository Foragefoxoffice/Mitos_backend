const { parseYoutubeId, youtubeWatchUrl, youtubeThumbnailUrl } = require("./youtube");

const ID = "dQw4w9WgXcQ";

describe("parseYoutubeId", () => {
  test.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s&list=PL123`,
    `https://m.youtube.com/watch?v=${ID}`,
    `www.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abcDEF123`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}?rel=0`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}?feature=share`,
    `  ${ID}  `,
  ])("parses %s", (input) => {
    expect(parseYoutubeId(input)).toBe(ID);
  });

  test.each([
    undefined,
    "",
    "not a url",
    "https://vimeo.com/123456789",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/channel/UCabcdefghijklmnop",
    "https://www.youtube.com/playlist?list=PL123",
    `https://evil.com/watch?v=${ID}`,
    `https://youtube.com.evil.com/watch?v=${ID}`,
  ])("rejects %s", (input) => {
    expect(parseYoutubeId(input)).toBeNull();
  });
});

test("url helpers", () => {
  expect(youtubeWatchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
  expect(youtubeThumbnailUrl(ID)).toBe(`https://img.youtube.com/vi/${ID}/hqdefault.jpg`);
});
