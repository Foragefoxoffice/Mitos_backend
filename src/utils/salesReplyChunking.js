// Splits one AI reply into the same multi-bubble shape a real person
// texting would send, instead of one long dump — the model already writes
// blank-line-separated paragraphs when a reply has more than one beat
// (see salesAgentPrompt.js), so a blank line is the natural split point.
const MAX_MESSAGE_CHUNKS = 4;

const splitReplyIntoMessages = (text) => {
  const chunks = String(text || "")
    .split(/\n\s*\n/)
    .map((c) => c.trim())
    .filter(Boolean);

  if (chunks.length === 0) return [];
  if (chunks.length <= MAX_MESSAGE_CHUNKS) return chunks;

  // Cap the bubble count rather than let one long reply become a wall of
  // separate messages — fold any overflow back into the last bubble.
  const head = chunks.slice(0, MAX_MESSAGE_CHUNKS - 1);
  const tail = chunks.slice(MAX_MESSAGE_CHUNKS - 1).join("\n\n");
  return [...head, tail];
};

// A rough "how long would a person take to type this" delay, so the gap
// between bubbles scales with how much is in the next one instead of being
// a fixed, obviously-mechanical pause.
const MIN_TYPING_DELAY_MS = 500;
const MAX_TYPING_DELAY_MS = 2200;
const MS_PER_CHAR = 18;

const typingDelayForChunk = (text) =>
  Math.min(MAX_TYPING_DELAY_MS, Math.max(MIN_TYPING_DELAY_MS, String(text || "").length * MS_PER_CHAR));

module.exports = { MAX_MESSAGE_CHUNKS, splitReplyIntoMessages, typingDelayForChunk };
