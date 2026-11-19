// A topic counts as completed when the practice session covered at least this
// share of the topic's questions. "Full" practice shows every question; the
// slack only absorbs questions an admin added while the student was mid-session.
const MIN_COVERAGE = 0.9;

/**
 * @param {Map<number, number>} coveredByTopic  topicId -> distinct session questions in that topic
 * @param {Map<number, number>} totalByTopic    topicId -> questions the topic has now
 * @returns {number[]} topic ids the session completed
 */
function completedTopics(coveredByTopic, totalByTopic) {
  const done = [];
  for (const [topicId, total] of totalByTopic) {
    const covered = coveredByTopic.get(topicId) || 0;
    if (total > 0 && covered >= Math.ceil(total * MIN_COVERAGE)) done.push(topicId);
  }
  return done;
}

// 0-100, rounded to 1 decimal; 0 when nothing was answered.
function accuracyPercent(correct, answered) {
  const c = Number(correct);
  const a = Number(answered);
  if (!Number.isFinite(c) || !Number.isFinite(a) || a <= 0 || c < 0) return 0;
  return Math.round((Math.min(c, a) / a) * 1000) / 10;
}

module.exports = { MIN_COVERAGE, completedTopics, accuracyPercent };
